import httpx
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings
from app.models.db_models import Notification, Assessment, Student
from sqlalchemy.ext.asyncio import AsyncSession

async def send_line_notify(token: str, message: str) -> bool:
    """
    ส่งข้อความผ่าน LINE Notify
    https://notify-bot.line.me/doc/en/
    """
    if not token or token == "YOUR_LINE_NOTIFY_TOKEN":
        print(f"[LINE Notify (Skipped - No Token)]: {message}")
        return True
        
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
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        print(f"[Email (Skipped - No SMTP Config)] To: {to_email} | Subject: {subject}")
        return True
        
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

def build_alert_message(assessment: Assessment, student: Student, level: str) -> str:
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
        f"ระดับชั้น: {student.grade} ห้อง {student.classroom}",
        f"แบบประเมิน: {assessment_name}",
        f"ระดับ: {severity_th} (คะแนน {assessment.score})",
    ]

    if getattr(assessment, "suicide_risk", False):
        lines.extend([
            f"",
            f"🚨🚨🚨 พบความเสี่ยงการฆ่าตัวตาย — ต้องดำเนินการทันที 🚨🚨🚨",
            f"กรุณาติดต่อนักเรียนและผู้ปกครองทันที",
        ])

    lines.extend([
        f"",
        f"เข้าดูรายละเอียดใน LEMCS Admin Dashboard",
    ])

    return "\n".join(lines)

async def create_in_app_notification(
    db: AsyncSession, user_id: str, title: str, message: str, link: str = None
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
