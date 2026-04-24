"use client";

import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

const DATASETS_CONFIG = [
  { key: "st5_avg",  label: "ST-5 (ความเครียด)",      color: "#F59E0B", fill: "rgba(245,158,11,0.08)"  },
  { key: "phqa_avg", label: "PHQ-A (ซึมเศร้าวัยรุ่น)", color: "#EF4444", fill: "rgba(239,68,68,0.08)"   },
  { key: "cdi_avg",  label: "CDI (ซึมเศร้าเด็ก)",     color: "#8B5CF6", fill: "rgba(139,92,246,0.08)"  },
];

export default function TrendChart({ data, canvasId = "trend-chart" }: { data: any[]; canvasId?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !data?.length) return;
    if (chartRef.current) chartRef.current.destroy();

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels: data.map(d => d.month),
        datasets: DATASETS_CONFIG.map(cfg => ({
          label: cfg.label,
          data: data.map(d => d[cfg.key] ?? null),
          borderColor: cfg.color,
          backgroundColor: cfg.fill,
          fill: true,
          tension: 0.45,
          borderWidth: 2.5,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointBackgroundColor: cfg.color,
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          spanGaps: true,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: { mode: "index", intersect: false },
        scales: {
          x: {
            grid: { color: "rgba(0,0,0,0.04)" },
            ticks: { font: { size: 11 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(0,0,0,0.04)" },
            ticks: {
              font: { size: 11 },
              callback: (v) => `${v} คะแนน`,
            },
            title: { display: true, text: "คะแนนเฉลี่ย", font: { size: 11 } },
          },
        },
        plugins: {
          legend: {
            position: "bottom",
            labels: { font: { size: 11 }, boxWidth: 14, padding: 12, usePointStyle: true },
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const val = ctx.parsed.y;
                return val !== null ? ` ${ctx.dataset.label}: ${val.toFixed(2)} คะแนน` : " ไม่มีข้อมูล";
              },
            },
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); };
  }, [data]);

  // Compute simple trend note
  const lastTwo = data.slice(-2);
  let trendNote = "";
  if (lastTwo.length === 2) {
    const phqaDiff = (lastTwo[1].phqa_avg ?? 0) - (lastTwo[0].phqa_avg ?? 0);
    const st5Diff  = (lastTwo[1].st5_avg  ?? 0) - (lastTwo[0].st5_avg  ?? 0);
    const parts: string[] = [];
    if (Math.abs(phqaDiff) >= 0.1) parts.push(`PHQ-A ${phqaDiff > 0 ? "▲" : "▼"} ${Math.abs(phqaDiff).toFixed(2)}`);
    if (Math.abs(st5Diff)  >= 0.1) parts.push(`ST-5 ${st5Diff  > 0 ? "▲" : "▼"} ${Math.abs(st5Diff).toFixed(2)}`);
    if (parts.length) trendNote = `เดือนล่าสุด: ${parts.join(" | ")}`;
  }

  return (
    <div>
      <canvas ref={canvasRef} id={canvasId} />

      {/* Reading guide */}
      <div className="mt-3 flex items-start gap-2 px-2 py-2 rounded-lg bg-base-200/60 text-xs text-base-content/70">
        <span className="shrink-0">📖</span>
        <p>
          <strong>อ่านกราฟ:</strong> แกน Y คือคะแนนเฉลี่ย — ยิ่งสูงยิ่งมีความเสี่ยงมากขึ้น
          เส้นที่มีแนวโน้มขึ้นต่อเนื่องหลายเดือนควรได้รับความสนใจ
          {trendNote && <> | <span className="font-medium">{trendNote}</span></>}
        </p>
      </div>
    </div>
  );
}
