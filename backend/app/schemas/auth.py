from pydantic import BaseModel
from datetime import date


class LoginRequest(BaseModel):
    student_code: str
    password: str


class OTPRequest(BaseModel):
    national_id: str
    birthdate: date
    student_code: str


class SKRLoginRequest(BaseModel):
    """Login สำหรับนักศึกษา สกร. — ใช้ student_code + วันเกิด เท่านั้น (ไม่มี national_id)"""
    student_code: str
    birthdate: date


class OTPVerifyRequest(BaseModel):
    student_code: str
    otp: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
