"""
SKR Import Service: นำเข้าข้อมูลนักศึกษา สกร. จากไฟล์ .XLS ของ สกร.เลย
รูปแบบไฟล์:
  - หลาย Sheet (1 Sheet = 1 อำเภอ)
  - Row 0: ชื่อรายงาน, Row 1: ชื่ออำเภอ, Row 2: headers, Row 3+: ข้อมูล
  - Columns: รหัสนักศึกษา | ชื่อ-นามสกุล | เพศ | วันเกิด | วุฒิการศึกษา | ที่อยู่ | เบอร์โทร | E-mail
"""
import re
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.db_models import Student, School, User
from app.services.import_service import parse_thai_date

# ─── Prefix/Title lookup ──────────────────────────────────────────
_PREFIXES_LONGEST_FIRST = [
    "นางสาว", "เด็กหญิง", "เด็กชาย", "นาง", "นาย",
    "น.ส.", "ด.ช.", "ด.ญ.",
]
_TITLE_MAP = {
    "นาย": "นาย",       "เด็กชาย": "เด็กชาย", "ด.ช.": "เด็กชาย",
    "นาง": "นาง",       "นางสาว":  "นางสาว",  "น.ส.": "นางสาว",
    "เด็กหญิง": "เด็กหญิง", "ด.ญ.": "เด็กหญิง",
}
_MALE_TITLES   = {"นาย", "เด็กชาย"}
_FEMALE_TITLES = {"นางสาว", "นาง", "เด็กหญิง"}

# ─── วุฒิการศึกษา → grade ────────────────────────────────────────
_EDUCATION_GRADE: dict[str, str] = {
    "ประถมศึกษา":        "ป.6",
    "มัธยมศึกษาตอนต้น": "ม.3",
    "มัธยมศึกษาตอนปลาย":"ม.6",
    "ม.ต้น":             "ม.3",
    "ม.ปลาย":            "ม.6",
    "ไม่มีวุฒิ":         "",
    "ไม่ระบุ":           "",
    "-":                 "",
}


# ─── Name splitting ───────────────────────────────────────────────

def split_full_name(full_name: str) -> tuple[str, str, str]:
    """
    แยกชื่อเต็มจากฟิลด์ "ชื่อ - นามสกุล" ของ สกร.
      "นายสมชาย   รักดี"    → ("นาย", "สมชาย", "รักดี")
      "นาง   สมหญิง   ดีงาม" → ("นาง", "สมหญิง", "ดีงาม")
      "สมชาย   รักดี"        → ("", "สมชาย", "รักดี")
    """
    if not full_name or not full_name.strip():
        return "", "", ""

    # แยกด้วย whitespace 2+ ตัว หรือ tab
    parts = re.split(r"\s{2,}|\t", full_name.strip())
    parts = [p.strip() for p in parts if p.strip()]

    if not parts:
        return "", "", ""

    def _extract_prefix(s: str) -> tuple[str, str]:
        """คืน (title, remaining_name)"""
        for p in _PREFIXES_LONGEST_FIRST:
            if s.startswith(p):
                return _TITLE_MAP.get(p, p), s[len(p):].strip()
        return "", s

    # กรณี 3 parts: prefix แยก / first_name / last_name
    if len(parts) >= 3:
        title = _TITLE_MAP.get(parts[0], "")
        if title:
            return title, parts[1], parts[2]
        # prefix อาจติดกับชื่อใน parts[0]
        title, first = _extract_prefix(parts[0])
        return title, first or parts[1], parts[-1]

    # กรณี 2 parts: "prefix+ชื่อ" / "นามสกุล"
    if len(parts) == 2:
        title, first = _extract_prefix(parts[0])
        return title, first, parts[1]

    # กรณี 1 part: แยกด้วย single space
    title, rest = _extract_prefix(parts[0])
    words = rest.split()
    if len(words) >= 2:
        return title, words[0], " ".join(words[1:])
    return title, rest, ""


def map_education_grade(education: str) -> str:
    """แปลงวุฒิการศึกษา → grade"""
    edu = (education or "").strip()
    if not edu:
        return ""
    if edu in _EDUCATION_GRADE:
        return _EDUCATION_GRADE[edu]
    if "ประถม" in edu:
        return "ป.6"
    if "มัธยม" in edu and ("ต้น" in edu or "ตอนต้น" in edu):
        return "ม.3"
    if "มัธยม" in edu and ("ปลาย" in edu or "ตอนปลาย" in edu):
        return "ม.6"
    if re.match(r"^[มป]\.\d+$", edu):
        return edu
    return edu


# ─── XLS reader ──────────────────────────────────────────────────

def _read_xls_sheets(content: bytes) -> list[dict]:
    """อ่าน .XLS ด้วย xlrd (encoding cp874 สำหรับ Thai Windows)"""
    try:
        import xlrd
    except ImportError:
        raise ImportError("xlrd not installed. Run: pip install xlrd")

    wb = xlrd.open_workbook(file_contents=content, encoding_override="cp874")
    sheets = []
    for sheet_name in wb.sheet_names():
        ws = wb.sheet_by_name(sheet_name)
        rows = []
        for r in range(ws.nrows):
            row = []
            for c in range(ws.ncols):
                val = ws.cell_value(r, c)
                row.append(str(val).strip() if val else "")
            rows.append(row)
        sheets.append({"name": sheet_name, "rows": rows})
    return sheets


def _parse_data_rows(rows: list[list[str]]) -> list[list[str]]:
    """คืน data rows (ข้าม 3 header rows และกรอง empty rows)"""
    data = rows[3:] if len(rows) > 3 else []
    return [r for r in data if any(c for c in r)]


def _row_to_preview(row: list[str]) -> dict:
    if len(row) < 2:
        return {}
    title, first_name, last_name = split_full_name(row[1])
    return {
        "student_code":   row[0],
        "full_name_raw":  row[1],
        "title":          title,
        "first_name":     first_name,
        "last_name":      last_name,
        "gender":         row[2] if len(row) > 2 else "",
        "birthdate_raw":  row[3] if len(row) > 3 else "",
        "education":      row[4] if len(row) > 4 else "",
    }


# ─── Public: Preview ─────────────────────────────────────────────

def preview_skr_file(content: bytes) -> dict:
    """
    อ่านไฟล์ → คืน list ของ sheet พร้อม metadata และ preview 5 แถวแรก
    ใช้สำหรับ Step 1 ของ import wizard
    """
    sheets_raw = _read_xls_sheets(content)
    sheets_info = []
    for sheet in sheets_raw:
        data = _parse_data_rows(sheet["rows"])
        preview = [_row_to_preview(r) for r in data[:5] if r]
        sheets_info.append({
            "name":       sheet["name"],
            "total_rows": len(data),
            "preview":    preview,
        })
    return {"sheets": sheets_info, "total_sheets": len(sheets_info)}


# ─── District / School helpers ────────────────────────────────────

def _district_short_name(sheet_name: str) -> str:
    """'อ.เมือง' → 'เมือง'"""
    s = sheet_name.strip()
    for prefix in ("อ.", "อำเภอ"):
        if s.startswith(prefix):
            return s[len(prefix):].strip()
    return s


# ─── Public: Bulk import ─────────────────────────────────────────

async def bulk_import_skr_sheets(
    db: AsyncSession,
    content: bytes,
    selected_sheets: list[str],
    school_map: dict[str, int],
) -> dict:
    """
    Import นักศึกษา สกร. จาก XLS
    - selected_sheets: ชื่อ sheet ที่เลือก (ตรงกับ sheet_name จาก preview)
    - school_map: dict ของ {sheet_name: school_id} — admin ต้องสร้างโรงเรียนไว้ก่อน
    Returns: per-sheet results + summary
    """
    sheets_raw = _read_xls_sheets(content)
    selected_set = set(selected_sheets)
    results = []

    for sheet in sheets_raw:
        if sheet["name"] not in selected_set:
            continue

        sheet_name = sheet["name"]
        district_short = _district_short_name(sheet_name)
        data_rows = _parse_data_rows(sheet["rows"])

        school_id = school_map.get(sheet_name)
        if not school_id:
            results.append({
                "sheet": sheet_name, "district": district_short, "school": "—",
                "total_processed": 0, "created": 0, "updated": 0, "skipped": 0,
                "errors": [{"row": 0, "reason": "ไม่ได้ระบุโรงเรียนปลายทาง"}],
                "error_count": 1,
            })
            continue

        r = await db.execute(select(School).where(School.id == school_id))
        school = r.scalar_one_or_none()
        if not school:
            results.append({
                "sheet": sheet_name, "district": district_short, "school": f"ID={school_id}",
                "total_processed": 0, "created": 0, "updated": 0, "skipped": 0,
                "errors": [{"row": 0, "reason": f"ไม่พบโรงเรียน ID={school_id} ในระบบ"}],
                "error_count": 1,
            })
            continue

        created, updated, skipped = 0, 0, 0
        errors: list[dict] = []

        for row_idx, row in enumerate(data_rows):
            row_num = row_idx + 4
            try:
                student_code = row[0].strip() if row else ""
                full_name    = row[1].strip() if len(row) > 1 else ""
                gender_raw   = row[2].strip() if len(row) > 2 else ""
                birthdate_str= row[3].strip() if len(row) > 3 else ""
                education    = row[4].strip() if len(row) > 4 else ""

                if not student_code or not full_name:
                    skipped += 1
                    continue

                # รหัสนักศึกษา สกร. ไม่ควรเป็น 13 หลัก
                sc_digits = re.sub(r"\D", "", student_code)
                if not sc_digits or len(sc_digits) > 12:
                    errors.append({"row": row_num, "reason": f"รหัสนักศึกษาไม่ถูกรูปแบบ: '{student_code}'"})
                    continue

                title, first_name, last_name = split_full_name(full_name)
                if not first_name:
                    errors.append({"row": row_num, "reason": f"แยกชื่อไม่ได้: '{full_name}'"})
                    continue

                # Gender
                if gender_raw in ("ชาย", "ช", "M", "m"):
                    gender = "ชาย"
                elif gender_raw in ("หญิง", "ญ", "F", "f"):
                    gender = "หญิง"
                elif title in _MALE_TITLES:
                    gender = "ชาย"
                elif title in _FEMALE_TITLES:
                    gender = "หญิง"
                else:
                    gender = "ไม่ระบุ"

                grade    = map_education_grade(education)
                birthdate = parse_thai_date(birthdate_str)

                r = await db.execute(
                    select(Student).where(Student.student_code == student_code)
                )
                existing = r.scalar_one_or_none()

                if existing:
                    existing.first_name = first_name
                    existing.last_name  = last_name or existing.last_name
                    if title:    existing.title    = title
                    if gender:   existing.gender   = gender
                    if grade:    existing.grade    = grade
                    if birthdate: existing.birthdate = birthdate
                    existing.school_id = school.id
                    updated += 1
                else:
                    stu = Student(
                        student_code=student_code,
                        title=title or None,
                        first_name=first_name,
                        last_name=last_name or "",
                        gender=gender or None,
                        grade=grade or None,
                        classroom=None,
                        school_id=school.id,
                        birthdate=birthdate,
                        is_active=True,
                    )
                    db.add(stu)
                    await db.flush()

                    user = User(student_id=stu.id, role="student", school_id=school.id)
                    db.add(user)
                    created += 1

            except Exception as exc:
                errors.append({"row": row_num, "reason": str(exc)})

        await db.commit()

        results.append({
            "sheet":           sheet_name,
            "district":        district_short,
            "school":          school.name,
            "total_processed": len(data_rows),
            "created":         created,
            "updated":         updated,
            "skipped":         skipped,
            "errors":          errors[:30],
            "error_count":     len(errors),
        })

    return {
        "results": results,
        "summary": {
            "total_created": sum(r["created"] for r in results),
            "total_updated": sum(r["updated"] for r in results),
            "total_skipped": sum(r["skipped"] for r in results),
            "total_errors":  sum(r["error_count"] for r in results),
            "sheets_imported": len(results),
        },
    }
