from fastapi import APIRouter, Depends, Query, HTTPException, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete, or_
from pydantic import BaseModel
from app.database import get_db
from app.deps import get_current_admin_user, require_role
from app.models.db_models import School, Student, District, Affiliation, User, AuditLog
from app.services.encryption import encrypt_pii, hash_pii

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


@router.get("/schools/stats")
async def get_schools_stats(
    district_id: int | None = Query(None),
    affiliation_id: int | None = Query(None),
    current_user = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """ดึงข้อมูลโรงเรียนพร้อมจำนวนนักเรียนและวันที่ import ล่าสุด"""
    # Base school query with RBAC
    school_query = select(School).join(District, School.district_id == District.id)

    if current_user.role == "schooladmin":
        school_query = school_query.where(School.id == current_user.school_id)
    elif current_user.role == "commissionadmin":
        if current_user.district_id:
            school_query = school_query.where(School.district_id == current_user.district_id)
        elif current_user.affiliation_id:
            school_query = school_query.where(District.affiliation_id == current_user.affiliation_id)
    else:
        if district_id:
            school_query = school_query.where(School.district_id == district_id)
        if affiliation_id:
            school_query = school_query.where(District.affiliation_id == affiliation_id)

    school_result = await db.execute(school_query.order_by(School.name))
    schools = school_result.scalars().all()
    school_ids = [s.id for s in schools]

    if not school_ids:
        return []

    # Batch query: count active students + last import date per school
    stats_result = await db.execute(
        select(
            Student.school_id,
            func.count(Student.id).label("student_count"),
            func.max(Student.created_at).label("last_import_at"),
        )
        .where(Student.school_id.in_(school_ids), Student.is_active == True)
        .group_by(Student.school_id)
    )
    stats_map = {row.school_id: row for row in stats_result}

    # Fetch district and affiliation names
    dist_result = await db.execute(
        select(District, Affiliation.name.label("aff_name"))
        .join(Affiliation, District.affiliation_id == Affiliation.id)
    )
    dist_map = {row.District.id: {"district_name": row.District.name, "affiliation_name": row.aff_name} for row in dist_result}

    return [
        {
            "id": s.id,
            "name": s.name,
            "district_id": s.district_id,
            "district_name": dist_map.get(s.district_id, {}).get("district_name", ""),
            "affiliation_name": dist_map.get(s.district_id, {}).get("affiliation_name", ""),
            "school_type": s.school_type,
            "student_count": stats_map[s.id].student_count if s.id in stats_map else 0,
            "last_import_at": stats_map[s.id].last_import_at.isoformat() if s.id in stats_map and stats_map[s.id].last_import_at else None,
        }
        for s in schools
    ]

@router.get("/students")
async def get_students(
    school_id: int | None = Query(None),
    district_id: int | None = Query(None),
    affiliation_id: int | None = Query(None),
    grade: str | None = Query(None),
    classroom: str | None = Query(None),
    gender: str | None = Query(None),
    is_active: bool | None = Query(None),
    search: str | None = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
    current_user = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """รายชื่อนักเรียน (กรองตาม RBAC scope) พร้อม server-side search"""
    base = (
        select(Student, School.name.label("school_name"))
        .join(School, Student.school_id == School.id)
        .join(District, School.district_id == District.id)
    )

    # RBAC scope
    if current_user.role == "schooladmin":
        base = base.where(Student.school_id == current_user.school_id)
    elif current_user.role == "commissionadmin":
        if current_user.district_id:
            base = base.where(School.district_id == current_user.district_id)
        elif current_user.affiliation_id:
            base = base.where(District.affiliation_id == current_user.affiliation_id)
    else:
        # superadmin / systemadmin → filter by params
        if school_id:
            base = base.where(Student.school_id == school_id)
        elif district_id:
            base = base.where(School.district_id == district_id)
        elif affiliation_id:
            base = base.where(District.affiliation_id == affiliation_id)

    if grade:
        base = base.where(Student.grade == grade)
    if classroom:
        base = base.where(Student.classroom == classroom)
    if gender:
        base = base.where(Student.gender == gender)
    if is_active is not None:
        base = base.where(Student.is_active == is_active)
    if search:
        term = f"%{search.strip()}%"
        base = base.where(
            or_(
                Student.student_code.ilike(term),
                Student.first_name.ilike(term),
                Student.last_name.ilike(term),
                func.concat(Student.first_name, " ", Student.last_name).ilike(term),
            )
        )

    # Total count (same filters, no limit/offset)
    count_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = count_result.scalar() or 0

    # Paginated data
    data_query = base.order_by(Student.grade, Student.classroom, Student.student_code).limit(limit).offset(offset)
    result = await db.execute(data_query)
    rows = result.all()

    return {
        "total": total,
        "items": [
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
        ],
    }

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

@router.delete("/students/by-school/{school_id}")
async def truncate_students_by_school(
    school_id: int,
    current_user = Depends(require_role("systemadmin")),
    db: AsyncSession = Depends(get_db),
):
    """ลบนักเรียนทั้งหมดของโรงเรียน (รวม User records) — ใช้กรณี import ผิดทั้งโรงเรียน"""
    school_result = await db.execute(select(School).where(School.id == school_id))
    school = school_result.scalar_one_or_none()
    if not school:
        raise HTTPException(404, f"ไม่พบโรงเรียน ID={school_id}")

    # ดึง student id ทั้งหมดของโรงเรียน
    stu_result = await db.execute(select(Student.id).where(Student.school_id == school_id))
    student_ids = [row[0] for row in stu_result.fetchall()]

    if not student_ids:
        return {"school_name": school.name, "deleted_students": 0, "deleted_users": 0}

    # ลบ User records ก่อน (FK constraint)
    user_del = await db.execute(delete(User).where(User.student_id.in_(student_ids)))
    # ลบ Student records
    stu_del = await db.execute(delete(Student).where(Student.school_id == school_id))
    await db.commit()

    return {
        "school_name": school.name,
        "deleted_students": stu_del.rowcount,
        "deleted_users": user_del.rowcount,
    }

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


class NationalIdUpdate(BaseModel):
    national_id: str


@router.patch("/students/{student_id}/national-id")
async def update_student_national_id(
    student_id: str,
    body: NationalIdUpdate,
    current_user = Depends(require_role("systemadmin")),
    db: AsyncSession = Depends(get_db),
):
    """แก้ไขเลขบัตรประชาชนนักเรียน — บันทึก audit log ทุกครั้ง (PDPA)"""
    from app.services.import_service import normalize_national_id

    result = await db.execute(select(Student).where(Student.id == student_id))
    stu = result.scalar_one_or_none()
    if not stu:
        raise HTTPException(404, "ไม่พบนักเรียน")

    nid, err = normalize_national_id(body.national_id.strip())
    if err:
        raise HTTPException(400, f"เลขบัตรประชาชนไม่ถูกต้อง: {err}")
    if not nid:
        raise HTTPException(400, "กรุณาระบุเลขบัตรประชาชน")

    # Check duplicate hash (another student already has this ID)
    new_hash = hash_pii(nid)
    dup = await db.execute(
        select(Student).where(Student.national_id_hash == new_hash, Student.id != student_id)
    )
    if dup.scalar_one_or_none():
        raise HTTPException(409, "เลขบัตรประชาชนนี้มีอยู่ในระบบแล้ว")

    stu.national_id = encrypt_pii(nid)
    stu.national_id_hash = new_hash

    log = AuditLog(
        user_id=current_user.id,
        action="update_national_id",
        resource=f"student:{student_id}",
        details={"updated_by": str(current_user.id), "student_code": stu.student_code},
    )
    db.add(log)
    await db.commit()
    return {"id": str(stu.id), "updated": True}


# ──────────────────────────────────────────
# Audit Logs
# ──────────────────────────────────────────

@router.get("/audit-logs")
async def get_audit_logs(
    action: str | None = Query(None),
    resource_prefix: str | None = Query(None),
    user_id: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    current_user = Depends(require_role("systemadmin", "superadmin")),
    db: AsyncSession = Depends(get_db),
):
    """ดึง audit log พร้อม username ของผู้กระทำ"""
    from datetime import datetime, timezone

    query = (
        select(AuditLog, User.username, User.role)
        .outerjoin(User, AuditLog.user_id == User.id)
    )

    if action:
        query = query.where(AuditLog.action == action)
    if resource_prefix:
        query = query.where(AuditLog.resource.ilike(f"{resource_prefix}%"))
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    if date_from:
        query = query.where(AuditLog.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        query = query.where(AuditLog.created_at <= datetime.fromisoformat(date_to))

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    rows = (await db.execute(
        query.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
    )).all()

    return {
        "total": total,
        "items": [
            {
                "id": r.AuditLog.id,
                "user_id": str(r.AuditLog.user_id) if r.AuditLog.user_id else None,
                "username": r.username,
                "role": r.role,
                "action": r.AuditLog.action,
                "resource": r.AuditLog.resource,
                "details": r.AuditLog.details,
                "ip_address": r.AuditLog.ip_address,
                "created_at": r.AuditLog.created_at.isoformat() if r.AuditLog.created_at else None,
            }
            for r in rows
        ],
    }


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
    name = normalize_school_name(body.name.strip(), body.school_type)
    school = School(name=name, district_id=body.district_id, school_type=body.school_type)
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
    updates = body.model_dump(exclude_unset=True)
    # normalize ชื่อถ้ามีการแก้ไข — ใช้ school_type ใหม่ถ้ามี ไม่งั้นใช้อันเดิม
    if "name" in updates:
        effective_type = updates.get("school_type", school.school_type)
        updates["name"] = normalize_school_name(updates["name"].strip(), effective_type)
    for field, val in updates.items():
        setattr(school, field, val)
    await db.commit()
    return {"id": school.id, "name": school.name, "updated": True}

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
    student_count = (await db.execute(
        select(func.count()).select_from(Student).where(Student.school_id == school_id)
    )).scalar() or 0
    if student_count > 0:
        raise HTTPException(400, f"ไม่สามารถลบได้ — ยังมีนักเรียน {student_count} คนในโรงเรียนนี้")
    await db.delete(school)
    await db.commit()
    return {"deleted": True}

# ──────────────────────────────────────────
# Current admin user info
# ──────────────────────────────────────────

@router.get("/me")
async def get_admin_me(
    current_user = Depends(get_current_admin_user),
):
    """ดึงข้อมูล admin ที่ login อยู่"""
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "role": current_user.role,
        "school_id": current_user.school_id,
        "affiliation_id": current_user.affiliation_id,
        "district_id": current_user.district_id,
        "is_active": current_user.is_active,
        "last_login": current_user.last_login.isoformat() if current_user.last_login else None,
    }

# ──────────────────────────────────────────
# CRUD: Users (systemadmin + superadmin)
# ──────────────────────────────────────────

from app.models.db_models import User

MANAGE_USERS_ROLES = ("systemadmin", "superadmin")

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

def _guard_superadmin_scope(current_user, target_role: str | None = None):
    """superadmin ไม่สามารถจัดการ systemadmin ได้"""
    if current_user.role == "superadmin" and target_role == "systemadmin":
        raise HTTPException(403, "ศึกษาธิการจังหวัดไม่สามารถจัดการบัญชี systemadmin ได้")

@router.get("/users")
async def list_users(
    role: str | None = Query(None),
    current_user = Depends(require_role(*MANAGE_USERS_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    query = select(User).where(User.role != "student")
    # superadmin ไม่เห็น systemadmin
    if current_user.role == "superadmin":
        query = query.where(User.role != "systemadmin")
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
    current_user = Depends(require_role(*MANAGE_USERS_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    import bcrypt
    _guard_superadmin_scope(current_user, body.role)
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
    current_user = Depends(require_role(*MANAGE_USERS_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "ไม่พบ user")
    _guard_superadmin_scope(current_user, user.role)
    if body.role:
        _guard_superadmin_scope(current_user, body.role)
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(user, field, val)
    await db.commit()
    return {"id": str(user.id), "updated": True}

@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: str,
    body: UserResetPassword,
    current_user = Depends(require_role(*MANAGE_USERS_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    import bcrypt
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "ไม่พบ user")
    _guard_superadmin_scope(current_user, user.role)
    user.hashed_password = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt()).decode()
    await db.commit()
    return {"reset": True}

@router.delete("/users/{user_id}")
async def toggle_user_active(
    user_id: str,
    current_user = Depends(require_role(*MANAGE_USERS_ROLES)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "ไม่พบ user")
    _guard_superadmin_scope(current_user, user.role)
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
    normalize_school_name,
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
    col_mapping: Optional[str] = Form(None, description="JSON string ของ {field: col_index} ที่ user ยืนยันแล้ว"),
    current_user = Depends(require_role("systemadmin", "schooladmin")),
    db: AsyncSession = Depends(get_db),
):
    """
    Smart Import Confirm — นำเข้าข้อมูลจริง
    - รับ Excel file + school_id + col_mapping (JSON จาก user)
    - ใช้ col_mapping ที่ user ยืนยันแล้ว (ไม่ auto-detect ซ้ำ)
    - Validate, encrypt national_id, Insert/Upsert students
    """
    import json as _json

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

    # แปลง col_mapping JSON → dict หรือ None (ถ้าไม่ส่งมา = auto-detect)
    col_map_override: Optional[dict] = None
    if col_mapping:
        try:
            parsed = _json.loads(col_mapping)
            # แปลงค่า null/"-1" → None, string index → int
            col_map_override = {
                field: (int(idx) if idx is not None and int(idx) >= 0 else None)
                for field, idx in parsed.items()
            }
        except Exception:
            raise HTTPException(400, "col_mapping ไม่ถูกรูปแบบ JSON")

    result = await smart_bulk_import_students(
        db=db,
        content=content,
        school_id=school_id,
        col_map_override=col_map_override,
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


# ──────────────────────────────────────────
# Proxy Assessment (ครูกรอกแทนนักเรียน)
# ──────────────────────────────────────────

@router.get("/proxy-assess/students")
async def proxy_assess_students(
    grade: str | None = Query(None),
    classroom: str | None = Query(None),
    current_user = Depends(require_role("schooladmin")),
    db: AsyncSession = Depends(get_db),
):
    """
    รายชื่อนักเรียนพร้อมสถานะแบบประเมินในภาคเรียนนี้
    schooladmin เห็นเฉพาะโรงเรียนตัวเอง
    """
    from app.routers.assessments import get_current_academic_year, get_current_term
    from datetime import date as dt

    academic_year = get_current_academic_year()
    term = get_current_term()

    query = select(Student).where(
        Student.school_id == current_user.school_id,
        Student.is_active == True,
    )
    if grade:
        query = query.where(Student.grade == grade)
    if classroom:
        query = query.where(Student.classroom == classroom)
    query = query.order_by(Student.grade, Student.classroom, Student.first_name)

    result = await db.execute(query)
    students = result.scalars().all()
    if not students:
        return []

    student_ids = [s.id for s in students]

    # ดึง assessment ที่ทำแล้วในภาคเรียนนี้ (ล่าสุดต่อ type)
    done_result = await db.execute(
        select(
            Assessment.student_id,
            Assessment.assessment_type,
            Assessment.severity_level,
            Assessment.score,
            Assessment.filled_by_user_id,
            Assessment.created_at,
        )
        .where(
            Assessment.student_id.in_(student_ids),
            Assessment.academic_year == academic_year,
            Assessment.term == term,
        )
        .order_by(Assessment.created_at.desc())
    )
    done_rows = done_result.all()

    # pivot: student_id → {type: latest_row}
    done_map: dict = {}
    for row in done_rows:
        sid = str(row.student_id)
        if sid not in done_map:
            done_map[sid] = {}
        atype = row.assessment_type
        if atype not in done_map[sid]:
            done_map[sid][atype] = {
                "severity_level": row.severity_level,
                "score": row.score,
                "filled_by_proxy": row.filled_by_user_id is not None,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }

    today = dt.today()

    def calc_age(s: Student) -> int | None:
        if not s.birthdate:
            return None
        age = today.year - s.birthdate.year
        if (today.month, today.day) < (s.birthdate.month, s.birthdate.day):
            age -= 1
        return age

    def available_types(age: int | None) -> list[str]:
        if age is None:
            return []
        types = []
        if age >= 15:
            types.append("ST5")
        if 7 <= age <= 17:
            types.append("CDI")
        if 11 <= age <= 20:
            types.append("PHQA")
        return types

    items = []
    for s in students:
        age = calc_age(s)
        types = available_types(age)
        sid = str(s.id)
        items.append({
            "id": sid,
            "student_code": s.student_code,
            "first_name": s.first_name,
            "last_name": s.last_name,
            "gender": s.gender,
            "grade": s.grade,
            "classroom": s.classroom,
            "birthdate": s.birthdate.isoformat() if s.birthdate else None,
            "age": age,
            "available_types": types,
            "assessments_done": done_map.get(sid, {}),
        })
    return items


class ProxyAssessSubmit(BaseModel):
    student_id: str
    assessment_type: str
    responses: dict


@router.post("/proxy-assess/submit")
async def proxy_assess_submit(
    body: ProxyAssessSubmit,
    current_user = Depends(require_role("schooladmin")),
    db: AsyncSession = Depends(get_db),
):
    """
    ส่งคำตอบแทนนักเรียน — ตรวจสอบ scope + อายุ + scoring + alert เหมือนปกติ
    """
    from app.services.scoring import calculate_score
    from app.services.alert_service import check_and_trigger_alert
    from app.routers.assessments import get_current_academic_year, get_current_term
    from datetime import date as dt

    # 1. ดึงนักเรียนและตรวจสอบ scope
    stu_result = await db.execute(select(Student).where(Student.id == body.student_id))
    student = stu_result.scalar_one_or_none()
    if not student:
        raise HTTPException(404, "ไม่พบนักเรียน")
    if student.school_id != current_user.school_id:
        raise HTTPException(403, "นักเรียนไม่ได้อยู่ในโรงเรียนของท่าน")

    # 2. ตรวจสอบเงื่อนไขอายุ
    if student.birthdate:
        today = dt.today()
        age = today.year - student.birthdate.year
        if (today.month, today.day) < (student.birthdate.month, student.birthdate.day):
            age -= 1
        atype = body.assessment_type.upper()
        age_ok = (
            (atype == "ST5"  and age >= 15) or
            (atype == "CDI"  and 7 <= age <= 17) or
            (atype == "PHQA" and 11 <= age <= 20)
        )
        if not age_ok:
            raise HTTPException(400, f"แบบประเมิน {body.assessment_type} ไม่เหมาะสมกับอายุ {age} ปี")

    # 3. คำนวณคะแนน
    try:
        result = calculate_score(body.assessment_type, body.responses)
    except ValueError as e:
        raise HTTPException(400, str(e))

    # 4. บันทึก
    assessment = Assessment(
        student_id=student.id,
        assessment_type=body.assessment_type,
        responses=body.responses,
        score=result["score"],
        severity_level=result["severity_level"],
        suicide_risk=result.get("suicide_risk", False),
        academic_year=get_current_academic_year(),
        term=get_current_term(),
        filled_by_user_id=current_user.id,
    )
    db.add(assessment)
    await db.commit()
    await db.refresh(assessment)

    # 5. Audit log
    log = AuditLog(
        user_id=current_user.id,
        action="proxy_assessment",
        resource=f"student:{student.id}",
        details={
            "assessment_type": body.assessment_type,
            "score": result["score"],
            "severity_level": result["severity_level"],
            "assessment_id": str(assessment.id),
        },
    )
    db.add(log)

    # 6. Trigger alert (เหมือนนักเรียนกรอกเอง)
    await check_and_trigger_alert(db, assessment, student)
    await db.commit()

    return {
        "id": str(assessment.id),
        "score": result["score"],
        "severity_level": result["severity_level"],
        "suicide_risk": result.get("suicide_risk", False),
        "assessment_type": body.assessment_type,
    }
