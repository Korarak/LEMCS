"use client";

import { useRouter } from "next/navigation";

interface PendingAssessmentsProps {
  assessments: any[];
}

const ASSESSMENT_META: Record<string, { icon: string; gradient: string }> = {
  ST5:  { icon: "🧠", gradient: "linear-gradient(135deg, #4f46e5, #7c3aed)" },
  PHQA: { icon: "💙", gradient: "linear-gradient(135deg, #0ea5e9, #6366f1)" },
  CDI:  { icon: "🌱", gradient: "linear-gradient(135deg, #10b981, #059669)" },
};

export default function PendingAssessments({ assessments }: PendingAssessmentsProps) {
  const router = useRouter();

  if (assessments.length === 0) {
    return (
      <div className="fade-in-up" style={{
        marginTop: 12, padding: "14px 16px", borderRadius: 12,
        background: "#f0fdf4", border: "1px solid #86efac",
        display: "flex", alignItems: "center", gap: 10,
        color: "#15803d", fontSize: "0.88rem",
      }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        ยอดเยี่ยม! คุณทำแบบประเมินในภาคเรียนนี้ครบทั้งหมดแล้ว
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
      {assessments.map((a) => {
        const meta = ASSESSMENT_META[a.type?.toUpperCase()] ?? { icon: "📋", gradient: "linear-gradient(135deg, #4f46e5, #7c3aed)" };
        return (
          <div key={a.type} className="fade-in-up" style={{
            background: "white", borderRadius: 16,
            boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 6px 28px rgba(79,70,229,.08)",
            border: "1px solid rgba(79,70,229,.08)",
            padding: "18px 20px",
            display: "flex", alignItems: "center", gap: 16,
          }}>
            {/* Icon */}
            <div style={{
              width: 48, height: 48, borderRadius: 14, flexShrink: 0,
              background: meta.gradient,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.5rem",
              boxShadow: "0 4px 12px rgba(79,70,229,.2)",
            }}>
              {meta.icon}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#0f172a" }}>{a.name_th}</div>
              <div style={{ display: "flex", gap: 12, marginTop: 5, fontSize: "0.78rem", color: "#64748b" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {a.question_count} ข้อ
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  ~ {a.estimated_minutes} นาที
                </span>
              </div>
            </div>

            {/* Button */}
            <button
              onClick={() => router.push(`/assess/${a.type.toLowerCase()}`)}
              style={{
                flexShrink: 0,
                padding: "9px 18px", border: "none", borderRadius: 10,
                background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                color: "white", fontWeight: 700, fontSize: "0.82rem",
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: "0 4px 14px rgba(79,70,229,.32)",
                transition: "opacity .15s, transform .15s",
                display: "flex", alignItems: "center", gap: 6,
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = "0.9"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              เริ่มเลย
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" stroke="currentColor" d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
