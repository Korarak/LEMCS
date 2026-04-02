import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
# สมมติใช้ deps ดึง mock student ไปก่อนสำหรับ Phase 1, 2 ที่เป็น bypass
# เดี๋ยวเราจะเขียน get_current_student แบบ mock ง่ายๆ
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

router = APIRouter()
redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

# ฟังก์ชันง่ายๆ ในการหา student คนปัจจุบันจาก Header แบบชั่วคราว
# เนื่องจากใน Phase 1 เรา Bypass OTP หน้าบ้านมา เราอาจจะใช้ JWT 
# แต่เพื่อความรวดเร็วในการเทสต์ Phase 2 จะใช้ Depend ดึงนักเรียนทดสอบ (12345) อัตโนมัติ (Mock)
async def get_current_student_mock(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Student).where(Student.student_code == "12345"))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=401, detail="Unauthorized (Mock student 12345 missing)")
    return student

def get_current_academic_year():
    return "2568"

def get_current_term():
    return 1

@router.get("/available")
async def get_available_assessments(
    current_user: Student = Depends(get_current_student_mock),
    db: AsyncSession = Depends(get_db)
):
    """รายการแบบประเมินที่นักเรียนต้องทำในภาคเรียนนี้"""
    # จำลองส่งกลับ 3 ชุด
    return [
        {"type": "ST5", "name_th": "แบบประเมินความเครียด (ST-5)", "question_count": 5, "estimated_minutes": 2},
        {"type": "PHQA", "name_th": "แบบประเมินภาวะซึมเศร้าเด็วัยรุ่น (PHQ-A)", "question_count": 11, "estimated_minutes": 5},
        {"type": "CDI", "name_th": "แบบประเมินภาวะซึมเศร้าในเด็ก (CDI)", "question_count": 27, "estimated_minutes": 10},
    ]

@router.post("/autosave")
async def autosave_draft(
    body: AutosaveRequest,
    current_user: Student = Depends(get_current_student_mock),
    db: AsyncSession = Depends(get_db)
):
    """บันทึก draft อัตโนมัติ"""
    await redis_client.setex(
        f"draft:{current_user.id}:{body.assessment_type}",
        3600,  # 1 ชั่วโมง
        json.dumps(body.responses)
    )
    return {"saved": True}

@router.post("/submit", response_model=AssessmentResponse)
async def submit_assessment(
    body: AssessmentSubmitRequest,
    current_user: Student = Depends(get_current_student_mock),
    db: AsyncSession = Depends(get_db)
):
    """ส่งคำตอบ + คำนวณคะแนน + บันทึก + trigger alert"""

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
    # ตรงนี้ต้อง flush เพื่อให้ได้ค่า id ออกมาใช้ก่อนที่จะไปต่อ หรือ commit เพื่อความมั่นใจ
    await db.commit()
    await db.refresh(assessment)

    # 3. ลบ draft
    await redis_client.delete(f"draft:{current_user.id}:{body.assessment_type}")

    # 4. Trigger alert
    await check_and_trigger_alert(db, assessment, current_user)
    await db.commit() # สำหรับการสร้าง Alert ใน DB

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
    current_user: Student = Depends(get_current_student_mock),
    db: AsyncSession = Depends(get_db)
):
    """ดึงประวัติการทำประเมินของนักเรียนเรียงจากล่าสุด"""
    res = await db.execute(select(Assessment).where(
        Assessment.student_id == current_user.id
    ).order_by(Assessment.created_at.desc()))
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
    current_user: Student = Depends(get_current_student_mock),
    db: AsyncSession = Depends(get_db)
):
    """ดึงผลการประเมิน (สำหรับหน้า Result)"""
    res = await db.execute(select(Assessment).where(
        Assessment.id == assessment_id, 
        Assessment.student_id == current_user.id
    ))
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
