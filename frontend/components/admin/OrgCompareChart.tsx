"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import Chart from "chart.js/auto";
import { api } from "@/lib/api";

const fetcher = (url: string) => api.get(url).then(r => r.data);

const LEVELS = ["normal", "none", "mild", "moderate", "severe", "very_severe", "clinical"] as const;
type Level = typeof LEVELS[number];

const LEVEL_LABEL: Record<Level, string> = {
  normal:     "ปกติ",
  none:       "ไม่มีอาการ",
  mild:       "น้อย",
  moderate:   "ปานกลาง",
  severe:     "สูง",
  very_severe:"รุนแรงมาก",
  clinical:   "ต้องดูแล",
};

const LEVEL_COLOR: Record<Level, string> = {
  normal:     "#10B981",
  none:       "#10B981",
  mild:       "#06B6D4",
  moderate:   "#F59E0B",
  severe:     "#EF4444",
  very_severe:"#7C3AED",
  clinical:   "#DC2626",
};

type GroupBy = "affiliation" | "district" | "school";

interface OrgCompareChartProps {
  queryString: string;
  defaultGroupBy?: GroupBy;
  canvasId?: string;
}

const GROUP_LABELS: Record<GroupBy, string> = {
  affiliation: "สังกัด",
  district:    "เขตพื้นที่",
  school:      "โรงเรียน",
};

export default function OrgCompareChart({
  queryString,
  defaultGroupBy = "affiliation",
  canvasId = "org-compare-chart",
}: OrgCompareChartProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>(defaultGroupBy);

  const url = `/reports/compare?group_by=${groupBy}${queryString ? `&${queryString}` : ""}`;
  const { data, isLoading } = useSWR(url, fetcher, { refreshInterval: 60000 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !data || data.length === 0) return;
    if (chartRef.current) chartRef.current.destroy();

    const rows: any[] = data;

    // Detect which levels actually appear
    const activeLevels = LEVELS.filter(lvl =>
      rows.some((r: any) => (r[`${lvl}_pct`] ?? 0) > 0)
    );

    const labels = rows.map((r: any) => r.name);

    const datasets = activeLevels.map(lvl => ({
      label: LEVEL_LABEL[lvl],
      data: rows.map((r: any) => r[`${lvl}_pct`] ?? 0),
      backgroundColor: LEVEL_COLOR[lvl],
      borderWidth: 0,
      borderRadius: 2,
      borderSkipped: false,
    }));

    const barHeight = Math.max(32, Math.min(52, 400 / Math.max(rows.length, 1)));
    const totalHeight = Math.max(160, rows.length * (barHeight + 10) + 60);
    if (canvasRef.current.parentElement) {
      canvasRef.current.parentElement.style.height = `${totalHeight}px`;
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        scales: {
          x: {
            stacked: true,
            min: 0,
            max: 100,
            grid: { color: "rgba(0,0,0,0.05)" },
            ticks: {
              font: { size: 11 },
              callback: (v) => `${v}%`,
            },
            title: { display: true, text: "สัดส่วน (%)", font: { size: 11 } },
          },
          y: {
            stacked: true,
            grid: { display: false },
            ticks: { font: { size: 11 } },
          },
        },
        plugins: {
          legend: {
            position: "bottom",
            labels: { font: { size: 11 }, boxWidth: 12, padding: 10 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const row = rows[ctx.dataIndex];
                const lvl = activeLevels[ctx.datasetIndex];
                const pct  = ctx.parsed.x as number;
                const cnt  = row[`${lvl}_cnt`] ?? 0;
                return ` ${LEVEL_LABEL[lvl]}: ${pct}% (${cnt.toLocaleString()} ครั้ง)`;
              },
              afterBody: (items) => {
                const row = rows[items[0].dataIndex];
                return [`รวม: ${row.total.toLocaleString()} ครั้ง`];
              },
            },
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); };
  }, [data]);

  // sync defaultGroupBy changes from parent (filter changes)
  useEffect(() => {
    setGroupBy(defaultGroupBy);
  }, [defaultGroupBy]);

  return (
    <div className="space-y-3">
      {/* Toggle group_by */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-base-content/50">จัดกลุ่มโดย:</span>
        <div className="join">
          {(["affiliation", "district", "school"] as GroupBy[]).map(g => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={`join-item btn btn-xs ${groupBy === g ? "btn-primary" : "btn-ghost border border-base-300"}`}
            >
              {GROUP_LABELS[g]}
            </button>
          ))}
        </div>
        {data && (
          <span className="text-xs text-base-content/40 ml-auto">
            {data.length} {GROUP_LABELS[groupBy]}
          </span>
        )}
      </div>

      {/* Chart */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <span className="loading loading-spinner loading-md text-primary" />
        </div>
      ) : !data || data.length === 0 ? (
        <p className="text-center text-base-content/40 py-10">ไม่มีข้อมูล</p>
      ) : (
        <div className="relative" style={{ height: 200 }}>
          <canvas ref={canvasRef} id={canvasId} />
        </div>
      )}

      {/* Risk summary table (top 5 highest risk) */}
      {data && data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="table table-xs w-full">
            <thead>
              <tr className="text-xs text-base-content/50">
                <th>{GROUP_LABELS[groupBy]}</th>
                <th className="text-right">รวม</th>
                <th className="text-right text-warning">ปานกลาง+</th>
                <th className="text-right text-error">สูง+</th>
                <th className="text-right">ความเสี่ยงรวม%</th>
              </tr>
            </thead>
            <tbody>
              {[...data]
                .sort((a: any, b: any) => {
                  const riskA = (a.moderate_pct ?? 0) + (a.severe_pct ?? 0) + (a.very_severe_pct ?? 0) + (a.clinical_pct ?? 0);
                  const riskB = (b.moderate_pct ?? 0) + (b.severe_pct ?? 0) + (b.very_severe_pct ?? 0) + (b.clinical_pct ?? 0);
                  return riskB - riskA;
                })
                .slice(0, 8)
                .map((row: any) => {
                  const modPlus = (row.moderate_pct ?? 0) + (row.severe_pct ?? 0) + (row.very_severe_pct ?? 0) + (row.clinical_pct ?? 0);
                  const sevPlus = (row.severe_pct ?? 0) + (row.very_severe_pct ?? 0) + (row.clinical_pct ?? 0);
                  return (
                    <tr key={row.name} className="hover">
                      <td className="max-w-[200px] truncate font-medium">{row.name}</td>
                      <td className="text-right text-base-content/60">{row.total.toLocaleString()}</td>
                      <td className="text-right text-warning font-medium">{modPlus.toFixed(1)}%</td>
                      <td className="text-right text-error font-medium">{sevPlus.toFixed(1)}%</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-16 bg-base-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(modPlus, 100)}%`,
                                backgroundColor: modPlus > 30 ? "#EF4444" : modPlus > 15 ? "#F59E0B" : "#10B981",
                              }}
                            />
                          </div>
                          <span className="text-xs w-10 text-right">{modPlus.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          {data.length > 8 && (
            <p className="text-xs text-base-content/40 text-center mt-1">
              แสดง 8 อันดับความเสี่ยงสูงสุด จาก {data.length} {GROUP_LABELS[groupBy]}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
