# LEMCS — Running Guide

Complete instructions for running the stack in **Development** and **Production** mode.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Docker Desktop | 4.x+ | https://docs.docker.com/desktop/ |
| Docker Compose | v2 (bundled with Docker Desktop) | — |
| Node.js *(local dev only)* | 20.x LTS | https://nodejs.org/ |
| Python *(local dev only)* | 3.12.x | https://python.org/ |

Verify your install:
```bash
docker --version          # Docker version 24.x.x
docker compose version    # Docker Compose version v2.x.x
node --version            # v20.x.x
python --version          # Python 3.12.x
```

---

## 1. First-Time Setup

**Run this once before anything else.**

```bash
# Clone / enter the project
cd D:/@LEMCS

# Copy environment file
cp .env.example .env
```

Open `.env` and set these required values:

```dotenv
# ── Security (MUST change before first run) ──────────────────────
SECRET_KEY=your-super-secret-jwt-key-minimum-32-characters-long
ENCRYPTION_KEY=12345678901234567890123456789012   # exactly 32 chars — AES-256

# ── Database ──────────────────────────────────────────────────────
POSTGRES_PASSWORD=strong_password_here
POSTGRES_USER=lemcs_user
POSTGRES_DB=lemcs

# ── MinIO ─────────────────────────────────────────────────────────
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=strong_minio_secret

# ── Monitoring ────────────────────────────────────────────────────
GRAFANA_PASSWORD=admin
```

> ⚠️ `ENCRYPTION_KEY` **must be exactly 32 characters** — AES-256 requires this.
> The system will crash on startup if it is the wrong length.

---

## 2. Development Mode (Docker) — Recommended

This uses Docker for all infrastructure (PostgreSQL, Redis, MinIO, etc.)
and mounts your local source code for **hot reload** on both frontend and backend.

### Start

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

Add `-d` to run in background:
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

### What runs in dev mode

| Service | URL | Notes |
|---|---|---|
| Frontend (Next.js) | http://localhost:3000 | Hot reload — changes appear instantly |
| Backend (FastAPI) | http://localhost:8000 | Auto-reload on Python file save |
| API Docs (Swagger) | http://localhost:8000/docs | Interactive API docs |
| PostgreSQL | localhost:5432 | Direct DB access available |
| MinIO Console | http://localhost:9001 | Username/password from `.env` |
| Grafana | http://localhost:3001 | admin / `GRAFANA_PASSWORD` |
| Prometheus | http://localhost:9090 | Metrics scraper |

### Test credentials (auto-seeded on startup)

#### นักเรียน (Student Login — `/login`)

| Field | Value |
|---|---|
| เลขบัตรประชาชน | `1234567890123` |
| วันเดือนปีเกิด | 1 มกราคม 2543 (2000-01-01) |
| รหัสนักเรียน | `12345` |

#### ผู้ดูแลระบบ (Admin Login — `/admin-login`)

รหัสผ่านทุก account: **`password123`**

**ระดับระบบ**

| Username | Role | ขอบเขต |
|---|---|---|
| `admin` | systemadmin | ระบบทั้งหมด (สูงสุด) |
| `superadmin` | superadmin | จังหวัดเลยทั้งหมด |

**ระดับเขตพื้นที่ / สังกัด (commissionadmin)**

| Username | สังกัด / เขต |
|---|---|
| `avc_admin` | สำนักงานอาชีวศึกษาจังหวัดเลย |
| `spp1_admin` | สพป.เลย เขต 1 |
| `spp2_admin` | สพป.เลย เขต 2 |
| `spp3_admin` | สพป.เลย เขต 3 |
| `spm_admin` | สพม.เลย-หนองบัวลำภู |
| `prv_admin` | การศึกษาเอกชนจังหวัดเลย |
| `skr_admin` | ส่งเสริมการเรียนรู้จังหวัดเลย |

**ระดับโรงเรียน (schooladmin)**

| Username | โรงเรียน |
|---|---|
| `vtl_admin` | วิทยาลัยเทคนิคเลย |
| `voc_admin` | วิทยาลัยอาชีวศึกษาเลย |
| `vtw_admin` | วิทยาลัยการอาชีพวังสะพุง |
| `anl_admin` | โรงเรียนอนุบาลเลย |
| `ml_admin` | โรงเรียนเมืองเลย |
| `nnm_admin` | โรงเรียนบ้านนาน้ำมัน |
| `wsp_admin` | โรงเรียนชุมชนบ้านวังสะพุง |
| `ck_admin` | โรงเรียนบ้านเชียงคาน |
| `tl_admin` | โรงเรียนบ้านท่าลี่ |
| `lp_admin` | โรงเรียนเลยพิทยาคม |
| `la_admin` | โรงเรียนเลยอนุกูลวิทยา |
| `ndw_admin` | โรงเรียนนาด้วงวิทยา |
| `ckw_admin` | โรงเรียนเชียงคานวิทยาคม |
| `ssk_admin` | โรงเรียนศรีสองรักษ์วิทยา |
| `stw_admin` | โรงเรียนแสงตะวันพัฒนา |
| `drw_admin` | โรงเรียนดาวเรืองวิทยา |
| `nfe_admin` | ศูนย์การเรียนรู้ กศน.อ.เมืองเลย |

> ลำดับสิทธิ์: `systemadmin` > `superadmin` > `commissionadmin` > `schooladmin` > `student`

### Stop

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```

---

## 3. Development Mode (Local — without Docker)

Use this if you want faster startup or prefer running services natively.
You still need Docker for the infrastructure services (postgres/redis/minio).

### Step 1 — Start only infrastructure services

```bash
docker compose up postgres pgbouncer redis minio -d
```

### Step 2 — Backend (FastAPI)

```bash
cd backend

# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Update .env: connect directly to localhost
# POSTGRES_HOST=localhost
# POSTGRES_PORT=5432
# REDIS_URL=redis://localhost:6379/0

# Run with hot reload
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Step 3 — Frontend (Next.js)

```bash
cd frontend

npm install
npm run dev
```

Frontend will be available at http://localhost:3000.

---

## 4. Production Mode

Production builds optimized images, runs 4 Uvicorn workers, and includes the
backup scheduler + full monitoring stack.

### Build & Start

```bash
# 1. Make sure .env is configured (see Section 1)

# 2. Build all images
docker compose build

# 3. Start all services in background
docker compose up -d
```

### Verify everything is healthy

```bash
docker compose ps
```

All services should show `healthy` or `running`. Expected output:

```
NAME                STATUS
lemcs-frontend      running (healthy)
lemcs-backend       running (healthy)
lemcs-postgres      running (healthy)
lemcs-pgbouncer     running
lemcs-redis         running (healthy)
lemcs-minio         running (healthy)
lemcs-prometheus    running
lemcs-grafana       running
lemcs-backup        running
```

### Stop

```bash
docker compose down
```

---

## 5. Rebuild from Scratch

Use this when you want a completely clean slate (new images, empty database).

### Soft rebuild — rebuild images, keep data

```bash
# Stop everything
docker compose down

# Rebuild images without using Docker layer cache
docker compose build --no-cache

# Start again
docker compose up -d
```

### Hard rebuild — rebuild images AND wipe all data

```bash
# Stop and remove containers + volumes (deletes all database data)
docker compose down -v

# Remove old images
docker compose down --rmi all

# Rebuild from scratch
docker compose build --no-cache

# Start fresh — database will be re-seeded automatically
docker compose up -d
```

> ⚠️ `down -v` **permanently deletes** all PostgreSQL data, Redis cache, and MinIO files.

### Rebuild a single service

```bash
# Rebuild and restart only the backend
docker compose build backend
docker compose up -d --no-deps backend

# Rebuild and restart only the frontend
docker compose build frontend
docker compose up -d --no-deps frontend
```

---

## 6. Useful Commands

### Logs

```bash
# Follow all logs
docker compose logs -f

# Follow a specific service
docker compose logs -f backend
docker compose logs -f frontend

# Last 100 lines
docker compose logs --tail=100 backend
```

### Shell access

```bash
# Enter backend container
docker compose exec backend bash

# Enter postgres container
docker compose exec postgres psql -U lemcs_user -d lemcs

# Enter redis container
docker compose exec redis redis-cli
```

### Database

```bash
# Full database dump
docker compose exec postgres pg_dump -U lemcs_user lemcs > backup.sql

# Restore from dump
docker compose exec -T postgres psql -U lemcs_user lemcs < backup.sql
```

### Frontend

```bash
# Lint
cd frontend && npm run lint

# Production build (local check)
cd frontend && npm run build
```

### Backend

```bash
# Run inside venv
cd backend
source venv/bin/activate   # or venv\Scripts\activate on Windows

# Check API health
curl http://localhost:8000/health
```

---

## 7. Environment Variables Reference

| Variable | Required | Example | Description |
|---|:---:|---|---|
| `SECRET_KEY` | ✅ | `abc...xyz` (32+ chars) | JWT signing key |
| `ENCRYPTION_KEY` | ✅ | `12345678901234567890123456789012` | AES-256 key — **must be exactly 32 chars** |
| `POSTGRES_HOST` | ✅ | `pgbouncer` (prod) / `postgres` (local) | DB host |
| `POSTGRES_PORT` | ✅ | `5432` | DB port |
| `POSTGRES_DB` | ✅ | `lemcs` | Database name |
| `POSTGRES_USER` | ✅ | `lemcs_user` | DB username |
| `POSTGRES_PASSWORD` | ✅ | strong password | DB password |
| `REDIS_URL` | ✅ | `redis://redis:6379/0` | Redis connection URL |
| `MINIO_ENDPOINT` | ✅ | `minio:9000` | MinIO host:port |
| `MINIO_ACCESS_KEY` | ✅ | `minioadmin` | MinIO username |
| `MINIO_SECRET_KEY` | ✅ | strong password | MinIO password |
| `API_BASE_URL` | ✅ | `http://localhost:8000` | Public API URL (used by frontend) |
| `DEBUG` | | `True` / `False` | Enables `/docs` when True |
| `GRAFANA_PASSWORD` | | `admin` | Grafana admin password |
| `LINE_NOTIFY_TOKEN` | | — | LINE Notify integration (optional) |
| `SMTP_HOST` | | — | Email server (optional) |

---

## 8. Service Architecture

```
Browser / Mobile
      │
      ▼
┌─────────────┐       ┌──────────────────┐
│  Next.js    │──────▶│  FastAPI         │
│  :3000      │       │  :8000           │
│  (PWA)      │       │  (4 workers)     │
└─────────────┘       └────────┬─────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
     ┌──────────────┐  ┌─────────────┐  ┌─────────────┐
     │  PgBouncer   │  │  Redis 7    │  │  MinIO      │
     │  :5432       │  │  (cache)    │  │  :9000/9001 │
     └──────┬───────┘  └─────────────┘  └─────────────┘
            ▼
     ┌──────────────┐
     │  PostgreSQL  │
     │  16-alpine   │
     └──────────────┘
```

---

## 9. Troubleshooting

### Port already in use

```bash
# Find what's using port 3000
netstat -ano | findstr :3000   # Windows
lsof -i :3000                  # macOS/Linux

# Kill the process (Windows)
taskkill /PID <PID> /F
```

### Frontend hot reload not working on Windows

Ensure `WATCHPACK_POLLING=true` is set in `docker-compose.dev.yml` — it already is by default.

### Backend fails to start — ENCRYPTION_KEY error

```
ValueError: ENCRYPTION_KEY must be exactly 32 characters
```

Fix: Count the characters in your `.env` `ENCRYPTION_KEY` — it must be **exactly 32**.

### Database connection refused

```bash
# Check postgres is healthy
docker compose ps postgres

# Check logs
docker compose logs postgres
```

If postgres is not healthy, check `POSTGRES_USER` / `POSTGRES_PASSWORD` match `.env`.

### "Table does not exist" on first run

The tables are auto-created by SQLAlchemy on startup. If this happens:
```bash
# Restart the backend to trigger table creation
docker compose restart backend
docker compose logs -f backend
```

### Container exits immediately

```bash
# Check for config errors
docker compose logs backend | tail -30
```

Most common cause: missing or invalid `.env` values.

### Reset everything and start clean

```bash
docker compose down -v --rmi all
cp .env.example .env
# edit .env ...
docker compose build --no-cache
docker compose up -d
```
