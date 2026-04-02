"use client";

import { useMemo } from "react";

interface SummaryRow {
  total_students: number;
  total_assessments: number;
  severity_level: string;
  assessment_type: string;
  count: number;
  suicide_risk_count: number;
}

interface TrendRow {
  month: string;
  st5_avg: number | null;
  phqa_avg: number | null;
  cdi_avg: number | null;
}

interface Insight {
  level: "critical" | "warning" | "info" | "success";
  icon: string;
  title: string;
  body: string;
  action?: string;
}

const CRITICAL_LEVELS = new Set(["severe", "very_severe", "clinical"]);
const RISK_LEVELS = new Set(["moderate", "severe", "very_severe", "clinical"]);

function getTrendDirection(values: (number | null)[]): "up" | "down" | "stable" | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length < 2) return null;
  const last = valid[valid.length - 1];
  const prev = valid[valid.length - 2];
  const diff = last - prev;
  if (Math.abs(diff) < 0.1) return "stable";
  return diff > 0 ? "up" : "down";
}

export default function InsightPanel({
  summaryData,
  trendData,
}: {
  summaryData: { data: SummaryRow[] } | undefined;
  trendData: TrendRow[] | undefined;
}) {
  const insights = useMemo<Insight[]>(() => {
    if (!summaryData?.data?.length) return [];
    const rows = summaryData.data;

    const totalStudents     = rows.reduce((s, r) => s + (r.total_students || 0), 0);
    const totalAssessments  = rows.reduce((s, r) => s + (r.total_assessments || 0), 0);
    const totalCount        = rows.reduce((s, r) => s + r.count, 0);
    const criticalCount     = rows.filter(r => CRITICAL_LEVELS.has(r.severity_level)).reduce((s, r) => s + r.count, 0);
    const atRiskCount       = rows.filter(r => RISK_LEVELS.has(r.severity_level)).reduce((s, r) => s + r.count, 0);
    const suicideRiskCount  = rows.reduce((s, r) => s + (r.suicide_risk_count || 0), 0);
    const normalCount       = rows.filter(r => r.severity_level === "normal" || r.severity_level === "none").reduce((s, r) => s + r.count, 0);

    const criticalPct   = totalCount > 0 ? (criticalCount / totalCount) * 100 : 0;
    const atRiskPct     = totalCount > 0 ? (atRiskCount / totalCount) * 100 : 0;
    const normalPct     = totalCount > 0 ? (normalCount / totalCount) * 100 : 0;
    const completionPct = totalStudents > 0 ? (totalAssessments / totalStudents) * 100 : 0;

    // Per-type totals
    const byType: Record<string, number> = {};
    const byTypeCritical: Record<string, number> = {};
    rows.forEach(r => {
      byType[r.assessment_type]         = (byType[r.assessment_type] || 0) + r.count;
      if (CRITICAL_LEVELS.has(r.severity_level))
        byTypeCritical[r.assessment_type] = (byTypeCritical[r.assessment_type] || 0) + r.count;
    });

    const result: Insight[] = [];

    // ── CRITICAL: Suicide risk ─────────────────────────────────────────────
    if (suicideRiskCount > 0) {
      result.push({
        level: "critical",
        icon: "🚨",
        title: `พบนักเรียนเสี่ยงฆ่าตัวตาย ${suicideRiskCount} คน`,
        body: "ข้อ 9 ของ PHQ-A ระบุความคิดทำร้ายตัวเอง ต้องดำเนินการประเมินซ้ำและส่งต่อทันที",
        action: "ดูรายการแจ้งเตือน →",
      });
    }

    // ── WARNING: High critical rate ────────────────────────────────────────
    if (criticalPct > 10) {
      result.push({
        level: "warning",
        icon: "⚠️",
        title: `${criticalPct.toFixed(1)}% ของผลประเมินอยู่ในระดับวิกฤต`,
        body: `มีนักเรียน ${criticalCount.toLocaleString()} คน จากผล ${totalCount.toLocaleString()} รายการ ที่ระดับ severe / clinical — ควรจัดทีมแนะแนวดูแลเฉพาะกลุ่มนี้`,
        action: "ส่งออกรายชื่อเพื่อติดตาม →",
      });
    } else if (atRiskPct > 20) {
      result.push({
        level: "warning",
        icon: "📊",
        title: `${atRiskPct.toFixed(1)}% ของผลประเมินอยู่ในระดับเฝ้าระวัง`,
        body: `นักเรียน ${atRiskCount.toLocaleString()} คน มีระดับ moderate ขึ้นไป ควรติดตามซ้ำในรอบหน้า`,
      });
    }

    // ── INFO: Trend direction ──────────────────────────────────────────────
    if (trendData && trendData.length >= 2) {
      const st5Trend  = getTrendDirection(trendData.map(d => d.st5_avg));
      const phqaTrend = getTrendDirection(trendData.map(d => d.phqa_avg));
      const cdiTrend  = getTrendDirection(trendData.map(d => d.cdi_avg));

      const upTypes: string[] = [];
      const downTypes: string[] = [];
      if (st5Trend  === "up")   upTypes.push("ST-5 (ความเครียด)");
      if (phqaTrend === "up")   upTypes.push("PHQ-A (ซึมเศร้า)");
      if (cdiTrend  === "up")   upTypes.push("CDI (ซึมเศร้าเด็ก)");
      if (st5Trend  === "down") downTypes.push("ST-5");
      if (phqaTrend === "down") downTypes.push("PHQ-A");
      if (cdiTrend  === "down") downTypes.push("CDI");

      const lastMonth = trendData[trendData.length - 1].month;

      if (upTypes.length > 0) {
        result.push({
          level: "warning",
          icon: "📈",
          title: `แนวโน้มสูงขึ้นใน ${lastMonth}: ${upTypes.join(", ")}`,
          body: "คะแนนเฉลี่ยแบบประเมินเพิ่มขึ้นจากเดือนก่อน — ควรทบทวนปัจจัยกดดันที่โรงเรียน เช่น ใกล้สอบ ปัญหาครอบครัว ฤดูกาล",
        });
      } else if (downTypes.length >= 2) {
        result.push({
          level: "success",
          icon: "📉",
          title: `แนวโน้มดีขึ้นใน ${lastMonth}: ${downTypes.join(", ")}`,
          body: "คะแนนเฉลี่ยลดลงจากเดือนก่อน — เป็นสัญญาณที่ดี ควรดูแลต่อเนื่องและบันทึกกิจกรรมที่ทำไว้",
        });
      } else if (upTypes.length === 0 && downTypes.length === 0) {
        result.push({
          level: "info",
          icon: "➡️",
          title: `ผลประเมินเสถียรใน ${lastMonth}`,
          body: "แนวโน้มคะแนนไม่เปลี่ยนแปลงอย่างมีนัยสำคัญ — ควรรักษาระดับการดูแลและติดตามต่อเนื่อง",
        });
      }
    }

    // ── INFO: Assessment type with most issues ─────────────────────────────
    const worstType = Object.entries(byTypeCritical).sort(([,a],[,b]) => b - a)[0];
    if (worstType && worstType[1] > 0) {
      const pct = byType[worstType[0]] > 0
        ? ((worstType[1] / byType[worstType[0]]) * 100).toFixed(1)
        : "0";
      const typeLabel: Record<string, string> = { ST5: "ST-5 (ความเครียด)", PHQA: "PHQ-A (ซึมเศร้าวัยรุ่น)", CDI: "CDI (ซึมเศร้าเด็ก)" };
      result.push({
        level: "info",
        icon: "🔍",
        title: `${typeLabel[worstType[0]] || worstType[0]} มีสัดส่วนวิกฤตสูงสุด (${pct}%)`,
        body: `จากผลประเมิน ${(byType[worstType[0]] || 0).toLocaleString()} รายการของแบบนี้ มี ${worstType[1].toLocaleString()} รายการอยู่ในระดับ severe หรือสูงกว่า`,
      });
    }

    // ── INFO: Completion rate ──────────────────────────────────────────────
    if (totalStudents > 0 && completionPct < 60) {
      result.push({
        level: "info",
        icon: "📝",
        title: `อัตราการทำแบบประเมิน ${completionPct.toFixed(0)}% (${totalAssessments.toLocaleString()} / ${totalStudents.toLocaleString()} คน)`,
        body: "ยังไม่ครอบคลุมนักเรียนทั้งหมด — ควรประสานงานกับครูประจำชั้นและโรงเรียนที่ยังไม่ได้ส่งข้อมูล",
        action: "ดูรายงานโรงเรียน →",
      });
    }

    // ── SUCCESS: Mostly normal ─────────────────────────────────────────────
    if (normalPct >= 70 && criticalPct < 5 && suicideRiskCount === 0) {
      result.push({
        level: "success",
        icon: "✅",
        title: `นักเรียน ${normalPct.toFixed(0)}% มีผลอยู่ในระดับปกติ`,
        body: "ภาพรวมสุขภาพจิตของนักเรียนอยู่ในระดับดี — ควรรักษากิจกรรมส่งเสริมสุขภาพจิตและติดตามกลุ่มเฝ้าระวัง",
      });
    }

    return result;
  }, [summaryData, trendData]);

  if (!summaryData?.data?.length) return null;
  if (insights.length === 0) return null;

  const LEVEL_STYLE = {
    critical: "border-error/40 bg-error/5",
    warning:  "border-warning/40 bg-warning/5",
    info:     "border-info/40 bg-info/5",
    success:  "border-success/40 bg-success/5",
  };
  const TITLE_STYLE = {
    critical: "text-error",
    warning:  "text-warning-content",
    info:     "text-info-content",
    success:  "text-success",
  };

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body pb-4">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="card-title text-base">💡 สรุปจากกราฟ &amp; คำแนะนำ</h2>
          <span className="badge badge-sm badge-ghost">{insights.length} ข้อสังเกต</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.map((ins, i) => (
            <div
              key={i}
              className={`rounded-xl border px-4 py-3 ${LEVEL_STYLE[ins.level]}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5 shrink-0">{ins.icon}</span>
                <div className="min-w-0">
                  <p className={`font-semibold text-sm leading-tight mb-1 ${TITLE_STYLE[ins.level]}`}>
                    {ins.title}
                  </p>
                  <p className="text-xs text-base-content/70 leading-relaxed">{ins.body}</p>
                  {ins.action && (
                    <p className="text-xs font-medium mt-1.5 text-primary cursor-pointer hover:underline">
                      {ins.action}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-base-200 text-xs text-base-content/50">
          <span className="flex items-center gap-1"><span className="text-error">🚨</span> ต้องดำเนินการทันที</span>
          <span className="flex items-center gap-1"><span className="text-warning">⚠️</span> ควรเฝ้าระวัง</span>
          <span className="flex items-center gap-1"><span className="text-info">🔍</span> ข้อมูลเพื่อทราบ</span>
          <span className="flex items-center gap-1"><span className="text-success">✅</span> สัญญาณดี</span>
          <span className="ml-auto italic">คำนวณจากข้อมูลจริงในระบบ ณ ขณะนี้</span>
        </div>
      </div>
    </div>
  );
}
