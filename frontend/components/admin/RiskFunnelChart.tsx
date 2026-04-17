"use client";

interface FunnelStage {
  label: string;
  sublabel: string;
  count: number;
  color: string;
  textColor: string;
}

interface RiskFunnelChartProps {
  totalRegistered: number;
  summaryData: { data: any[] } | undefined;
}

export default function RiskFunnelChart({ totalRegistered, summaryData }: RiskFunnelChartProps) {
  const rows: any[] = summaryData?.data ?? [];
  if (!rows.length || totalRegistered === 0) {
    return <p className="text-center text-base-content/40 py-10">ไม่มีข้อมูล</p>;
  }

  const totalAssessed = rows.reduce((s: number, r: any) => s + r.count, 0);
  const atRisk        = rows.filter((r: any) => ["moderate","severe","very_severe","clinical"].includes(r.severity_level)).reduce((s: number, r: any) => s + r.count, 0);
  const critical      = rows.filter((r: any) => ["severe","very_severe","clinical"].includes(r.severity_level)).reduce((s: number, r: any) => s + r.count, 0);
  const suicide       = rows.reduce((s: number, r: any) => s + (r.suicide_risk_count || 0), 0);

  const stages: FunnelStage[] = [
    {
      label:     "นักเรียนในระบบ",
      sublabel:  "ลงทะเบียนทั้งหมด",
      count:     totalRegistered,
      color:     "bg-primary/15 border-primary/30",
      textColor: "text-primary",
    },
    {
      label:     "ทำแบบประเมินแล้ว",
      sublabel:  `${totalRegistered > 0 ? ((totalAssessed / totalRegistered) * 100).toFixed(1) : 0}% ของนักเรียนในระบบ`,
      count:     totalAssessed,
      color:     "bg-info/15 border-info/30",
      textColor: "text-info",
    },
    {
      label:     "เฝ้าระวัง (moderate+)",
      sublabel:  `${totalAssessed > 0 ? ((atRisk / totalAssessed) * 100).toFixed(1) : 0}% ของที่ทำแบบประเมิน`,
      count:     atRisk,
      color:     "bg-warning/15 border-warning/30",
      textColor: "text-warning",
    },
    {
      label:     "วิกฤต (severe+)",
      sublabel:  `${totalAssessed > 0 ? ((critical / totalAssessed) * 100).toFixed(1) : 0}% ต้องส่งต่อผู้เชี่ยวชาญ`,
      count:     critical,
      color:     "bg-error/15 border-error/30",
      textColor: "text-error",
    },
  ];

  const maxCount = totalRegistered;

  return (
    <div className="space-y-2">
      {stages.map((stage, i) => {
        const pct = maxCount > 0 ? Math.max((stage.count / maxCount) * 100, 2) : 0;
        const dropPct = i > 0 && stages[i - 1].count > 0
          ? (((stages[i - 1].count - stage.count) / stages[i - 1].count) * 100).toFixed(0)
          : null;

        return (
          <div key={stage.label} className="relative">
            {/* Drop indicator between stages */}
            {dropPct !== null && Number(dropPct) > 0 && (
              <div className="flex items-center gap-1 pl-2 mb-1 text-[10px] text-base-content/40">
                <span>↓</span>
                <span>ออกจากระบบการดูแล {dropPct}%</span>
              </div>
            )}

            <div className={`relative flex items-center gap-3 border rounded-xl px-4 py-3 ${stage.color}`}
              style={{ width: `${pct}%`, minWidth: "55%" }}>

              {/* Stage number */}
              <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${stage.color} ${stage.textColor}`}>
                {i + 1}
              </span>

              {/* Labels */}
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-semibold ${stage.textColor}`}>{stage.label}</span>
                <span className="text-[10px] text-base-content/50 ml-2 hidden sm:inline">{stage.sublabel}</span>
              </div>

              {/* Count */}
              <span className={`text-base font-bold tabular-nums shrink-0 ${stage.textColor}`}>
                {stage.count.toLocaleString()}
              </span>
            </div>
          </div>
        );
      })}

      {/* Suicide risk footnote */}
      {suicide > 0 && (
        <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-error/5 border border-error/20 text-xs text-error">
          <span className="shrink-0">🚨</span>
          <span>ในจำนวนวิกฤตพบ <strong>{suicide}</strong> รายที่มีสัญญาณเสี่ยงฆ่าตัวตาย — ต้องดำเนินการทันที</span>
        </div>
      )}

      {/* Legend */}
      <p className="text-[10px] text-base-content/40 pt-1">
        แต่ละแถบกว้างตามสัดส่วนจำนวน · % คือสัดส่วนเทียบกับขั้นก่อนหน้า
      </p>
    </div>
  );
}
