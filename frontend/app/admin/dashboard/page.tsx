"use client";

import { useState, useCallback, useMemo } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import StatsCards          from "@/components/admin/StatsCards";
import SeverityChart       from "@/components/admin/SeverityChart";
import TrendChart          from "@/components/admin/TrendChart";
import AssessmentTypeChart from "@/components/admin/AssessmentTypeChart";
import RiskProgressBars    from "@/components/admin/RiskProgressBars";
import RecentAlerts        from "@/components/admin/RecentAlerts";
import InsightPanel        from "@/components/admin/InsightPanel";
import FilterBar, { type DashboardFilters } from "@/components/admin/FilterBar";

const fetcher = (url: string) => api.get(url).then(r => r.data);

function buildQS(f: DashboardFilters): string {
  const p = new URLSearchParams();
  if (f.school_id)       p.set("school_id",       f.school_id);
  if (f.assessment_type) p.set("assessment_type",  f.assessment_type);
  if (f.grade)           p.set("grade",            f.grade);
  if (f.gender)          p.set("gender",           f.gender);
  if (f.date_from)       p.set("date_from",        f.date_from);
  if (f.date_to)         p.set("date_to",          f.date_to);
  return p.toString();
}

export default function AdminDashboardPage() {
  const [filters, setFilters] = useState<DashboardFilters>({
    school_id: "", assessment_type: "", grade: "", gender: "", date_from: "", date_to: "",
  });

  const qs = useMemo(() => buildQS(filters), [filters]);

  const { data: summaryData } = useSWR(
    `/reports/summary${qs ? `?${qs}` : ""}`,
    fetcher,
    { refreshInterval: 60000 },
  );
  const { data: trendData } = useSWR(
    `/reports/trend${qs ? `?${qs}` : ""}`,
    fetcher,
    { refreshInterval: 60000 },
  );

  const handleFilterChange = useCallback((f: DashboardFilters) => setFilters(f), []);

  // Severity distribution for doughnut
  const severityChartData = useMemo(() => {
    if (!summaryData?.data) return [];
    const map = new Map<string, number>();
    summaryData.data.forEach((d: any) => {
      map.set(d.severity_level, (map.get(d.severity_level) || 0) + d.count);
    });
    return Array.from(map.entries()).map(([severity_level, count]) => ({ severity_level, count }));
  }, [summaryData]);

  // Raw rows for stacked bar and progress bars
  const summaryRows: any[] = summaryData?.data ?? [];

  const now = new Date().toLocaleDateString("th-TH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="space-y-6 pb-8">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">ภาพรวมผลการประเมิน</h1>
          <p className="text-base-content/50 text-sm">ข้อมูล จ.เลย ปีการศึกษา 2567 ภาคเรียนที่ 2</p>
        </div>
        <p className="text-xs text-base-content/40 shrink-0">{now}</p>
      </div>

      {/* ── Filter ──────────────────────────────────────────────────── */}
      <FilterBar onFilterChange={handleFilterChange} />

      {/* ── KPI Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCards queryString={qs} />
      </div>

      {/* ── Insight Panel ───────────────────────────────────────────── */}
      <InsightPanel summaryData={summaryData} trendData={trendData} />

      {/* ── Row 1: Severity Doughnut | Assessment Type Stacked Bar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <div className="flex items-center justify-between mb-1">
              <h2 className="card-title text-sm">การกระจายระดับความเสี่ยง</h2>
              <span className="badge badge-sm badge-ghost">Doughnut</span>
            </div>
            <p className="text-xs text-base-content/40 mb-3">
              สัดส่วนผลประเมินทุกแบบแบ่งตามระดับความรุนแรง
            </p>
            {severityChartData.length > 0
              ? <SeverityChart data={severityChartData} />
              : <p className="text-center text-base-content/40 py-10">ไม่มีข้อมูล</p>
            }
          </div>
        </div>

        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <div className="flex items-center justify-between mb-1">
              <h2 className="card-title text-sm">ความเสี่ยงแยกตามแบบประเมิน</h2>
              <span className="badge badge-sm badge-ghost">Stacked Bar</span>
            </div>
            <p className="text-xs text-base-content/40 mb-3">
              แต่ละแบบประเมินพบระดับความเสี่ยงมากน้อยแค่ไหน
            </p>
            {summaryRows.length > 0
              ? <AssessmentTypeChart data={summaryRows} />
              : <p className="text-center text-base-content/40 py-10">ไม่มีข้อมูล</p>
            }
            <div className="mt-3 flex items-start gap-2 px-2 py-2 rounded-lg bg-base-200/60 text-xs text-base-content/70">
              <span className="shrink-0">📖</span>
              <p>
                <strong>อ่านกราฟ:</strong> แถบสีแดง/ม่วงในแต่ละแบบคือกลุ่มที่ต้องดูแลพิเศษ
                — แบบใดมีแถบสีเข้มมากกว่าแสดงว่าพบปัญหาในมิตินั้นสูงกว่า
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* ── Row 2: Trend Line | Risk Progress Bars ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <div className="flex items-center justify-between mb-1">
              <h2 className="card-title text-sm">แนวโน้มคะแนนรายเดือน</h2>
              <span className="badge badge-sm badge-ghost">Line</span>
            </div>
            <p className="text-xs text-base-content/40 mb-3">
              ค่าเฉลี่ยคะแนนแต่ละแบบประเมินย้อนหลัง 6 เดือน
            </p>
            {trendData && trendData.length > 0
              ? <TrendChart data={trendData} />
              : <p className="text-center text-base-content/40 py-10">
                  {trendData ? "ยังไม่มีข้อมูลเพียงพอ" : "กำลังโหลด…"}
                </p>
            }
          </div>
        </div>

        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <div className="flex items-center justify-between mb-1">
              <h2 className="card-title text-sm">สัดส่วนระดับความเสี่ยง</h2>
              <span className="badge badge-sm badge-ghost">Progress</span>
            </div>
            <p className="text-xs text-base-content/40 mb-4">
              แถบแสดงสัดส่วนและจำนวนครั้งของแต่ละระดับ — อ่านง่ายกว่ากราฟวงกลม
            </p>
            {severityChartData.length > 0
              ? <RiskProgressBars data={severityChartData} />
              : <p className="text-center text-base-content/40 py-10">ไม่มีข้อมูล</p>
            }
          </div>
        </div>

      </div>

      {/* ── Recent Alerts ────────────────────────────────────────────── */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <h2 className="card-title">การแจ้งเตือนล่าสุด</h2>
            <a href="/admin/alerts" className="text-xs text-primary hover:underline">ดูทั้งหมด →</a>
          </div>
          <p className="text-xs text-base-content/40 mb-2">
            5 รายการล่าสุด — อัปเดตอัตโนมัติทุก 30 วินาที
          </p>
          <RecentAlerts />
        </div>
      </div>

    </div>
  );
}
