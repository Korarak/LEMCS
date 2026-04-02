# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**LEMCS** (Loei Educational MindCare System) is a mental health assessment system for K-12 students in Loei province, Thailand. It serves 100,000+ students with ST-5 (stress), PHQ-A (adolescent depression), and CDI (child depression) surveys. UI is **Thai language only**.

## Development Commands

### Docker (recommended)
```bash
cp .env.example .env                                                        # First-time setup
docker compose -f docker-compose.yml -f docker-compose.dev.yml up          # Dev (hot reload)
docker compose up -d                                                        # Production mode
```
> See RUNNING.md for the full guide (rebuild, troubleshooting, env vars).

### Frontend (Next.js 14)
```bash
cd frontend
npm install
npm run dev       # Dev server at :3000
npm run build     # Production build
npm run lint      # ESLint
```

### Backend (FastAPI)
```bash
cd backend
python -m venv venv && source venv/Scripts/activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Service Endpoints
| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API + Swagger | http://localhost:8000/docs |
| MinIO Console | http://localhost:9001 |
| Grafana | http://localhost:3001 |
| Prometheus | http://localhost:9090 |

### Test Credentials (seeded)
- Student: code `12345`, birthdate `2000-01-01`, national ID `1234567890123`
- Admin: username `admin`, password `password123`

## Architecture

### Tech Stack
- **Frontend**: Next.js 14 App Router, TypeScript, DaisyUI + Tailwind CSS, SWR, Chart.js, next-pwa
- **Backend**: FastAPI (Python 3.12), SQLAlchemy async, Alembic, Celery
- **Database**: PostgreSQL 16 via PgBouncer, Redis 7 (cache/sessions)
- **Storage**: MinIO (object storage)
- **Auth**: JWT + OTP (SMS), AES-256 encryption for national IDs (PDPA)

### Backend Structure (`backend/app/`)
```
main.py          — App factory, lifespan hooks, router includes; auto-creates tables on startup
config.py        — Pydantic settings (all env vars)
database.py      — AsyncSessionLocal, PgBouncer pool config (transaction mode)
deps.py          — Dependency injection (get_db, get_current_user, check_scope)
models/db_models.py   — SQLAlchemy ORM (9 tables)
schemas/         — Pydantic request/response schemas (auth.py, assessment.py, alert.py)
routers/         — auth, assessments, reports, alerts, admin
services/        — Business logic: auth, scoring, export, import, notifications, recommendations
services/scoring/ — st5.py, phqa.py, cdi.py (treat as authoritative — do not change scoring logic)
middleware/rate_limit.py — 100 req/min per IP via Redis
scripts/seed.py  — Seeds test student/admin on startup
scripts/backup.py — Daily pg_dump to MinIO at 02:00
```

### Frontend Structure (`frontend/app/`)
```
(auth)/login/          — OTP + bypass login
(auth)/admin-login/    — Admin password login
(student)/dashboard/   — Assessment selection, history
(student)/assess/[type]/ — Question form (type = st5|phqa|cdi)
(student)/result/[id]/ — Score breakdown, crisis resources
admin/                 — Dashboard, students, schools, alerts, reports, settings
```

Key shared files:
- `lib/api.ts` — Axios client with auto token refresh and retry logic
- `lib/questions.ts` — All question data for ST-5, PHQ-A, CDI
- `components/assessment/` — QuestionCard, ResultCard, ProgressBar, CrisisResources
- `components/admin/` — Admin-side components (alerts, reports, student tables)
- `components/ConsentModal.tsx` — PDPA consent; must appear before first assessment

### Database Schema (9 tenant tables + 2 system tables)
Tenant tables (per-province schema, e.g. `loei.*`):
`affiliations → districts → schools → students/users → assessments → alerts → notifications → audit_logs`

System schema (`system.*`): `tenants` (province registry) + `super_admins`

`assessments` is range-partitioned by `created_at` (one partition per calendar year — add a new partition each year).

### RBAC Roles (data-scoped by org level)
`systemadmin > superadmin > commissionadmin > schooladmin > student`

### Assessment Scoring Logic
- **ST-5**: Score 0–15, levels: normal/mild/moderate/severe. No suicide flag.
- **PHQ-A**: Score 0–27 (Q1–Q9), levels: none/mild/moderate/severe/very_severe. Suicide flag if Q9 ≥ 1 or BQ1/BQ2 == true. Target: age 11–20.
- **CDI**: Score 0–54 (27 questions). Questions split into Group A (ก=0,ข=1,ค=2) and Group B (ก=2,ข=1,ค=0 — inverted). Groups are fixed sets defined in `services/scoring/cdi.py`. Levels: normal (0–14) / clinical (≥15). No suicide flag; clinical level triggers alert. Target: age < 11.

**Routing rule**: age determines which depression assessment to use. If student age < 11 → CDI; if age 11–20 → PHQ-A. All students can take ST-5.

**Alert notification channels** (in priority order): LINE Notify → Email SMTP → in-app dashboard notification.

## Key Constraints
- PostgreSQL only (no other DB); FastAPI only (no other framework)
- `ENCRYPTION_KEY` must be exactly 32 characters for AES-256 (startup crashes otherwise)
- All scoring algorithms are in `backend/app/services/scoring/` — treat as authoritative; never re-interpret thresholds
- National IDs are always AES-256 encrypted at rest; audit logs required for PDPA
- PDPA consent screen must appear before a student's **first** assessment (`ConsentModal.tsx`)
- No PII (name, national ID) in URL paths or query strings
- Session expiry: students 60 min, admin 8 hours
- Mobile-first at 375px; Thai font: `Noto Sans Thai` or `Sarabun` (Google Fonts)
- Service worker must cache all assessment questions for offline use (next-pwa)
- On `suicide_risk = true`: immediately create critical alert, notify all roles synchronously (not via queue), and show crisis hotline 1323 on the student's screen

## Documentation
- `LEMCS_DEV.md` — Primary developer reference (scoring logic, DB schema, config)
- `docs/phase1-infrastructure.md` through `docs/phase5-alerts.md` — Phase-by-phase specs
- `docs/rbac.md` — Full role permission matrix
- `docs/database-schema.md` — ER diagram and table specifications
