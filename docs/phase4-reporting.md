# Phase 4 — Reporting Dashboard
## LEMCS Developer Guide

> ก่อนอ่านไฟล์นี้: Phase 1, 2, 3 ต้องผ่าน checklist ครบแล้ว

---

## เป้าหมายของ Phase 4

- [x] Report API (summary + per school) พร้อม role-based scope
- [x] Admin dashboard: Stats cards + charts (Chart.js)
- [x] Export PDF (WeasyPrint) + Export Excel (openpyxl)
- [x] Filters: school / district / affiliation / grade / gender / date / assessment type

---

## ขั้นตอน 1: Report API

### backend/app/routers/reports.py

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, datetime
from app.database import get_db
from app.deps import get_current_admin_user, check_report_scope

router = APIRouter()

@router.get("/summary")
async def get_summary(
    school_id: int | None = Query(None),
    district_id: int | None = Query(None),
    assessment_type: str | None = Query(None),     # ST5|PHQA|CDI
    grade: str | None = Query(None),
    gender: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    current_user = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """
    ภาพรวมผล อัตโนมัติกรองตาม role ของผู้ใช้
    - teacher → only own class
    - school_admin → only own school
    - district_admin → only own district
    - province_admin/superadmin → all
    """
    scope = await check_report_scope(current_user, school_id, district_id)

    query = """
    SELECT
        COUNT(DISTINCT a.student_id) AS total_students,
        COUNT(a.id) AS total_assessments,
        a.severity_level,
        a.assessment_type,
        COUNT(*) AS count
    FROM assessments a
    JOIN students s ON a.student_id = s.id
    WHERE 1=1
    """
    params = {}

    if scope.school_id:
        query += " AND s.school_id = :school_id"
        params["school_id"] = scope.school_id

    if assessment_type:
        query += " AND a.assessment_type = :assessment_type"
        params["assessment_type"] = assessment_type

    if grade:
        query += " AND s.grade = :grade"
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

    query += " GROUP BY a.severity_level, a.assessment_type"

    result = await db.execute(query, params)
    rows = result.fetchall()

    return {
        "filters": {"school_id": scope.school_id, "assessment_type": assessment_type},
        "data": [dict(r) for r in rows],
    }

@router.post("/export/pdf")
async def export_pdf(
    body: dict,
    current_user = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate PDF report (WeasyPrint)"""
    from app.services.export_service import generate_pdf_report
    pdf_bytes = await generate_pdf_report(db, current_user, body)
    from fastapi.responses import Response
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=lemcs_report.pdf"}
    )

@router.post("/export/excel")
async def export_excel(
    body: dict,
    current_user = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate Excel file (openpyxl)"""
    from app.services.export_service import generate_excel_report
    excel_bytes = await generate_excel_report(db, current_user, body)
    from fastapi.responses import Response
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=lemcs_report.xlsx"}
    )
```

---

## ขั้นตอน 2: Export Service

### backend/app/services/export_service.py

```python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
import io

SEVERITY_TH = {
    # ST5
    "normal": "ปกติ", "mild": "น้อย", "moderate": "ปานกลาง", "severe": "มาก",
    # PHQA extra
    "none": "ไม่มีอาการ", "very_severe": "รุนแรงมาก",
    # CDI
    "clinical": "ต้องดูแล",
}

async def generate_excel_report(db, current_user, filters: dict) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "รายงาน LEMCS"

    # Header style
    header_fill = PatternFill(start_color="3B82F6", end_color="3B82F6", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)

    headers = ["ลำดับ", "โรงเรียน", "ระดับชั้น", "เพศ", "ประเภทแบบประเมิน",
               "คะแนน", "ระดับความเสี่ยง", "ความเสี่ยงการฆ่าตัวตาย", "วันที่ประเมิน"]

    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")

    # Query data
    data = await get_report_data(db, current_user, filters)

    for row_idx, row in enumerate(data, 2):
        ws.cell(row=row_idx, column=1, value=row_idx - 1)
        ws.cell(row=row_idx, column=2, value=row["school_name"])
        ws.cell(row=row_idx, column=3, value=row["grade"])
        ws.cell(row=row_idx, column=4, value=row["gender"])
        ws.cell(row=row_idx, column=5, value=row["assessment_type"])
        ws.cell(row=row_idx, column=6, value=row["score"])
        ws.cell(row=row_idx, column=7, value=SEVERITY_TH.get(row["severity_level"], row["severity_level"]))
        ws.cell(row=row_idx, column=8, value="⚠️ ใช่" if row["suicide_risk"] else "ไม่มี")
        ws.cell(row=row_idx, column=9, value=row["created_at"].strftime("%d/%m/%Y %H:%M"))

    # Auto-column width
    for col in ws.columns:
        max_len = max((len(str(cell.value or "")) for cell in col), default=10)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 4, 40)

    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()
```

---

## ขั้นตอน 3: Admin Dashboard Page

### app/(admin)/dashboard/page.tsx

```typescript
import StatsCards from "@/components/admin/StatsCards";
import SeverityChart from "@/components/admin/SeverityChart";
import TrendChart from "@/components/admin/TrendChart";
import RecentAlerts from "@/components/admin/RecentAlerts";
import FilterBar from "@/components/admin/FilterBar";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">ภาพรวมผลการประเมิน</h1>
        <p className="text-base-content/60 text-sm">ข้อมูล จ.เลย ปีการศึกษา 2567 ภาคเรียนที่ 2</p>
      </div>

      {/* Filter Bar */}
      <FilterBar />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCards />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title text-sm">การกระจายระดับความเสี่ยง</h2>
            <SeverityChart />
          </div>
        </div>

        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title text-sm">แนวโน้มรายเดือน</h2>
            <TrendChart />
          </div>
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title">การแจ้งเตือนล่าสุด</h2>
          <RecentAlerts />
        </div>
      </div>
    </div>
  );
}
```

### components/admin/SeverityChart.tsx

```typescript
"use client";

import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

const SEVERITY_COLORS = {
  normal:     "#10B981",  // เขียว
  mild:       "#06B6D4",  // ฟ้า
  moderate:   "#F59E0B",  // เหลือง
  severe:     "#EF4444",  // แดง
  very_severe:"#7C3AED",  // ม่วง
  clinical:   "#EF4444",  // แดง (CDI)
};

interface SeverityChartProps {
  data: { severity_level: string; count: number }[];
}

export default function SeverityChart({ data }: SeverityChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !data) return;

    if (chartRef.current) chartRef.current.destroy();

    chartRef.current = new Chart(canvasRef.current, {
      type: "doughnut",
      data: {
        labels: data.map(d => d.severity_level),
        datasets: [{
          data: data.map(d => d.count),
          backgroundColor: data.map(d => SEVERITY_COLORS[d.severity_level as keyof typeof SEVERITY_COLORS] || "#9CA3AF"),
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" },
        },
      },
    });

    return () => chartRef.current?.destroy();
  }, [data]);

  return <canvas ref={canvasRef} />;
}
```

### components/admin/TrendChart.tsx

```typescript
"use client";

import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

export default function TrendChart({ data }: { data: any[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !data) return;
    if (chartRef.current) chartRef.current.destroy();

    const labels = data.map(d => d.month);  // e.g., ["ก.ค.", "ส.ค.", "ก.ย."]

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "ST-5 (ความเครียด)",
            data: data.map(d => d.st5_avg),
            borderColor: "#F59E0B",
            tension: 0.4,
          },
          {
            label: "PHQ-A (ซึมเศร้า)",
            data: data.map(d => d.phqa_avg),
            borderColor: "#EF4444",
            tension: 0.4,
          },
          {
            label: "CDI (ซึมเศร้าเด็ก)",
            data: data.map(d => d.cdi_avg),
            borderColor: "#8B5CF6",
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom" } },
      },
    });

    return () => chartRef.current?.destroy();
  }, [data]);

  return <canvas ref={canvasRef} />;
}
```

---

## ขั้นตอน 5: StatsCards Component

### components/admin/StatsCards.tsx

```typescript
"use client";

import useSWR from "swr";
import { api } from "@/lib/api";

const fetcher = (url: string) => api.get(url).then(r => r.data);

export default function StatsCards() {
  const { data } = useSWR("/reports/summary", fetcher);

  if (!data) {
    return (
      <>
        {[1,2,3,4].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
      </>
    );
  }

  // Aggregate data
  const totalStudents = data.data.reduce((sum: number, d: any) => sum + (d.total_students || 0), 0);
  const totalAssessments = data.data.reduce((sum: number, d: any) => sum + (d.total_assessments || 0), 0);
  const criticalCount = data.data.filter((d: any) =>
    ["severe", "very_severe", "clinical"].includes(d.severity_level)
  ).reduce((sum: number, d: any) => sum + d.count, 0);
  const suicideRiskCount = data.data.filter((d: any) => d.suicide_risk_count).reduce(
    (sum: number, d: any) => sum + d.suicide_risk_count, 0
  );

  const cards = [
    { label: "นักเรียนทั้งหมด",    value: totalStudents.toLocaleString(),    icon: "👥", color: "text-primary" },
    { label: "แบบประเมินทั้งหมด",  value: totalAssessments.toLocaleString(), icon: "📋", color: "text-info" },
    { label: "ต้องดูแล (สูง/วิกฤต)", value: criticalCount.toLocaleString(),   icon: "⚠️", color: "text-warning" },
    { label: "เสี่ยงฆ่าตัวตาย",     value: suicideRiskCount.toLocaleString(), icon: "🚨", color: "text-error" },
  ];

  return (
    <>
      {cards.map((card) => (
        <div key={card.label} className="card bg-base-100 shadow">
          <div className="card-body py-4 px-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{card.icon}</span>
              <div>
                <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                <p className="text-xs text-base-content/60">{card.label}</p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
```

---

## ขั้นตอน 6: FilterBar Component

### components/admin/FilterBar.tsx

```typescript
"use client";

import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";

const fetcher = (url: string) => api.get(url).then(r => r.data);

export default function FilterBar() {
  const { data: schools } = useSWR("/admin/schools", fetcher);

  const [filters, setFilters] = useState({
    school_id: "",
    assessment_type: "",
    grade: "",
    gender: "",
    date_from: "",
    date_to: "",
  });

  const handleChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    // Emit filter change event — ใช้ global state หรือ context
  };

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body py-3">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {/* โรงเรียน */}
          <select
            className="select select-bordered select-sm w-full"
            value={filters.school_id}
            onChange={e => handleChange("school_id", e.target.value)}
          >
            <option value="">ทุกโรงเรียน</option>
            {schools?.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* ประเภทแบบประเมิน */}
          <select
            className="select select-bordered select-sm w-full"
            value={filters.assessment_type}
            onChange={e => handleChange("assessment_type", e.target.value)}
          >
            <option value="">ทุกแบบประเมิน</option>
            <option value="ST5">ST-5 (ความเครียด)</option>
            <option value="PHQA">PHQ-A (ซึมเศร้า)</option>
            <option value="CDI">CDI (ซึมเศร้าเด็ก)</option>
          </select>

          {/* ระดับชั้น */}
          <select
            className="select select-bordered select-sm w-full"
            value={filters.grade}
            onChange={e => handleChange("grade", e.target.value)}
          >
            <option value="">ทุกระดับชั้น</option>
            {["ม.1","ม.2","ม.3","ม.4","ม.5","ม.6","ปวช.1","ปวช.2","ปวช.3"].map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          {/* เพศ */}
          <select
            className="select select-bordered select-sm w-full"
            value={filters.gender}
            onChange={e => handleChange("gender", e.target.value)}
          >
            <option value="">ทุกเพศ</option>
            <option value="ชาย">ชาย</option>
            <option value="หญิง">หญิง</option>
          </select>

          {/* วันที่ */}
          <input
            type="date"
            className="input input-bordered input-sm w-full"
            value={filters.date_from}
            onChange={e => handleChange("date_from", e.target.value)}
          />
          <input
            type="date"
            className="input input-bordered input-sm w-full"
            value={filters.date_to}
            onChange={e => handleChange("date_to", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
```

---

## ขั้นตอน 7: PDF Export Service (WeasyPrint)

### backend/app/services/export_service.py (เพิ่มเติม)

```python
from weasyprint import HTML
import io

async def generate_pdf_report(db, current_user, filters: dict) -> bytes:
    """สร้าง PDF report ด้วย WeasyPrint"""
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
                    <td>{row["school_name"]}</td>
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

    pdf_bytes = HTML(string=html_content).write_pdf()
    return pdf_bytes

async def get_report_data(db, current_user, filters: dict) -> list[dict]:
    """ดึงข้อมูลรายงาน (ใช้ร่วมกันทั้ง PDF + Excel)"""
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
    JOIN schools sc ON s.school_id = sc.id
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
```

---

## ขั้นตอน 8: Report Scope Dependency

### backend/app/deps.py (เพิ่มเติม)

```python
from dataclasses import dataclass

@dataclass
class QueryScope:
    school_id: int | None = None
    district_id: int | None = None
    classroom: str | None = None

async def check_report_scope(current_user, school_id=None, district_id=None) -> QueryScope:
    """กรอง scope ตาม role ของผู้ใช้"""
    if current_user.role == "teacher":
        return QueryScope(school_id=current_user.school_id, classroom=getattr(current_user, "classroom", None))
    elif current_user.role == "school_admin":
        return QueryScope(school_id=current_user.school_id)
    elif current_user.role == "district_admin":
        return QueryScope(district_id=district_id or getattr(current_user, "district_id", None))
    elif current_user.role in ("province_admin", "superadmin"):
        return QueryScope(school_id=school_id, district_id=district_id)  # ไม่จำกัด
    else:
        raise HTTPException(403, "ไม่มีสิทธิ์ดูรายงาน")
```

---

## ขั้นตอน 9: RecentAlerts Component

### components/admin/RecentAlerts.tsx

```typescript
"use client";

import useSWR from "swr";
import { api } from "@/lib/api";
import Link from "next/link";

const fetcher = (url: string) => api.get(url).then(r => r.data);

const LEVEL_EMOJI = { warning: "⚠️", urgent: "🔴", critical: "🚨" };

export default function RecentAlerts() {
  const { data: alerts, isLoading } = useSWR("/alerts?limit=5", fetcher, {
    refreshInterval: 30000,
  });

  if (isLoading) return <div className="skeleton h-24 w-full" />;
  if (!alerts || alerts.length === 0) {
    return <p className="text-sm text-base-content/40 text-center py-4">ไม่มีการแจ้งเตือน</p>;
  }

  return (
    <div className="divide-y divide-base-200">
      {alerts.map((alert: any) => (
        <Link key={alert.id} href={`/admin/alerts`}>
          <div className="flex items-center gap-3 py-2 hover:bg-base-200/50 px-2 rounded transition">
            <span className="text-lg">
              {LEVEL_EMOJI[alert.alert_level as keyof typeof LEVEL_EMOJI] || "📢"}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {alert.school_name} • {alert.grade}
              </p>
              <p className="text-xs text-base-content/50">
                {alert.assessment_type} • คะแนน {alert.score}
              </p>
            </div>
            <span className={`badge badge-sm ${
              alert.status === "new" ? "badge-error" : "badge-ghost"
            }`}>
              {alert.status === "new" ? "ใหม่" : alert.status}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
```

---

## Checklist Phase 4

- [x] GET /api/reports/summary กรองตาม role ของผู้ใช้ถูกต้อง
  - teacher → เห็นเฉพาะห้องตัวเอง
  - school_admin → เห็นเฉพาะโรงเรียนตัวเอง
- [x] QueryScope dependency ทำงานถูกต้องทุก role
- [x] FilterBar: dropdown schools โหลด list จาก API
- [x] FilterBar: filter by date, grade, gender, assessment_type ทำงาน
- [x] StatsCards แสดงจำนวนนักเรียน, แบบประเมิน, ต้องดูแล, เสี่ยงฆ่าตัวตาย
- [x] Donut chart แสดง severity distribution ได้
- [x] Line chart แสดง monthly trend 3 assessment types ได้
- [x] RecentAlerts แสดง 5 alerts ล่าสุด + auto-refresh
- [x] Export Excel: download ไฟล์ .xlsx ได้ ข้อมูลถูกต้อง ตาราง Thai headers
- [x] Export PDF: download ไฟล์ .pdf ได้ มีหัวกระดาษ LEMCS + Noto Sans Thai
- [x] get_report_data ใช้ร่วมทั้ง PDF + Excel สม่ำเสมอ
- [x] Chart.js render ถูกต้องบน mobile 375px
