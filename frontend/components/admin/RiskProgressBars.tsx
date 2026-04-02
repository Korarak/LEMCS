"use client";

interface SummaryRow {
  severity_level: string;
  count: number;
}

const LEVELS = [
  { key: "normal",     label: "ปกติ",           color: "bg-success",   textColor: "text-success",   hint: "ไม่พบปัญหา ดูแลตามปกติ" },
  { key: "none",       label: "ไม่มีอาการ",     color: "bg-success",   textColor: "text-success",   hint: "PHQ-A: ไม่มีอาการซึมเศร้า" },
  { key: "mild",       label: "ระดับน้อย",      color: "bg-info",      textColor: "text-info",      hint: "ควรติดตามและพูดคุย" },
  { key: "moderate",   label: "ระดับปานกลาง",   color: "bg-warning",   textColor: "text-warning",   hint: "ควรส่งพบครูแนะแนว" },
  { key: "severe",     label: "ระดับสูง",       color: "bg-error",     textColor: "text-error",     hint: "ต้องดูแลโดยผู้เชี่ยวชาญ" },
  { key: "very_severe",label: "รุนแรงมาก",      color: "bg-purple-600",textColor: "text-purple-600",hint: "ต้องส่งต่อโดยด่วน" },
  { key: "clinical",   label: "ต้องดูแลพิเศษ",  color: "bg-error",     textColor: "text-error",     hint: "CDI: ต้องรับการรักษา" },
];

export default function RiskProgressBars({ data }: { data: SummaryRow[] }) {
  const total = data.reduce((s, r) => s + r.count, 0);
  if (total === 0) return <p className="text-center text-base-content/40 py-6">ไม่มีข้อมูล</p>;

  // Merge counts per severity key
  const countMap = new Map<string, number>();
  data.forEach(r => countMap.set(r.severity_level, (countMap.get(r.severity_level) || 0) + r.count));

  // Only show levels that have data
  const present = LEVELS.filter(l => (countMap.get(l.key) || 0) > 0);

  return (
    <div className="space-y-3">
      {present.map(lvl => {
        const count = countMap.get(lvl.key) || 0;
        const pct   = (count / total) * 100;
        return (
          <div key={lvl.key}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${lvl.textColor}`}>{lvl.label}</span>
                <span className="text-xs text-base-content/40 hidden sm:inline">— {lvl.hint}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold tabular-nums">{count.toLocaleString()} ครั้ง</span>
                <span className="text-xs text-base-content/50 w-10 text-right tabular-nums">{pct.toFixed(1)}%</span>
              </div>
            </div>
            <div className="w-full bg-base-200 rounded-full h-3 overflow-hidden">
              <div
                className={`${lvl.color} h-3 rounded-full transition-all duration-700`}
                style={{ width: `${Math.max(pct, 0.5)}%` }}
              />
            </div>
          </div>
        );
      })}

      {/* Total footer */}
      <div className="flex justify-between pt-2 border-t border-base-200 text-xs text-base-content/50">
        <span>รวมทั้งหมด</span>
        <span className="font-semibold text-base-content">{total.toLocaleString()} ครั้ง</span>
      </div>
    </div>
  );
}
