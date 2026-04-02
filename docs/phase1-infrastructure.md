# Phase 1 — Infrastructure & Authentication
## LEMCS Developer Guide

> ก่อนอ่านไฟล์นี้: อ่าน `LEMCS_DEV.md` ที่ root ก่อน (ข้อมูล schema, env, scoring อยู่ที่นั่น)

---

## เป้าหมายของ Phase 1

สิ่งที่ต้องสร้างให้ครบใน Phase นี้:
- [x] `docker-compose.yml` — ทุก service พร้อม health check
- [x] `.env.example` — ทุก env var พร้อม comment
- [x] Database schema + Alembic migrations
- [x] FastAPI skeleton + middleware
- [x] JWT Auth endpoints (login + OTP + refresh)
- [x] Next.js skeleton + DaisyUI + หน้า login

---

## ขั้นตอน 1: สร้าง docker-compose.yml

สร้างไฟล์ `lemcs/docker-compose.yml` ตามนี้:

```yaml
version: "3.9"

services:
  # ───────────────────────────────────────────
  # Frontend — Next.js 14 PWA
  # ───────────────────────────────────────────
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=${API_BASE_URL}
    restart: unless-stopped
    depends_on:
      backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "-O-", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ───────────────────────────────────────────
  # Backend — FastAPI
  # ───────────────────────────────────────────
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    env_file: .env
    depends_on:
      pgbouncer:
        condition: service_started
      redis:
        condition: service_healthy
    restart: unless-stopped
    deploy:
      replicas: 1    # เพิ่มเป็น 4 ใน production
    command: >
      uvicorn app.main:app
      --host 0.0.0.0
      --port 8000
      --workers 4
      --loop uvloop
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ───────────────────────────────────────────
  # Database — PostgreSQL 16
  # ───────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./backend/init.sql:/docker-entrypoint-initdb.d/init.sql
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ───────────────────────────────────────────
  # Connection Pooler — PgBouncer
  # ───────────────────────────────────────────
  pgbouncer:
    image: bitnami/pgbouncer:latest
    environment:
      POSTGRESQL_HOST: postgres
      POSTGRESQL_PORT: 5432
      POSTGRESQL_DATABASE: ${POSTGRES_DB}
      POSTGRESQL_USERNAME: ${POSTGRES_USER}
      POSTGRESQL_PASSWORD: ${POSTGRES_PASSWORD}
      PGBOUNCER_POOL_MODE: transaction        # ← ต้องเป็น transaction
      PGBOUNCER_MAX_CLIENT_CONN: 1000
      PGBOUNCER_DEFAULT_POOL_SIZE: 50
    ports:
      - "5432:5432"
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  # ───────────────────────────────────────────
  # Cache — Redis 7
  # ───────────────────────────────────────────
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redisdata:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

  # ───────────────────────────────────────────
  # Object Storage — MinIO
  # ───────────────────────────────────────────
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    volumes:
      - miniodata:/data
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    ports:
      - "9000:9000"
      - "9001:9001"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ───────────────────────────────────────────
  # Monitoring — Prometheus
  # ───────────────────────────────────────────
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheusdata:/prometheus
    restart: unless-stopped

  # ───────────────────────────────────────────
  # Monitoring — Grafana
  # ───────────────────────────────────────────
  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafanadata:/var/lib/grafana
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD:-admin}
    ports:
      - "3001:3000"
    depends_on:
      - prometheus
    restart: unless-stopped

volumes:
  pgdata:
  redisdata:
  miniodata:
  prometheusdata:
  grafanadata:
```

---

## ขั้นตอน 2: Backend — FastAPI Skeleton

### โครงสร้างโฟลเดอร์

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── deps.py
│   ├── middleware/
│   │   ├── tenant.py
│   │   └── rate_limit.py
│   ├── routers/
│   │   ├── auth.py
│   │   ├── students.py
│   │   ├── assessments.py
│   │   ├── reports.py
│   │   ├── alerts.py
│   │   └── admin.py
│   ├── services/
│   │   ├── scoring/
│   │   │   ├── st5.py
│   │   │   ├── phqa.py
│   │   │   └── cdi.py
│   │   ├── alert_service.py
│   │   ├── notification_service.py
│   │   ├── export_service.py
│   │   └── tenant_provisioning.py
│   ├── models/
│   │   └── db_models.py
│   └── schemas/
│       ├── auth.py
│       ├── assessment.py
│       └── report.py
├── alembic/
├── tests/
├── Dockerfile
└── requirements.txt
```

### app/main.py

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.middleware.rate_limit import RateLimitMiddleware
from app.routers import auth, students, assessments, reports, alerts, admin

app = FastAPI(
    title="LEMCS API",
    description="Loei Educational MindCare System",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,  # ปิด docs ใน production
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting (100 req/min per IP)
app.add_middleware(RateLimitMiddleware, max_requests=100, window_seconds=60)

# Routers
app.include_router(auth.router,        prefix="/api/auth",        tags=["auth"])
app.include_router(students.router,    prefix="/api/students",    tags=["students"])
app.include_router(assessments.router, prefix="/api/assessments", tags=["assessments"])
app.include_router(reports.router,     prefix="/api/reports",     tags=["reports"])
app.include_router(alerts.router,      prefix="/api/alerts",      tags=["alerts"])
app.include_router(admin.router,       prefix="/api/admin",       tags=["admin"])

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "lemcs-api"}
```

### app/config.py

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database
    POSTGRES_HOST: str
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str

    # Redis
    REDIS_URL: str

    # JWT
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # MinIO
    MINIO_ENDPOINT: str
    MINIO_ACCESS_KEY: str
    MINIO_SECRET_KEY: str

    # LINE / SMS / SMTP
    LINE_NOTIFY_TOKEN: str = ""
    SMS_API_KEY: str = ""
    SMS_API_URL: str = ""
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""

    # Encryption
    ENCRYPTION_KEY: str  # ต้องยาวพอดี 32 bytes สำหรับ AES-256

    # App
    ENVIRONMENT: str = "production"
    DEBUG: bool = False
    FRONTEND_URL: str

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    class Config:
        env_file = ".env"

settings = Settings()
```

### app/database.py

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=20,
    max_overflow=40,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=settings.DEBUG,
)

AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

---

## ขั้นตอน 3: Auth Endpoints

### JWT Login Flow (Student Login)

เพื่อความปลอดภัยสูงขึ้น ระบบล็อกอินปัจจุบันกำหนดให้นักเรียนต้องยืนยันตัวตนด้วยปัจจัย 3 ประการ:
1. `national_id` (เลขบัตรประจำตัวประชาชน 13 หลัก)
2. `birthdate` (วัน/เดือน/ปีเกิด)
3. `student_code` (รหัสประจำตัวนักเรียน เพื่อป้องกันผู้อื่นรู้เลขบัตร+วันเกิด)

Flow การทำงาน (ในโหมดปกติที่มี OTP):
```
1. POST /api/auth/otp/request   → ส่งข้อมูล {national_id, birthdate, student_code} 
                                  → ระบบเช็คว่าตรงกันหรือไม่ → ส่ง OTP ทาง SMS ไปที่เบอร์ที่ผูกไว้
2. POST /api/auth/otp/verify    → ตรวจ OTP → return {access_token, refresh_token}
3. ทุก request ต้องใส่ header: Authorization: Bearer {access_token}
4. POST /api/auth/refresh       → ใช้ refresh_token ขอ access_token ใหม่
```

> **หมายเหตุช่วง Development (Phase 1-2):**
> สามารถเรียกใช้ `/api/auth/login/bypass` โดยส่ง `{national_id, birthdate, student_code}` ไปเพื่อรับ `access_token` ทันที ไม่ต้องรอเลขอ้างอิง OTP

### app/routers/auth.py (โครงสร้างหลัก)

```python
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.auth import LoginRequest, OTPRequest, OTPVerifyRequest, TokenResponse
from app.services.auth_service import (
    request_otp, verify_otp, create_tokens, refresh_access_token
)

router = APIRouter()

@router.post("/otp/request")
async def request_login_otp(body: OTPRequest, db: AsyncSession = Depends(get_db)):
    """ส่ง OTP ทาง SMS ไปยังเบอร์โทรที่ลงทะเบียนไว้"""
    await request_otp(db, body.student_code)
    return {"message": "ส่ง OTP แล้ว"}

@router.post("/otp/verify", response_model=TokenResponse)
async def verify_login_otp(body: OTPVerifyRequest, db: AsyncSession = Depends(get_db)):
    """ตรวจสอบ OTP และออก JWT tokens"""
    user = await verify_otp(db, body.student_code, body.otp)
    if not user:
        raise HTTPException(status_code=401, detail="OTP ไม่ถูกต้องหรือหมดอายุ")
    tokens = await create_tokens(user)
    return tokens

@router.post("/login", response_model=TokenResponse)
async def login_with_password(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login ด้วย student_code + password (สำหรับ admin/teacher)"""
    # implement password verification
    ...

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(refresh_token: str, db: AsyncSession = Depends(get_db)):
    tokens = await refresh_access_token(refresh_token)
    return tokens
```

### OTP Flow ด้วย Redis

```python
# backend/app/services/auth_service.py
import random
import redis.asyncio as aioredis
from app.config import settings

redis_client = aioredis.from_url(settings.REDIS_URL)

async def request_otp(db, student_code: str):
    # 1. ตรวจสอบว่า student มีในระบบ
    student = await get_student_by_code(db, student_code)
    if not student:
        raise HTTPException(404, "ไม่พบรหัสนักเรียนในระบบ")

    # 2. สร้าง OTP 6 หลัก
    otp = str(random.randint(100000, 999999))

    # 3. บันทึกใน Redis (หมดอายุใน 5 นาที)
    await redis_client.setex(
        f"otp:{student_code}",
        300,   # 5 minutes
        otp
    )

    # 4. ส่ง SMS
    await send_sms(student.phone_number, f"รหัส OTP: {otp} (หมดอายุใน 5 นาที)")

async def verify_otp(db, student_code: str, otp: str) -> Student | None:
    stored_otp = await redis_client.get(f"otp:{student_code}")
    if stored_otp and stored_otp.decode() == otp:
        await redis_client.delete(f"otp:{student_code}")  # ใช้ได้ครั้งเดียว
        return await get_student_by_code(db, student_code)
    return None
```

### Rate Limiting Middleware

```python
# backend/app/middleware/rate_limit.py
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
import redis.asyncio as aioredis
from app.config import settings

redis_client = aioredis.from_url(settings.REDIS_URL)

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int = 100, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    async def dispatch(self, request: Request, call_next):
        ip = request.client.host
        key = f"ratelimit:{ip}"

        current = await redis_client.incr(key)
        if current == 1:
            await redis_client.expire(key, self.window_seconds)

        if current > self.max_requests:
            return JSONResponse(
                status_code=429,
                content={"detail": "มีการส่งคำขอมากเกินไป กรุณาลองใหม่ภายหลัง"}
            )
        return await call_next(request)
```

---

## ขั้นตอน 4: AES-256 Encryption สำหรับ national_id

```python
# backend/app/services/encryption.py
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import base64
import os
from app.config import settings

def encrypt_pii(plaintext: str) -> str:
    """เข้ารหัส national_id ก่อนบันทึก"""
    key = settings.ENCRYPTION_KEY.encode()[:32]  # AES-256 = 32 bytes
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode(), None)
    # return: base64(nonce + ciphertext)
    return base64.b64encode(nonce + ciphertext).decode()

def decrypt_pii(encrypted: str) -> str:
    """ถอดรหัส national_id เมื่อต้องการใช้"""
    key = settings.ENCRYPTION_KEY.encode()[:32]
    aesgcm = AESGCM(key)
    data = base64.b64decode(encrypted)
    nonce, ciphertext = data[:12], data[12:]
    return aesgcm.decrypt(nonce, ciphertext, None).decode()
```

---

## ขั้นตอน 5: requirements.txt

```txt
fastapi==0.115.0
uvicorn[standard]==0.30.0
uvloop==0.19.0
sqlalchemy[asyncio]==2.0.35
asyncpg==0.29.0
alembic==1.13.0
pydantic==2.8.0
pydantic-settings==2.4.0
redis[hiredis]==5.0.8
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
httpx==0.27.0
cryptography==43.0.0
minio==7.2.8
weasyprint==62.3
openpyxl==3.1.5
celery==5.4.0
prometheus-fastapi-instrumentator==7.0.0
```

---

## ขั้นตอน 6: Next.js Skeleton

```bash
# สร้าง Next.js project
cd lemcs
npx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"

cd frontend
npm install daisyui@latest
npm install next-pwa
npm install axios swr
npm install @tanstack/react-query
```

### tailwind.config.ts

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        lemcs: {
          "primary": "#3B82F6",      // น้ำเงิน
          "secondary": "#8B5CF6",    // ม่วง
          "accent": "#10B981",       // เขียว
          "neutral": "#374151",
          "base-100": "#FFFFFF",
          "info": "#06B6D4",
          "success": "#10B981",
          "warning": "#F59E0B",
          "error": "#EF4444",
        },
      },
      "dark",
    ],
    defaultTheme: "lemcs",
  },
};
export default config;
```

### app/layout.tsx

```typescript
import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "LEMCS — ระบบประเมินสุขภาพจิตนักเรียน จ.เลย",
  description: "ระบบสำรวจและประเมินความเครียดและภาวะซึมเศร้าในนักเรียน จ.เลย",
  manifest: "/manifest.json",
  themeColor: "#3B82F6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" data-theme="lemcs">
      <body className={notoSansThai.className}>{children}</body>
    </html>
  );
}
```

---

## ขั้นตอน 7: Dockerfiles

### backend/Dockerfile

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install system deps for WeasyPrint + pg_dump
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    libcairo2 \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### frontend/Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

> ⚠️ frontend ต้องเปิด `output: 'standalone'` ใน `next.config.js`:
> ```javascript
> module.exports = withPWA({ reactStrictMode: true, output: 'standalone' });
> ```

---

## ขั้นตอน 8: SQLAlchemy ORM Models

### backend/app/models/db_models.py

```python
import uuid
from datetime import datetime, date
from sqlalchemy import (
    Column, String, Integer, Boolean, Text, Date,
    ForeignKey, JSON, DateTime, func
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import DeclarativeBase, relationship

class Base(DeclarativeBase):
    pass

class Affiliation(Base):
    __tablename__ = "affiliations"
    id = Column(Integer, primary_key=True)
    name = Column(Text, nullable=False)

class District(Base):
    __tablename__ = "districts"
    id = Column(Integer, primary_key=True)
    name = Column(Text, nullable=False)
    affiliation_id = Column(Integer, ForeignKey("affiliations.id"))

class School(Base):
    __tablename__ = "schools"
    id = Column(Integer, primary_key=True)
    name = Column(Text, nullable=False)
    district_id = Column(Integer, ForeignKey("districts.id"))
    school_type = Column(Text)

class Student(Base):
    __tablename__ = "students"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_code = Column(Text, unique=True, nullable=False)
    national_id = Column(Text)        # AES-256 encrypted
    first_name = Column(Text, nullable=False)
    last_name = Column(Text, nullable=False)
    gender = Column(Text)
    birthdate = Column(Date)
    grade = Column(Text)
    classroom = Column(Text)
    school_id = Column(Integer, ForeignKey("schools.id"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    school = relationship("School")

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=True)
    username = Column(Text, unique=True)
    hashed_password = Column(Text)
    role = Column(Text, nullable=False)
    school_id = Column(Integer, ForeignKey("schools.id"))
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime(timezone=True))

    student = relationship("Student")
    school = relationship("School")

class Assessment(Base):
    __tablename__ = "assessments"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    assessment_type = Column(Text, nullable=False)
    responses = Column(JSONB, nullable=False)
    score = Column(Integer, nullable=False)
    severity_level = Column(Text, nullable=False)
    suicide_risk = Column(Boolean, default=False)
    academic_year = Column(Text)
    term = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("Student")

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"))
    assessment_id = Column(UUID(as_uuid=True), ForeignKey("assessments.id"))
    alert_level = Column(Text)
    status = Column(Text, default="new")
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    note = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    student = relationship("Student")
    assessment = relationship("Assessment")
    assignee = relationship("User", foreign_keys=[assigned_to])

class Notification(Base):
    """In-app notifications สำหรับ admin dashboard"""
    __tablename__ = "notifications"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(Text, nullable=False)
    message = Column(Text, nullable=False)
    link = Column(Text)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class AuditLog(Base):
    """Audit log สำหรับการเข้าถึงข้อมูล"""
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    action = Column(Text, nullable=False)
    resource = Column(Text)
    details = Column(JSONB)
    ip_address = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

---

## ขั้นตอน 9: FastAPI Dependencies (deps.py)

### backend/app/deps.py

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.config import settings
from app.models.db_models import User, Student

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """ดึง user จาก JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="ไม่สามารถยืนยันตัวตนได้",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise credentials_exception
    return user

async def get_current_student(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Student:
    """ตรวจสอบว่า user เป็นนักเรียน และดึง Student object"""
    if current_user.role != "student":
        raise HTTPException(403, "เฉพาะนักเรียนเท่านั้น")
    result = await db.execute(select(Student).where(Student.id == current_user.student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(404, "ไม่พบข้อมูลนักเรียน")
    return student

async def get_current_admin_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """ตรวจสอบว่า user เป็น admin ระดับใดระดับหนึ่ง"""
    admin_roles = {"teacher", "counselor", "school_admin", "district_admin", "province_admin", "superadmin"}
    if current_user.role not in admin_roles:
        raise HTTPException(403, "ไม่มีสิทธิ์เข้าถึง")
    return current_user

def require_role(*allowed_roles: str):
    """Dependency สำหรับ check role เฉพาะ"""
    async def _check(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(403, f"ต้องการ role: {', '.join(allowed_roles)}")
        return current_user
    return _check
```

---

## ขั้นตอน 10: JWT Token Creation

### backend/app/services/auth_service.py (เพิ่มเติม)

```python
from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

async def create_tokens(user) -> dict:
    """สร้าง access + refresh token"""
    access_payload = {
        "sub": str(user.id),
        "role": user.role,
        "school_id": user.school_id,
        "exp": datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    refresh_payload = {
        "sub": str(user.id),
        "type": "refresh",
        "exp": datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    }
    return {
        "access_token": jwt.encode(access_payload, settings.SECRET_KEY, algorithm="HS256"),
        "refresh_token": jwt.encode(refresh_payload, settings.SECRET_KEY, algorithm="HS256"),
        "token_type": "bearer",
    }

async def refresh_access_token(refresh_token: str) -> dict:
    """ใช้ refresh token ขอ access token ใหม่"""
    try:
        payload = jwt.decode(refresh_token, settings.SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") != "refresh":
            raise ValueError("ไม่ใช่ refresh token")
        # สร้าง access token ใหม่ (ไม่ต้องสร้าง refresh ใหม่)
        new_access = {
            "sub": payload["sub"],
            "role": payload.get("role", "student"),
            "exp": datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        }
        return {
            "access_token": jwt.encode(new_access, settings.SECRET_KEY, algorithm="HS256"),
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }
    except Exception:
        raise HTTPException(401, "Refresh token ไม่ถูกต้องหรือหมดอายุ")
```

### Pydantic Auth Schemas

```python
# backend/app/schemas/auth.py
from pydantic import BaseModel

class LoginRequest(BaseModel):
    student_code: str
    password: str

class OTPRequest(BaseModel):
    student_code: str

class OTPVerifyRequest(BaseModel):
    student_code: str
    otp: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
```

---

## ขั้นตอน 11: Alembic Setup

```bash
cd backend
pip install alembic
alembic init alembic
```

### alembic/env.py (แก้ไข)

```python
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context
from app.config import settings
from app.models.db_models import Base   # ← import Base ที่มี ORM models

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline():
    context.configure(url=settings.DATABASE_URL, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online():
    connectable = create_async_engine(settings.DATABASE_URL, poolclass=pool.NullPool)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()

import asyncio
if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
```

### สร้าง migration แรก

```bash
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

---

## ขั้นตอน 12: Database Init Script

### backend/init.sql

```sql
-- รันอัตโนมัติเมื่อ postgres container เริ่มครั้งแรก
-- สร้าง extensions ที่จำเป็น

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- สร้าง partition tables สำหรับ assessments
-- (ถ้าใช้ Alembic อาจข้ามส่วนนี้ได้)
```

---

## ขั้นตอน 13: Monitoring (prometheus.yml)

### monitoring/prometheus.yml

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: "lemcs-api"
    metrics_path: /metrics
    static_configs:
      - targets: ["backend:8000"]
        labels:
          service: "fastapi"

  - job_name: "postgres"
    static_configs:
      - targets: ["postgres:5432"]

  - job_name: "redis"
    static_configs:
      - targets: ["redis:6379"]
```

> ⚠️ ต้องเพิ่ม `prometheus-fastapi-instrumentator` ใน `main.py`:
> ```python
> from prometheus_fastapi_instrumentator import Instrumentator
> Instrumentator().instrument(app).expose(app)
> ```

---

## ขั้นตอน 14: Nginx Proxy Manager Settings

```
# ตั้งค่าใน Nginx Proxy Manager UI:

# 1. Frontend (tenant)
Domain:        loei.lemcs.app
Forward Host:  frontend
Forward Port:  3000
Block Exploits: ✅
SSL:           Let's Encrypt ✅

# 2. Backend API
Domain:        api.lemcs.app
Forward Host:  backend
Forward Port:  8000
Block Exploits: ✅
SSL:           Let's Encrypt ✅
Custom Nginx:
  location / {
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;
    proxy_pass http://backend:8000;
  }

# 3. Grafana
Domain:        grafana.lemcs.app
Forward Host:  grafana
Forward Port:  3000
SSL:           Let's Encrypt ✅

# 4. MinIO Console
Domain:        minio.lemcs.app
Forward Host:  minio
Forward Port:  9001
SSL:           Let's Encrypt ✅
```

---

## Checklist Phase 1 (ต้องผ่านก่อนไป Phase 2)

- [ ] `docker-compose up` ทุก service healthy
- [ ] `GET /health` return `{"status": "ok"}`
- [ ] `GET /metrics` return Prometheus metrics
- [ ] Login ด้วย student_code + OTP สำเร็จ → ได้ JWT token
- [ ] JWT token มี payload: `{sub: user_id, role: "student", school_id: 1}`
- [ ] Refresh token ทำงาน → ได้ access token ใหม่
- [ ] Rate limit ทำงาน: ส่ง 101 req → ได้ HTTP 429
- [ ] AES encrypt/decrypt national_id ได้ถูกต้อง
- [ ] Alembic migration รัน schema ทั้งหมดได้สำเร็จ
- [ ] Alembic migration สร้าง tables ครบ: affiliations, districts, schools, students, users, assessments, alerts, notifications, audit_logs
- [ ] หน้า login `/login` แสดงได้บนมือถือ 375px
- [ ] Docker image build สำเร็จ (frontend + backend)
- [ ] Nginx Proxy Manager route API + frontend ถูกต้อง
