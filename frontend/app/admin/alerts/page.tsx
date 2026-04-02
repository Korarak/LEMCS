"use client";

import { useState } from "react";
import { useAlerts } from "@/hooks/useAlerts";
import AlertCard from "@/components/alerts/AlertCard";

const STATUS_OPTIONS = [
  { value: "", label: "ทุกสถานะ" },
  { value: "new", label: "ใหม่" },
  { value: "acknowledged", label: "รับทราบแล้ว" },
  { value: "in_progress", label: "กำลังดำเนินการ" },
  { value: "referred", label: "ส่งต่อแล้ว" },
  { value: "closed", label: "ปิดเคส" },
];

const LEVEL_OPTIONS = [
  { value: "", label: "ทุกระดับ" },
  { value: "warning",  label: "⚠️ เฝ้าระวัง" },
  { value: "urgent",   label: "🔴 เร่งด่วน" },
  { value: "critical", label: "🚨 วิกฤต" },
];

export default function AlertsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const { alerts, isLoading, mutate } = useAlerts({ status: statusFilter, level: levelFilter });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            การแจ้งเตือน
            {!isLoading && alerts?.filter((a: any) => a.status === "new").length > 0 && (
              <span className="badge badge-error py-3 px-3 shadow-sm drop-shadow text-white border-none font-medium ml-2 animate-bounce">
                {alerts.filter((a: any) => a.status === "new").length} ใหม่
              </span>
            )}
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            รายการนักเรียนที่เข้าข่ายมีความเสี่ยงสูง
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body py-3 px-4 flex-row flex-wrap gap-3 items-center">
          <span className="text-sm font-medium text-base-content/70">ตัวกรอง:</span>
          <select
            className="select select-bordered select-sm min-w-32 bg-base-50"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            className="select select-bordered select-sm min-w-32 bg-base-50"
            value={levelFilter}
            onChange={e => setLevelFilter(e.target.value)}
          >
            {LEVEL_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Alert List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="skeleton h-32 w-full rounded-2xl" />)}
        </div>
      ) : alerts?.length === 0 ? (
        <div className="text-center py-20 bg-base-100 rounded-box border border-base-200 border-dashed text-base-content/40">
          <p className="text-5xl mb-4">✅</p>
          <h3 className="text-lg font-bold text-base-content/70">ไม่มีการแจ้งเตือนในขณะนี้</h3>
          <p className="text-sm mt-1">ทั้งหมดจัดการเรียบร้อย หรือไม่พบรายการที่ตรงกับตัวกรอง</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts?.map((alert: any) => (
            <AlertCard key={alert.id} alert={alert} onUpdate={mutate} />
          ))}
        </div>
      )}
    </div>
  );
}
