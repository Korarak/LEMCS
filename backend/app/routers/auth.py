from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from app.database import get_db
from app.schemas.auth import LoginRequest, OTPRequest, SKRLoginRequest, OTPVerifyRequest, TokenResponse
from app.services.auth_service import (
    request_otp, verify_otp, create_tokens, refresh_access_token
)
from app.deps import get_current_student
from app.models.db_models import Student, School

router = APIRouter()

@router.get("/me")
async def get_me(student: Student = Depends(get_current_student), db: AsyncSession = Depends(get_db)):
    """ดึงข้อมูลนักเรียนที่ login อยู่"""
    school_name = None
    if student.school_id:
        result = await db.execute(select(School).where(School.id == student.school_id))
        school = result.scalar_one_or_none()
        school_name = school.name if school else None
    return {
        "student_code": student.student_code,
        "title": student.title,
        "first_name": student.first_name,
        "last_name": student.last_name,
        "gender": student.gender,
        "grade": student.grade,
        "classroom": student.classroom,
        "school_name": school_name,
        "birthdate": student.birthdate.isoformat() if student.birthdate else None,
    }

@router.post("/otp/request")
async def request_login_otp(body: OTPRequest, db: AsyncSession = Depends(get_db)):
    """ส่ง OTP ทาง SMS ไปยังเบอร์โทรที่ลงทะเบียนไว้"""
    from app.services.auth_service import get_student_by_code
    student = await get_student_by_code(db, body.student_code)
    if not student:
        raise HTTPException(status_code=404, detail="ไม่พบรหัสนักเรียนในระบบ")
    
    await request_otp(db, body.student_code)
    return {"message": "ส่ง OTP แล้ว"}

@router.post("/login/bypass", response_model=TokenResponse)
async def login_bypass(body: OTPRequest, db: AsyncSession = Depends(get_db)):
    """Bypass OTP สำหรับ Development: เข้าสู่ระบบได้เลยโดยไม่ต้องรอ OTP"""
    from app.services.auth_service import get_student_by_code, get_user_by_student_id, create_tokens
    from app.services.encryption import hash_pii
    
    student = await get_student_by_code(db, body.student_code)
    if not student:
        raise HTTPException(status_code=404, detail="ไม่พบรหัสนักเรียนในระบบ")
        
    # ตรวจสอบ วันเกิด และ เลขบัตรประชาชน (Hash)
    if student.birthdate != body.birthdate:
        raise HTTPException(status_code=401, detail="ข้อมูลวันเกิดไม่ถูกต้อง")
        
    if student.national_id_hash != hash_pii(body.national_id):
        raise HTTPException(status_code=401, detail="ข้อมูลเลขบัตรประชาชนไม่ถูกต้อง")
        
    user = await get_user_by_student_id(db, student.id)
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลผู้ใช้งานของนักเรียนนี้")

    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    tokens = await create_tokens(user)
    return tokens

@router.post("/login/skr", response_model=TokenResponse)
async def login_skr(body: SKRLoginRequest, db: AsyncSession = Depends(get_db)):
    """Login สำหรับนักศึกษา สกร.: ยืนยันตัวตนด้วย student_code + วันเกิด (ไม่ต้องใช้เลขบัตรปชช.)"""
    from app.services.auth_service import get_student_by_code, get_user_by_student_id, create_tokens

    student = await get_student_by_code(db, body.student_code)
    if not student:
        raise HTTPException(status_code=404, detail="ไม่พบรหัสนักศึกษาในระบบ")

    if student.birthdate != body.birthdate:
        raise HTTPException(status_code=401, detail="ข้อมูลวันเกิดไม่ถูกต้อง")

    user = await get_user_by_student_id(db, student.id)
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบข้อมูลผู้ใช้งานของนักศึกษานี้")

    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    return await create_tokens(user)


@router.post("/otp/verify", response_model=TokenResponse)
async def verify_login_otp(body: OTPVerifyRequest, db: AsyncSession = Depends(get_db)):
    """ตรวจสอบ OTP และออก JWT tokens"""
    user = await verify_otp(db, body.student_code, body.otp)
    if not user:
        raise HTTPException(status_code=401, detail="OTP ไม่ถูกต้องหรือหมดอายุ")
    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    tokens = await create_tokens(user)
    return tokens

@router.post("/login", response_model=TokenResponse)
async def login_with_password(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    """Login ด้วย username + password (สำหรับ admin/teacher)"""
    from sqlalchemy import select
    from app.models.db_models import User
    from app.services.auth_service import verify_password, create_tokens
    
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalar_one_or_none()
    
    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง")
        
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง")

    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    tokens = await create_tokens(user)
    return tokens

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(refresh_token: str, db: AsyncSession = Depends(get_db)):
    tokens = await refresh_access_token(refresh_token)
    return tokens
