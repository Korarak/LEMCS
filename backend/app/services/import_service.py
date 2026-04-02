"""
Import Service: CSV/Excel → Bulk DB Insert
รองรับ: students.csv / schools.csv
pip install openpyxl python-multipart
"""
import io
import csv
import traceback
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.db_models import Student, School, District
from app.services.encryption import encrypt_pii, hash_pii
from datetime import date


def parse_csv(content: bytes) -> list[dict]:
    text = content.decode("utf-8-sig")  # handle BOM
    reader = csv.DictReader(io.StringIO(text))
    return [row for row in reader]


def parse_excel(content: bytes) -> list[dict]:
    try:
        import openpyxl
    except ImportError:
        raise ImportError("openpyxl not installed. Run: pip install openpyxl")
    wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []
    headers = [str(h).strip() if h is not None else "" for h in rows[0]]
    result = []
    for row in rows[1:]:
        if all(v is None for v in row):
            continue
        result.append({headers[i]: (str(row[i]).strip() if row[i] is not None else "") for i in range(len(headers))})
    return result


async def bulk_import_students(db: AsyncSession, rows: list[dict]) -> dict:
    created, updated, errors = 0, 0, []

    for i, row in enumerate(rows, start=2):  # row 1 = header
        try:
            student_code = row.get("student_code", "").strip()
            if not student_code:
                errors.append({"row": i, "reason": "student_code ว่าง"})
                continue

            # Validate school_id
            school_id = int(row.get("school_id", 0)) if row.get("school_id") else None

            # Find existing
            result = await db.execute(select(Student).where(Student.student_code == student_code))
            existing = result.scalar_one_or_none()

            if existing:
                # Update
                if row.get("first_name"): existing.first_name = row["first_name"]
                if row.get("last_name"):  existing.last_name = row["last_name"]
                if row.get("gender"):     existing.gender = row["gender"]
                if row.get("grade"):      existing.grade = row["grade"]
                if row.get("classroom"):  existing.classroom = row["classroom"]
                if school_id:             existing.school_id = school_id
                if row.get("birthdate"):
                    try:
                        y, m, d = row["birthdate"].split("-")
                        existing.birthdate = date(int(y), int(m), int(d))
                    except: pass
                updated += 1
            else:
                # Create
                national_id = row.get("national_id", "").strip()
                stu = Student(
                    student_code=student_code,
                    first_name=row.get("first_name", ""),
                    last_name=row.get("last_name", ""),
                    gender=row.get("gender") or None,
                    grade=row.get("grade") or None,
                    classroom=row.get("classroom") or None,
                    school_id=school_id,
                    is_active=True,
                )
                if national_id:
                    stu.national_id = encrypt_pii(national_id)
                    stu.national_id_hash = hash_pii(national_id)
                if row.get("birthdate"):
                    try:
                        y, m, d2 = row["birthdate"].split("-")
                        stu.birthdate = date(int(y), int(m), int(d2))
                    except: pass
                db.add(stu)
                created += 1

        except Exception as e:
            errors.append({"row": i, "reason": str(e)})

    await db.commit()
    return {"created": created, "updated": updated, "errors": errors}


async def bulk_import_schools(db: AsyncSession, rows: list[dict]) -> dict:
    created, updated, errors = 0, 0, []

    for i, row in enumerate(rows, start=2):
        try:
            name = row.get("name", "").strip()
            if not name:
                errors.append({"row": i, "reason": "name ว่าง"})
                continue

            district_id = int(row.get("district_id", 0)) if row.get("district_id") else None
            if not district_id:
                errors.append({"row": i, "reason": "district_id ว่าง"})
                continue

            result = await db.execute(select(School).where(School.name == name))
            existing = result.scalar_one_or_none()

            if existing:
                existing.district_id = district_id
                if row.get("school_type"): existing.school_type = row["school_type"]
                updated += 1
            else:
                db.add(School(
                    name=name,
                    district_id=district_id,
                    school_type=row.get("school_type") or None,
                ))
                created += 1

        except Exception as e:
            errors.append({"row": i, "reason": str(e)})

    await db.commit()
    return {"created": created, "updated": updated, "errors": errors}
