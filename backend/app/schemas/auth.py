from pydantic import BaseModel

class LoginRequest(BaseModel):
    student_code: str
    password: str

from datetime import date

class OTPRequest(BaseModel):
    national_id: str
    birthdate: date
    student_code: str

class OTPVerifyRequest(BaseModel):
    student_code: str
    otp: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
