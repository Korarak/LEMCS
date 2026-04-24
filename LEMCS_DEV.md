# LEMCS — Loei Educational MindCare System
## Developer Guide (AI-Agent Optimized)

> **สำหรับ AI Agent**: อ่านไฟล์นี้ทั้งหมดก่อนเริ่มพัฒนา จากนั้นอ่านไฟล์ phase ที่ได้รับมอบหมายเพิ่มเติม
> ไม่ต้องอ่านทุก phase พร้อมกัน — อ่านเฉพาะ phase ที่กำลังพัฒนา

---

## สิ่งที่ต้องรู้ก่อนเริ่ม

### ระบบนี้คืออะไร
LEMCS คือระบบ **สำรวจและประเมินสุขภาพจิต** สำหรับนักเรียน/นักศึกษาในจังหวัดเลย
- ผู้ใช้: **100,000+ คน** (นักเรียน) + ครู + ผู้บริหาร
- Concurrent: **10,000+ คนพร้อมกัน**
- แบบประเมิน: **ST-5** (ความเครียด), **PHQ-A** (ซึมเศร้าวัยรุ่น), **CDI** (ซึมเศร้าเด็ก)
- ภาษา UI: **ภาษาไทยทั้งหมด**

### Tech Stack (ห้ามเปลี่ยน)
| Layer | Technology | Version |
|---|---|---|
| Frontend | Next.js (App Router) | 14 |
| UI | DaisyUI + Tailwind CSS | latest |
| Backend | FastAPI | Python 3.12 |
| Database | PostgreSQL | 16 |
| Cache | Redis | 7 |
| Storage | MinIO | latest |
| Container | Docker + Portainer | - |
| Proxy | Nginx Proxy Manager | - |
| Monitoring | Prometheus + Grafana | - |

> ❌ ห้ามใช้ Flask, Django, Express, Django REST Framework
> ✅ ใช้ FastAPI เท่านั้น

---

## โครงสร้างโปรเจกต์

```
lemcs/
├── LEMCS_DEV.md                ← ไฟล์นี้ (อ่านก่อน)
├── docs/
│   ├── phase1-infrastructure.md
│   ├── phase2-assessment-engine.md
│   ├── phase3-pwa-frontend.md
│   ├── phase4-reporting.md
│   ├── phase5-alerts.md
│   └── assessments/            ← spec แบบประเมิน (ดูหัวข้อด้านล่าง)
├── assessments/                ← PDF ต้นฉบับ (สำหรับ reference)
├── docker-compose.yml
├── .env.example
├── frontend/                   ← Next.js 14
└── backend/                    ← FastAPI
```

---

## ลำดับการพัฒนา (ต้องทำตามลำดับ)

```
Phase 1 → Foundation & Auth        ← เริ่มที่นี่
Phase 2 → Assessment Engine
Phase 3 → PWA Frontend
Phase 4 → Reporting Dashboard
Phase 5 → Alert System
```

แต่ละ Phase มีไฟล์ docs แยก อ่านไฟล์ phase ก่อนเริ่มพัฒนา phase นั้น

---

## Scoring Logic (Complete Specification)

> ⚠️ **สำคัญมาก**: ต้องนำ logic นี้ไป implement ตรงๆ อย่าทำการตีความเอง

### ST-5 — แบบประเมินความเครียด

**จำนวนข้อ**: 5 ข้อ  
**ตัวเลือกและคะแนนต่อข้อ**: 4 ตัวเลือก (0–3)
- ไม่เลย = 0
- บางครั้ง = 1
- บ่อยครั้ง = 2
- เกือบทุกวัน = 3

**คำนวณคะแนน**: รวมคะแนนทุกข้อ (sum of Q1–Q5)  
**คะแนนสูงสุด**: 15

**เกณฑ์ระดับ**:
| คะแนน | ระดับ (EN) | ระดับ (TH) |
|---|---|---|
| 0–4 | `normal` | ไม่มีความเครียด |
| 5–7 | `mild` | เครียดน้อย |
| 8–11 | `moderate` | เครียดปานกลาง |
| 12–15 | `severe` | เครียดมาก |

**ไม่มี suicide flag สำหรับ ST-5**

---

### PHQ-A — แบบประเมินภาวะซึมเศร้าวัยรุ่น

**กลุ่มเป้าหมาย**: อายุ 18–20 ปี (ถ้าอายุ 7–17 ใช้ CDI แทน)  
**จำนวนข้อหลัก**: 9 ข้อ  
**ตัวเลือกและคะแนนต่อข้อ**: 4 ตัวเลือก (0–3)
- ไม่มีเลย = 0
- มีบางวัน (น้อยกว่า 7 วัน) = 1
- มีบ่อย (7–11 วัน) = 2
- มีเกือบทุกวัน (12–14 วัน) หรือทุกวัน = 3

**คำถาม PHQ-A (ใน 2 สัปดาห์ที่ผ่านมา)**:
| ข้อ | คำถาม |
|---|---|
| Q1 | รู้สึกหมดความสนใจหรือไม่มีความสุขในการทำสิ่งต่างๆ |
| Q2 | รู้สึกหดหู่ เศร้า หรือสิ้นหวัง |
| Q3 | นอนหลับยาก หรือหลับๆ ตื่นๆ หรือหลับมากเกินไป |
| Q4 | รู้สึกเหนื่อยง่าย หรือไม่มีแรง |
| Q5 | เบื่ออาหาร หรือกินมากเกินไป |
| Q6 | รู้สึกแย่กับตัวเอง หรือรู้สึกว่าตัวเองล้มเหลว หรือรู้สึกว่าตัวเองทำให้ตัวเองหรือครอบครัวผิดหวัง |
| Q7 | มีสมาธิในการทำสิ่งต่างๆ ยากขึ้น เช่น อ่านหนังสือ หรือดูทีวี |
| Q8 | เคลื่อนไหวหรือพูดช้าลงจนคนอื่นสังเกตได้ หรือกลับกันคือ กระสับกระส่าย อยู่ไม่นิ่ง มากกว่าปกติ |
| Q9 | คิดว่าตายไปแล้วจะดีกว่า หรือคิดอยากทำร้ายตัวเอง |

**Bonus Questions (ถามเพิ่มทุกคน)**:
| ข้อ | คำถาม | ตัวเลือก |
|---|---|---|
| BQ1 | ในปีที่ผ่านมา คุณเคยคิดอยากฆ่าตัวตายหรือไม่? | ใช่ / ไม่ใช่ |
| BQ2 | ในปีที่ผ่านมา คุณเคยพยายามฆ่าตัวตายหรือไม่? | ใช่ / ไม่ใช่ |

**คำนวณคะแนน**: รวม Q1–Q9 (ไม่รวม BQ)  
**คะแนนสูงสุด**: 27

**เกณฑ์ระดับ**:
| คะแนน | ระดับ (EN) | ระดับ (TH) |
|---|---|---|
| 0–4 | `none` | ไม่มีอาการ |
| 5–9 | `mild` | อาการน้อย |
| 10–14 | `moderate` | อาการปานกลาง |
| 15–19 | `severe` | อาการมาก |
| 20–27 | `very_severe` | อาการรุนแรงมาก |

**⚠️ Suicide Risk Flag** — ต้องตรวจสอบทุกครั้งหลัง submit:
```python
def check_suicide_risk(responses: dict) -> bool:
    # Q9 ≥ 1 คะแนน = มีความคิดอยากทำร้ายตัวเอง
    if responses.get("q9", 0) >= 1:
        return True
    # Bonus question ตอบ "ใช่" ข้อใดข้อหนึ่ง
    if responses.get("bq1") == True or responses.get("bq2") == True:
        return True
    return False
```

---

### CDI — แบบประเมินภาวะซึมเศร้าในเด็ก

**กลุ่มเป้าหมาย**: อายุ 7–17 ปี (อ้างอิง: Maria Kovacs 1985, validated 7–17)  
**จำนวนข้อ**: 27 ข้อ  
**ตัวเลือกต่อข้อ**: 3 ตัวเลือก (ก, ข, ค)

**⚠️ การให้คะแนน CDI มี 2 กลุ่ม (สำคัญมาก)**:

**กลุ่ม A** (ตัวเลือก ก=0, ข=1, ค=2):
- ข้อที่อยู่ในกลุ่ม A: **1, 3, 4, 6, 9, 12, 14, 17, 19, 20, 22, 23, 26, 27**

**กลุ่ม B** (ตัวเลือก ก=2, ข=1, ค=0) — คะแนนกลับด้าน:
- ข้อที่อยู่ในกลุ่ม B: **2, 5, 7, 8, 10, 11, 13, 15, 16, 18, 21, 24, 25**

```python
CDI_GROUP_A = {1,3,4,6,9,12,14,17,19,20,22,23,26,27}  # ก=0, ข=1, ค=2
CDI_GROUP_B = {2,5,7,8,10,11,13,15,16,18,21,24,25}    # ก=2, ข=1, ค=0

def score_cdi(responses: dict) -> int:
    """
    responses = {"q1": "ก", "q2": "ข", ...}
    """
    total = 0
    for q_num in range(1, 28):
        answer = responses.get(f"q{q_num}", "ก")  # default ก
        if q_num in CDI_GROUP_A:
            score = {"ก": 0, "ข": 1, "ค": 2}[answer]
        else:  # GROUP_B
            score = {"ก": 2, "ข": 1, "ค": 0}[answer]
        total += score
    return total
```

**เกณฑ์ระดับ**:
| คะแนน | ระดับ (EN) | ระดับ (TH) |
|---|---|---|
| 0–14 | `normal` | ไม่มีภาวะซึมเศร้า |
| ≥ 15 | `clinical` | มีภาวะซึมเศร้าที่มีนัยสำคัญทางคลินิก |

**ไม่มี suicide flag เฉพาะสำหรับ CDI** (ถ้าพบระดับ clinical ให้แจ้งเตือนตาม Alert Rules)

---

## Database Schema (Complete)

```sql
-- ===========================
-- SYSTEM TABLES (schema: system)
-- ===========================

CREATE SCHEMA IF NOT EXISTS system;

CREATE TABLE system.tenants (
  id              SERIAL PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,        -- "loei"
  name            TEXT NOT NULL,               -- "จังหวัดเลย"
  province_code   TEXT UNIQUE NOT NULL,        -- "42"
  db_schema       TEXT UNIQUE NOT NULL,        -- "loei" (PostgreSQL schema name)
  domain          TEXT UNIQUE,                 -- "loei.lemcs.app"
  logo_url        TEXT,
  theme_color     TEXT DEFAULT '#3B82F6',
  is_active       BOOLEAN DEFAULT FALSE,
  subscription_plan TEXT DEFAULT 'trial',      -- trial|basic|pro|enterprise
  trial_expires_at TIMESTAMPTZ,
  max_students    INT DEFAULT 50000,
  contact_name    TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  activated_at    TIMESTAMPTZ
);

CREATE TABLE system.super_admins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username        TEXT UNIQUE NOT NULL,
  hashed_password TEXT NOT NULL,
  full_name       TEXT,
  last_login      TIMESTAMPTZ
);

-- ===========================
-- TENANT TABLES (schema: {tenant_slug}, e.g. "loei")
-- ===========================
-- ทุก table ด้านล่างสร้างใน schema ชื่อ slug ของจังหวัด
-- เช่น loei.students, loei.schools ฯลฯ

CREATE TABLE affiliations (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL         -- "สพม.เลย", "สอศ.เลย", "โรงเรียนเอกชน"
);

CREATE TABLE districts (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  affiliation_id  INT REFERENCES affiliations(id)
);

CREATE TABLE schools (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  district_id INT REFERENCES districts(id),
  school_type TEXT              -- "มัธยม" | "อาชีวะ" | "เอกชน"
);

CREATE TABLE students (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_code  TEXT UNIQUE NOT NULL,   -- รหัสนักเรียน (ใช้ login)
  national_id   TEXT,                   -- ⚠️ เข้ารหัส AES-256 ก่อนบันทึก
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  gender        TEXT,                   -- "ชาย" | "หญิง" | "ไม่ระบุ"
  birthdate     DATE,
  grade         TEXT,                   -- "ม.1" | "ม.2" | "ปวช.1" ฯลฯ
  classroom     TEXT,                   -- "ห้อง 1/1"
  school_id     INT REFERENCES schools(id),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID REFERENCES students(id),  -- NULL ถ้าไม่ใช่นักเรียน
  username        TEXT UNIQUE,
  hashed_password TEXT,
  role            TEXT NOT NULL,
  -- roles: student | teacher | counselor | school_admin
  --        district_admin | province_admin | superadmin
  school_id       INT REFERENCES schools(id),
  is_active       BOOLEAN DEFAULT TRUE,
  last_login      TIMESTAMPTZ
);

CREATE TABLE assessments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES students(id),
  assessment_type TEXT NOT NULL,        -- "ST5" | "PHQA" | "CDI"
  responses       JSONB NOT NULL,       -- {"q1": 2, "q2": 1, ...}
  score           INT NOT NULL,
  severity_level  TEXT NOT NULL,
  -- ST5:  normal | mild | moderate | severe
  -- PHQA: none | mild | moderate | severe | very_severe
  -- CDI:  normal | clinical
  suicide_risk    BOOLEAN DEFAULT FALSE,
  academic_year   TEXT,                 -- "2567"
  term            INT,                  -- 1 หรือ 2
  created_at      TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);      -- partition รายปี

-- สร้าง partition รายปี
CREATE TABLE assessments_2567
  PARTITION OF assessments
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE assessments_2568
  PARTITION OF assessments
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID REFERENCES students(id),
  assessment_id   UUID REFERENCES assessments(id),
  alert_level     TEXT,          -- "warning" | "urgent" | "critical"
  status          TEXT DEFAULT 'new',
  -- new | acknowledged | in_progress | referred | closed
  assigned_to     UUID REFERENCES users(id),
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_assessments_student_id ON assessments(student_id);
CREATE INDEX idx_assessments_created    ON assessments(created_at DESC);
CREATE INDEX idx_students_school        ON students(school_id);
CREATE INDEX idx_alerts_status          ON alerts(status, alert_level);
CREATE INDEX idx_students_code          ON students(student_code);
```

---

## Environment Variables (.env.example)

```env
# === Database ===
POSTGRES_HOST=pgbouncer        # ต่อผ่าน PgBouncer เสมอ
POSTGRES_PORT=5432
POSTGRES_DB=lemcs
POSTGRES_USER=lemcs_user
POSTGRES_PASSWORD=CHANGE_ME_strong_password

# === Redis ===
REDIS_URL=redis://redis:6379/0

# === JWT Authentication ===
SECRET_KEY=CHANGE_ME_min_32_characters_random_string
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30

# === MinIO Object Storage ===
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=CHANGE_ME_minio_password
MINIO_BUCKET_REPORTS=lemcs-reports
MINIO_BUCKET_BACKUPS=lemcs-backups

# === LINE Notify (การแจ้งเตือน) ===
LINE_NOTIFY_TOKEN=your_line_notify_token_here

# === SMS OTP (AIS/DTAC) ===
SMS_API_KEY=your_sms_api_key
SMS_API_URL=https://smsapi.aisplay.th/v1/send

# === PDPA / Encryption ===
ENCRYPTION_KEY=CHANGE_ME_exactly_32_chars_aes_key

# === Email (SMTP) ===
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@lemcs.app
SMTP_PASSWORD=CHANGE_ME_smtp_password

# === Application ===
ENVIRONMENT=production          # development | production
DEBUG=false
API_BASE_URL=https://api.lemcs.app
FRONTEND_URL=https://loei.lemcs.app
```

---

## API Endpoints (Complete List)

### Authentication
```
POST  /api/auth/login           body: {student_code, password}
POST  /api/auth/otp/request     body: {student_code}  → ส่ง OTP ทาง SMS
POST  /api/auth/otp/verify      body: {student_code, otp}  → return JWT
POST  /api/auth/refresh         header: Authorization: Bearer {refresh_token}
POST  /api/auth/logout
```

### Student (role: student)
```
GET   /api/students/me          → โปรไฟล์นักเรียนที่ login
GET   /api/students/me/history  → ประวัติการทำแบบประเมินทั้งหมด
```

### Assessments
```
GET   /api/assessments/available          → รายการแบบที่ต้องทำในภาคเรียนนี้
POST  /api/assessments/start/{type}       → สร้าง session (type: ST5|PHQA|CDI)
POST  /api/assessments/autosave           → บันทึก draft อัตโนมัติ (ทุก 30 วิ)
POST  /api/assessments/submit             → ส่งคำตอบ + รับผลทันที
GET   /api/assessments/{id}               → ดูผลการประเมิน
```

### Admin — Reports (role: teacher/school_admin/district_admin/province_admin)
```
GET   /api/reports/summary                → ภาพรวม (filter ตาม role scope)
GET   /api/reports/school/{school_id}     → รายงานรายโรงเรียน
POST  /api/reports/export/pdf             body: {filters, school_id, date_range}
POST  /api/reports/export/excel           body: {filters}
```

### Admin — Alerts (role: teacher+)
```
GET   /api/alerts                         → รายการแจ้งเตือน
PATCH /api/alerts/{id}                    body: {status, note, assigned_to}
```

### Admin — Management (role: school_admin+)
```
POST  /api/admin/students/import          body: CSV file (multipart)
GET   /api/admin/schools                  → รายการโรงเรียน
POST  /api/admin/schools                  → เพิ่มโรงเรียน
GET   /api/admin/users                    → รายการผู้ใช้
POST  /api/admin/users                    → เพิ่มผู้ใช้ (ครู/แอดมิน)
```

### System (role: superadmin เท่านั้น)
```
GET   /system/tenants                     → รายชื่อจังหวัดทั้งหมด
POST  /system/tenants                     → เพิ่ม tenant ใหม่
POST  /system/tenants/{id}/provision      → provision schema
PATCH /system/tenants/{id}/activate
```

---

## Alert Rules (ต้อง implement ตรงๆ)

```python
# backend/app/services/alert_service.py

ALERT_RULES = {
    "PHQA": {
        # คะแนน ≥ key → trigger alert
        10: {"level": "warning",  "notify_roles": ["teacher", "counselor"]},
        15: {"level": "urgent",   "notify_roles": ["teacher", "counselor", "school_admin"]},
        20: {"level": "critical", "notify_roles": ["all"]},
    },
    "CDI": {
        15: {"level": "warning",  "notify_roles": ["teacher", "counselor"]},
        20: {"level": "urgent",   "notify_roles": ["teacher", "counselor", "school_admin"]},
    },
    "SUICIDE_RISK": {
        # suicide_risk = True → แจ้งเตือนทันทีทันใด ไม่สนคะแนน
        "level": "critical",
        "notify_roles": ["all"],
        "immediate": True,   # ไม่รอ background job
    }
}

def determine_alert(assessment_type: str, score: int, suicide_risk: bool) -> dict | None:
    """
    Returns alert config หรือ None ถ้าไม่ต้องแจ้งเตือน
    """
    if suicide_risk:
        return ALERT_RULES["SUICIDE_RISK"]

    rules = ALERT_RULES.get(assessment_type, {})
    # หา threshold สูงสุดที่ score ผ่าน
    triggered = None
    for threshold in sorted(rules.keys()):
        if score >= threshold:
            triggered = rules[threshold]
    return triggered
```

**ช่องทางแจ้งเตือน (เรียงลำดับ)**:
1. **LINE Notify** webhook (หลัก)
2. **Email SMTP** (สำรอง)
3. **In-app notification** (แสดงใน admin dashboard)

---

## PDPA & Security Rules

> กฎเหล่านี้บังคับ ห้ามข้าม

1. **Consent Screen**: แสดงหน้าขอความยินยอมก่อนทำแบบประเมินครั้งแรกเสมอ
2. **Encrypt PII**: `national_id` ต้องเข้ารหัสด้วย AES-256 ก่อน INSERT เสมอ
3. **No PII in URL**: ห้ามใส่ชื่อ, รหัสบัตรประชาชน ใน URL path หรือ query string
4. **HTTPS Only**: ทุก endpoint ต้องผ่าน Nginx Proxy Manager (SSL)
5. **Rate Limiting**: 100 req/min ต่อ IP (ใช้ Redis + middleware)
6. **Session Expire**: นักเรียน 60 นาที, Admin 8 ชั่วโมง
7. **Audit Log**: บันทึกทุกการเข้าถึงข้อมูล assessment และ alert
8. **Daily Backup**: pg_dump ไปยัง MinIO ทุกวัน เวลา 02:00

---

## Role-Based Access Control (RBAC)

| Role | ขอบเขตข้อมูลที่เห็น |
|---|---|
| `student` | เฉพาะข้อมูลตัวเอง |
| `teacher` | นักเรียนในห้องที่สอนเท่านั้น |
| `counselor` | นักเรียนที่ถูก assign alert ให้ |
| `school_admin` | ทุกคนในโรงเรียนนั้น |
| `district_admin` | ทุกโรงเรียนในอำเภอนั้น |
| `province_admin` | ทุกโรงเรียนใน จ.เลย |
| `superadmin` | ทุก tenant (จังหวัด) |

```python
# ตัวอย่าง dependency ใน FastAPI
async def check_scope(
    current_user: User = Depends(get_current_user),
    school_id: int = None
) -> QueryScope:
    if current_user.role == "teacher":
        return QueryScope(school_id=current_user.school_id, classroom=current_user.classroom)
    elif current_user.role == "school_admin":
        return QueryScope(school_id=current_user.school_id)
    elif current_user.role in ("district_admin", "province_admin", "superadmin"):
        return QueryScope(school_id=None)  # ไม่จำกัด
    else:
        raise HTTPException(403, "ไม่มีสิทธิ์เข้าถึงข้อมูลนี้")
```

---

## Performance Configuration

```python
# backend/app/database.py
# PgBouncer อยู่หน้า PostgreSQL
engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,          # connections ต่อ worker
    max_overflow=40,       # burst
    pool_pre_ping=True,
    pool_recycle=3600,
)
```

```yaml
# docker-compose.yml — FastAPI replicas
backend:
  deploy:
    replicas: 4
  command: uvicorn app.main:app --workers 4 --host 0.0.0.0 --port 8000
```

```
PgBouncer config:
  pool_mode = transaction        # ← transaction pooling (สำคัญ)
  max_client_conn = 1000
  default_pool_size = 50
```

---

## ข้อกำหนดสำคัญ (ห้ามลืม)

> ⚠️ **Suicide Risk**: เมื่อพบ `suicide_risk = True` ต้องทำสิ่งเหล่านี้ทันที:
> 1. บันทึก alert level "critical"
> 2. แจ้งเตือนทุก role ทันที (ไม่รอ queue)
> 3. แสดงข้อความ crisis resources บนหน้าจอนักเรียนทันที
> 4. แสดงเบอร์โทรสายด่วนสุขภาพจิต 1323

> 📱 **Mobile First**: ออกแบบสำหรับ 375px ก่อนเสมอ นักเรียนใช้มือถือ

> 🌐 **Thai Language**: Font: `Noto Sans Thai` หรือ `Sarabun` (Google Fonts)

> 🔌 **Offline Support**: Service worker ต้อง cache คำถามทุกแบบประเมินไว้ offline

---

*LEMCS — Loei Educational MindCare System | จังหวัดเลย, ประเทศไทย*
*เวอร์ชันเอกสาร: 2.0 | อัปเดต: มีนาคม 2568*
