"use client";

import useSWR from "swr";
import { api } from "@/lib/api";

const fetcher = (url: string) => api.get(url).then(r => r.data);

interface StatsCardsProps {
  queryString?: string;
}

export default function StatsCards({ queryString = "" }: StatsCardsProps) {
  const url = `/reports/summary${queryString ? `?${queryString}` : ""}`;
  const { data } = useSWR(url, fetcher);

  if (!data) {
    return (
      <>
        {[1,2,3,4].map(i => <div key={i} className="skeleton h-28 rounded-xl" />)}
      </>
    );
  }

  const rows = data.data as any[];
  const totalStudents    = rows.reduce((s: number, d: any) => s + (d.total_students || 0), 0);
  const totalAssessments = rows.reduce((s: number, d: any) => s + (d.total_assessments || 0), 0);
  const totalCount       = rows.reduce((s: number, d: any) => s + d.count, 0);
  const criticalCount    = rows.filter((d: any) => ["severe","very_severe","clinical"].includes(d.severity_level))
                               .reduce((s: number, d: any) => s + d.count, 0);
  const suicideRiskCount = rows.reduce((s: number, d: any) => s + (d.suicide_risk_count || 0), 0);

  const completionPct = totalStudents > 0 ? ((totalAssessments / totalStudents) * 100).toFixed(0) : null;
  const criticalPct   = totalCount    > 0 ? ((criticalCount    / totalCount)    * 100).toFixed(1) : null;

  const cards = [
    {
      label:   "นักเรียนในระบบ",
      value:   totalStudents.toLocaleString(),
      icon:    "👥",
      color:   "text-primary",
      sub:     completionPct !== null ? `ทำแบบประเมินแล้ว ${completionPct}%` : null,
      subColor: Number(completionPct) >= 70 ? "text-success" : "text-warning",
      hint:    "จำนวนนักเรียนทั้งหมดที่ลงทะเบียนในระบบ LEMCS",
    },
    {
      label:   "แบบประเมินทั้งหมด",
      value:   totalAssessments.toLocaleString(),
      icon:    "📋",
      color:   "text-info",
      sub:     totalStudents > 0 ? `เฉลี่ย ${(totalAssessments / totalStudents).toFixed(1)} ครั้ง/คน` : null,
      subColor:"text-base-content/50",
      hint:    "ผลรวมครั้งที่ทำแบบประเมิน ST-5, PHQ-A, CDI ทั้งหมด",
    },
    {
      label:   "ต้องดูแลพิเศษ",
      value:   criticalCount.toLocaleString(),
      icon:    "⚠️",
      color:   criticalCount > 0 ? "text-warning" : "text-base-content/40",
      sub:     criticalPct !== null ? `คิดเป็น ${criticalPct}% ของทั้งหมด` : null,
      subColor: Number(criticalPct) > 10 ? "text-error" : "text-base-content/50",
      hint:    "ผลประเมินระดับ severe, very_severe, clinical — ต้องส่งต่อครูแนะแนว",
    },
    {
      label:   "เสี่ยงฆ่าตัวตาย",
      value:   suicideRiskCount.toLocaleString(),
      icon:    suicideRiskCount > 0 ? "🚨" : "✅",
      color:   suicideRiskCount > 0 ? "text-error" : "text-success",
      sub:     suicideRiskCount > 0 ? "ต้องดำเนินการทันที" : "ไม่พบความเสี่ยงในตอนนี้",
      subColor: suicideRiskCount > 0 ? "text-error font-semibold animate-pulse" : "text-success",
      hint:    "นักเรียนที่ตอบข้อ 9 ของ PHQ-A ระบุความคิดทำร้ายตัวเอง",
    },
  ];

  return (
    <>
      {cards.map((card) => (
        <div key={card.label} className="card bg-base-100 shadow hover:shadow-md transition-shadow group">
          <div className="card-body py-4 px-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">{card.icon}</span>
              <div className="min-w-0 flex-1">
                <p className={`text-2xl font-bold tabular-nums leading-none ${card.color}`}>{card.value}</p>
                <p className="text-xs text-base-content/60 mt-0.5 leading-tight">{card.label}</p>
                {card.sub && (
                  <p className={`text-xs mt-1.5 leading-tight ${card.subColor}`}>{card.sub}</p>
                )}
              </div>
            </div>
            {/* Tooltip on hover */}
            <p className="text-xs text-base-content/40 mt-2 pt-2 border-t border-base-200 leading-relaxed hidden group-hover:block">
              {card.hint}
            </p>
          </div>
        </div>
      ))}
    </>
  );
}
