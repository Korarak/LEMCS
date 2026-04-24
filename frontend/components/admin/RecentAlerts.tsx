"use client";

import useSWR from "swr";
import { api } from "@/lib/api";
import Link from "next/link";

const fetcher = (url: string) => api.get(url).then(r => r.data);

const LEVEL_CONFIG: Record<string, { icon: string; badge: string; label: string }> = {
  warning:  { icon: "⚠️", badge: "badge-warning",  label: "เฝ้าระวัง" },
  urgent:   { icon: "🔴", badge: "badge-error",    label: "เร่งด่วน"  },
  critical: { icon: "🚨", badge: "badge-error",    label: "วิกฤต"    },
};

const STATUS_LABEL: Record<string, string> = {
  new:          "ใหม่",
  acknowledged: "รับทราบ",
  in_progress:  "กำลังดำเนินการ",
  referred:     "ส่งต่อแล้ว",
  closed:       "ปิดเคส",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "เมื่อสักครู่";
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชั่วโมงที่แล้ว`;
  return `${Math.floor(h / 24)} วันที่แล้ว`;
}

interface RecentAlertsProps {
  limit?: number;
}

export default function RecentAlerts({ limit = 5 }: RecentAlertsProps) {
  const { data: alerts, isLoading } = useSWR(`/alerts?limit=${limit}`, fetcher, {
    refreshInterval: 30000,
  });

  if (isLoading) return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-14 w-full rounded-lg" />)}
    </div>
  );

  if (!alerts || alerts.length === 0) {
    return (
      <div className="text-center py-8 text-base-content/40">
        <p className="text-2xl mb-1">✅</p>
        <p className="text-sm">ไม่มีการแจ้งเตือนในขณะนี้</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-base-200 -mx-1">
      {alerts.map((alert: any) => {
        const lvl = LEVEL_CONFIG[alert.alert_level] ?? { icon: "📢", badge: "badge-ghost", label: alert.alert_level };
        const isNew = alert.status === "new";
        return (
          <Link key={alert.id} href="/admin/alerts">
            <div className={`flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-base-200/60 transition ${isNew ? "bg-error/3" : ""}`}>
              <span className="text-lg shrink-0">{lvl.icon}</span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-medium truncate">{alert.school_name}</p>
                  {alert.grade && <span className="text-xs text-base-content/40">• {alert.grade}</span>}
                </div>
                <p className="text-xs text-base-content/50 mt-0.5">
                  {alert.assessment_type} &nbsp;|&nbsp; คะแนน <span className="font-semibold text-base-content/70">{alert.score}</span>
                  {alert.created_at && <span className="ml-2 text-base-content/35">{timeAgo(alert.created_at)}</span>}
                </p>
              </div>

              <div className="shrink-0 flex flex-col items-end gap-1">
                <span className={`badge badge-sm ${lvl.badge} text-[10px]`}>{lvl.label}</span>
                <span className={`badge badge-sm text-[10px] ${isNew ? "badge-error" : "badge-ghost"}`}>
                  {STATUS_LABEL[alert.status] ?? alert.status}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
