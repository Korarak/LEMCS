from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, update
from app.database import get_db
from app.deps import get_current_admin_user
from app.schemas.alert import AlertUpdateRequest
from app.models.db_models import Alert, Student, Assessment, School, District, Notification, AuditLog

router = APIRouter()

@router.get("")
async def list_alerts(
    status: str | None = Query(None),
    alert_level: str | None = Query(None),
    school_id: int | None = Query(None),
    district_id: int | None = Query(None),
    affiliation_id: int | None = Query(None),
    assessment_type: str | None = Query(None),
    grade: str | None = Query(None),
    gender: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
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
            Student.gender,
            School.name.label("school_name"),
            Assessment.assessment_type,
            Assessment.score,
            Assessment.suicide_risk,
        )
        .join(Student, Alert.student_id == Student.id)
        .join(School, Student.school_id == School.id)
        .join(District, School.district_id == District.id)
        .join(Assessment, Alert.assessment_id == Assessment.id)
    )

    # Role-based scope (ล็อกตาม role ก่อน ไม่ให้ override ด้วย query param)
    if current_user.role == "schooladmin":
        query = query.where(Student.school_id == current_user.school_id)
    elif current_user.role == "commissionadmin":
        if current_user.district_id:
            query = query.where(School.district_id == current_user.district_id)
        elif current_user.affiliation_id:
            query = query.where(District.affiliation_id == current_user.affiliation_id)
    else:
        # superadmin / systemadmin — ใช้ filter จาก query param ได้
        if school_id:
            query = query.where(Student.school_id == school_id)
        elif district_id:
            query = query.where(School.district_id == district_id)
        elif affiliation_id:
            query = query.where(District.affiliation_id == affiliation_id)

    if status:
        query = query.where(Alert.status == status)
    if alert_level:
        query = query.where(Alert.alert_level == alert_level)
    if assessment_type:
        query = query.where(Assessment.assessment_type == assessment_type)
    if grade:
        query = query.where(Student.grade == grade)
    if gender:
        query = query.where(Student.gender == gender)
    if date_from:
        query = query.where(Alert.created_at >= date_from)
    if date_to:
        query = query.where(Alert.created_at <= date_to + " 23:59:59")

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
                "created_at": n.created_at.isoformat() if n.created_at else None,
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
    await db.commit()
    return {"marked": True}

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
    await db.commit()

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
            "created_at": row.Assessment.created_at.isoformat() if row.Assessment.created_at else None,
        },
        "created_at": row.Alert.created_at.isoformat() if row.Alert.created_at else None,
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

    await db.commit()
    return {"id": str(alert.id), "status": alert.status, "updated": True}
