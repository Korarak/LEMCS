from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, datetime
from typing import Optional

from app.database import get_db
from app.deps import get_current_admin_user, check_report_scope

router = APIRouter()

@router.get("/summary")
async def get_summary(
    school_id: int | None = Query(None),
    district_id: int | None = Query(None),
    affiliation_id: int | None = Query(None),
    assessment_type: str | None = Query(None),
    grade: str | None = Query(None),
    gender: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    survey_round_id: str | None = Query(None),
    current_user = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """
    ภาพรวมผล — กรองอัตโนมัติตาม role:
      - systemadmin/superadmin  → ทุกอย่าง (ฟิลเตอร์ได้)
      - commissionadmin         → เฉพาะสังกัด/เขตของตัวเอง
      - schooladmin             → เฉพาะโรงเรียนตัวเอง
    """
    from sqlalchemy import text
    scope = await check_report_scope(current_user, school_id, district_id, affiliation_id)

    query = """
    SELECT
        COUNT(DISTINCT a.student_id) AS total_students,
        COUNT(a.id) AS total_assessments,
        a.severity_level,
        a.assessment_type,
        COUNT(*) AS count,
        SUM(CASE WHEN a.suicide_risk = true THEN 1 ELSE 0 END) AS suicide_risk_count
    FROM assessments a
    JOIN students s ON a.student_id = s.id
    JOIN schools sch ON s.school_id = sch.id
    JOIN districts d ON sch.district_id = d.id
    WHERE 1=1
    """
    params = {}

    # RBAC scope filters
    if scope.school_id:
        query += " AND s.school_id = :school_id"
        params["school_id"] = scope.school_id
    if scope.district_id:
        query += " AND sch.district_id = :district_id"
        params["district_id"] = scope.district_id
    if scope.affiliation_id:
        query += " AND d.affiliation_id = :affiliation_id"
        params["affiliation_id"] = scope.affiliation_id

    # User-chosen filters
    if assessment_type:
        query += " AND a.assessment_type = :assessment_type"
        params["assessment_type"] = assessment_type
    if grade:
        query += " AND COALESCE(a.grade_snapshot, s.grade) = :grade"
        params["grade"] = grade
    if gender:
        query += " AND s.gender = :gender"
        params["gender"] = gender
    if date_from:
        query += " AND a.created_at >= :date_from"
        params["date_from"] = datetime.combine(date_from, datetime.min.time())
    if date_to:
        query += " AND a.created_at <= :date_to"
        params["date_to"] = datetime.combine(date_to, datetime.max.time())
    if survey_round_id:
        query += " AND a.survey_round_id = :survey_round_id"
        params["survey_round_id"] = survey_round_id

    query += " GROUP BY a.severity_level, a.assessment_type"

    result = await db.execute(text(query), params)
    rows = result.fetchall()

    return {
        "filters": {
            "school_id": scope.school_id,
            "district_id": scope.district_id,
            "affiliation_id": scope.affiliation_id,
            "assessment_type": assessment_type,
        },
        "data": [dict(r._mapping) for r in rows],
    }

@router.get("/data")
async def get_raw_data(
    school_id: int | None = Query(None),
    district_id: int | None = Query(None),
    affiliation_id: int | None = Query(None),
    assessment_type: str | None = Query(None),
    grade: str | None = Query(None),
    gender: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    survey_round_id: str | None = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
    current_user = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import text
    scope = await check_report_scope(current_user, school_id, district_id, affiliation_id)

    query = """
    SELECT
        a.id, a.assessment_type, a.score, a.severity_level, a.suicide_risk,
        a.created_at, a.survey_round_id,
        COALESCE(a.grade_snapshot, s.grade) AS grade,
        COALESCE(a.classroom_snapshot, s.classroom) AS classroom,
        s.student_code, s.first_name, s.last_name,
        sch.name as school_name
    FROM assessments a
    JOIN students s ON a.student_id = s.id
    JOIN schools sch ON s.school_id = sch.id
    JOIN districts d ON sch.district_id = d.id
    WHERE 1=1
    """
    params = {}

    if scope.school_id:
        query += " AND s.school_id = :school_id"
        params["school_id"] = scope.school_id
    if scope.district_id:
        query += " AND sch.district_id = :district_id"
        params["district_id"] = scope.district_id
    if scope.affiliation_id:
        query += " AND d.affiliation_id = :affiliation_id"
        params["affiliation_id"] = scope.affiliation_id
    if assessment_type:
        query += " AND a.assessment_type = :assessment_type"
        params["assessment_type"] = assessment_type
    if grade:
        query += " AND COALESCE(a.grade_snapshot, s.grade) = :grade"
        params["grade"] = grade
    if gender:
        query += " AND s.gender = :gender"
        params["gender"] = gender
    if date_from:
        query += " AND a.created_at >= :date_from"
        params["date_from"] = datetime.combine(date_from, datetime.min.time())
    if date_to:
        query += " AND a.created_at <= :date_to"
        params["date_to"] = datetime.combine(date_to, datetime.max.time())
    if survey_round_id:
        query += " AND a.survey_round_id = :survey_round_id"
        params["survey_round_id"] = survey_round_id

    query += " ORDER BY a.created_at DESC LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset

    result = await db.execute(text(query), params)
    rows = result.fetchall()

    return [dict(r._mapping) for r in rows]

@router.get("/trend")
async def get_trend(
    school_id: int | None = Query(None),
    district_id: int | None = Query(None),
    affiliation_id: int | None = Query(None),
    assessment_type: str | None = Query(None),
    grade: str | None = Query(None),
    gender: str | None = Query(None),
    months: int = Query(6),
    survey_round_id: str | None = Query(None),
    current_user = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """รายเดือน — ค่าเฉลี่ยคะแนนแต่ละประเภทแบบประเมิน"""
    from sqlalchemy import text
    scope = await check_report_scope(current_user, school_id, district_id, affiliation_id)

    query = """
    SELECT
        TO_CHAR(DATE_TRUNC('month', a.created_at), 'YYYY-MM') AS ym,
        a.assessment_type,
        ROUND(AVG(a.score)::numeric, 2) AS avg_score,
        COUNT(*) AS total
    FROM assessments a
    JOIN students s ON a.student_id = s.id
    JOIN schools sch ON s.school_id = sch.id
    JOIN districts d ON sch.district_id = d.id
    WHERE a.created_at >= NOW() - INTERVAL ':months months'
    """
    params: dict = {"months": months}

    if scope.school_id:
        query += " AND s.school_id = :school_id"
        params["school_id"] = scope.school_id
    if scope.district_id:
        query += " AND sch.district_id = :district_id"
        params["district_id"] = scope.district_id
    if scope.affiliation_id:
        query += " AND d.affiliation_id = :affiliation_id"
        params["affiliation_id"] = scope.affiliation_id
    if assessment_type:
        query += " AND a.assessment_type = :assessment_type"
        params["assessment_type"] = assessment_type
    if grade:
        query += " AND COALESCE(a.grade_snapshot, s.grade) = :grade"
        params["grade"] = grade
    if gender:
        query += " AND s.gender = :gender"
        params["gender"] = gender
    if survey_round_id:
        query += " AND a.survey_round_id = :survey_round_id"
        params["survey_round_id"] = survey_round_id

    query += " GROUP BY DATE_TRUNC('month', a.created_at), a.assessment_type ORDER BY DATE_TRUNC('month', a.created_at)"

    # Use raw string interpolation for INTERVAL (not a bind param)
    query = query.replace("':months months'", f"'{months} months'")
    del params["months"]

    result = await db.execute(text(query), params)
    rows = result.fetchall()

    # Pivot into { ym, month_label, st5_avg, phqa_avg, cdi_avg }
    THAI_MONTHS = {
        "01": "ม.ค.", "02": "ก.พ.", "03": "มี.ค.", "04": "เม.ย.",
        "05": "พ.ค.", "06": "มิ.ย.", "07": "ก.ค.", "08": "ส.ค.",
        "09": "ก.ย.", "10": "ต.ค.", "11": "พ.ย.", "12": "ธ.ค.",
    }

    pivot: dict = {}
    for row in rows:
        ym = row.ym  # e.g., "2025-07"
        month_num = ym.split("-")[1]
        year_short = ym.split("-")[0][2:]
        label = f"{THAI_MONTHS[month_num]} {year_short}"
        if ym not in pivot:
            pivot[ym] = {"month": label, "st5_avg": None, "phqa_avg": None, "cdi_avg": None}
        key = f"{row.assessment_type.lower()}_avg"
        pivot[ym][key] = float(row.avg_score)

    return [pivot[k] for k in sorted(pivot.keys())]


@router.get("/compare")
async def get_compare(
    group_by: str = Query("affiliation"),
    school_id: int | None = Query(None),
    district_id: int | None = Query(None),
    affiliation_id: int | None = Query(None),
    assessment_type: str | None = Query(None),
    grade: str | None = Query(None),
    gender: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    survey_round_id: str | None = Query(None),
    current_user = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """เปรียบเทียบอัตราส่วนความเสี่ยงแต่ละสังกัด / เขต / โรงเรียน (% stacked)"""
    from sqlalchemy import text
    if group_by not in ("affiliation", "district", "school"):
        raise HTTPException(status_code=422, detail="group_by ต้องเป็น affiliation, district หรือ school")

    scope = await check_report_scope(current_user, school_id, district_id, affiliation_id)

    if group_by == "affiliation":
        select_name = "af.name"
        extra_join  = "JOIN affiliations af ON d.affiliation_id = af.id"
    elif group_by == "district":
        select_name = "d.name"
        extra_join  = ""
    else:
        select_name = "sch.name"
        extra_join  = ""

    query = f"""
    SELECT
        {select_name} AS group_name,
        a.severity_level,
        COUNT(*) AS cnt
    FROM assessments a
    JOIN students s ON a.student_id = s.id
    JOIN schools sch ON s.school_id = sch.id
    JOIN districts d ON sch.district_id = d.id
    {extra_join}
    WHERE 1=1
    """
    params: dict = {}

    if scope.school_id:
        query += " AND s.school_id = :school_id"
        params["school_id"] = scope.school_id
    if scope.district_id:
        query += " AND sch.district_id = :district_id"
        params["district_id"] = scope.district_id
    if scope.affiliation_id:
        query += " AND d.affiliation_id = :affiliation_id"
        params["affiliation_id"] = scope.affiliation_id
    if assessment_type:
        query += " AND a.assessment_type = :assessment_type"
        params["assessment_type"] = assessment_type
    if grade:
        query += " AND COALESCE(a.grade_snapshot, s.grade) = :grade"
        params["grade"] = grade
    if gender:
        query += " AND s.gender = :gender"
        params["gender"] = gender
    if date_from:
        query += " AND a.created_at >= :date_from"
        params["date_from"] = datetime.combine(date_from, datetime.min.time())
    if date_to:
        query += " AND a.created_at <= :date_to"
        params["date_to"] = datetime.combine(date_to, datetime.max.time())
    if survey_round_id:
        query += " AND a.survey_round_id = :survey_round_id"
        params["survey_round_id"] = survey_round_id

    query += f" GROUP BY {select_name}, a.severity_level ORDER BY {select_name}"

    result = await db.execute(text(query), params)
    rows = result.fetchall()

    groups: dict = {}
    for row in rows:
        name = row.group_name or "ไม่ระบุ"
        if name not in groups:
            groups[name] = {"name": name, "total": 0, "levels": {}}
        groups[name]["total"] += row.cnt
        groups[name]["levels"][row.severity_level] = row.cnt

    out = []
    LEVELS = ["normal", "none", "mild", "moderate", "severe", "very_severe", "clinical"]
    for g in groups.values():
        total = g["total"]
        item: dict = {"name": g["name"], "total": total}
        for lvl in LEVELS:
            cnt = g["levels"].get(lvl, 0)
            item[f"{lvl}_pct"] = round(cnt / total * 100, 1) if total > 0 else 0
            item[f"{lvl}_cnt"] = cnt
        out.append(item)

    return out


@router.post("/export/pdf")
async def export_pdf(
    body: dict,
    current_user = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    from app.services.export_service import generate_pdf_report
    pdf_bytes = await generate_pdf_report(db, current_user, body)
    from fastapi.responses import Response
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=lemcs_report.pdf"}
    )

@router.post("/export/excel")
async def export_excel(
    body: dict,
    current_user = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    from app.services.export_service import generate_excel_report
    excel_bytes = await generate_excel_report(db, current_user, body)
    from fastapi.responses import Response
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=lemcs_report.xlsx"}
    )
