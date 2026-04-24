"use client";

import useSWR from "swr";
import { api } from "@/lib/api";
import Link from "next/link";

const fetcher = (url: string) => api.get(url).then(r => r.data);

const STATUS_CONFIG = [
  { key: "new",          label: "ใหม่",              icon: "🔴", color: "text-error",       bg: "bg-error/8",       border: "border-error/20"   },
  { key: "in_progress",  label: "กำลังดำเนินการ",    icon: "🔄", color: "text-warning",     bg: "bg-warning/8",     border: "border-warning/20" },
  { key: "acknowledged", label: "รับทราบแล้ว",       icon: "👁️", color: "text-info",        bg: "bg-info/8",        border: "border-info/20"    },
  { key: "referred",     label: "ส่งต่อแล้ว",        icon: "📤", color: "text-purple-500",  bg: "bg-purple-500/8",  border: "border-purple-500/20" },
  { key: "closed",       label: "ปิดเคส",            icon: "✅", color: "text-success",     bg: "bg-success/8",     border: "border-success/20" },
];

export default function AlertStatusSummary() {
  const { data: alerts, isLoading } = useSWR("/alerts?limit=200", fetcher, {
    refreshInterval: 30000,
  });

  const counts: Record<string, number> = {};
  if (Array.isArray(alerts)) {
    alerts.forEach((a: any) => {
      counts[a.status] = (counts[a.status] || 0) + 1;
    });
  }

  const totalNew    = counts["new"] || 0;
  const totalOpen   = STATUS_CONFIG.slice(0, 3).reduce((s, c) => s + (counts[c.key] || 0), 0);

  return (
    <div className="card bg-base-100 shadow h-full">
      <div className="card-body py-4 px-4">

        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">สถานะการแจ้งเตือน</h3>
          {totalNew > 0 && (
            <span className="badge badge-error badge-sm animate-pulse">{totalNew} ใหม่!</span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {STATUS_CONFIG.map(s => <div key={s.key} className="skeleton h-10 w-full rounded-lg" />)}
          </div>
        ) : (
          <div className="space-y-1.5">
            {STATUS_CONFIG.map(s => {
              const count = counts[s.key] || 0;
              return (
                <Link key={s.key} href={`/admin/alerts?status=${s.key}`}>
                  <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${s.bg} ${s.border} hover:opacity-80 transition-opacity cursor-pointer`}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{s.icon}</span>
                      <span className={`text-xs font-medium ${s.color}`}>{s.label}</span>
                    </div>
                    <span className={`text-xl font-bold tabular-nums leading-none ${count === 0 ? "text-base-content/25" : s.color}`}>
                      {count}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {!isLoading && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-base-200 text-xs">
            <span className="text-base-content/50">รวมที่ยังเปิดอยู่</span>
            <span className={`font-bold tabular-nums ${totalOpen > 0 ? "text-warning" : "text-success"}`}>
              {totalOpen} รายการ
            </span>
          </div>
        )}

      </div>
    </div>
  );
}
