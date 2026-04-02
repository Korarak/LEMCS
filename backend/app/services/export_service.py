from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
import io

SEVERITY_TH = {
    "normal": "ปกติ", "mild": "น้อย", "moderate": "ปานกลาง", "severe": "มาก",
    "none": "ไม่มีอาการ", "very_severe": "รุนแรงมาก",
    "clinical": "ต้องดูแล",
}

async def get_report_data(db, current_user, filters: dict) -> list[dict]:
    from sqlalchemy import text
    from app.deps import check_report_scope

    scope = await check_report_scope(current_user, filters.get("school_id"), filters.get("district_id"))

    query = """
    SELECT
        s.first_name, s.last_name, s.grade, s.gender,
        sc.name AS school_name,
        a.assessment_type, a.score, a.severity_level,
        a.suicide_risk, a.created_at
    FROM assessments a
    JOIN students s ON a.student_id = s.id
    LEFT JOIN schools sc ON s.school_id = sc.id
    WHERE 1=1
    """
    params = {}

    if scope.school_id:
        query += " AND s.school_id = :school_id"
        params["school_id"] = scope.school_id

    if filters.get("assessment_type"):
        query += " AND a.assessment_type = :assessment_type"
        params["assessment_type"] = filters["assessment_type"]

    if filters.get("grade"):
        query += " AND s.grade = :grade"
        params["grade"] = filters["grade"]

    query += " ORDER BY a.created_at DESC LIMIT 5000"

    result = await db.execute(text(query), params)
    return [dict(row._mapping) for row in result.fetchall()]


async def generate_excel_report(db, current_user, filters: dict) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "รายงาน LEMCS"

    header_fill = PatternFill(start_color="3B82F6", end_color="3B82F6", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)

    headers = ["ลำดับ", "โรงเรียน", "ระดับชั้น", "เพศ", "ประเภทแบบประเมิน",
               "คะแนน", "ระดับความเสี่ยง", "ความเสี่ยงการฆ่าตัวตาย", "วันที่ประเมิน"]

    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")

    data = await get_report_data(db, current_user, filters)

    for row_idx, row in enumerate(data, 2):
        ws.cell(row=row_idx, column=1, value=row_idx - 1)
        ws.cell(row=row_idx, column=2, value=row["school_name"] or "ไม่มีข้อมูล")
        ws.cell(row=row_idx, column=3, value=row["grade"])
        ws.cell(row=row_idx, column=4, value=row["gender"])
        ws.cell(row=row_idx, column=5, value=row["assessment_type"])
        ws.cell(row=row_idx, column=6, value=row["score"])
        ws.cell(row=row_idx, column=7, value=SEVERITY_TH.get(row["severity_level"], row["severity_level"]))
        ws.cell(row=row_idx, column=8, value="⚠️ ใช่" if row["suicide_risk"] else "ไม่มี")
        ws.cell(row=row_idx, column=9, value=row["created_at"].strftime("%d/%m/%Y %H:%M"))

    for col in ws.columns:
        max_len = max((len(str(cell.value or "")) for cell in col), default=10)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 4, 40)

    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()


async def generate_pdf_report(db, current_user, filters: dict) -> bytes:
    from weasyprint import HTML
    data = await get_report_data(db, current_user, filters)

    html_content = f"""
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;700&display=swap');
            body {{ font-family: 'Noto Sans Thai', sans-serif; font-size: 12px; margin: 2cm; }}
            h1 {{ color: #3B82F6; font-size: 20px; text-align: center; }}
            .subtitle {{ text-align: center; color: #6B7280; margin-bottom: 1.5rem; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 1rem; }}
            th {{ background: #3B82F6; color: white; padding: 8px; text-align: left; font-size: 11px; }}
            td {{ padding: 6px 8px; border-bottom: 1px solid #E5E7EB; font-size: 11px; }}
            tr:nth-child(even) {{ background: #F9FAFB; }}
            .footer {{ text-align: center; color: #9CA3AF; font-size: 9px; margin-top: 2rem; }}
            .risk {{ color: #EF4444; font-weight: bold; }}
        </style>
    </head>
    <body>
        <h1>🧠 LEMCS — รายงานผลการประเมินสุขภาพจิต</h1>
        <p class="subtitle">ระบบสำรวจและประเมินสุขภาพจิตนักเรียน จ.เลย</p>

        <table>
            <thead>
                <tr>
                    <th>ลำดับ</th>
                    <th>โรงเรียน</th>
                    <th>ระดับชั้น</th>
                    <th>เพศ</th>
                    <th>แบบประเมิน</th>
                    <th>คะแนน</th>
                    <th>ระดับ</th>
                    <th>เสี่ยงฆ่าตัวตาย</th>
                    <th>วันที่</th>
                </tr>
            </thead>
            <tbody>
    """

    for i, row in enumerate(data, 1):
        risk_class = ' class="risk"' if row["suicide_risk"] else ""
        html_content += f"""
                <tr>
                    <td>{i}</td>
                    <td>{row["school_name"] or "ไม่มีข้อมูล"}</td>
                    <td>{row["grade"]}</td>
                    <td>{row["gender"]}</td>
                    <td>{row["assessment_type"]}</td>
                    <td>{row["score"]}</td>
                    <td>{SEVERITY_TH.get(row["severity_level"], row["severity_level"])}</td>
                    <td{risk_class}>{"⚠️ ใช่" if row["suicide_risk"] else "ไม่มี"}</td>
                    <td>{row["created_at"].strftime("%d/%m/%Y")}</td>
                </tr>
        """

    html_content += """
            </tbody>
        </table>
        <p class="footer">LEMCS — ระบบประเมินสุขภาพจิตนักเรียน จ.เลย | สร้างอัตโนมัติ</p>
    </body>
    </html>
    """

    return HTML(string=html_content).write_pdf()
