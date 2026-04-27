import random
from datetime import datetime, timedelta
import redis.asyncio as aioredis
from fastapi import HTTPException
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.models.db_models import Student, User

redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
import bcrypt

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except ValueError:
        return False

async def get_student_by_code(db: AsyncSession, student_code: str) -> Student | None:
    result = await db.execute(select(Student).where(Student.student_code == student_code))
    return result.scalar_one_or_none()

async def get_user_by_student_id(db: AsyncSession, student_id: str) -> User | None:
    result = await db.execute(select(User).where(User.student_id == student_id))
    return result.scalar_one_or_none()

async def request_otp(db: AsyncSession, student_code: str):
    # 1. ตรวจสอบว่า student มีในระบบ
    student = await get_student_by_code(db, student_code)
    if not student:
        raise HTTPException(404, "ไม่พบรหัสนักเรียนในระบบ")

    # 2. สร้าง OTP 6 หลัก
    otp = str(random.randint(100000, 999999))

    # 3. บันทึกใน Redis (หมดอายุใน 5 นาที)
    await redis_client.setex(
        f"otp:{student_code}",
        300,   # 5 minutes
        otp
    )

    # 4. ส่ง SMS (ในสภาวะจริงจะต้อง Call SMS API ตรงนี้)
    # await send_sms(student.phone_number, f"รหัส OTP: {otp} (หมดอายุใน 5 นาที)")
    # สำหรับ Development ให้ Print ออก Console ชั่วคราว
    print(f"=============================")
    print(f"OTP for {student_code}: {otp}")
    print(f"=============================")

async def verify_otp(db: AsyncSession, student_code: str, otp: str) -> User | None:
    stored_otp = await redis_client.get(f"otp:{student_code}")
    if stored_otp and stored_otp == otp:
        await redis_client.delete(f"otp:{student_code}")  # ใช้ได้ครั้งเดียว
        student = await get_student_by_code(db, student_code)
        if student:
            user = await get_user_by_student_id(db, student.id)
            return user
    return None

async def create_tokens(user: User) -> dict:
    """สร้าง access + refresh token"""
    access_payload = {
        "sub": str(user.id),
        "role": user.role,
        "school_id": user.school_id,
        "exp": datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    refresh_payload = {
        "sub": str(user.id),
        "role": user.role,
        "school_id": user.school_id,
        "type": "refresh",
        "exp": datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    }
    return {
        "access_token": jwt.encode(access_payload, settings.SECRET_KEY, algorithm="HS256"),
        "refresh_token": jwt.encode(refresh_payload, settings.SECRET_KEY, algorithm="HS256"),
        "token_type": "bearer",
    }

async def refresh_access_token(refresh_token: str) -> dict:
    """ใช้ refresh token ขอ access token ใหม่"""
    try:
        payload = jwt.decode(refresh_token, settings.SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") != "refresh":
            raise ValueError("ไม่ใช่ refresh token")
        new_access = {
            "sub": payload["sub"],
            "role": payload.get("role", "student"),
            "school_id": payload.get("school_id"),
            "exp": datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        }
        return {
            "access_token": jwt.encode(new_access, settings.SECRET_KEY, algorithm="HS256"),
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }
    except Exception:
        raise HTTPException(401, "Refresh token ไม่ถูกต้องหรือหมดอายุ")
