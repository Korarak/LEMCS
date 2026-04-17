"use client";

import useSWR from "swr";
import { api } from "@/lib/api";

const fetcher = (url: string) => api.get(url).then(r => r.data);

interface TrendRow { month: string; st5_avg: number | null; phqa_avg: number | null; cdi_avg: number | null; }

interface StatsCardsProps {
  queryString?: string;
  trendData?: TrendRow[];
}

function TrendChip({ delta, lowerIsBetter = true }: { delta: number | null; lowerIsBetter?: boolean }) {
  if (delta === null || Math.abs(delta) < 0.05) return null;
  const isGood = lowerIsBetter ? delta < 0 : delta > 0;
  const sign = delta > 0 ? "▲" : "▼";
  const cls = isGood ? "text-success bg-success/10" : "text-error bg-error/10";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cls}`}>
      {sign} คะแนนเฉลี่ย {Math.abs(delta).toFixed(1)}
      <span className="font-normal opacity-70 ml-0.5">จากเดือนก่อน</span>
    </span>
  );
}

function computeAvgScoreDelta(trendData?: TrendRow[]): number | null {
  if (!trendData || trendData.length < 2) return null;
  const last = trendData[trendData.length - 1];
  const prev = trendData[trendData.length - 2];
  const keys: (keyof TrendRow)[] = ["st5_avg", "phqa_avg", "cdi_avg"];
  let sum = 0; let n = 0;
  keys.forEach(k => {
    const a = last[k] as number | null;
    const b = prev[k] as number | null;
    if (a !== null && b !== null) { sum += (a - b); n++; }
  });
  return n > 0 ? sum / n : null;
}

export default function StatsCards({ queryString = "", trendData }: StatsCardsProps) {
  const summaryUrl = `/reports/summary${queryString ? `?${queryString}` : ""}`;
  const { data: summaryData } = useSWR(summaryUrl, fetcher);

  const studentCountUrl = `/admin/students?limit=1&offset=0${queryString ? `&${queryString}` : ""}`;
  const { data: studentCountData } = useSWR(studentCountUrl, fetcher);

  const isLoading = !summaryData || !studentCountData;
  if (isLoading) {
    return (
      <>
        {[1,2,3,4].map(i => <div key={i} className="skeleton h-28 rounded-xl" />)}
      </>
    );
  }

  const rows: any[]         = summaryData.data ?? [];
  const totalRegistered     = studentCountData?.total ?? 0;
  const totalAssessments    = rows.reduce((s: number, d: any) => s + d.count, 0);
  const criticalCount       = rows.filter((d: any) => ["severe","very_severe","clinical"].includes(d.severity_level)).reduce((s: number, d: any) => s + d.count, 0);
  const suicideRiskCount    = rows.reduce((s: number, d: any) => s + (d.suicide_risk_count || 0), 0);
  const atRiskCount         = rows.filter((d: any) => ["moderate","severe","very_severe","clinical"].includes(d.severity_level)).reduce((s: number, d: any) => s + d.count, 0);

  const completionPct   = totalRegistered > 0 ? (totalAssessments / totalRegistered) * 100 : null;
  const criticalPct     = totalAssessments > 0 ? (criticalCount / totalAssessments) * 100 : null;
  const atRiskPct       = totalAssessments > 0 ? (atRiskCount / totalAssessments) * 100 : null;
  const avgScoreDelta   = computeAvgScoreDelta(trendData);

  const cards = [
    {
      label:    "นักเรียนในระบบ",
      value:    totalRegistered.toLocaleString(),
      icon:     "👥",
      color:    "text-primary",
      bar:      completionPct !== null ? { pct: completionPct, label: `ทำแบบประเมินแล้ว ${completionPct.toFixed(0)}%`, color: completionPct >= 70 ? "bg-success" : "bg-warning" } : null,
      hint:     "นักเรียนลงทะเบียนทั้งหมดในระบบ LEMCS",
      trend:    null,
    },
    {
      label:    "แบบประเมินทั้งหมด",
      value:    totalAssessments.toLocaleString(),
      icon:     "📋",
      color:    "text-info",
      bar:      null,
      hint:     totalRegistered > 0 ? `เฉลี่ย ${(totalAssessments / totalRegistered).toFixed(2)} ครั้ง/คน` : "จำนวนครั้งที่ทำแบบประเมินทั้งหมด",
      trend:    null,
    },
    {
      label:    "ต้องดูแลพิเศษ",
      value:    criticalCount.toLocaleString(),
      icon:     criticalCount > 0 ? "⚠️" : "🟢",
      color:    criticalCount > 0 ? "text-warning" : "text-base-content/40",
      bar:      atRiskPct !== null ? { pct: atRiskPct, label: `เฝ้าระวังขึ้นไป ${atRiskPct.toFixed(1)}%`, color: atRiskPct > 20 ? "bg-warning" : "bg-info" } : null,
      hint:     criticalPct !== null ? `${criticalPct.toFixed(1)}% ของผลประเมินทั้งหมด` : "ระดับ severe, very_severe, clinical",
      trend:    avgScoreDelta,
    },
    {
      label:    "เสี่ยงฆ่าตัวตาย",
      value:    suicideRiskCount.toLocaleString(),
      icon:     suicideRiskCount > 0 ? "🚨" : "✅",
      color:    suicideRiskCount > 0 ? "text-error" : "text-success",
      bar:      null,
      hint:     suicideRiskCount > 0 ? "ต้องดำเนินการทันที — PHQ-A ข้อ 9 ≥ 1" : totalAssessments === 0 ? "ยังไม่มีผลประเมิน" : "ไม่พบความเสี่ยงในขณะนี้",
      trend:    null,
    },
  ];

  return (
    <>
      {cards.map((card) => (
        <div key={card.label} className="card bg-base-100 shadow hover:shadow-md transition-shadow">
          <div className="card-body py-4 px-4 gap-0">

            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5 shrink-0">{card.icon}</span>
              <div className="min-w-0 flex-1">
                <p className={`text-2xl font-bold tabular-nums leading-none ${card.color}`}>{card.value}</p>
                <p className="text-xs text-base-content/60 mt-0.5 leading-tight">{card.label}</p>
              </div>
            </div>

            {card.trend !== null && (
              <div className="mt-2 pl-9">
                <TrendChip delta={card.trend} lowerIsBetter />
              </div>
            )}

            {card.bar && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-base-content/50">{card.bar.label}</span>
                </div>
                <div className="w-full bg-base-200 rounded-full h-1.5">
                  <div
                    className={`${card.bar.color} h-1.5 rounded-full transition-all duration-700`}
                    style={{ width: `${Math.min(card.bar.pct, 100)}%` }}
                  />
                </div>
              </div>
            )}

            <p className="text-[10px] text-base-content/40 mt-2.5 pt-2 border-t border-base-200 leading-relaxed">
              {card.hint}
            </p>

          </div>
        </div>
      ))}
    </>
  );
}
