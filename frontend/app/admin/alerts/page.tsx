"use client";

import { useState, useCallback } from "react";
import { useAlerts, type AlertFilters } from "@/hooks/useAlerts";
import AlertCard from "@/components/alerts/AlertCard";
import FilterBar, { type DashboardFilters } from "@/components/admin/FilterBar";

const EMPTY_ALERTS: AlertFilters = {
  status: "", level: "",
  affiliation_id: "", district_id: "", school_id: "",
  assessment_type: "", grade: "", gender: "", date_from: "", date_to: "",
};

export default function AlertsPage() {
  const [alertFilters, setAlertFilters] = useState<AlertFilters>(EMPTY_ALERTS);

  const handleFilterChange = useCallback((df: DashboardFilters) => {
    setAlertFilters(prev => ({
      ...prev,
      affiliation_id:  df.affiliation_id,
      district_id:     df.district_id,
      school_id:       df.school_id,
      assessment_type: df.assessment_type,
      grade:           df.grade,
      gender:          df.gender,
      date_from:       df.date_from,
      date_to:         df.date_to,
    }));
  }, []);

  const { alerts, isLoading, mutate } = useAlerts(alertFilters);

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

      {/* Filters — ใช้ FilterBar เดียวกับ Dashboard + แถวสถานะ/ระดับ */}
      <FilterBar onFilterChange={handleFilterChange}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {/* สถานะ */}
          <select
            className="select select-bordered select-sm w-full"
            value={alertFilters.status}
            onChange={e => setAlertFilters(prev => ({ ...prev, status: e.target.value }))}
          >
            <option value="">ทุกสถานะ</option>
            <option value="new">ใหม่</option>
            <option value="acknowledged">รับทราบแล้ว</option>
            <option value="in_progress">กำลังดำเนินการ</option>
            <option value="referred">ส่งต่อแล้ว</option>
            <option value="closed">ปิดเคส</option>
          </select>

          {/* ระดับความรุนแรง */}
          <select
            className="select select-bordered select-sm w-full"
            value={alertFilters.level}
            onChange={e => setAlertFilters(prev => ({ ...prev, level: e.target.value }))}
          >
            <option value="">ทุกระดับ</option>
            <option value="warning">⚠️ เฝ้าระวัง</option>
            <option value="urgent">🔴 เร่งด่วน</option>
            <option value="critical">🚨 วิกฤต</option>
          </select>
        </div>
      </FilterBar>

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
