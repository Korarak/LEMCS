"use client";

import useSWR from "swr";
import { api } from "@/lib/api";
import Link from "next/link";

const fetcher = (url: string) => api.get(url).then(r => r.data);

const LEVEL_EMOJI = { warning: "⚠️", urgent: "🔴", critical: "🚨" };

export default function RecentAlerts() {
  const { data: alerts, isLoading } = useSWR("/alerts?limit=5", fetcher, {
    refreshInterval: 30000,
  });

  if (isLoading) return <div className="skeleton h-24 w-full" />;
  if (!alerts || alerts.length === 0) {
    return <p className="text-sm text-base-content/40 text-center py-4">ไม่มีการแจ้งเตือน</p>;
  }

  return (
    <div className="divide-y divide-base-200">
      {alerts.map((alert: any) => (
        <Link key={alert.id} href={`/admin/alerts`}>
          <div className="flex items-center gap-3 py-2 hover:bg-base-200/50 px-2 rounded transition">
            <span className="text-lg">
              {LEVEL_EMOJI[alert.alert_level as keyof typeof LEVEL_EMOJI] || "📢"}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {alert.school_name} • {alert.grade}
              </p>
              <p className="text-xs text-base-content/50">
                {alert.assessment_type} • คะแนน {alert.score}
              </p>
            </div>
            <span className={`badge badge-sm ${
              alert.status === "new" ? "badge-error" : "badge-ghost"
            }`}>
              {alert.status === "new" ? "ใหม่" : alert.status}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
