from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.middleware.rate_limit import RateLimitMiddleware
from app.routers import auth
from prometheus_fastapi_instrumentator import Instrumentator

from contextlib import asynccontextmanager
from app.database import engine
from app.models.db_models import Base

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-create tables on startup (for fresh DBs).
    # Catch IntegrityError: with --workers > 1, multiple workers race to create tables;
    # the loser gets a pg_type duplicate-key error which is safe to ignore.
    from sqlalchemy.exc import IntegrityError
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except IntegrityError:
        pass  # Another worker already created the tables

    # Migrate existing DB: each migration in its own transaction so failures are isolated
    from sqlalchemy import text as sa_text

    _migrations = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS affiliation_id INTEGER REFERENCES affiliations(id)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS district_id INTEGER REFERENCES districts(id)",
        "ALTER TABLE assessments ADD COLUMN IF NOT EXISTS filled_by_user_id UUID REFERENCES users(id)",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS title TEXT",
        # Survey Round feature — table must be created before the FK column on assessments
        """CREATE TABLE IF NOT EXISTS survey_rounds (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            label TEXT NOT NULL,
            academic_year TEXT NOT NULL,
            term INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'open',
            opened_at TIMESTAMPTZ DEFAULT now(),
            closed_at TIMESTAMPTZ,
            created_by UUID REFERENCES users(id)
        )""",
        "ALTER TABLE assessments ADD COLUMN IF NOT EXISTS survey_round_id UUID REFERENCES survey_rounds(id)",
        "ALTER TABLE assessments ADD COLUMN IF NOT EXISTS grade_snapshot TEXT",
        "ALTER TABLE assessments ADD COLUMN IF NOT EXISTS classroom_snapshot TEXT",
        "ALTER TABLE survey_rounds ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ",
        "ALTER TABLE affiliations ADD COLUMN IF NOT EXISTS abbreviation TEXT",
        "UPDATE affiliations SET abbreviation = 'สอศ.' WHERE name ILIKE '%อาชีวศึกษา%' AND abbreviation IS NULL",
        "UPDATE affiliations SET abbreviation = 'สพฐ.' WHERE name ILIKE '%การศึกษาขั้นพื้นฐาน%' AND abbreviation IS NULL",
        "UPDATE affiliations SET abbreviation = 'สช.'  WHERE name ILIKE '%เอกชน%' AND abbreviation IS NULL",
        "UPDATE affiliations SET abbreviation = 'สกร.' WHERE name ILIKE '%ส่งเสริมการเรียนรู้%' AND abbreviation IS NULL",
        "ALTER TABLE schools ADD COLUMN IF NOT EXISTS affiliation_id INTEGER REFERENCES affiliations(id)",
        # backfill: โรงเรียน สกร. ที่สร้างก่อนมี affiliation_id → ตั้งค่าจาก affiliations
        """UPDATE schools SET affiliation_id = (
            SELECT id FROM affiliations WHERE name ILIKE '%สกร%' LIMIT 1
        ) WHERE school_type = 'สกร.' AND affiliation_id IS NULL
          AND EXISTS (SELECT 1 FROM affiliations WHERE name ILIKE '%สกร%')""",
        # backfill: เชื่อม district_id ให้โรงเรียน สกร. ที่ยังไม่มี
        # จับคู่ด้วย: ชื่ออำเภอในชื่อโรงเรียน (หลัง "อำเภอ") ↔ ชื่อ district (ILIKE)
        """UPDATE schools s
           SET district_id = (
               SELECT d.id FROM districts d
               WHERE d.affiliation_id = s.affiliation_id
                 AND d.name ILIKE '%' || SUBSTRING(s.name FROM 'อำเภอ(.+)') || '%'
               LIMIT 1
           )
           WHERE s.school_type = 'สกร.'
             AND s.district_id IS NULL
             AND s.affiliation_id IS NOT NULL
             AND SUBSTRING(s.name FROM 'อำเภอ(.+)') IS NOT NULL""",
    ]
    for _sql in _migrations:
        try:
            async with engine.begin() as conn:
                await conn.execute(sa_text(_sql))
        except Exception as e:
            print(f"[Migration] Skipped (already applied or error): {e}")
        
    # Seed a test student for Phase 1 OTP testing
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.database import AsyncSessionLocal
    from app.models.db_models import Student, User
    from sqlalchemy import select
    
    from datetime import date
    from app.services.encryption import hash_pii, encrypt_pii
    
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Student).where(Student.student_code == "12345"))
        student = result.scalar_one_or_none()
        if not student:
            # Fake ID: 1234567890123, DOB: 2000-01-01
            test_student = Student(
                student_code="12345", 
                first_name="ทดสอบ", 
                last_name="นักเรียน", 
                birthdate=date(2000, 1, 1),
                national_id=encrypt_pii("1234567890123"),
                national_id_hash=hash_pii("1234567890123"),
                is_active=True
            )
            session.add(test_student)
            await session.commit()
            
            test_user = User(student_id=test_student.id, username="student12345", role="student", is_active=True)
            session.add(test_user)
            await session.commit()
            
        # Seed a test admin for Phase 4 Dashboard access
        import bcrypt
        
        admin_result = await session.execute(select(User).where(User.username == "admin"))
        admin_user = admin_result.scalar_one_or_none()
        if not admin_user:
            hashed = bcrypt.hashpw("password123".encode(), bcrypt.gensalt()).decode()
            admin_user = User(
                username="admin",
                hashed_password=hashed,
                role="systemadmin",
                is_active=True
            )
            session.add(admin_user)
            await session.commit()
            
    yield

app = FastAPI(
    title="LEMCS API",
    description="Loei Educational MindCare System",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    lifespan=lifespan,
)

# CORS
_cors_origins = [
    settings.FRONTEND_URL,                        # prod/staging domain from env
    "https://lemcs.loeitech.ac.th",               # production
    "https://dev.lemcs.loeitech.ac.th",           # staging
    "http://localhost:3000",                       # local Next.js dev server
    "http://127.0.0.1:3000",
    "http://localhost:3100",                       # staging container port
    "http://127.0.0.1:3100",
    "http://localhost:6300",                       # local dev (alt port)
    "http://127.0.0.1:6300",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting (100 req/min per IP)
app.add_middleware(RateLimitMiddleware, max_requests=100, window_seconds=60)

# Routers
from app.routers import auth, assessments, reports, alerts, admin
from app.routers import survey_rounds
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(assessments.router, prefix="/api/assessments", tags=["assessments"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(survey_rounds.router, prefix="/api/survey-rounds", tags=["survey-rounds"])

# For metrics
Instrumentator().instrument(app).expose(app)

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "lemcs-api"}
