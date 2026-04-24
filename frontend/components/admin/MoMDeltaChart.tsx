"use client";

import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

interface TrendRow {
  month: string;
  st5_avg: number | null;
  phqa_avg: number | null;
  cdi_avg: number | null;
}

interface MoMDeltaChartProps {
  trendData: TrendRow[];
  canvasId?: string;
}

const TYPE_CONFIG = [
  { key: "st5_avg",  label: "ST-5",  fullLabel: "ST-5 (ความเครียด)",       maxScore: 15  },
  { key: "phqa_avg", label: "PHQ-A", fullLabel: "PHQ-A (ซึมเศร้าวัยรุ่น)", maxScore: 27  },
  { key: "cdi_avg",  label: "CDI",   fullLabel: "CDI (ซึมเศร้าเด็ก)",      maxScore: 54  },
] as const;

export default function MoMDeltaChart({ trendData, canvasId = "mom-delta-chart" }: MoMDeltaChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  const hasEnough = trendData && trendData.length >= 2;

  useEffect(() => {
    if (!canvasRef.current || !hasEnough) return;
    if (chartRef.current) chartRef.current.destroy();

    const last = trendData[trendData.length - 1];
    const prev = trendData[trendData.length - 2];

    const deltas = TYPE_CONFIG.map(cfg => {
      const a = last[cfg.key as keyof TrendRow] as number | null;
      const b = prev[cfg.key as keyof TrendRow] as number | null;
      return (a !== null && b !== null) ? +(a - b).toFixed(2) : null;
    });

    const colors = deltas.map(d =>
      d === null ? "rgba(156,163,175,0.5)"
      : d > 0    ? "rgba(239,68,68,0.75)"   // สูงขึ้น = แย่ลง = แดง
      :            "rgba(16,185,129,0.75)"   // ลดลง = ดีขึ้น = เขียว
    );

    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels: TYPE_CONFIG.map(c => c.label),
        datasets: [{
          label: "เปลี่ยนแปลงจากเดือนก่อน",
          data: deltas,
          backgroundColor: colors,
          borderColor: colors.map(c => c.replace("0.75", "1")),
          borderWidth: 1.5,
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: ctx => TYPE_CONFIG[ctx[0].dataIndex].fullLabel,
              label: ctx => {
                const v = ctx.parsed.y;
                if (v === null) return " ไม่มีข้อมูล";
                const sign = v > 0 ? "▲ +" : v < 0 ? "▼ " : "→ ";
                const msg  = v > 0 ? "(แย่ลง)" : v < 0 ? "(ดีขึ้น)" : "(คงที่)";
                return ` ${sign}${v.toFixed(2)} คะแนน  ${msg}`;
              },
              afterLabel: ctx => {
                const v = ctx.parsed.y;
                const cfg = TYPE_CONFIG[ctx.dataIndex];
                if (v === null) return "";
                const pctChange = ((v / cfg.maxScore) * 100).toFixed(1);
                return ` (${Math.abs(+pctChange)}% ของคะแนนสูงสุด ${cfg.maxScore})`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 12 } },
          },
          y: {
            grid: { color: "rgba(0,0,0,0.05)" },
            ticks: {
              font: { size: 11 },
              callback: v => `${Number(v) > 0 ? "+" : ""}${v}`,
            },
            title: { display: true, text: "Δ คะแนนเฉลี่ย (เดือนนี้ − เดือนก่อน)", font: { size: 10 } },
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); };
  }, [trendData, hasEnough]);

  if (!hasEnough) {
    return (
      <p className="text-center text-base-content/40 py-10">
        ต้องการข้อมูลอย่างน้อย 2 เดือนสำหรับการเปรียบเทียบ
      </p>
    );
  }

  const last  = trendData[trendData.length - 1];
  const prev  = trendData[trendData.length - 2];
  const improving = TYPE_CONFIG.filter(c => {
    const a = last[c.key as keyof TrendRow] as number | null;
    const b = prev[c.key as keyof TrendRow] as number | null;
    return a !== null && b !== null && a < b;
  }).map(c => c.label);
  const worsening = TYPE_CONFIG.filter(c => {
    const a = last[c.key as keyof TrendRow] as number | null;
    const b = prev[c.key as keyof TrendRow] as number | null;
    return a !== null && b !== null && a > b;
  }).map(c => c.label);

  return (
    <div>
      <canvas ref={canvasRef} id={canvasId} />

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        {improving.length > 0 && (
          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-lg bg-success/8 text-success">
            <span className="shrink-0 font-bold">▼ ดีขึ้น:</span>
            <span>{improving.join(", ")}</span>
          </div>
        )}
        {worsening.length > 0 && (
          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-lg bg-error/8 text-error">
            <span className="shrink-0 font-bold">▲ แย่ลง:</span>
            <span>{worsening.join(", ")}</span>
          </div>
        )}
      </div>

      <p className="text-[10px] text-base-content/40 mt-2">
        เปรียบเทียบ {prev.month} → {last.month} · แดง = คะแนนสูงขึ้น (ความเสี่ยงเพิ่ม) · เขียว = ลดลง (ดีขึ้น)
      </p>
    </div>
  );
}
