"use client";

interface WellnessScoreProps {
  history: any[];
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; border: string; bar: string }> = {
  normal:     { color: "#15803d", bg: "#f0fdf4", border: "#86efac", bar: "#10b981" },
  none:       { color: "#15803d", bg: "#f0fdf4", border: "#86efac", bar: "#10b981" },
  mild:       { color: "#0369a1", bg: "#f0f9ff", border: "#7dd3fc", bar: "#0ea5e9" },
  moderate:   { color: "#92400e", bg: "#fffbeb", border: "#fcd34d", bar: "#f59e0b" },
  severe:     { color: "#9f1239", bg: "#fff1f2", border: "#fecdd3", bar: "#ef4444" },
  very_severe:{ color: "#9f1239", bg: "#fff1f2", border: "#fecdd3", bar: "#ef4444" },
  clinical:   { color: "#9f1239", bg: "#fff1f2", border: "#fecdd3", bar: "#ef4444" },
};

// Labels ตามฉบับมาตรฐานแยกตามประเภทแบบประเมิน
const SEVERITY_LABELS: Record<string, Record<string, string>> = {
  ST5:  { normal: "ปกติ", mild: "เครียดเล็กน้อย", moderate: "เครียดปานกลาง", severe: "เครียดสูง" },
  PHQA: { none: "ไม่มีภาวะซึมเศร้า", mild: "เล็กน้อย", moderate: "ปานกลาง", severe: "มาก", very_severe: "รุนแรง" },
  CDI:  { normal: "ปกติ", clinical: "ควรได้รับการดูแล" },
};

function getSeverityLabel(type: string, level: string): string {
  return SEVERITY_LABELS[type?.toUpperCase()]?.[level] ?? level;
}

const ASSESSMENT_NAMES: Record<string, string> = {
  ST5:  "ความเครียด (ST-5)",
  PHQA: "ซึมเศร้า (PHQ-A)",
  CDI:  "ซึมเศร้า (CDI)",
};

export default function WellnessScore({ history }: WellnessScoreProps) {
  if (!history || history.length === 0) return null;

  const latest = history[0];
  const cfg = SEVERITY_CONFIG[latest.severity_level] ?? {
    color: "#64748b", bg: "#f8fafc", border: "#e2e8f0", bar: "#94a3b8",
  };
  const name = ASSESSMENT_NAMES[latest.assessment_type?.toUpperCase()] ?? latest.assessment_type;
  const severityLabel = getSeverityLabel(latest.assessment_type, latest.severity_level);

  return (
    <div className="fade-in-up" style={{
      marginTop: 12, background: "white", borderRadius: 16,
      boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 6px 28px rgba(79,70,229,.08)",
      border: "1px solid rgba(79,70,229,.08)",
      overflow: "hidden",
    }}>
      {/* Top gradient strip */}
      <div style={{
        height: 4,
        background: "linear-gradient(90deg, #4f46e5, #7c3aed)",
      }} />

      <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "#94a3b8", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>
            ผลประเมินล่าสุด
          </div>
          <div style={{ fontSize: "0.88rem", color: "#64748b", marginBottom: 6 }}>
            แบบประเมิน{name}
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "5px 12px", borderRadius: 20,
            background: cfg.bg, border: `1px solid ${cfg.border}`,
            color: cfg.color, fontWeight: 700, fontSize: "0.85rem",
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%", background: cfg.bar, flexShrink: 0,
            }} />
            ระดับ: {severityLabel}
          </div>
        </div>

        {/* Score ring */}
        <div style={{
          width: 64, height: 64, borderRadius: "50%", flexShrink: 0,
          background: `conic-gradient(${cfg.bar} 0%, rgba(0,0,0,.06) 0%)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 0 0 3px ${cfg.bg}, 0 0 0 5px ${cfg.border}`,
          position: "relative",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            background: "white",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column",
          }}>
            <span style={{ fontSize: "1.3rem", fontWeight: 800, color: cfg.color, lineHeight: 1 }}>
              {latest.score}
            </span>
            <span style={{ fontSize: "0.6rem", color: "#94a3b8", fontWeight: 600 }}>คะแนน</span>
          </div>
        </div>
      </div>
    </div>
  );
}
