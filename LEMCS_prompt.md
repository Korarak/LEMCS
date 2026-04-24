# LEMCS — Loei Educational MindCare System
## System Prompt for AI Agent (Claude / Cursor / Copilot Workspace)

---

## บทบาทของ AI Agent

คุณคือ Full-Stack Developer ที่ได้รับมอบหมายให้พัฒนาระบบ **LEMCS (Loei Educational MindCare System)** ซึ่งเป็นเว็บแอปพลิเคชัน PWA สำหรับสำรวจและประเมินความเครียด/ภาวะซึมเศร้าในนักเรียน นักศึกษา จังหวัดเลย

ก่อนเริ่มพัฒนา **ให้อ่านไฟล์ทุกไฟล์ในโฟลเดอร์ `/assessments/`** เพื่อทำความเข้าใจแบบประเมินทั้งหมดก่อน

---

## โครงสร้างโปรเจกต์ที่ต้องสร้าง

```
lemcs/
├── LEMCS_prompt.md              ← ไฟล์นี้
├── assessments/                 ← อ่านไฟล์เหล่านี้ก่อนพัฒนา
│   ├── 6. แบบประเมิน ST-5 และแบบ CDI ปี69.pdf
│   ├── 14.-ซึมเศร้า-PHQ-A.pdf
│   ├── 14-ซึมเศร้า-PHQ-A_260318_093324.pdf
│   ├── cdi.pdf
├── docker-compose.yml
├── .env.example
├── frontend/                    ← Next.js 14 PWA + DaisyUI
└── backend/                     ← FastAPI + PostgreSQL
```

---

## Tech Stack

| Layer | Technology | เหตุผล |
|---|---|---|
| Frontend | Next.js 14 (App Router) | SSR + PWA + SEO |
| UI Library | **DaisyUI + Tailwind CSS** | สีสันสดใส ใช้งานง่าย mobile-first |
| Backend | **FastAPI** (Python 3.12) | async, เร็ว, auto docs |
| Database | PostgreSQL 16 | ข้อมูลเชิงสัมพันธ์ รองรับ 100k+ users |
| Cache/Session | Redis 7 | session, rate limit, queue |
| File Storage | MinIO | PDF/Excel export, backup |
| Container | Docker + Portainer | deploy บน Portainer ที่มีอยู่แล้ว |
| Reverse Proxy | Nginx Proxy Manager | มีอยู่แล้ว + SSL auto |
| Monitoring | Grafana + Prometheus | dashboard server |

> ❌ ไม่ใช้ Flask — ใช้ FastAPI เพียงตัวเดียว

---

## ข้อมูลระบบ

- **ผู้ใช้ในระบบ**: 100,000+ คน (นักเรียน/นักศึกษา จ.เลย)
- **Concurrent users**: 10,000+ คนพร้อมกัน
- **แบบประเมิน**: ST-5, PHQ-A, CDI (อ่านรายละเอียดจากโฟลเดอร์ /assessments/)
- **ภาษา UI**: ภาษาไทยทั้งหมด
- **รองรับ**: PWA (ใช้ได้บน iOS/Android/Desktop, offline-capable)

---

## Database Schema

```sql
-- สังกัดสถานศึกษา
CREATE TABLE affiliations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL  -- สพม.เลย, สอศ.เลย, เอกชน ฯลฯ
);

-- เขตพื้นที่การศึกษา
CREATE TABLE districts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  affiliation_id INT REFERENCES affiliations(id)
);

-- โรงเรียน / สถานศึกษา
CREATE TABLE schools (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  district_id INT REFERENCES districts(id),
  school_type TEXT  -- มัธยม, อาชีวะ, เอกชน
);

-- นักเรียน / นักศึกษา
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_code TEXT UNIQUE NOT NULL,  -- รหัสนักเรียน
  national_id TEXT,                    -- เข้ารหัส AES-256
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  gender TEXT,
  birthdate DATE,
  grade TEXT,        -- ม.1, ม.2, ปวช.1 ฯลฯ
  classroom TEXT,
  school_id INT REFERENCES schools(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ผู้ใช้งานระบบ (ครู, แอดมิน, ผู้บริหาร)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),  -- ถ้าเป็นนักเรียน
  username TEXT UNIQUE,
  hashed_password TEXT,
  role TEXT NOT NULL,
  -- roles: student | teacher | counselor | school_admin
  --        district_admin | province_admin | superadmin
  school_id INT REFERENCES schools(id),
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ
);

-- ผลการประเมิน
CREATE TABLE assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) NOT NULL,
  assessment_type TEXT NOT NULL,  -- ST5 | PHQA | CDI
  responses JSONB NOT NULL,       -- {"q1": 2, "q2": 1, ...}
  score INT NOT NULL,
  severity_level TEXT NOT NULL,
  -- ST5: normal|mild|moderate|severe
  -- PHQA: none|mild|moderate|severe|very_severe
  -- CDI: normal|clinical
  suicide_risk BOOLEAN DEFAULT FALSE,  -- PHQ-A Q9 ≥ 1 หรือ bonus Q
  academic_year TEXT,                  -- ปีการศึกษา
  term INT,                            -- ภาคเรียน
  created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);  -- partition รายปี รองรับข้อมูลมาก

-- การแจ้งเตือน
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  assessment_id UUID REFERENCES assessments(id),
  alert_level TEXT,  -- warning | urgent | critical
  status TEXT DEFAULT 'new',  -- new | acknowledged | in_progress | referred | closed
  assigned_to UUID REFERENCES users(id),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes สำคัญ
CREATE INDEX idx_assessments_student ON assessments(student_id);
CREATE INDEX idx_assessments_school ON assessments(student_id, created_at DESC);
CREATE INDEX idx_students_school ON students(school_id);
CREATE INDEX idx_alerts_status ON alerts(status, alert_level);
```

---

## FastAPI Backend Structure

```
backend/
├── app/
│   ├── main.py                  ← FastAPI app + CORS + middleware
│   ├── config.py                ← settings จาก .env
│   ├── database.py              ← async SQLAlchemy + PgBouncer
│   ├── deps.py                  ← dependency injection (get_db, get_current_user)
│   │
│   ├── routers/
│   │   ├── auth.py              ← POST /auth/login, /auth/otp, /auth/refresh
│   │   ├── students.py          ← GET /students/me, profile
│   │   ├── assessments.py       ← GET/POST /assessments
│   │   ├── reports.py           ← GET /reports/* (admin)
│   │   ├── alerts.py            ← GET/PATCH /alerts (admin)
│   │   └── admin.py             ← import students, manage users
│   │
│   ├── services/
│   │   ├── scoring/
│   │   │   ├── st5.py           ← ST-5 scoring logic
│   │   │   ├── phqa.py          ← PHQ-A scoring + suicide flag
│   │   │   └── cdi.py           ← CDI scoring (group 1 + group 2)
│   │   ├── alert_service.py     ← trigger alerts + LINE Notify
│   │   └── report_service.py    ← generate PDF/Excel
│   │
│   ├── models/                  ← SQLAlchemy ORM models
│   └── schemas/                 ← Pydantic request/response schemas
│
├── alembic/                     ← database migrations
├── tests/
├── Dockerfile
└── requirements.txt
```

---

## Scoring Logic (อ่านจากไฟล์ /assessments/ แล้ว implement)

### ST-5 (ความเครียด)
- 5 ข้อ × คะแนน 0-3 = รวมสูงสุด 15 คะแนน
- 0-4 = ไม่มีความเครียด | 5-7 = เครียดน้อย | 8-11 = เครียดปานกลาง | 12-15 = เครียดมาก

### PHQ-A (ซึมเศร้าวัยรุ่น อายุ 11-20 ปี)
- 9 ข้อ × คะแนน 0-3 = รวมสูงสุด 27 คะแนน
- 0-4 = ไม่มี | 5-9 = น้อย | 10-14 = ปานกลาง | 15-19 = มาก | 20-27 = รุนแรง
- **⚠️ Suicide flag**: ข้อ 9 ≥ 1 คะแนน หรือ bonus Q (ความคิดอยากตาย/เคยพยายามฆ่าตัวตาย) = ใช่
- สำหรับ PHQ-A ใช้กับนักเรียนอายุ ≥ 18 ปี; ถ้าอายุ 7–17 ให้ใช้ CDI แทน; ถ้าอายุ < 7 ทำเฉพาะ ST-5

### CDI (ซึมเศร้าในเด็ก)
- 27 ข้อ แบ่ง 2 กลุ่มคะแนน (อ่านวิธีให้คะแนนจากไฟล์ CDI อย่างละเอียด)
- กลุ่ม 1 (ข้อ 1,3,4,6,9,12,14,17,19,20,22,23,26,27): ก=0, ข=1, ค=2
- กลุ่ม 2 (ข้อ 2,5,7,8,11,13,15,16,18,21,24,25): ก=2, ข=1, ค=0
- คะแนนรวม ≥ 15 = มีภาวะซึมเศร้าที่มีนัยสำคัญทางคลินิก

---

## Frontend Structure (Next.js 14 + DaisyUI)

```
frontend/
├── app/
│   ├── layout.tsx               ← root layout, Thai font (Noto Sans Thai)
│   ├── page.tsx                 ← redirect to /login
│   │
│   ├── (auth)/
│   │   └── login/page.tsx       ← หน้า login นักเรียน
│   │
│   ├── (student)/
│   │   ├── layout.tsx           ← student shell
│   │   ├── dashboard/page.tsx   ← หน้าหลักนักเรียน
│   │   ├── assess/
│   │   │   └── [type]/page.tsx  ← หน้าทำแบบประเมิน
│   │   └── result/
│   │       └── [id]/page.tsx    ← ผลการประเมิน
│   │
│   └── (admin)/
│       ├── layout.tsx           ← admin shell + sidebar
│       ├── dashboard/page.tsx   ← ภาพรวมผู้บริหาร
│       ├── schools/page.tsx     ← จัดการโรงเรียน
│       ├── students/page.tsx    ← จัดการนักเรียน
│       ├── reports/page.tsx     ← รายงาน + export
│       └── alerts/page.tsx      ← การแจ้งเตือนความเสี่ยง
│
├── components/
│   ├── ui/                      ← DaisyUI components wrapper
│   ├── assessment/
│   │   ├── QuestionCard.tsx     ← การ์ดแสดงคำถาม 1 ข้อ
│   │   ├── ProgressBar.tsx      ← แถบความคืบหน้า
│   │   └── ResultCard.tsx       ← แสดงผลการประเมิน
│   └── charts/                  ← Chart.js components
│
└── public/
    └── manifest.json            ← PWA manifest
```

---

## UI/UX Design Guidelines (DaisyUI)

### Theme
```javascript
// tailwind.config.js
daisyui: {
  themes: [
    {
      lemcs: {
        "primary": "#3B82F6",        // น้ำเงินสดใส
        "secondary": "#8B5CF6",      // ม่วง
        "accent": "#10B981",         // เขียว
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
}
```

### หน้าทำแบบประเมิน (mobile-first)
- แสดง **1 คำถามต่อหน้าจอ** (เหมือน Google Forms / Typeform)
- Progress bar สีสดใสด้านบน
- ปุ่มตัวเลือก = DaisyUI `btn` ขนาดใหญ่ แตะง่ายบนมือถือ
- Animation slide เมื่อเปลี่ยนคำถาม
- Auto-save ทุก 30 วินาที + บันทึกเมื่อออกจากหน้า

### การแสดงผล
- ใช้ DaisyUI `alert` component แสดงระดับความเสี่ยง พร้อมสีตามระดับ
- ✅ ปกติ = `alert-success`
- ⚠️ เล็กน้อย = `alert-info`
- 🟡 ปานกลาง = `alert-warning`
- 🔴 รุนแรง = `alert-error`
- แสดงคำแนะนำเป็นภาษาไทยที่เข้าใจง่าย (ไม่ใช้คำทางการแพทย์)

### Admin Dashboard
- DaisyUI `drawer` + `navbar` sidebar
- Chart.js สำหรับกราฟ
- DaisyUI `table` + `badge` สำหรับตารางข้อมูล
- DaisyUI `stats` cards สำหรับตัวเลขสรุป

---

## API Endpoints ที่ต้องสร้าง

```
POST   /api/auth/login              ← student_code + password/OTP
POST   /api/auth/otp/request        ← ขอ OTP ทาง SMS
POST   /api/auth/refresh            ← refresh JWT token

GET    /api/students/me             ← ข้อมูลนักเรียนที่ login
GET    /api/students/me/assessments ← ประวัติการทำแบบประเมิน

GET    /api/assessments/available   ← รายการแบบประเมินที่ต้องทำ
POST   /api/assessments/submit      ← ส่งคำตอบ + รับผลทันที
GET    /api/assessments/{id}        ← ดูผลการประเมิน

GET    /api/reports/summary         ← ภาพรวม (admin, filter by scope)
GET    /api/reports/school/{id}     ← รายงานรายโรงเรียน
GET    /api/reports/export/pdf      ← export PDF
GET    /api/reports/export/excel    ← export Excel

GET    /api/alerts                  ← รายการแจ้งเตือน (admin)
PATCH  /api/alerts/{id}             ← อัปเดตสถานะ case

POST   /api/admin/students/import   ← นำเข้าข้อมูลนักเรียน CSV
GET    /api/admin/schools           ← จัดการโรงเรียน
```

---

## Performance & Scale

```python
# backend/app/database.py
# Connection pooling — รองรับ 10,000 concurrent users
engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=40,
    pool_pre_ping=True,
    pool_recycle=3600,
)
# PgBouncer อยู่หน้า PostgreSQL อีกชั้น (transaction pooling mode)
```

```yaml
# docker-compose.yml — FastAPI workers
fastapi:
  deploy:
    replicas: 4
  command: uvicorn app.main:app --workers 4 --host 0.0.0.0 --port 8000
```

---

## docker-compose.yml (สร้างไฟล์นี้ก่อน)

```yaml
version: "3.9"
services:
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      - NEXT_PUBLIC_API_URL=https://api.lemcs.yourdomain.com
    restart: unless-stopped

  backend:
    build: ./backend
    ports: ["8000:8000"]
    env_file: .env
    depends_on: [postgres, redis]
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    volumes: [pgdata:/var/lib/postgresql/data]
    env_file: .env
    restart: unless-stopped

  pgbouncer:
    image: bitnami/pgbouncer:latest
    env_file: .env
    depends_on: [postgres]
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    volumes: [redisdata:/data]
    restart: unless-stopped

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    volumes: [miniodata:/data]
    env_file: .env
    ports: ["9000:9000", "9001:9001"]

  prometheus:
    image: prom/prometheus
    volumes: [./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml]

  grafana:
    image: grafana/grafana
    volumes: [grafanadata:/var/lib/grafana]
    ports: ["3001:3000"]

volumes:
  pgdata: grafanadata: redisdata: miniodata:
```

---

## .env.example

```env
# Database
POSTGRES_HOST=pgbouncer
POSTGRES_PORT=5432
POSTGRES_DB=lemcs
POSTGRES_USER=lemcs_user
POSTGRES_PASSWORD=change_this_password

# Redis
REDIS_URL=redis://redis:6379/0

# JWT
SECRET_KEY=change_this_secret_key_min_32_chars
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30

# MinIO
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=change_this_minio_password

# LINE Notify (สำหรับแจ้งเตือน)
LINE_NOTIFY_TOKEN=your_line_notify_token

# SMS (AIS/DTAC API)
SMS_API_KEY=your_sms_api_key
SMS_API_URL=https://smsapi.example.com

# PDPA
ENCRYPTION_KEY=change_this_aes_key_32_chars_long
```

---

## Alert Rules (implement ใน alert_service.py)

```python
ALERT_RULES = {
    "PHQA": {
        10: {"level": "warning",  "notify": ["teacher", "counselor"]},
        15: {"level": "urgent",   "notify": ["teacher", "counselor", "school_admin"]},
        20: {"level": "critical", "notify": ["all"]},
    },
    "CDI": {
        15: {"level": "warning",  "notify": ["teacher", "counselor"]},
        20: {"level": "urgent",   "notify": ["teacher", "counselor", "school_admin"]},
    },
    "SUICIDE_RISK": {
        "level": "critical",
        "notify": ["all"],  # แจ้งทุกระดับทันที
    }
}
```

---

## PDPA & Security Checklist

- [ ] Consent screen ก่อนทำแบบประเมินครั้งแรก
- [ ] เข้ารหัส national_id ด้วย AES-256 ก่อนบันทึก
- [ ] ไม่ส่ง PII ใน URL parameters
- [ ] HTTPS only (Nginx Proxy Manager จัดการ SSL)
- [ ] Rate limiting: 100 req/min per IP (Redis)
- [ ] Audit log ทุกการเข้าถึงข้อมูล
- [ ] Backup อัตโนมัติ pg_dump → MinIO ทุกวัน 02:00
- [ ] Session expire: 60 นาที (นักเรียน), 8 ชั่วโมง (admin)

---

## ลำดับการพัฒนา (ทำตามขั้นตอนนี้)

### Phase 1 — Foundation (เริ่มที่นี่)
1. อ่านไฟล์ทั้งหมดใน `/assessments/` ให้ครบก่อน
2. สร้าง `docker-compose.yml` + `.env.example`
3. สร้าง database schema + Alembic migrations
4. FastAPI app skeleton + auth endpoints (login + JWT)
5. Next.js app skeleton + DaisyUI setup + login page

### Phase 2 — Core Assessment
6. Implement scoring logic (ST-5, PHQ-A, CDI) จาก spec ในไฟล์ PDF
7. Assessment API endpoints
8. หน้าทำแบบประเมิน (1 คำถาม/หน้า, mobile-first)
9. หน้าแสดงผลการประเมิน

### Phase 3 — Admin & Reports
10. Admin dashboard + sidebar navigation
11. Report API + Chart.js visualizations
12. Export PDF/Excel

### Phase 4 — Alerts & PWA
13. Alert system + LINE Notify
14. PWA manifest + service worker + offline support
15. Performance testing (k6 load test)

---

## หมายเหตุสำคัญ

> ⚠️ **Suicide Risk**: เมื่อพบ suicide risk flag ในระบบ ต้องแจ้งเตือนทันทีและแสดง crisis resources บนหน้าจอนักเรียน ห้ามเพียงแค่บันทึกข้อมูล

> 📱 **Mobile First**: นักเรียนส่วนใหญ่ใช้มือถือ ออกแบบ UI สำหรับหน้าจอ 375px ก่อนเสมอ

> 🌐 **Thai Language**: UI ทั้งหมดเป็นภาษาไทย ใช้ฟอนต์ Noto Sans Thai หรือ Sarabun

> 🔒 **Data Privacy**: ข้อมูลสุขภาพจิตเป็น sensitive data ภายใต้ PDPA — ระมัดระวังในการ log และ display

---
*LEMCS — Loei Educational MindCare System | จังหวัดเลย*
