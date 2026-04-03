from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from app.database import get_db
from app.deps import get_current_admin_user, require_role
from app.models.db_models import School, Student, District, Affiliation

router = APIRouter()

# ── Affiliation CRUD ─────────────────────────────────────────────────────────

class AffiliationBody(BaseModel):
    name: str

@router.get("/affiliations")
async def get_affiliations(
    current_user = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """ดึงรายการสังกัด"""
    query = select(Affiliation)

    if current_user.role == "commissionadmin" and current_user.affiliation_id:
        query = query.where(Affiliation.id == current_user.affiliation_id)

    result = await db.execute(query.order_by(Affiliation.name))
    affiliations = result.scalars().all()

    return [{"id": a.id, "name": a.name} for a in affiliations]

@router.post("/affiliations")
async def create_affiliation(
    body: AffiliationBody,
    current_user = Depends(require_role("systemadmin")),
    db: AsyncSession = Depends(get_db),
):
    aff = Affiliation(name=body.name.strip())
    db.add(aff)
    await db.commit()
    await db.refresh(aff)
    return {"id": aff.id, "name": aff.name}

@router.put("/affiliations/{aff_id}")
async def update_affiliation(
    aff_id: int,
    body: AffiliationBody,
    current_user = Depends(require_role("systemadmin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Affiliation).where(Affiliation.id == aff_id))
    aff = result.scalar_one_or_none()
    if not aff:
        raise HTTPException(404, "ไม่พบสังกัด")
    aff.name = body.name.strip()
    await db.commit()
    return {"id": aff.id, "name": aff.name}

@router.delete("/affiliations/{aff_id}")
async def delete_affiliation(
    aff_id: int,
    current_user = Depends(require_role("systemadmin")),
    db: AsyncSession = Depends(get_db),
):
    # Block if districts reference it
    count_result = await db.execute(
        select(func.count()).select_from(District).where(District.affiliation_id == aff_id)
    )
    if count_result.scalar() > 0:
        raise HTTPException(400, "ไม่สามารถลบได้ — ยังมีเขตพื้นที่อยู่ในสังกัดนี้")
    result = await db.execute(select(Affiliation).where(Affiliation.id == aff_id))
    aff = result.scalar_one_or_none()
    if not aff:
        raise HTTPException(404, "ไม่พบสังกัด")
    await db.delete(aff)
    await db.commit()
    return {"deleted": True}

# ── District CRUD ─────────────────────────────────────────────────────────────

class DistrictBody(BaseModel):
    name: str
    affiliation_id: int

@router.get("/districts")
async def get_districts(
    affiliation_id: int | None = Query(None),
    current_user = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """ดึงรายการเขตพื้นที่ (กรองตาม role)"""
    query = select(District)

    if current_user.role == "commissionadmin":
        if current_user.district_id:
            query = query.where(District.id == current_user.district_id)
        elif current_user.affiliation_id:
            query = query.where(District.affiliation_id == current_user.affiliation_id)
    elif affiliation_id:
        query = query.where(District.affiliation_id == affiliation_id)

    result = await db.execute(query.order_by(District.name))
    districts = result.scalars().all()

    return [
        {"id": d.id, "name": d.name, "affiliation_id": d.affiliation_id}
        for d in districts
    ]

@router.post("/districts")
async def create_district(
    body: DistrictBody,
    current_user = Depends(require_role("systemadmin")),
    db: AsyncSession = Depends(get_db),
):
    # Verify affiliation exists
    aff = await db.execute(select(Affiliation).where(Affiliation.id == body.affiliation_id))
    if not aff.scalar_one_or_none():
        raise HTTPException(400, "ไม่พบสังกัดที่เลือก")
    district = District(name=body.name.strip(), affiliation_id=body.affiliation_id)
    db.add(district)
    await db.commit()
    await db.refresh(district)
    return {"id": district.id, "name": district.name, "affiliation_id": district.affiliation_id}

@router.put("/districts/{dist_id}")
async def update_district(
    dist_id: int,
    body: DistrictBody,
    current_user = Depends(require_role("systemadmin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(District).where(District.id == dist_id))
    district = result.scalar_one_or_none()
    if not district:
        raise HTTPException(404, "ไม่พบเขตพื้นที่")
    district.name = body.name.strip()
    district.affiliation_id = body.affiliation_id
    await db.commit()
    return {"id": district.id, "name": district.name, "affiliation_id": district.affiliation_id}

@router.delete("/districts/{dist_id}")
async def delete_district(
    dist_id: int,
    current_user = Depends(require_role("systemadmin")),
    db: AsyncSession = Depends(get_db),
):
    # Block if schools reference it
    count_result = await db.execute(
        select(func.count()).select_from(School).where(School.district_id == dist_id)
    )
    if count_result.scalar() > 0:
        raise HTTPException(400, "ไม่สามารถลบได้ — ยังมีโรงเรียนอยู่ในเขตนี้")
    result = await db.execute(select(District).where(District.id == dist_id))
    district = result.scalar_one_or_none()
    if not district:
        raise HTTPException(404, "ไม่พบเขตพื้นที่")
    await db.delete(district)
    await db.commit()
    return {"deleted": True}

@router.get("/schools")
async def get_schools(
    district_id: int | None = Query(None),
    affiliation_id: int | None = Query(None),
    current_user = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """ดึงข้อมูลโรงเรียน (กรองตาม role + เขตพื้นที่)"""
    query = select(School).join(District, School.district_id == District.id)

    if current_user.role == "schooladmin":
        query = query.where(School.id == current_user.school_id)
    elif current_user.role == "commissionadmin":
        if current_user.district_id:
            query = query.where(School.district_id == current_user.district_id)
        elif current_user.affiliation_id:
            query = query.where(District.affiliation_id == current_user.affiliation_id)
    else:
        # superadmin / systemadmin → filter by params
        if district_id:
            query = query.where(School.district_id == district_id)
        if affiliation_id:
            query = query.where(District.affiliation_id == affiliation_id)

    result = await db.execute(query.order_by(School.name))
    schools = result.scalars().all()

    return [
        {
            "id": s.id,
            "name": s.name,
            "district_id": s.district_id,
            "school_type": s.school_type
        } for s in schools
    ]

@router.get("/students")
async def get_students(
    school_id: int | None = Query(None),
    district_id: int | None = Query(None),
    grade: str | None = Query(None),
    classroom: str | None = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
    current_user = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """รายชื่อนักเรียน (กรองตาม RBAC scope)"""
    query = (
        select(Student, School.name.label("school_name"))
        .join(School, Student.school_id == School.id)
        .join(District, School.district_id == District.id)
    )

    # RBAC scope
    if current_user.role == "schooladmin":
        query = query.where(Student.school_id == current_user.school_id)
    elif current_user.role == "commissionadmin":
        if current_user.district_id:
            query = query.where(School.district_id == current_user.district_id)
        elif current_user.affiliation_id:
            query = query.where(District.affiliation_id == current_user.affiliation_id)
    else:
        # superadmin / systemadmin → filter by params
        if school_id:
            query = query.where(Student.school_id == school_id)
        if district_id:
            query = query.where(School.district_id == district_id)

    if grade:
        query = query.where(Student.grade == grade)
    if classroom:
        query = query.where(Student.classroom == classroom)

    query = query.order_by(Student.grade, Student.classroom, Student.student_code).limit(limit).offset(offset)

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "id": str(r.Student.id),
            "student_code": r.Student.student_code,
            "first_name": r.Student.first_name,
            "last_name": r.Student.last_name,
            "gender": r.Student.gender,
            "birthdate": r.Student.birthdate.isoformat() if r.Student.birthdate else None,
            "grade": r.Student.grade,
            "classroom": r.Student.classroom,
            "school_id": r.Student.school_id,
            "school_name": r.school_name,
            "is_active": r.Student.is_active,
            "created_at": r.Student.created_at.isoformat() if r.Student.created_at else None,
        } for r in rows
    ]

# ──────────────────────────────────────────
# CRUD: Students
# ──────────────────────────────────────────

class StudentCreate(BaseModel):
    student_code: str
    first_name: str
    last_name: str
    gender: str | None = None
    grade: str | None = None
    classroom: str | None = None
    school_id: int

class StudentUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    gender: str | None = None
    grade: str | None = None
    classroom: str | None = None
    school_id: int | None = None

@router.post("/students")
async def create_student(
    body: StudentCreate,
    current_user = Depends(require_role("systemadmin")),
    db: AsyncSession = Depends(get_db),
):
    stu = Student(
        student_code=body.student_code,
        first_name=body.first_name,
        last_name=body.last_name,
        gender=body.gender,
        grade=body.grade,
        classroom=body.classroom,
        school_id=body.school_id,
        is_active=True,
    )
    db.add(stu)
    await db.commit()
    await db.refresh(stu)
    return {"id": str(stu.id), "student_code": stu.student_code, "created": True}

@router.put("/students/{student_id}")
async def update_student(
    student_id: str,
    body: StudentUpdate,
    current_user = Depends(require_role("systemadmin", "schooladmin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Student).where(Student.id == student_id))
    stu = result.scalar_one_or_none()
    if not stu:
        raise HTTPException(404, "ไม่พบนักเรียน")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(stu, field, val)
    await db.commit()
    return {"id": str(stu.id), "updated": True}

@router.delete("/students/{student_id}")
async def toggle_student_active(
    student_id: str,
    current_user = Depends(require_role("systemadmin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Student).where(Student.id == student_id))
    stu = result.scalar_one_or_none()
    if not stu:
        raise HTTPException(404, "ไม่พบนักเรียน")
    stu.is_active = not stu.is_active
    await db.commit()
    return {"id": str(stu.id), "is_active": stu.is_active, "toggled": True}

# ──────────────────────────────────────────
# CRUD: Schools
# ──────────────────────────────────────────

class SchoolCreate(BaseModel):
    name: str
    district_id: int
    school_type: str | None = None

class SchoolUpdate(BaseModel):
    name: str | None = None
    district_id: int | None = None
    school_type: str | None = None

@router.post("/schools")
async def create_school(
    body: SchoolCreate,
    current_user = Depends(require_role("systemadmin")),
    db: AsyncSession = Depends(get_db),
):
    school = School(name=body.name, district_id=body.district_id, school_type=body.school_type)
    db.add(school)
    await db.commit()
    await db.refresh(school)
    return {"id": school.id, "name": school.name, "created": True}

@router.put("/schools/{school_id}")
async def update_school(
    school_id: int,
    body: SchoolUpdate,
    current_user = Depends(require_role("systemadmin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(School).where(School.id == school_id))
    school = result.scalar_one_or_none()
    if not school:
        raise HTTPException(404, "ไม่พบโรงเรียน")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(school, field, val)
    await db.commit()
    return {"id": school.id, "updated": True}

@router.delete("/schools/{school_id}")
async def delete_school(
    school_id: int,
    current_user = Depends(require_role("systemadmin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(School).where(School.id == school_id))
    school = result.scalar_one_or_none()
    if not school:
        raise HTTPException(404, "ไม่พบโรงเรียน")
    await db.delete(school)
    await db.commit()
    return {"deleted": True}

# ──────────────────────────────────────────
# CRUD: Users (systemadmin only)
# ──────────────────────────────────────────

from app.models.db_models import User

class UserCreate(BaseModel):
    username: str
    password: str
    role: str
    school_id: int | None = None
    affiliation_id: int | None = None
    district_id: int | None = None

class UserUpdate(BaseModel):
    role: str | None = None
    school_id: int | None = None
    affiliation_id: int | None = None
    district_id: int | None = None
    is_active: bool | None = None

class UserResetPassword(BaseModel):
    new_password: str

@router.get("/users")
async def list_users(
    role: str | None = Query(None),
    current_user = Depends(require_role("systemadmin")),
    db: AsyncSession = Depends(get_db),
):
    query = select(User).where(User.role != "student")
    if role:
        query = query.where(User.role == role)
    result = await db.execute(query.order_by(User.role, User.username))
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "username": u.username,
            "role": u.role,
            "school_id": u.school_id,
            "affiliation_id": u.affiliation_id,
            "district_id": u.district_id,
            "is_active": u.is_active,
            "last_login": u.last_login.isoformat() if u.last_login else None,
        }
        for u in users
    ]

@router.post("/users")
async def create_user(
    body: UserCreate,
    current_user = Depends(require_role("systemadmin")),
    db: AsyncSession = Depends(get_db),
):
    import bcrypt
    hashed = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    user = User(
        username=body.username,
        hashed_password=hashed,
        role=body.role,
        school_id=body.school_id,
        affiliation_id=body.affiliation_id,
        district_id=body.district_id,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {"id": str(user.id), "username": user.username, "created": True}

@router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    body: UserUpdate,
    current_user = Depends(require_role("systemadmin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "ไม่พบ user")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(user, field, val)
    await db.commit()
    return {"id": str(user.id), "updated": True}

@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: str,
    body: UserResetPassword,
    current_user = Depends(require_role("systemadmin")),
    db: AsyncSession = Depends(get_db),
):
    import bcrypt
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "ไม่พบ user")
    user.hashed_password = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt()).decode()
    await db.commit()
    return {"reset": True}

@router.delete("/users/{user_id}")
async def toggle_user_active(
    user_id: str,
    current_user = Depends(require_role("systemadmin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "ไม่พบ user")
    if str(user.id) == str(current_user.id):
        raise HTTPException(400, "ไม่สามารถปิดบัญชีตัวเองได้")
    user.is_active = not user.is_active
    await db.commit()
    return {"id": str(user.id), "is_active": user.is_active, "toggled": True}

# ──────────────────────────────────────────
# Import: CSV / Excel
# ──────────────────────────────────────────

from fastapi import UploadFile, File
from fastapi.responses import Response as FastAPIResponse
from typing import Optional
from app.services.import_service import (
    parse_csv, parse_excel,
    bulk_import_students, bulk_import_schools,
    smart_parse_excel, smart_bulk_import_students,
)


# ──────────────────────────────────────────
# Smart Import (ไม่ต้องใช้ Template)
# ──────────────────────────────────────────

@router.post("/import/smart-preview")
async def smart_import_preview(
    file: UploadFile = File(...),
    current_user = Depends(require_role("systemadmin", "schooladmin")),
):
    """
    Smart Preview — อ่านไฟล์ Excel จากโรงเรียน (ไม่ต้องใช้ template)
    Auto-detect header row + fuzzy column mapping
    Returns: metadata, detected column mapping, preview 5 แถวแรก
    """
    content = await file.read()
    filename = file.filename or ""
    if not (filename.endswith(".xlsx") or filename.endswith(".xls")):
        raise HTTPException(400, "Smart Import รองรับเฉพาะไฟล์ .xlsx และ .xls เท่านั้น")
    return smart_parse_excel(content)


class SmartImportConfirmBody(BaseModel):
    school_id: int
    # col_mapping_override: {field_name: col_index} ถ้า Admin ต้องการแก้ไข mapping
    col_mapping_override: Optional[dict[str, Optional[int]]] = None


@router.post("/import/smart-confirm")
async def smart_import_confirm(
    file: UploadFile = File(...),
    school_id: int = Query(..., description="ID ของโรงเรียนที่จะ import"),
    current_user = Depends(require_role("systemadmin", "schooladmin")),
    db: AsyncSession = Depends(get_db),
):
    """
    Smart Import Confirm — นำเข้าข้อมูลจริง
    - รับ Excel file + school_id
    - Auto-detect header + map columns
    - Validate, encrypt national_id, Insert/Upsert students
    """
    # schooladmin สามารถ import ได้เฉพาะโรงเรียนตัวเอง
    if current_user.role == "schooladmin" and current_user.school_id != school_id:
        raise HTTPException(403, "คุณสามารถ import ได้เฉพาะโรงเรียนของคุณเท่านั้น")

    # ตรวจสอบว่า school_id มีอยู่จริง
    school_result = await db.execute(select(School).where(School.id == school_id))
    school = school_result.scalar_one_or_none()
    if not school:
        raise HTTPException(404, f"ไม่พบโรงเรียน ID={school_id}")

    content = await file.read()
    filename = file.filename or ""
    if not (filename.endswith(".xlsx") or filename.endswith(".xls")):
        raise HTTPException(400, "Smart Import รองรับเฉพาะไฟล์ .xlsx และ .xls เท่านั้น")

    result = await smart_bulk_import_students(
        db=db,
        content=content,
        school_id=school_id,
    )
    result["school_name"] = school.name
    return result


# ──────────────────────────────────────────
# Legacy Import: CSV / Excel (ต้องใช้ Template)
# ──────────────────────────────────────────

@router.post("/import/students")
async def import_students(
    file: UploadFile = File(...),
    current_user = Depends(require_role("systemadmin")),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    filename = file.filename or ""
    if filename.endswith(".xlsx") or filename.endswith(".xls"):
        rows = parse_excel(content)
    else:
        rows = parse_csv(content)
    result = await bulk_import_students(db, rows)
    return result


@router.post("/import/schools")
async def import_schools(
    file: UploadFile = File(...),
    current_user = Depends(require_role("systemadmin")),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    filename = file.filename or ""
    if filename.endswith(".xlsx") or filename.endswith(".xls"):
        rows = parse_excel(content)
    else:
        rows = parse_csv(content)
    result = await bulk_import_schools(db, rows)
    return result


@router.post("/import/preview")
async def preview_import(
    file: UploadFile = File(...),
    current_user = Depends(require_role("systemadmin")),
):
    """Legacy: ดู 5 แถวแรกก่อน import (ต้องใช้ template)"""
    content = await file.read()
    filename = file.filename or ""
    if filename.endswith(".xlsx") or filename.endswith(".xls"):
        rows = parse_excel(content)
    else:
        rows = parse_csv(content)
    return {"total_rows": len(rows), "preview": rows[:5], "columns": list(rows[0].keys()) if rows else []}


@router.get("/import/template/{data_type}")
async def download_template(
    data_type: str,
    current_user = Depends(require_role("systemadmin")),
):
    """ดาวน์โหลด CSV template (สำหรับ legacy import)"""
    templates = {
        "students": "student_code,first_name,last_name,gender,grade,classroom,school_id,birthdate,national_id\nSTD0001,สมชาย,ใจดี,male,ม.1,1,7,2010-01-15,\n",
        "schools":  "name,district_id,school_type\nโรงเรียนใหม่,2,มัธยมศึกษา\n",
    }
    if data_type not in templates:
        raise HTTPException(400, f"data_type ต้องเป็น: {list(templates.keys())}")
    return FastAPIResponse(
        content=templates[data_type].encode("utf-8-sig"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=template_{data_type}.csv"},
    )


