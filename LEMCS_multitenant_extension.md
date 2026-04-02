# LEMCS Multi-Tenant Extension
## ส่วนเพิ่มเติมใน LEMCS_prompt.md — รองรับหลายจังหวัด

---

## แนวคิด Multi-Tenancy

ระบบ LEMCS รองรับการขยายให้จังหวัดอื่นใช้งานได้ โดยใช้รูปแบบ **"Schema-per-Tenant"** บน PostgreSQL
แต่ละจังหวัด = 1 Tenant = 1 PostgreSQL Schema แยกกัน ข้อมูลไม่ปนกัน แต่ใช้ infrastructure ชุดเดียว

```
URL pattern:  https://{slug}.lemcs.app
ตัวอย่าง:     https://loei.lemcs.app        ← จังหวัดเลย (ต้นแบบ)
              https://nbl.lemcs.app         ← หนองบัวลำภู
              https://udon.lemcs.app        ← อุดรธานี
              https://kkn.lemcs.app         ← ขอนแก่น
```

---

## Database Schema เพิ่มเติม (System-level tables)

```sql
-- ตารางกลาง (อยู่ใน schema "public" — ไม่ใช่ tenant schema)

CREATE SCHEMA IF NOT EXISTS system;

-- จังหวัด / Tenant registry
CREATE TABLE system.tenants (
  id          SERIAL PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,        -- "loei", "nbl", "udon"
  name        TEXT NOT NULL,               -- "จังหวัดเลย"
  province_code TEXT UNIQUE NOT NULL,      -- "42" (รหัสจังหวัด)
  db_schema   TEXT UNIQUE NOT NULL,        -- "loei" (ชื่อ PostgreSQL schema)
  domain      TEXT UNIQUE,                 -- "loei.lemcs.app"
  logo_url    TEXT,
  theme_color TEXT DEFAULT '#3B82F6',      -- สีหลักของ tenant
  is_active   BOOLEAN DEFAULT FALSE,       -- ต้องเปิดใช้งานก่อน
  subscription_plan TEXT DEFAULT 'trial',  -- trial | basic | pro
  trial_expires_at TIMESTAMPTZ,
  max_students INT DEFAULT 50000,          -- จำกัดตามแพลน
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ
);

-- Super Admin ของระบบ (ไม่ใช่ admin ของแต่ละจังหวัด)
CREATE TABLE system.super_admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT UNIQUE NOT NULL,
  hashed_password TEXT NOT NULL,
  full_name     TEXT,
  last_login    TIMESTAMPTZ
);

-- Audit log ระดับ system
CREATE TABLE system.audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   INT REFERENCES system.tenants(id),
  action      TEXT NOT NULL,
  performed_by TEXT,
  details     JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription / billing log
CREATE TABLE system.subscription_logs (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT REFERENCES system.tenants(id),
  plan        TEXT,
  started_at  TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  amount      NUMERIC(10,2),
  note        TEXT
);
```

---

## Tenant Provisioning (สร้าง tenant ใหม่อัตโนมัติ)

```python
# backend/app/services/tenant_provisioning.py

async def provision_new_tenant(slug: str, name: str, province_code: str):
    """
    เรียกใช้เมื่อจังหวัดใหม่สมัครใช้งาน
    สร้าง PostgreSQL schema + tables + default data อัตโนมัติ
    """
    schema_name = slug.lower().replace("-", "_")

    async with get_system_db() as db:
        # 1. สร้าง PostgreSQL schema ใหม่
        await db.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema_name}"')

        # 2. รัน migrations ใน schema ใหม่
        #    (Alembic multi-schema migration)
        await run_tenant_migrations(schema_name)

        # 3. สร้าง default data
        await seed_tenant_defaults(db, schema_name, name, province_code)

        # 4. บันทึกใน system.tenants
        await db.execute("""
            INSERT INTO system.tenants (slug, name, province_code, db_schema, domain)
            VALUES ($1, $2, $3, $4, $5)
        """, slug, name, province_code, schema_name, f"{slug}.lemcs.app")

    return {"status": "provisioned", "schema": schema_name}


async def seed_tenant_defaults(db, schema: str, name: str, province_code: str):
    """สร้างข้อมูลเริ่มต้นใน tenant schema"""
    # Default affiliation (สังกัด)
    await db.execute(f"""
        INSERT INTO "{schema}".affiliations (name) VALUES
        ('สพม.{name}'), ('สอศ.{name}'), ('โรงเรียนเอกชน')
    """)
    # Default super admin ของ tenant
    await db.execute(f"""
        INSERT INTO "{schema}".users (username, role, hashed_password)
        VALUES ('admin_{schema}', 'province_admin', $1)
    """, hash_default_password(f"lemcs_{schema}_2567"))
```

---

## Tenant Middleware (FastAPI)

```python
# backend/app/middleware/tenant.py

from fastapi import Request, HTTPException
from app.services.tenant_service import get_tenant_by_slug

class TenantMiddleware:
    """
    อ่าน subdomain จาก request host
    inject tenant context ใน request.state ทุก request
    """
    async def __call__(self, request: Request, call_next):
        host = request.headers.get("host", "")
        slug = host.split(".")[0]  # "loei" จาก "loei.lemcs.app"

        # ยกเว้น system endpoints
        if slug in ("www", "api", "admin", "localhost"):
            return await call_next(request)

        tenant = await get_tenant_by_slug(slug)
        if not tenant or not tenant.is_active:
            raise HTTPException(status_code=404, detail="ไม่พบจังหวัดในระบบ")

        # inject ใน request state
        request.state.tenant = tenant
        request.state.db_schema = tenant.db_schema

        return await call_next(request)


# ใช้ใน database dependency
async def get_tenant_db(request: Request):
    """Set search_path ให้ตรงกับ tenant schema ก่อน query ทุกครั้ง"""
    schema = request.state.db_schema
    async with AsyncSession(engine) as session:
        await session.execute(f'SET search_path TO "{schema}", public')
        yield session
```

---

## API เพิ่มเติมสำหรับ Super Admin

```
# System-level endpoints (เฉพาะ super admin เท่านั้น)
# อยู่ที่ https://system.lemcs.app/admin/

GET    /system/tenants                    ← รายชื่อจังหวัดทั้งหมด
POST   /system/tenants                    ← เพิ่ม tenant ใหม่
POST   /system/tenants/{id}/provision     ← provision schema + migrate
PATCH  /system/tenants/{id}/activate      ← เปิดใช้งาน
PATCH  /system/tenants/{id}/suspend       ← ระงับการใช้งาน
GET    /system/tenants/{id}/stats         ← สถิติการใช้งาน
GET    /system/dashboard                  ← ภาพรวมทุกจังหวัด (cross-tenant)
GET    /system/reports/national           ← รายงานระดับประเทศ (anonymized)
```

---

## Super Admin Dashboard (system.lemcs.app)

```
หน้าที่ต้องสร้างใน /app/(system)/ :

/system/login              ← login สำหรับ super admin เท่านั้น
/system/dashboard          ← ภาพรวมทุก tenant
/system/tenants            ← จัดการจังหวัด (เพิ่ม/ระงับ/ดูสถิติ)
/system/tenants/new        ← ฟอร์มเพิ่มจังหวัดใหม่ + auto-provision
/system/tenants/[slug]     ← รายละเอียด + config ของแต่ละ tenant
/system/reports            ← รายงาน cross-tenant (anonymized)
/system/subscriptions      ← จัดการ plan / billing
```

### ข้อมูลที่ Super Admin เห็นได้

```python
# Cross-tenant stats (anonymized — ไม่เห็นข้อมูลส่วนตัวนักเรียน)
SUPER_ADMIN_CAN_SEE = [
    "จำนวนนักเรียนต่อจังหวัด",
    "จำนวนการทำแบบประเมินต่อเดือน",
    "สัดส่วน severity level แต่ละจังหวัด (aggregated)",
    "อัตราการใช้งานระบบ (active users)",
    "จำนวน alert ที่เกิดขึ้น (ไม่มีชื่อนักเรียน)",
]

SUPER_ADMIN_CANNOT_SEE = [
    "ชื่อ-นามสกุลนักเรียน",
    "ผลการประเมินรายบุคคล",
    "ข้อมูล sensitive ทุกประเภท",
]
```

---

## Subscription Plans

```python
PLANS = {
    "trial": {
        "max_students": 500,
        "duration_days": 90,
        "price": 0,
        "features": ["ST5", "PHQA", "CDI", "basic_report"],
    },
    "basic": {
        "max_students": 30000,
        "price_per_year": 50000,  # บาทต่อปี
        "features": ["ST5", "PHQA", "CDI", "full_report", "excel_export", "line_notify"],
    },
    "pro": {
        "max_students": 150000,
        "price_per_year": 120000,
        "features": ["all_basic", "pdf_export", "api_access", "custom_theme", "priority_support"],
    },
    "enterprise": {
        "max_students": "unlimited",
        "price": "custom",
        "features": ["all_pro", "dedicated_db", "sla_99_9", "on_premise_option"],
    },
}
```

---

## Docker Compose เพิ่มเติม

```yaml
# เพิ่มใน docker-compose.yml

services:
  # ... services เดิมทั้งหมด ...

  # System admin portal (แยกจาก tenant frontend)
  system-admin:
    build:
      context: ./frontend
      args:
        APP_TYPE: system
    ports: ["3002:3000"]
    environment:
      - NEXT_PUBLIC_API_URL=https://system-api.lemcs.app
      - APP_MODE=system_admin
    restart: unless-stopped
```

---

## Nginx Proxy Manager Rules เพิ่มเติม

```nginx
# Wildcard subdomain → tenant frontend
*.lemcs.app → frontend:3000

# System admin portal
system.lemcs.app → system-admin:3002

# API routing (ใส่ tenant slug ใน header อัตโนมัติ)
*.lemcs.app/api/* → backend:8000
system.lemcs.app/api/* → backend:8000
```

---

## ขั้นตอนเพิ่ม Tenant ใหม่ (Step-by-step)

```
1. Super admin เข้า system.lemcs.app
2. กรอกข้อมูลจังหวัด: ชื่อ / รหัสจังหวัด / ชื่อผู้ติดต่อ
3. กด "Provision" → ระบบสร้าง schema + migrate + seed อัตโนมัติ
4. ระบบสร้าง admin account เริ่มต้นให้จังหวัดนั้น
5. ส่ง email แจ้ง credential ให้ผู้ดูแลจังหวัด
6. ผู้ดูแลจังหวัดเข้า {slug}.lemcs.app/admin และเปลี่ยน password
7. นำเข้าข้อมูลนักเรียน CSV
8. พร้อมใช้งาน
```

---

## Checklist ความปลอดภัย Multi-Tenant

- [ ] `TenantMiddleware` ต้องทำงานทุก request ก่อน auth
- [ ] ทุก DB query ต้อง set `search_path` ตาม tenant_id
- [ ] ห้าม cross-tenant query — ต้องมี unit test ยืนยัน
- [ ] Super admin token แยกจาก tenant admin token ชัดเจน
- [ ] Rate limit แยกต่อ tenant (Redis key: `ratelimit:{tenant}:{ip}`)
- [ ] Backup แยกต่อ tenant schema (`pg_dump -n {schema}`)
- [ ] Log แยกต่อ tenant ใน Grafana (label: `tenant={slug}`)
- [ ] PDPA: ข้อมูลแต่ละจังหวัดห้ามข้ามไปยังจังหวัดอื่นเด็ดขาด

---

## การ Scale ในอนาคต

```
Phase 1 (ปัจจุบัน):   Schema-per-tenant บน server เดียว (Portainer)
Phase 2 (10+ จังหวัด): Read replica PostgreSQL + Redis Cluster
Phase 3 (แห่งชาติ):    Kubernetes + แต่ละจังหวัดใหญ่ได้ dedicated namespace
Phase 4 (SaaS):        Multi-region deployment + DB-per-tenant สำหรับ enterprise
```

---
*LEMCS Multi-Tenant Extension | รองรับการขยายระดับภาค → ระดับประเทศ*
