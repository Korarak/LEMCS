import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.deps import get_current_student
from app.schemas.assessment import (
    AssessmentSubmitRequest, AssessmentResponse, AutosaveRequest
)
from app.models.db_models import Assessment, Student
from app.services.scoring import calculate_score
from app.services.recommendation_service import get_recommendations
from app.services.alert_service import check_and_trigger_alert
import redis.asyncio as aioredis
from app.config import settings
from sqlalchemy import select
from datetime import date

router = APIRouter()
redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)


def get_current_academic_year() -> str:
    """ปีการศึกษาไทย (พ.ศ. + 543)"""
    y = date.today().year + 543
    # ภาคเรียนที่ 2 เริ่ม พ.ย. — ใช้ปีเดิม; ภาคเรียนที่ 1 เริ่ม พ.ค. — ปีใหม่
    return str(y)


def get_current_term() -> int:
    m = date.today().month
    return 1 if m >= 5 else 2


@router.get("/available")
async def get_available_assessments(
    current_user: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db)
):
    """รายการแบบประเมินที่นักเรียนต้องทำในภาคเรียนนี้"""
    from datetime import date as dt
    today = dt.today()
    age = today.year - (current_user.birthdate.year if current_user.birthdate else today.year)
    if current_user.birthdate:
        if (today.month, today.day) < (current_user.birthdate.month, current_user.birthdate.day):
            age -= 1

    # routing rule (เงื่อนไขอายุ):
    #   ST-5  → age ≥ 15
    #   CDI   → age 7–17  (Maria Kovacs 1985)
    #   PHQ-A → age 11–20
    #   overlap 15–17: ST-5 + CDI + PHQ-A ทั้ง 3 แบบ
    #   overlap 11–14: CDI + PHQ-A
    assessments: list[dict] = []
    if current_user.birthdate is not None:
        if age >= 15:
            assessments.append({
                "type": "ST5",
                "name_th": "แบบประเมินความเครียด (ST-5)",
                "question_count": 5,
                "estimated_minutes": 2,
            })
        if 7 <= age <= 17:
            assessments.append({
                "type": "CDI",
                "name_th": "แบบประเมินภาวะซึมเศร้าในเด็กและวัยรุ่น (CDI)",
                "question_count": 27,
                "estimated_minutes": 10,
            })
        if 11 <= age <= 20:
            assessments.append({
                "type": "PHQA",
                "name_th": "แบบประเมินภาวะซึมเศร้าวัยรุ่น (PHQ-A)",
                "question_count": 11,
                "estimated_minutes": 5,
            })
    return assessments


@router.post("/autosave")
async def autosave_draft(
    body: AutosaveRequest,
    current_user: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db)
):
    """บันทึก draft อัตโนมัติ"""
    await redis_client.setex(
        f"draft:{current_user.id}:{body.assessment_type}",
        3600,
        json.dumps(body.responses)
    )
    return {"saved": True}


@router.post("/submit", response_model=AssessmentResponse)
async def submit_assessment(
    body: AssessmentSubmitRequest,
    current_user: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db)
):
    """ส่งคำตอบ + คำนวณคะแนน + บันทึก + trigger alert"""

    # 0. ตรวจสอบเงื่อนไขอายุก่อนรับคำตอบ
    if current_user.birthdate:
        today = date.today()
        age = today.year - current_user.birthdate.year
        if (today.month, today.day) < (current_user.birthdate.month, current_user.birthdate.day):
            age -= 1
        atype = body.assessment_type.upper()
        age_ok = (
            (atype == "ST5"  and age >= 15) or
            (atype == "CDI"  and 7 <= age <= 17) or
            (atype == "PHQA" and 11 <= age <= 20)
        )
        if not age_ok:
            raise HTTPException(status_code=400, detail=f"แบบประเมิน {body.assessment_type} ไม่เหมาะสมกับอายุ {age} ปี")

    # 1. คำนวณคะแนน
    try:
        result = calculate_score(body.assessment_type, body.responses)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 2. บันทึกลง database
    assessment = Assessment(
        student_id=current_user.id,
        assessment_type=body.assessment_type,
        responses=body.responses,
        score=result["score"],
        severity_level=result["severity_level"],
        suicide_risk=result.get("suicide_risk", False),
        academic_year=get_current_academic_year(),
        term=get_current_term(),
    )
    db.add(assessment)
    await db.commit()
    await db.refresh(assessment)

    # 3. ลบ draft
    await redis_client.delete(f"draft:{current_user.id}:{body.assessment_type}")

    # 4. Trigger alert
    await check_and_trigger_alert(db, assessment, current_user)
    await db.commit()

    # 5. Return ผล
    return AssessmentResponse(
        id=str(assessment.id),
        assessment_type=body.assessment_type,
        score=result["score"],
        severity_level=result["severity_level"],
        suicide_risk=result.get("suicide_risk", False),
        recommendations=get_recommendations(body.assessment_type, result["severity_level"]),
        created_at=assessment.created_at,
    )


@router.get("/history", response_model=list[AssessmentResponse])
async def get_assessment_history(
    current_user: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db)
):
    """ดึงประวัติการทำประเมินของนักเรียนเรียงจากล่าสุด"""
    res = await db.execute(
        select(Assessment)
        .where(Assessment.student_id == current_user.id)
        .order_by(Assessment.created_at.desc())
    )
    assessments = res.scalars().all()

    return [
        AssessmentResponse(
            id=str(a.id),
            assessment_type=a.assessment_type,
            score=a.score,
            severity_level=a.severity_level,
            suicide_risk=a.suicide_risk,
            recommendations=get_recommendations(a.assessment_type, a.severity_level),
            created_at=a.created_at,
        ) for a in assessments
    ]


@router.get("/result/{assessment_id}", response_model=AssessmentResponse)
async def get_assessment_result(
    assessment_id: str,
    current_user: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db)
):
    """ดึงผลการประเมิน (สำหรับหน้า Result)"""
    res = await db.execute(
        select(Assessment).where(
            Assessment.id == assessment_id,
            Assessment.student_id == current_user.id,
        )
    )
    assessment = res.scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=404, detail="ไม่พบผลประเมิน")

    return AssessmentResponse(
        id=str(assessment.id),
        assessment_type=assessment.assessment_type,
        score=assessment.score,
        severity_level=assessment.severity_level,
        suicide_risk=assessment.suicide_risk,
        recommendations=get_recommendations(assessment.assessment_type, assessment.severity_level),
        created_at=assessment.created_at,
    )
