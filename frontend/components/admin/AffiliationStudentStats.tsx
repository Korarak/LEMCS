"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";
import Chart from "chart.js/auto";
import { api } from "@/lib/api";

interface AffiliationStat {
  id: number;
  name: string;
  student_count: number;
}

const fetcher = (url: string) => api.get(url).then(r => r.data);

export default function AffiliationStudentStats() {
  const { data } = useSWR<AffiliationStat[]>("/admin/affiliations/stats", fetcher, {
    refreshInterval: 300000,
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  useEffect(() => {
    if (!data || !canvasRef.current) return;

    const active = data.filter(a => a.student_count > 0);
    if (active.length === 0) return;

    // ย่อชื่อสังกัด: ดึงตัวย่อในวงเล็บถ้ามี ไม่งั้นใช้ชื่อเดิม
    const labels = active.map(a => {
      const m = a.name.match(/\(([^)]+)\)$/);
      return m ? m[1] : a.name;
    });
    const counts = active.map(a => a.student_count);

    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "จำนวนนักศึกษา",
          data: counts,
          backgroundColor: "rgba(99,102,241,0.75)",
          borderColor:     "rgba(99,102,241,1)",
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => active[items[0].dataIndex].name,
              label: (item) => ` ${(item.raw as number).toLocaleString()} คน`,
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              font: { size: 11 },
              callback: (v) => Number(v).toLocaleString(),
            },
            grid: { color: "rgba(0,0,0,0.05)" },
          },
          y: {
            ticks: { font: { size: 12 } },
            grid: { display: false },
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); };
  }, [data]);

  if (!data) return null;
  const active = data.filter(a => a.student_count > 0);
  if (active.length === 0) return null;

  const total = active.reduce((s, a) => s + a.student_count, 0);
  const h = Math.max(active.length * 36 + 24, 120);

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body py-4 px-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">👥 นักศึกษาในระบบ แยกตามสังกัด</h3>
          <span className="text-xs text-base-content/50">
            รวม <strong className="text-base-content">{total.toLocaleString()}</strong> คน
          </span>
        </div>
        <div style={{ height: h }}>
          <canvas ref={canvasRef} />
        </div>
      </div>
    </div>
  );
}
