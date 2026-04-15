"use client";

import useSWR from "swr";
import { api } from "@/lib/api";

const fetcher = (url: string) => api.get(url).then(r => r.data);

interface StatsCardsProps {
  queryString?: string;
}

export default function StatsCards({ queryString = "" }: StatsCardsProps) {
  const summaryUrl = `/reports/summary${queryString ? `?${queryString}` : ""}`;
  const { data: summaryData } = useSWR(summaryUrl, fetcher);

  // นับนักเรียนทั้งหมดในระบบ (ไม่ขึ้นกับว่าทำแบบประเมินหรือเปล่า)
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

  const rows: any[]   = summaryData.data ?? [];
  const totalRegistered: number = studentCountData?.total ?? 0;

  // count assessments and risk from summary rows
  const totalAssessments = rows.reduce((s: number, d: any) => s + d.count, 0);
  const criticalCount    = rows
    .filter((d: any) => ["severe","very_severe","clinical"].includes(d.severity_level))
    .reduce((s: number, d: any) => s + d.count, 0);
  const suicideRiskCount = rows.reduce((s: number, d: any) => s + (d.suicide_risk_count || 0), 0);

  // นักเรียนที่ทำแบบประเมินอย่างน้อย 1 ครั้ง (unique)
  const assessedStudents = rows.reduce((acc: Set<string>, d: any) => {
    // summary doesn't give per-student IDs, use total_students per group as approximation
    // actual distinct is from DB; show total assessments / registered as %
    return acc;
  }, new Set()).size;

  const completionPct = totalRegistered > 0
    ? ((totalAssessments / totalRegistered) * 100).toFixed(0)
    : null;
  const criticalPct = totalAssessments > 0
    ? ((criticalCount / totalAssessments) * 100).toFixed(1)
    : null;

  const cards = [
    {
      label:    "นักเรียนในระบบ",
      value:    totalRegistered.toLocaleString(),
      icon:     "👥",
      color:    "text-primary",
      sub:      completionPct !== null
                  ? `ทำแบบประเมินแล้ว ${completionPct}%`
                  : "ยังไม่มีผลประเมิน",
      subColor: Number(completionPct) >= 70
                  ? "text-success"
                  : totalAssessments > 0 ? "text-warning" : "text-base-content/40",
      hint:     "จำนวนนักเรียนทั้งหมดที่ลงทะเบียนในระบบ LEMCS",
    },
    {
      label:    "แบบประเมินทั้งหมด",
      value:    totalAssessments.toLocaleString(),
      icon:     "📋",
      color:    "text-info",
      sub:      totalRegistered > 0
                  ? `เฉลี่ย ${(totalAssessments / totalRegistered).toFixed(2)} ครั้ง/คน`
                  : null,
      subColor: "text-base-content/50",
      hint:     "ผลรวมครั้งที่ทำแบบประเมิน ST-5, PHQ-A, CDI ทั้งหมด",
    },
    {
      label:    "ต้องดูแลพิเศษ",
      value:    criticalCount.toLocaleString(),
      icon:     "⚠️",
      color:    criticalCount > 0 ? "text-warning" : "text-base-content/40",
      sub:      criticalPct !== null
                  ? `คิดเป็น ${criticalPct}% ของผลประเมิน`
                  : totalAssessments === 0 ? "ยังไม่มีผลประเมิน" : null,
      subColor: Number(criticalPct) > 10 ? "text-error" : "text-base-content/50",
      hint:     "ผลประเมินระดับ severe, very_severe, clinical — ต้องส่งต่อครูแนะแนว",
    },
    {
      label:    "เสี่ยงฆ่าตัวตาย",
      value:    suicideRiskCount.toLocaleString(),
      icon:     suicideRiskCount > 0 ? "🚨" : "✅",
      color:    suicideRiskCount > 0 ? "text-error" : "text-success",
      sub:      suicideRiskCount > 0
                  ? "ต้องดำเนินการทันที"
                  : totalAssessments === 0 ? "ยังไม่มีผลประเมิน" : "ไม่พบความเสี่ยงในตอนนี้",
      subColor: suicideRiskCount > 0
                  ? "text-error font-semibold animate-pulse"
                  : totalAssessments === 0 ? "text-base-content/40" : "text-success",
      hint:     "นักเรียนที่ตอบข้อ 9 ของ PHQ-A ระบุความคิดทำร้ายตัวเอง",
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
            <p className="text-xs text-base-content/40 mt-2 pt-2 border-t border-base-200 leading-relaxed">
              {card.hint}
            </p>
          </div>
        </div>
      ))}
    </>
  );
}
