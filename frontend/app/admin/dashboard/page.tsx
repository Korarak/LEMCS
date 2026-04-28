"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import useSWR from "swr";
import Link from "next/link";
import { api } from "@/lib/api";
import { getAdminRole, getAdminSchoolId } from "@/lib/auth";
import StatsCards          from "@/components/admin/StatsCards";
import SeverityChart       from "@/components/admin/SeverityChart";
import TrendChart          from "@/components/admin/TrendChart";
import AssessmentTypeChart from "@/components/admin/AssessmentTypeChart";
import RiskProgressBars    from "@/components/admin/RiskProgressBars";
import RecentAlerts        from "@/components/admin/RecentAlerts";
import InsightPanel        from "@/components/admin/InsightPanel";
import AlertStatusSummary  from "@/components/admin/AlertStatusSummary";
import RiskFunnelChart     from "@/components/admin/RiskFunnelChart";
import MoMDeltaChart       from "@/components/admin/MoMDeltaChart";
import FilterBar, { type DashboardFilters } from "@/components/admin/FilterBar";
import OrgCompareChart from "@/components/admin/OrgCompareChart";
import SurveyRoundBanner from "@/components/admin/SurveyRoundBanner";
import AffiliationStudentStats from "@/components/admin/AffiliationStudentStats";
import type { SurveyRound } from "@/types/survey-round";

const fetcher = (url: string) => api.get(url).then(r => r.data);

function buildQS(f: DashboardFilters): string {
  const p = new URLSearchParams();
  if (f.survey_round_id) p.set("survey_round_id", f.survey_round_id);
  if (f.affiliation_id)  p.set("affiliation_id",  f.affiliation_id);
  if (f.district_id)     p.set("district_id",     f.district_id);
  if (f.school_id)       p.set("school_id",       f.school_id);
  if (f.assessment_type) p.set("assessment_type", f.assessment_type);
  if (f.grade)           p.set("grade",           f.grade);
  if (f.gender)          p.set("gender",          f.gender);
  // date filters are ignored when survey_round_id is set
  if (!f.survey_round_id && f.date_from) p.set("date_from", f.date_from);
  if (!f.survey_round_id && f.date_to)   p.set("date_to",   f.date_to);
  return p.toString();
}

function downloadCanvasAsPng(canvasId: string, filename: string) {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas) return;
  const link = document.createElement("a");
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

async function exportReport(qs: string, format: "pdf" | "excel") {
  try {
    const params = Object.fromEntries(new URLSearchParams(qs));
    const res = await api.post(`/reports/export/${format}`, params, { responseType: "blob" });
    const ext  = format === "pdf" ? "pdf" : "xlsx";
    const mime = format === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const blob = new Blob([res.data], { type: mime });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href     = url;
    link.download = `lemcs_report.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    alert("ส่งออกไม่สำเร็จ กรุณาลองใหม่");
  }
}

function SectionHeader({ icon, label, description, accent = "border-primary" }: {
  icon: string; label: string; description: string; accent?: string;
}) {
  return (
    <div className={`flex items-center gap-3 border-l-4 ${accent} pl-3`}>
      <span className="text-xl">{icon}</span>
      <div>
        <h2 className="font-bold text-base leading-snug">{label}</h2>
        <p className="text-xs text-base-content/45 leading-tight">{description}</p>
      </div>
    </div>
  );
}

function DownloadBtn({ canvasId, filename }: { canvasId: string; filename: string }) {
  return (
    <button
      onClick={() => downloadCanvasAsPng(canvasId, filename)}
      className="btn btn-ghost btn-xs gap-1 text-base-content/40 hover:text-base-content"
      title="ดาวน์โหลดกราฟ PNG"
    >
      ↓ PNG
    </button>
  );
}

const QUICK_ACTIONS = [
  { href: "/admin/alerts",   label: "จัดการแจ้งเตือน", icon: "🚨", cls: "btn-error"   },
  { href: "/admin/reports",  label: "ส่งออกรายงาน",   icon: "📋", cls: "btn-outline" },
  { href: "/admin/students", label: "รายชื่อนักเรียน", icon: "👥", cls: "btn-outline" },
  { href: "/admin/import",   label: "นำเข้าข้อมูล",   icon: "📥", cls: "btn-outline" },
];

export default function AdminDashboardPage() {
  const [isSchoolAdmin, setIsSchoolAdmin] = useState(false);
  const [mySchoolId,    setMySchoolId]    = useState<number | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>({
    survey_round_id: "",
    affiliation_id: "", district_id: "", school_id: "",
    assessment_type: "", grade: "", gender: "", date_from: "", date_to: "",
  });
  const [exporting, setExporting] = useState<"pdf"|"excel"|null>(null);

  useEffect(() => {
    const role = getAdminRole();
    const sid  = getAdminSchoolId();
    if (role === "schooladmin" && sid) {
      setIsSchoolAdmin(true);
      setMySchoolId(sid);
      setFilters(prev => ({ ...prev, school_id: sid.toString() }));
    }
  }, []);

  const { data: rounds } = useSWR<SurveyRound[]>("/survey-rounds", fetcher);

  // schooladmin: โหลดชื่อโรงเรียน (backend scopes เหลือเฉพาะโรงเรียนตัวเอง)
  const { data: mySchoolList } = useSWR<{id: number; name: string}[]>(
    isSchoolAdmin ? "/admin/schools" : null, fetcher
  );
  const mySchoolName = mySchoolList?.[0]?.name ?? "โรงเรียนของคุณ";

  // Auto-select compare group_by based on active filters
  const compareGroupBy = useMemo(() => {
    if (filters.district_id) return "school" as const;
    if (filters.affiliation_id) return "district" as const;
    return "affiliation" as const;
  }, [filters.district_id, filters.affiliation_id]);

  const qs = useMemo(() => buildQS(filters), [filters]);

  const selectedRound = useMemo(
    () => rounds?.find(r => r.id === filters.survey_round_id) ?? null,
    [rounds, filters.survey_round_id],
  );

  const subtitleText = useMemo(() => {
    if (isSchoolAdmin) {
      if (selectedRound) return `${mySchoolName} · ${selectedRound.label}`;
      return mySchoolName;
    }
    if (selectedRound) {
      return `${selectedRound.label} · ปีการศึกษา ${selectedRound.academic_year} ภาคเรียนที่ ${selectedRound.term}`;
    }
    if (filters.date_from || filters.date_to) {
      const from = filters.date_from
        ? new Date(filters.date_from).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
        : "–";
      const to = filters.date_to
        ? new Date(filters.date_to).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
        : "–";
      return `ช่วงวันที่ ${from} ถึง ${to}`;
    }
    return "ข้อมูลทั้งหมด จ.เลย";
  }, [isSchoolAdmin, mySchoolName, selectedRound, filters.date_from, filters.date_to]);

  const { data: summaryData } = useSWR(
    `/reports/summary${qs ? `?${qs}` : ""}`, fetcher, { refreshInterval: 60000 },
  );
  const { data: trendData } = useSWR(
    `/reports/trend${qs ? `?${qs}` : ""}`, fetcher, { refreshInterval: 60000 },
  );
  const { data: studentCountData } = useSWR(
    `/admin/students?limit=1&offset=0${qs ? `&${qs}` : ""}`, fetcher, { refreshInterval: 300000 },
  );

  const totalRegistered: number = studentCountData?.total ?? 0;
  const handleFilterChange = useCallback((f: DashboardFilters) => {
    // schooladmin ต้องล็อก school_id ไว้เสมอ
    setFilters(isSchoolAdmin && mySchoolId ? { ...f, school_id: mySchoolId.toString() } : f);
  }, [isSchoolAdmin, mySchoolId]);

  const severityChartData = useMemo(() => {
    if (!summaryData?.data) return [];
    const map = new Map<string, number>();
    summaryData.data.forEach((d: any) => {
      map.set(d.severity_level, (map.get(d.severity_level) || 0) + d.count);
    });
    return Array.from(map.entries()).map(([severity_level, count]) => ({ severity_level, count }));
  }, [summaryData]);

  const summaryRows: any[] = summaryData?.data ?? [];

  const handleExport = async (format: "pdf" | "excel") => {
    setExporting(format);
    await exportReport(qs, format);
    setExporting(null);
  };

  const now = new Date().toLocaleDateString("th-TH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="space-y-8 pb-12 max-w-screen-xl print:space-y-4">

      {/* ── Survey Round Banner ─────────────────────────────────────────── */}
      <div className="print:hidden">
        <SurveyRoundBanner />
      </div>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">ภาพรวมผลการประเมิน</h1>
          <p className="text-base-content/50 text-sm">{subtitleText}</p>
        </div>

        {/* Export toolbar */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="btn btn-outline btn-sm gap-1.5"
          >
            🖨️ พิมพ์หน้านี้
          </button>
          <button
            onClick={() => handleExport("excel")}
            disabled={exporting !== null}
            className="btn btn-outline btn-sm gap-1.5 text-success border-success/40 hover:bg-success hover:border-success"
          >
            {exporting === "excel" ? <span className="loading loading-spinner loading-xs" /> : "📊"}
            Excel
          </button>
          <button
            onClick={() => handleExport("pdf")}
            disabled={exporting !== null}
            className="btn btn-outline btn-sm gap-1.5 text-error border-error/40 hover:bg-error hover:border-error"
          >
            {exporting === "pdf" ? <span className="loading loading-spinner loading-xs" /> : "📄"}
            PDF
          </button>
          <p className="text-xs text-base-content/40 hidden sm:block">{now}</p>
        </div>
      </div>

      {/* ── Filter ─────────────────────────────────────────────────────── */}
      <div className="print:hidden">
        <FilterBar onFilterChange={handleFilterChange} isSchoolAdmin={isSchoolAdmin} />
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION A — ผู้บริหาร
      ══════════════════════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <SectionHeader
          icon="📊"
          label="สรุปภาพรวมผู้บริหาร"
          description="ตัวเลขหลักและข้อสังเกตสำคัญ — อัปเดตทุก 1 นาที"
          accent="border-primary"
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCards queryString={qs} trendData={trendData} />
        </div>

        {/* Risk Funnel — executive gold */}
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-sm">ช่องทางการดูแล (Risk Funnel)</h3>
              <span className="badge badge-sm badge-ghost">Funnel</span>
            </div>
            <p className="text-xs text-base-content/40 mb-4">
              แสดงจำนวนนักเรียนในแต่ละขั้นของการดูแล — แถบแคบลงแสดงว่าคนออกจากระบบการดูแล
            </p>
            <RiskFunnelChart totalRegistered={totalRegistered} summaryData={summaryData} />
          </div>
        </div>

        <InsightPanel summaryData={summaryData} trendData={trendData} totalRegistered={totalRegistered} />
        {!isSchoolAdmin && <AffiliationStudentStats />}
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION B — ผู้ปฏิบัติงาน
      ══════════════════════════════════════════════════════════════════ */}
      <section className="space-y-4 print:hidden">
        <SectionHeader
          icon="🚨"
          label="ศูนย์ปฏิบัติการ"
          description="รายการที่ต้องดำเนินการ — อัปเดตทุก 30 วินาที"
          accent="border-error"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-1">
            <AlertStatusSummary />
          </div>
          <div className="card bg-base-100 shadow lg:col-span-2">
            <div className="card-body py-4 px-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-sm">การแจ้งเตือนล่าสุด</h3>
                <Link href="/admin/alerts" className="text-xs text-primary hover:underline">ดูทั้งหมด →</Link>
              </div>
              <p className="text-xs text-base-content/40 mb-3">คลิกเพื่อดูรายละเอียดและดำเนินการ</p>
              <RecentAlerts limit={8} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map(a => (
            <Link key={a.href} href={a.href} className={`btn btn-sm gap-1.5 ${a.cls}`}>
              <span>{a.icon}</span>{a.label}
            </Link>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION C — นักวิเคราะห์ข้อมูล
      ══════════════════════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <SectionHeader
          icon="📈"
          label="วิเคราะห์เชิงลึก"
          description="แนวโน้มและการเปรียบเทียบ — ดาวน์โหลดกราฟแต่ละชิ้นด้วยปุ่ม ↓ PNG"
          accent="border-info"
        />

        {/* Row 1: Trend (full width) + MoM Delta */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          <div className="card bg-base-100 shadow lg:col-span-2">
            <div className="card-body">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <h3 className="font-semibold text-sm">แนวโน้มคะแนนเฉลี่ยรายเดือน</h3>
                <div className="flex items-center gap-1">
                  <span className="badge badge-sm badge-ghost">Line · 6 เดือน</span>
                  <DownloadBtn canvasId="trend-chart" filename="lemcs_trend" />
                </div>
              </div>
              <p className="text-xs text-base-content/40 mb-3">
                ยิ่งสูงยิ่งมีความเสี่ยง · เส้นขึ้นต่อเนื่องหลายเดือนควรตรวจสอบ
              </p>
              {trendData && trendData.length > 0
                ? <TrendChart data={trendData} canvasId="trend-chart" />
                : <p className="text-center text-base-content/40 py-10">{trendData ? "ยังไม่มีข้อมูลเพียงพอ" : "กำลังโหลด…"}</p>
              }
            </div>
          </div>

          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-sm">เปรียบเทียบเดือนนี้ vs เดือนก่อน</h3>
                <DownloadBtn canvasId="mom-delta-chart" filename="lemcs_mom_delta" />
              </div>
              <p className="text-xs text-base-content/40 mb-3">
                แดง = คะแนนสูงขึ้น (แย่ลง) · เขียว = ลดลง (ดีขึ้น)
              </p>
              <MoMDeltaChart
                trendData={trendData ?? []}
                canvasId="mom-delta-chart"
              />
            </div>
          </div>

        </div>

        {/* Row 2: Severity doughnut + Assessment type stacked bar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-sm">การกระจายระดับความเสี่ยง</h3>
                <div className="flex items-center gap-1">
                  <span className="badge badge-sm badge-ghost">Doughnut</span>
                  <DownloadBtn canvasId="severity-chart" filename="lemcs_severity" />
                </div>
              </div>
              <p className="text-xs text-base-content/40 mb-3">
                เขียว = ปกติ · เหลือง = เฝ้าระวัง · แดง/ม่วง = วิกฤต
              </p>
              {severityChartData.length > 0
                ? <SeverityChart data={severityChartData} canvasId="severity-chart" />
                : <p className="text-center text-base-content/40 py-10">ไม่มีข้อมูล</p>
              }
            </div>
          </div>

          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-sm">ความเสี่ยงแยกตามแบบประเมิน</h3>
                <div className="flex items-center gap-1">
                  <span className="badge badge-sm badge-ghost">Stacked Bar</span>
                  <DownloadBtn canvasId="type-chart" filename="lemcs_by_type" />
                </div>
              </div>
              <p className="text-xs text-base-content/40 mb-3">
                แถบสีเข้ม (แดง/ม่วง) ยาว = แบบนั้นพบปัญหาสูงกว่า
              </p>
              {summaryRows.length > 0
                ? <AssessmentTypeChart data={summaryRows} canvasId="type-chart" />
                : <p className="text-center text-base-content/40 py-10">ไม่มีข้อมูล</p>
              }
            </div>
          </div>

        </div>

        {/* Row 3: Risk progress bars */}
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h3 className="font-semibold text-sm mb-1">สัดส่วนระดับความเสี่ยง (ตัวเลขและแถบ)</h3>
            <p className="text-xs text-base-content/40 mb-4">จำนวนและเปอร์เซ็นต์แต่ละระดับ</p>
            {severityChartData.length > 0
              ? <RiskProgressBars data={severityChartData} />
              : <p className="text-center text-base-content/40 py-10">ไม่มีข้อมูล</p>
            }
          </div>
        </div>

      </section>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION D — เปรียบเทียบระหว่างองค์กร (ซ่อนสำหรับ schooladmin)
      ══════════════════════════════════════════════════════════════════ */}
      {!isSchoolAdmin && <section className="space-y-4">
        <SectionHeader
          icon="🏫"
          label="เปรียบเทียบสัดส่วนความเสี่ยงระหว่างสังกัด / เขต / โรงเรียน"
          description="อัตราส่วน % ที่เท่ากัน — มองเห็นความแตกต่างระหว่างองค์กรได้ชัดโดยไม่ถูกจำนวนนักเรียนบิดเบือน"
          accent="border-warning"
        />

        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <h3 className="font-semibold text-sm">อัตราส่วนระดับความเสี่ยง (100% Stacked)</h3>
              <div className="flex items-center gap-1">
                <span className="badge badge-sm badge-ghost">% เปรียบเทียบ</span>
                <DownloadBtn canvasId="org-compare-chart" filename="lemcs_org_compare" />
              </div>
            </div>
            <p className="text-xs text-base-content/40 mb-4">
              แต่ละแถบยาวเท่ากัน 100% — เปรียบเทียบสัดส่วนได้โดยตรง · แถบแดง/ม่วงยาวกว่า = องค์กรนั้นมีความเสี่ยงสูงกว่า
              {filters.district_id
                ? " · กำลังแสดงโรงเรียนในเขตที่เลือก"
                : filters.affiliation_id
                ? " · กำลังแสดงเขตในสังกัดที่เลือก"
                : " · กำลังแสดงทุกสังกัด"}
            </p>
            <OrgCompareChart
              queryString={qs}
              defaultGroupBy={compareGroupBy}
              canvasId="org-compare-chart"
            />
          </div>
        </div>
      </section>}

      {/* ── Print styles ─────────────────────────────────────────────── */}
      <style>{`
        @media print {
          .drawer-side { display: none !important; }
          .drawer-content { margin-left: 0 !important; }
          .navbar { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

    </div>
  );
}
