# Phase 5 — Alert System & Notifications
## LEMCS Developer Guide

> ก่อนอ่านไฟล์นี้: Phase 1–4 ต้องผ่าน checklist ครบแล้ว

---

## เป้าหมายของ Phase 5

- [x] Alert triggers ครบตาม spec (PHQA, CDI, Suicide Risk)
- [x] LINE Notify webhook
- [x] Email SMTP notification
- [x] In-app notification (admin dashboard)
- [x] Case management (assign + track status)
- [x] Alert list page พร้อม filter + status update

---

## ขั้นตอน 1: Notification Service

### backend/app/services/notification_service.py

```python
import httpx
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings

async def send_line_notify(token: str, message: str) -> bool:
    """
    ส่งข้อความผ่าน LINE Notify
    https://notify-bot.line.me/doc/en/
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://notify-api.line.me/api/notify",
                headers={"Authorization": f"Bearer {token}"},
                data={"message": message},
                timeout=10.0,
            )
            return response.status_code == 200
    except Exception as e:
        print(f"LINE Notify error: {e}")
        return False

async def send_email(to_email: str, subject: str, body: str) -> bool:
    """ส่ง Email ผ่าน SMTP"""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_USER
        msg["To"] = to_email
        msg.attach(MIMEText(body, "html", "utf-8"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"Email error: {e}")
        return False

def build_alert_message(assessment, student, level: str) -> str:
    """สร้างข้อความแจ้งเตือนภาษาไทย"""
    assessment_name = {
        "ST5": "ความเครียด (ST-5)",
        "PHQA": "ภาวะซึมเศร้า (PHQ-A)",
        "CDI": "ภาวะซึมเศร้า (CDI)",
    }.get(assessment.assessment_type, assessment.assessment_type)

    severity_th = {
        "none": "ไม่มีอาการ", "normal": "ปกติ",
        "mild": "น้อย", "moderate": "ปานกลาง",
        "severe": "มาก", "very_severe": "รุนแรงมาก", "clinical": "ต้องดูแล",
    }.get(assessment.severity_level, assessment.severity_level)

    emoji = {"warning": "⚠️", "urgent": "🔴", "critical": "🚨"}.get(level, "📢")

    lines = [
        f"{emoji} LEMCS แจ้งเตือน: นักเรียนต้องการความช่วยเหลือ",
        f"",
        f"โรงเรียน: {student.school_name}",
        f"ระดับชั้น: {student.grade} ห้อง {student.classroom}",
        f"แบบประเมิน: {assessment_name}",
        f"ระดับ: {severity_th} (คะแนน {assessment.score})",
    ]

    if assessment.suicide_risk:
        lines.extend([
            f"",
            f"🚨🚨🚨 พบความเสี่ยงการฆ่าตัวตาย — ต้องดำเนินการทันที 🚨🚨🚨",
            f"กรุณาติดต่อนักเรียนและผู้ปกครองทันที",
        ])

    lines.extend([
        f"",
        f"เข้าดูรายละเอียดใน LEMCS: {settings.FRONTEND_URL}/admin/alerts",
    ])

    return "\n".join(lines)
```

---

## ขั้นตอน 2: Alert Router

### backend/app/routers/alerts.py

```python
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, update
from app.database import get_db
from app.deps import get_current_admin_user
from app.schemas.alert import AlertUpdateRequest
from app.models.db_models import Alert, Student, Assessment, School, Notification, AuditLog

router = APIRouter()

@router.get("")
async def list_alerts(
    status: str | None = Query(None),
    level: str | None = Query(None),
    school_id: int | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    current_user = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """รายการ alerts กรองตาม role ของผู้ใช้โดยอัตโนมัติ"""
    query = (
        select(
            Alert,
            Student.grade,
            Student.classroom,
            School.name.label("school_name"),
            Assessment.assessment_type,
            Assessment.score,
            Assessment.suicide_risk,
        )
        .join(Student, Alert.student_id == Student.id)
        .join(School, Student.school_id == School.id)
        .join(Assessment, Alert.assessment_id == Assessment.id)
    )

    # Role-based scope
    if current_user.role == "teacher":
        query = query.where(Student.school_id == current_user.school_id)
    elif current_user.role == "school_admin":
        query = query.where(Student.school_id == current_user.school_id)
    # district_admin, province_admin, superadmin → see all

    if status:
        query = query.where(Alert.status == status)
    if level:
        query = query.where(Alert.alert_level == level)
    if school_id:
        query = query.where(Student.school_id == school_id)

    query = query.order_by(Alert.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "id": str(row.Alert.id),
            "alert_level": row.Alert.alert_level,
            "status": row.Alert.status,
            "note": row.Alert.note,
            "grade": row.grade,
            "classroom": row.classroom,
            "school_name": row.school_name,
            "assessment_type": row.assessment_type,
            "score": row.score,
            "suicide_risk": row.suicide_risk,
            "created_at": row.Alert.created_at.isoformat(),
        }
        for row in rows
    ]

@router.get("/{alert_id}")
async def get_alert(
    alert_id: str,
    current_user = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """รายละเอียด alert + ข้อมูลนักเรียน (anonymized บางส่วน)"""
    result = await db.execute(
        select(Alert, Student, School.name.label("school_name"), Assessment)
        .join(Student, Alert.student_id == Student.id)
        .join(School, Student.school_id == School.id)
        .join(Assessment, Alert.assessment_id == Assessment.id)
        .where(Alert.id == alert_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(404, "ไม่พบ alert")

    # Audit log
    db.add(AuditLog(
        user_id=current_user.id,
        action="view_alert",
        resource=f"alert:{alert_id}",
        details={"alert_level": row.Alert.alert_level},
    ))

    return {
        "id": str(row.Alert.id),
        "alert_level": row.Alert.alert_level,
        "status": row.Alert.status,
        "note": row.Alert.note,
        "assigned_to": str(row.Alert.assigned_to) if row.Alert.assigned_to else None,
        "student": {
            "grade": row.Student.grade,
            "classroom": row.Student.classroom,
            "gender": row.Student.gender,
            "school_name": row.school_name,
            # ⚠️ PDPA: ไม่ส่ง first_name, last_name, national_id ผ่าน API
        },
        "assessment": {
            "type": row.Assessment.assessment_type,
            "score": row.Assessment.score,
            "severity_level": row.Assessment.severity_level,
            "suicide_risk": row.Assessment.suicide_risk,
            "created_at": row.Assessment.created_at.isoformat(),
        },
        "created_at": row.Alert.created_at.isoformat(),
    }

@router.patch("/{alert_id}")
async def update_alert(
    alert_id: str,
    body: AlertUpdateRequest,
    current_user = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """อัปเดตสถานะ case + บันทึก note + assign ผู้รับผิดชอบ"""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(404, "ไม่พบ alert")

    if body.status:
        alert.status = body.status
    if body.note:
        alert.note = (alert.note or "") + f"\n[{current_user.role}] {body.note}"
    if body.assigned_to:
        alert.assigned_to = body.assigned_to

    # Audit log
    db.add(AuditLog(
        user_id=current_user.id,
        action="update_alert",
        resource=f"alert:{alert_id}",
        details={"status": body.status, "assigned_to": body.assigned_to},
    ))

    await db.flush()
    return {"id": str(alert.id), "status": alert.status, "updated": True}

# Pydantic Schema
# backend/app/schemas/alert.py
from pydantic import BaseModel

class AlertUpdateRequest(BaseModel):
    status: str | None = None       # new|acknowledged|in_progress|referred|closed
    note: str | None = None
    assigned_to: str | None = None  # user UUID
```

---

## ขั้นตอน 3: In-App Notification Service

### backend/app/services/notification_service.py (เพิ่มเติม)

```python
from app.models.db_models import Notification

async def create_in_app_notification(
    db, user_id: str, title: str, message: str, link: str = None
):
    """สร้าง in-app notification สำหรับแสดงใน admin dashboard"""
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        link=link,
    )
    db.add(notification)
    await db.flush()
    return notification
```

### เพิ่ม endpoint สำหรับอ่าน notifications

```python
# backend/app/routers/alerts.py (เพิ่มเติม)

@router.get("/notifications/me")
async def my_notifications(
    limit: int = Query(20, le=100),
    current_user = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """รายการ in-app notifications ของผู้ใช้"""
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    notifications = result.scalars().all()
    unread_count = sum(1 for n in notifications if not n.is_read)

    return {
        "unread_count": unread_count,
        "notifications": [
            {
                "id": str(n.id),
                "title": n.title,
                "message": n.message,
                "link": n.link,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat(),
            }
            for n in notifications
        ]
    }

@router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """อ่าน notification แล้ว"""
    await db.execute(
        update(Notification)
        .where(and_(Notification.id == notification_id, Notification.user_id == current_user.id))
        .values(is_read=True)
    )
    return {"marked": True}
```

---

## ขั้นตอน 3 (Frontend): Alert List Page (Admin)

### app/(admin)/alerts/page.tsx

```typescript
"use client";

import { useState } from "react";
import { useAlerts } from "@/hooks/useAlerts";
import AlertCard from "@/components/alerts/AlertCard";

const STATUS_OPTIONS = [
  { value: "", label: "ทุกสถานะ" },
  { value: "new", label: "ใหม่" },
  { value: "acknowledged", label: "รับทราบแล้ว" },
  { value: "in_progress", label: "กำลังดำเนินการ" },
  { value: "referred", label: "ส่งต่อแล้ว" },
  { value: "closed", label: "ปิดเคส" },
];

const LEVEL_OPTIONS = [
  { value: "", label: "ทุกระดับ" },
  { value: "warning",  label: "⚠️ เฝ้าระวัง" },
  { value: "urgent",   label: "🔴 เร่งด่วน" },
  { value: "critical", label: "🚨 วิกฤต" },
];

export default function AlertsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const { alerts, isLoading, mutate } = useAlerts({ status: statusFilter, level: levelFilter });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">การแจ้งเตือน</h1>
        {alerts?.filter((a: any) => a.status === "new").length > 0 && (
          <span className="badge badge-error badge-lg">
            {alerts.filter((a: any) => a.status === "new").length} ใหม่
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          className="select select-bordered select-sm"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          className="select select-bordered select-sm"
          value={levelFilter}
          onChange={e => setLevelFilter(e.target.value)}
        >
          {LEVEL_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Alert List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="skeleton h-24 w-full rounded-xl" />)}
        </div>
      ) : alerts?.length === 0 ? (
        <div className="text-center py-16 text-base-content/40">
          <p className="text-4xl mb-3">✅</p>
          <p>ไม่มีการแจ้งเตือนที่ต้องดำเนินการ</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts?.map((alert: any) => (
            <AlertCard key={alert.id} alert={alert} onUpdate={mutate} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### components/alerts/AlertCard.tsx

```typescript
"use client";

import { useState } from "react";
import { api } from "@/lib/api";

const LEVEL_STYLES = {
  warning:  "border-l-4 border-warning bg-warning/5",
  urgent:   "border-l-4 border-error bg-error/5",
  critical: "border-l-4 border-error bg-error/10 ring-2 ring-error/30",
};

const LEVEL_LABELS = {
  warning:  "⚠️ เฝ้าระวัง",
  urgent:   "🔴 เร่งด่วน",
  critical: "🚨 วิกฤต",
};

const STATUS_LABELS = {
  new:           "ใหม่",
  acknowledged:  "รับทราบแล้ว",
  in_progress:   "กำลังดำเนินการ",
  referred:      "ส่งต่อแล้ว",
  closed:        "ปิดเคสแล้ว",
};

export default function AlertCard({ alert, onUpdate }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState(alert.status);
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleUpdate = async () => {
    setIsSaving(true);
    try {
      await api.patch(`/alerts/${alert.id}`, { status, note: note || undefined });
      onUpdate();
      setIsOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`card bg-base-100 shadow ${LEVEL_STYLES[alert.alert_level as keyof typeof LEVEL_STYLES]}`}>
      <div className="card-body py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">
                {LEVEL_LABELS[alert.alert_level as keyof typeof LEVEL_LABELS]}
              </span>
              <span className={`badge badge-sm ${
                alert.status === "new" ? "badge-error" :
                alert.status === "closed" ? "badge-ghost" : "badge-warning"
              }`}>
                {STATUS_LABELS[alert.status as keyof typeof STATUS_LABELS]}
              </span>
            </div>
            <p className="text-xs text-base-content/60 mt-1">
              {alert.school_name} • {alert.grade} • {alert.assessment_type} • คะแนน {alert.score}
            </p>
            {alert.suicide_risk && (
              <p className="text-xs text-error font-bold mt-1">
                🚨 พบความเสี่ยงการฆ่าตัวตาย
              </p>
            )}
          </div>

          <button
            className="btn btn-sm btn-outline"
            onClick={() => setIsOpen(!isOpen)}
          >
            จัดการ
          </button>
        </div>

        {/* Collapsible detail */}
        {isOpen && (
          <div className="mt-4 pt-4 border-t border-base-300 space-y-3">
            <select
              className="select select-bordered select-sm w-full"
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <textarea
              className="textarea textarea-bordered w-full text-sm"
              placeholder="บันทึกการดำเนินการ..."
              rows={3}
              value={note}
              onChange={e => setNote(e.target.value)}
            />

            <button
              className="btn btn-primary btn-sm w-full"
              onClick={handleUpdate}
              disabled={isSaving}
            >
              {isSaving ? <span className="loading loading-spinner loading-xs" /> : "บันทึก"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## ขั้นตอน 4: Daily Backup Script

### backend/scripts/backup.py

```python
#!/usr/bin/env python3
"""
Daily backup: pg_dump → compress → upload to MinIO
รัน: python backup.py หรือ schedule ด้วย cron/celery beat ทุกวัน 02:00
"""
import subprocess
import os
from datetime import datetime
from minio import Minio
from app.config import settings

def run_backup():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dump_filename = f"lemcs_backup_{timestamp}.sql.gz"
    dump_path = f"/tmp/{dump_filename}"

    # 1. pg_dump + compress
    cmd = [
        "pg_dump",
        f"--host={settings.POSTGRES_HOST}",
        f"--port={settings.POSTGRES_PORT}",
        f"--username={settings.POSTGRES_USER}",
        f"--dbname={settings.POSTGRES_DB}",
        "--no-password",
        "--format=plain",
    ]
    env = os.environ.copy()
    env["PGPASSWORD"] = settings.POSTGRES_PASSWORD

    with open(dump_path, "wb") as f:
        dump_proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, env=env)
        gzip_proc = subprocess.Popen(["gzip", "-c"], stdin=dump_proc.stdout, stdout=f)
        dump_proc.stdout.close()
        gzip_proc.communicate()

    # 2. Upload to MinIO
    client = Minio(
        settings.MINIO_ENDPOINT,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=False,
    )

    bucket = settings.MINIO_BUCKET_BACKUPS
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)

    client.fput_object(bucket, f"daily/{dump_filename}", dump_path)

    # 3. Cleanup local file
    os.remove(dump_path)

    print(f"✅ Backup สำเร็จ: {dump_filename}")
    return dump_filename

if __name__ == "__main__":
    run_backup()
```

### docker-compose เพิ่ม cron

```yaml
  # Backup scheduler (รันทุกวัน 02:00)
  backup-scheduler:
    build: ./backend
    command: >
      sh -c "echo '0 2 * * * cd /app && python scripts/backup.py >> /var/log/backup.log 2>&1' | crontab - && crond -f"
    env_file: .env
    depends_on:
      - postgres
      - minio
    restart: unless-stopped
```

---

## Checklist Phase 5

- [ ] PHQ-A score ≥ 10 → สร้าง alert level "warning" + แจ้งครูและนักแนะแนว
- [ ] PHQ-A score ≥ 15 → สร้าง alert level "urgent" + แจ้ง school_admin ด้วย
- [ ] PHQ-A Q9 ≥ 1 → สร้าง alert level "critical" + แจ้งทุกระดับ **ทันที** (ไม่รอ queue)
- [ ] CDI score ≥ 15 → สร้าง alert level "warning"
- [ ] LINE Notify ส่ง message ถูกต้องภาษาไทย
- [ ] Email SMTP ส่งได้
- [ ] In-app notification ถูกสร้างเมื่อมี alert ใหม่
- [ ] GET /alerts/notifications/me return unread_count
- [ ] PATCH /alerts/notifications/{id}/read อ่านแล้วทำงาน
- [ ] หน้า /admin/alerts แสดง list พร้อม filter (status + level)
- [ ] GET /alerts role-based: teacher เห็นเฉพาะโรงเรียนตัวเอง
- [ ] GET /alerts/{id} return ข้อมูลนักเรียน anonymized (ไม่มี name/national_id)
- [ ] PATCH /api/alerts/{id} อัปเดต status + note ได้
- [ ] Alert note append ด้วย role ของผู้บันทึก
- [ ] AuditLog ถูกสร้างเมื่อ view/update alert
- [ ] Backup สคริปต์รันได้ ไฟล์ขึ้น MinIO
