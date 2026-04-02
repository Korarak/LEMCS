from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.config import settings
from app.models.db_models import User, Student

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# ──────────────────────────────────────────
# Role definitions
# ──────────────────────────────────────────
ADMIN_ROLES = {"systemadmin", "superadmin", "commissionadmin", "schooladmin"}
ALL_ROLES = ADMIN_ROLES | {"student"}

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """ดึง user จาก JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="ไม่สามารถยืนยันตัวตนได้",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise credentials_exception
    return user

async def get_current_student(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Student:
    """ตรวจสอบว่า user เป็นนักเรียน และดึง Student object"""
    if current_user.role != "student":
        raise HTTPException(403, "เฉพาะนักเรียนเท่านั้น")
    result = await db.execute(select(Student).where(Student.id == current_user.student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(404, "ไม่พบข้อมูลนักเรียน")
    return student

async def get_current_admin_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """ตรวจสอบว่า user เป็น admin ระดับใดระดับหนึ่ง"""
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(403, "ไม่มีสิทธิ์เข้าถึง")
    return current_user

def require_role(*allowed_roles: str):
    """Dependency สำหรับ check role เฉพาะ"""
    async def _check(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(403, f"ต้องการ role: {', '.join(allowed_roles)}")
        return current_user
    return _check

# ──────────────────────────────────────────
# Report Scope (RBAC query filtering)
# ──────────────────────────────────────────
from dataclasses import dataclass

@dataclass
class QueryScope:
    school_id: int | None = None
    district_id: int | None = None
    affiliation_id: int | None = None

async def check_report_scope(
    current_user: User,
    school_id: int | None = None,
    district_id: int | None = None,
    affiliation_id: int | None = None,
) -> QueryScope:
    """
    กรอง scope ตาม role ของผู้ใช้:
      - systemadmin / superadmin → ดูทุกอย่าง (ส่ง filter ตามที่เลือก)
      - commissionadmin → ดูเฉพาะสังกัด/เขต ของตัวเอง
      - schooladmin → ดูเฉพาะโรงเรียนของตัวเอง
    """
    if current_user.role in ("systemadmin", "superadmin"):
        # ดูทั้งหมด แต่สามารถฟิลเตอร์ตามที่เลือกได้
        return QueryScope(
            school_id=school_id,
            district_id=district_id,
            affiliation_id=affiliation_id,
        )

    elif current_user.role == "commissionadmin":
        # lock ตาม district_id หรือ affiliation_id ที่ผูกไว้กับ user
        scope = QueryScope()
        if current_user.district_id:
            scope.district_id = current_user.district_id
        elif current_user.affiliation_id:
            scope.affiliation_id = current_user.affiliation_id
        # อนุญาตให้ filter โรงเรียนย่อยภายในเขต/สังกัด
        if school_id:
            scope.school_id = school_id
        return scope

    elif current_user.role == "schooladmin":
        return QueryScope(school_id=current_user.school_id)

    else:
        raise HTTPException(403, "ไม่มีสิทธิ์ดูรายงาน")
