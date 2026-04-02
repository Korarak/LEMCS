"use client";

import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

interface SummaryRow {
  severity_level: string;
  assessment_type: string;
  count: number;
}

const SEVERITY_ORDER = ["normal", "none", "mild", "moderate", "severe", "very_severe", "clinical"];
const SEVERITY_LABEL: Record<string, string> = {
  normal: "ปกติ", none: "ไม่มีอาการ", mild: "น้อย",
  moderate: "ปานกลาง", severe: "สูง", very_severe: "รุนแรง", clinical: "ต้องดูแล",
};
const SEVERITY_COLOR: Record<string, string> = {
  normal:     "#10B981",
  none:       "#10B981",
  mild:       "#06B6D4",
  moderate:   "#F59E0B",
  severe:     "#EF4444",
  very_severe:"#7C3AED",
  clinical:   "#DC2626",
};

const TYPE_LABEL: Record<string, string> = {
  ST5:  "ST-5\nความเครียด",
  PHQA: "PHQ-A\nซึมเศร้าวัยรุ่น",
  CDI:  "CDI\nซึมเศร้าเด็ก",
};

export default function AssessmentTypeChart({ data }: { data: SummaryRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !data.length) return;
    if (chartRef.current) chartRef.current.destroy();

    // Collect types present in data
    const typeSet: Record<string, boolean> = {};
    data.forEach(d => { typeSet[d.assessment_type] = true; });
    const types = Object.keys(typeSet).sort();

    // Collect severities present
    const severitySet: Record<string, boolean> = {};
    data.forEach(d => { severitySet[d.severity_level] = true; });
    const severities = SEVERITY_ORDER.filter(s => severitySet[s]);

    // Build pivot: type → severity → count
    const pivot: Record<string, Record<string, number>> = {};
    types.forEach(t => { pivot[t] = {}; });
    data.forEach(r => {
      if (!pivot[r.assessment_type]) pivot[r.assessment_type] = {};
      pivot[r.assessment_type][r.severity_level] = r.count;
    });

    const datasets = severities.map(sev => ({
      label: SEVERITY_LABEL[sev] || sev,
      data: types.map(t => pivot[t]?.[sev] || 0),
      backgroundColor: SEVERITY_COLOR[sev] || "#9CA3AF",
      borderRadius: 4,
      borderSkipped: false,
    }));

    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels: types.map(t => TYPE_LABEL[t] || t),
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        scales: {
          x: {
            stacked: true,
            grid: { color: "rgba(0,0,0,0.05)" },
            ticks: { font: { size: 11 } },
            title: { display: true, text: "จำนวนครั้งที่ทำแบบประเมิน", font: { size: 11 } },
          },
          y: {
            stacked: true,
            grid: { display: false },
            ticks: { font: { size: 12 } },
          },
        },
        plugins: {
          legend: {
            position: "bottom",
            labels: { font: { size: 11 }, boxWidth: 12, padding: 12 },
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
                const val = ctx.parsed.x as number;
                return ` ${ctx.dataset.label}: ${val.toLocaleString()} ครั้ง`;
              },
            },
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); };
  }, [data]);

  return (
    <div className="relative" style={{ height: 200 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
