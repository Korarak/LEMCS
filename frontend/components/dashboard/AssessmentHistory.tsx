"use client";

import { useRouter } from "next/navigation";

interface AssessmentHistoryProps {
  history: any[];
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; border: string; strip: string }> = {
  normal:     { color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0", strip: "#10b981" },
  none:       { color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0", strip: "#10b981" },
  mild:       { color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd", strip: "#0ea5e9" },
  moderate:   { color: "#92400e", bg: "#fffbeb", border: "#fde68a", strip: "#f59e0b" },
  severe:     { color: "#9f1239", bg: "#fff1f2", border: "#fecdd3", strip: "#ef4444" },
  very_severe:{ color: "#9f1239", bg: "#fff1f2", border: "#fecdd3", strip: "#ef4444" },
  clinical:   { color: "#9f1239", bg: "#fff1f2", border: "#fecdd3", strip: "#ef4444" },
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

const ASSESSMENT_ICONS: Record<string, string> = {
  ST5: "🧠", PHQA: "💙", CDI: "🌱",
};

export default function AssessmentHistory({ history }: AssessmentHistoryProps) {
  const router = useRouter();

  if (history.length === 0) {
    return (
      <div style={{
        marginTop: 12, padding: "32px 20px", borderRadius: 16, textAlign: "center",
        background: "white", border: "1px solid rgba(79,70,229,.08)",
        boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 6px 28px rgba(79,70,229,.06)",
      }}>
        <div style={{ fontSize: "2rem", marginBottom: 8 }}>📋</div>
        <p style={{ color: "#94a3b8", fontSize: "0.88rem" }}>ยังไม่มีประวัติการทำแบบทดสอบ</p>
      </div>
    );
  }

  const formatThaiDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("th-TH", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    }).format(date);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
      {history.map((record) => {
        const cfg = SEVERITY_CONFIG[record.severity_level] ?? {
          color: "#64748b", bg: "#f8fafc", border: "#e2e8f0", strip: "#94a3b8",
        };
        const type = record.assessment_type?.toUpperCase();
        const name = ASSESSMENT_NAMES[type] ?? record.assessment_type;
        const icon = ASSESSMENT_ICONS[type] ?? "📋";
        const severityLabel = getSeverityLabel(type, record.severity_level);

        return (
          <div
            key={record.id}
            onClick={() => router.push(`/result/${record.id}`)}
            style={{
              background: "white", borderRadius: 14,
              boxShadow: "0 1px 3px rgba(0,0,0,.05), 0 4px 16px rgba(79,70,229,.06)",
              border: "1px solid rgba(79,70,229,.08)",
              display: "flex", alignItems: "center", cursor: "pointer",
              overflow: "hidden",
              transition: "box-shadow .18s, transform .18s, border-color .18s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = "0 4px 20px rgba(79,70,229,.14)";
              e.currentTarget.style.borderColor = "rgba(79,70,229,.22)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,.05), 0 4px 16px rgba(79,70,229,.06)";
              e.currentTarget.style.borderColor = "rgba(79,70,229,.08)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            {/* Left color strip */}
            <div style={{ width: 4, alignSelf: "stretch", background: cfg.strip, flexShrink: 0 }} />

            <div style={{ padding: "12px 14px", flex: 1, display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              {/* Icon */}
              <span style={{ fontSize: "1.25rem", flexShrink: 0 }}>{icon}</span>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#0f172a" }}>
                  แบบประเมิน{name}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 2 }}>
                  ทำเมื่อ {formatThaiDate(record.created_at)}
                </div>
              </div>

              {/* Right: severity + score */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{
                  display: "inline-block", padding: "3px 10px", borderRadius: 20,
                  background: cfg.bg, border: `1px solid ${cfg.border}`,
                  color: cfg.color, fontWeight: 700, fontSize: "0.75rem", marginBottom: 3,
                }}>
                  {severityLabel}
                </div>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b" }}>
                  {record.score} คะแนน
                </div>
              </div>

              {/* Arrow */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, color: "#cbd5e1" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" stroke="currentColor" d="M9 5l7 7-7 7"/>
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}
