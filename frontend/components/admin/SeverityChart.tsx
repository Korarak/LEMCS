"use client";

import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

const SEVERITY_COLORS: Record<string, string> = {
  normal:     "#10B981",
  none:       "#10B981",
  mild:       "#06B6D4",
  moderate:   "#F59E0B",
  severe:     "#EF4444",
  very_severe:"#7C3AED",
  clinical:   "#EF4444",
};

const SEVERITY_LABEL: Record<string, string> = {
  normal: "ปกติ", none: "ไม่มีอาการ", mild: "ระดับน้อย",
  moderate: "ระดับปานกลาง", severe: "ระดับสูง",
  very_severe: "รุนแรงมาก", clinical: "ต้องดูแล (CDI)",
};

interface SeverityChartProps {
  data: { severity_level: string; count: number }[];
}

export default function SeverityChart({ data }: SeverityChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  const total    = data.reduce((s, d) => s + d.count, 0);
  const atRisk   = data.filter(d => ["moderate","severe","very_severe","clinical"].includes(d.severity_level))
                       .reduce((s, d) => s + d.count, 0);
  const atRiskPct = total > 0 ? ((atRisk / total) * 100).toFixed(1) : "0";

  useEffect(() => {
    if (!canvasRef.current || !data.length) return;
    if (chartRef.current) chartRef.current.destroy();

    chartRef.current = new Chart(canvasRef.current, {
      type: "doughnut",
      data: {
        labels: data.map(d => SEVERITY_LABEL[d.severity_level] || d.severity_level),
        datasets: [{
          data: data.map(d => d.count),
          backgroundColor: data.map(d => SEVERITY_COLORS[d.severity_level] || "#9CA3AF"),
          borderWidth: 2,
          borderColor: "#ffffff",
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        cutout: "65%",
        plugins: {
          legend: {
            position: "bottom",
            labels: { font: { size: 11 }, boxWidth: 12, padding: 10 },
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const val = ctx.parsed as number;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : "0";
                return ` ${val.toLocaleString()} ครั้ง (${pct}%)`;
              },
            },
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); };
  }, [data]);

  return (
    <div>
      {/* Center label overlay */}
      <div className="relative">
        <canvas ref={canvasRef} />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: "-16px" }}>
          <p className="text-2xl font-bold tabular-nums leading-none">{total.toLocaleString()}</p>
          <p className="text-xs text-base-content/50 mt-0.5">รายการทั้งหมด</p>
        </div>
      </div>

      {/* Interpretation */}
      <div className="mt-3 flex items-start gap-2 px-2 py-2 rounded-lg bg-base-200/60 text-xs text-base-content/70">
        <span className="shrink-0">📖</span>
        <p>
          <strong>อ่านกราฟ:</strong> แต่ละสีแสดงสัดส่วนระดับความเสี่ยง —{" "}
          เขียว = ปกติ, ฟ้า = น้อย, เหลือง = ปานกลาง, แดง/ม่วง = สูง/วิกฤต{" "}
          {atRisk > 0 && (
            <span>
              | ขณะนี้ <strong className="text-warning">{atRisk.toLocaleString()} ครั้ง ({atRiskPct}%)</strong> อยู่ในระดับเฝ้าระวังขึ้นไป
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
