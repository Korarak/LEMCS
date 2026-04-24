"""
Survey Rounds Router
Admin เปิด/ปิดรอบการสำรวจ — นักเรียนทำแบบประเมินได้เฉพาะช่วง round ที่ open
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete, update
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.deps import get_current_admin_user, require_role
from app.models.db_models import SurveyRound, Assessment, Alert

router = APIRouter()


def _format_round(r: SurveyRound) -> dict:
    return {
        "id": str(r.id),
        "label": r.label,
        "academic_year": r.academic_year,
        "term": r.term,
        "status": r.status,
        "opened_at": r.opened_at.isoformat() if r.opened_at else None,
        "closed_at": r.closed_at.isoformat() if r.closed_at else None,
        "cancelled_at": r.cancelled_at.isoformat() if r.cancelled_at else None,
        "created_by": str(r.created_by) if r.created_by else None,
    }


@router.get("/current")
async def get_current_round(db: AsyncSession = Depends(get_db)):
    """รอบที่กำลัง open อยู่ (public — นักเรียนดูได้ด้วย)"""
    result = await db.execute(
        select(SurveyRound)
        .where(SurveyRound.status == "open")
        .order_by(SurveyRound.opened_at.desc())
        .limit(1)
    )
    r = result.scalar_one_or_none()
    return _format_round(r) if r else None


@router.get("")
async def list_rounds(
    current_user=Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """รายการรอบการสำรวจทั้งหมด (admin เท่านั้น)"""
    result = await db.execute(
        select(SurveyRound).order_by(SurveyRound.opened_at.desc())
    )
    rounds = result.scalars().all()
    return [_format_round(r) for r in rounds]


class OpenRoundBody(BaseModel):
    label: Optional[str] = None      # ถ้าไม่ระบุ auto-generate จาก academic_year + term
    academic_year: Optional[str] = None
    term: Optional[int] = None


@router.post("/open")
async def open_round(
    body: OpenRoundBody,
    current_user=Depends(require_role("systemadmin", "superadmin")),
    db: AsyncSession = Depends(get_db),
):
    """เปิดรอบสำรวจใหม่ — ต้องปิดรอบเก่าก่อน"""
    from datetime import date

    # ตรวจว่ามี round open อยู่แล้วไหม
    existing = await db.execute(
        select(SurveyRound).where(SurveyRound.status == "open")
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            400,
            "มีรอบการสำรวจที่เปิดอยู่แล้ว กรุณาปิดรอบปัจจุบันก่อนเปิดรอบใหม่"
        )

    # auto-derive academic_year + term ถ้าไม่ระบุ
    today = date.today()
    academic_year = body.academic_year or str(today.year + 543)
    term = body.term or (1 if today.month >= 5 else 2)
    label = body.label or f"ภาคเรียน {term}/{academic_year}"

    new_round = SurveyRound(
        label=label,
        academic_year=academic_year,
        term=term,
        status="open",
        created_by=current_user.id,
    )
    db.add(new_round)
    await db.commit()
    await db.refresh(new_round)
    return _format_round(new_round)


@router.post("/{round_id}/close")
async def close_round(
    round_id: str,
    current_user=Depends(require_role("systemadmin", "superadmin")),
    db: AsyncSession = Depends(get_db),
):
    """ปิดรอบสำรวจ — ข้อมูลใน round นี้จะถูกแช่แข็งสำหรับดูย้อนหลัง"""
    from datetime import datetime, timezone

    result = await db.execute(
        select(SurveyRound).where(SurveyRound.id == round_id)
    )
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(404, "ไม่พบรอบการสำรวจ")
    if r.status == "closed":
        raise HTTPException(400, "รอบนี้ปิดแล้ว")

    r.status = "closed"
    r.closed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(r)
    return _format_round(r)


@router.get("/{round_id}/stats")
async def get_round_stats(
    round_id: str,
    current_user=Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """สถิติจำนวน assessment แยกตามประเภทในรอบนี้"""
    result = await db.execute(
        select(Assessment.assessment_type, func.count().label("count"))
        .where(Assessment.survey_round_id == round_id)
        .group_by(Assessment.assessment_type)
    )
    rows = result.all()
    by_type = {row.assessment_type: row.count for row in rows}
    return {
        "total": sum(by_type.values()),
        "by_type": by_type,
    }


@router.post("/{round_id}/cancel")
async def cancel_round(
    round_id: str,
    current_user=Depends(require_role("systemadmin", "superadmin")),
    db: AsyncSession = Depends(get_db),
):
    """ยกเลิกรอบ (soft delete) — ข้อมูล assessment ยังคงอยู่ แต่รอบถูก mark ว่า cancelled"""
    from datetime import datetime, timezone

    result = await db.execute(select(SurveyRound).where(SurveyRound.id == round_id))
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(404, "ไม่พบรอบการสำรวจ")
    if r.status == "cancelled":
        raise HTTPException(400, "รอบนี้ถูกยกเลิกแล้ว")

    r.status = "cancelled"
    r.cancelled_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(r)
    return _format_round(r)


@router.delete("/{round_id}")
async def delete_round(
    round_id: str,
    current_user=Depends(require_role("systemadmin")),
    db: AsyncSession = Depends(get_db),
):
    """ลบรอบถาวร (hard delete) — ลบ assessment ทั้งหมดในรอบ, unlink alerts, แล้วลบรอบ"""
    result = await db.execute(select(SurveyRound).where(SurveyRound.id == round_id))
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(404, "ไม่พบรอบการสำรวจ")

    # ดึง assessment IDs ในรอบนี้
    asmnt_result = await db.execute(
        select(Assessment.id).where(Assessment.survey_round_id == round_id)
    )
    assessment_ids = [row[0] for row in asmnt_result.fetchall()]

    if assessment_ids:
        # Unlink alerts ที่อ้าง assessments เหล่านี้ (ไม่ลบ alert เพราะเป็นข้อมูล safety)
        await db.execute(
            update(Alert)
            .where(Alert.assessment_id.in_(assessment_ids))
            .values(assessment_id=None)
        )
        await db.execute(
            delete(Assessment).where(Assessment.survey_round_id == round_id)
        )

    await db.delete(r)
    await db.commit()
    return {"deleted": True, "assessments_removed": len(assessment_ids)}
