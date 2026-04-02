from sqlalchemy.ext.asyncio import AsyncSession
from app.models.db_models import Assessment, Alert

ALERT_RULES = {
    "PHQA": {
        10: {"level": "warning",  "notify_roles": ["teacher", "counselor"]},
        15: {"level": "urgent",   "notify_roles": ["teacher", "counselor", "schooladmin"]},
        20: {"level": "critical", "notify_roles": ["all"]},
    },
    "CDI": {
        15: {"level": "warning",  "notify_roles": ["teacher", "counselor"]},
        20: {"level": "urgent",   "notify_roles": ["teacher", "counselor", "school_admin"]},
    },
}

async def check_and_trigger_alert(db: AsyncSession, assessment: Assessment, student):
    suicide_risk = assessment.suicide_risk

    # Suicide risk = ส่งทันที ไม่รอ
    if suicide_risk:
        await create_alert(db, assessment, "critical", ["all"], immediate=True)
        return

    rules = ALERT_RULES.get(assessment.assessment_type, {})
    triggered_config = None
    for threshold in sorted(rules.keys()):
        if assessment.score >= threshold:
            triggered_config = rules[threshold]

    if triggered_config:
        await create_alert(db, assessment, triggered_config["level"],
                          triggered_config["notify_roles"])

async def create_alert(db: AsyncSession, assessment: Assessment, level: str, notify_roles: list, immediate=False):
    alert = Alert(
        student_id=assessment.student_id,
        assessment_id=assessment.id,
        alert_level=level,
        status="new",
    )
    db.add(alert)
    # เราจะ flush ทันทีเพื่อให้ alert มีไอดี (แต่จริงจะถูกคอมมิตพร้อม Assessment)
    await db.flush()

    # สำหรับ Phase 2 เราทำแค่บันทึก Alert ลงฐานข้อมูลไปก่อน (Mute notification system for now)
    print(f"⚠️ [ALERT] สร้าง Alert ระดับ {level} สำหรับนักเรียน {assessment.student_id} (แจ้งเตือน: {notify_roles})")
