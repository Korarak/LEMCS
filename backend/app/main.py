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

    # Migrate existing DB: add new RBAC columns if they don't exist
    from sqlalchemy import text as sa_text
    try:
        async with engine.begin() as conn:
            await conn.execute(sa_text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS affiliation_id INTEGER REFERENCES affiliations(id)"
            ))
            await conn.execute(sa_text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS district_id INTEGER REFERENCES districts(id)"
            ))
    except Exception as e:
        print(f"[Migration] Column migration skipped or already applied: {e}")
        
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
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(assessments.router, prefix="/api/assessments", tags=["assessments"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])

# For metrics
Instrumentator().instrument(app).expose(app)

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "lemcs-api"}
