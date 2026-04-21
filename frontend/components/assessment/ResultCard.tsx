import React from 'react';

const SEVERITY_STYLES: Record<string, { bg: string; text: string; badge: string; emoji: string }> = {
  normal:      { bg: "bg-success/10", text: "text-success", badge: "badge-success", emoji: "😊" },
  none:        { bg: "bg-success/10", text: "text-success", badge: "badge-success", emoji: "😊" },
  mild:        { bg: "bg-info/10",    text: "text-info",    badge: "badge-info",    emoji: "🙂" },
  moderate:    { bg: "bg-warning/10", text: "text-warning", badge: "badge-warning", emoji: "😟" },
  severe:      { bg: "bg-error/10",   text: "text-error",   badge: "badge-error",   emoji: "😔" },
  very_severe: { bg: "bg-error/10",   text: "text-error",   badge: "badge-error",   emoji: "😢" },
  clinical:    { bg: "bg-error/10",   text: "text-error",   badge: "badge-error",   emoji: "😔" },
};

// Labels แยกตามประเภทแบบประเมิน ตามฉบับมาตรฐาน
const SEVERITY_LABELS: Record<string, Record<string, string>> = {
  ST5: {
    normal: "ปกติ", mild: "เครียดเล็กน้อย",
    moderate: "เครียดปานกลาง", severe: "เครียดสูง",
  },
  PHQA: {
    none: "ไม่มีภาวะซึมเศร้า", mild: "เล็กน้อย",
    moderate: "ปานกลาง", severe: "มาก", very_severe: "รุนแรง",
  },
  CDI: {
    normal: "ปกติ", clinical: "ควรได้รับการดูแล",
  },
};

function getSeverityLabel(assessmentType: string, severityLevel: string): string {
  return SEVERITY_LABELS[assessmentType.toUpperCase()]?.[severityLevel] ?? severityLevel;
}

const ASSESSMENT_NAMES: Record<string, string> = {
  ST5: "แบบประเมินความเครียด (ST-5)",
  PHQA: "แบบประเมินภาวะซึมเศร้าเด็กวัยรุ่น (PHQ-A)",
  CDI: "แบบประเมินภาวะซึมเศร้าในเด็ก (CDI)",
};

interface ResultCardProps {
  result: {
    assessment_type: string;
    score: number;
    severity_level: string;
    suicide_risk: boolean;
    recommendations: string[];
    created_at: string;
  };
}

export default function ResultCard({ result }: ResultCardProps) {
  const style = SEVERITY_STYLES[result.severity_level] || SEVERITY_STYLES.moderate;

  return (
    <div className={`card shadow-xl border-t-4 border-t-current ${style.text} ${style.bg} w-full max-w-lg mx-auto`}>
      <div className="card-body items-center text-center gap-6 p-8">
        <span className="text-6xl drop-shadow-sm">{style.emoji}</span>

        <h2 className="text-xl font-bold text-base-content leading-snug">
          ผล{ASSESSMENT_NAMES[result.assessment_type.toUpperCase()] || "การประเมิน"}
        </h2>

        <div className="flex flex-col items-center gap-2">
          <div className="flex items-end gap-2">
            <span className={`text-6xl font-black ${style.text}`}>{result.score}</span>
            <span className="text-base-content/60 font-medium mb-1">คะแนน</span>
          </div>
        </div>

        <span className={`badge ${style.badge} badge-lg py-4 px-6 text-lg font-bold shadow-sm`}>
          {getSeverityLabel(result.assessment_type, result.severity_level)}
        </span>

        {/* ข้อแนะนำ */}
        {result.recommendations && result.recommendations.length > 0 && (
          <div className="text-left w-full mt-6 bg-base-100 rounded-xl p-5 shadow-sm border border-base-200 text-base-content">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              คำแนะนำเบื้องต้น:
            </h3>
            <ul className="space-y-3">
              {result.recommendations.map((rec, i) => (
                <li key={i} className="text-base-content/90 flex items-start gap-3 text-base">
                  <span className="text-primary mt-1">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
