"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";

const fetcher = (url: string) => api.get(url).then(r => r.data);

export interface DashboardFilters {
  school_id: string;
  assessment_type: string;
  grade: string;
  gender: string;
  date_from: string;
  date_to: string;
}

interface FilterBarProps {
  onFilterChange: (filters: DashboardFilters) => void;
}

export default function FilterBar({ onFilterChange }: FilterBarProps) {
  const { data: schools } = useSWR("/admin/schools", fetcher);

  const [filters, setFilters] = useState<DashboardFilters>({
    school_id: "",
    assessment_type: "",
    grade: "",
    gender: "",
    date_from: "",
    date_to: "",
  });

  const handleChange = useCallback((key: keyof DashboardFilters, value: string) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      onFilterChange(next);
      return next;
    });
  }, [onFilterChange]);

  const handleReset = () => {
    const empty: DashboardFilters = {
      school_id: "", assessment_type: "", grade: "", gender: "", date_from: "", date_to: "",
    };
    setFilters(empty);
    onFilterChange(empty);
  };

  const hasFilter = Object.values(filters).some(v => v !== "");

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body py-3">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {/* โรงเรียน */}
          <select
            className="select select-bordered select-sm w-full"
            value={filters.school_id}
            onChange={e => handleChange("school_id", e.target.value)}
          >
            <option value="">ทุกโรงเรียน</option>
            {schools?.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* ประเภทแบบประเมิน */}
          <select
            className="select select-bordered select-sm w-full"
            value={filters.assessment_type}
            onChange={e => handleChange("assessment_type", e.target.value)}
          >
            <option value="">ทุกแบบประเมิน</option>
            <option value="ST5">ST-5 (ความเครียด)</option>
            <option value="PHQA">PHQ-A (ซึมเศร้า)</option>
            <option value="CDI">CDI (ซึมเศร้าเด็ก)</option>
          </select>

          {/* ระดับชั้น */}
          <select
            className="select select-bordered select-sm w-full"
            value={filters.grade}
            onChange={e => handleChange("grade", e.target.value)}
          >
            <option value="">ทุกระดับชั้น</option>
            {["ป.1","ป.2","ป.3","ป.4","ป.5","ป.6","ม.1","ม.2","ม.3","ม.4","ม.5","ม.6","ปวช.1","ปวช.2","ปวช.3","ปวส.1","ปวส.2"].map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          {/* เพศ */}
          <select
            className="select select-bordered select-sm w-full"
            value={filters.gender}
            onChange={e => handleChange("gender", e.target.value)}
          >
            <option value="">ทุกเพศ</option>
            <option value="ชาย">ชาย</option>
            <option value="หญิง">หญิง</option>
          </select>

          {/* วันที่เริ่ม */}
          <input
            type="date"
            className="input input-bordered input-sm w-full"
            value={filters.date_from}
            onChange={e => handleChange("date_from", e.target.value)}
          />

          {/* วันที่สิ้นสุด + ปุ่มล้าง */}
          <div className="flex gap-1">
            <input
              type="date"
              className="input input-bordered input-sm flex-1 min-w-0"
              value={filters.date_to}
              onChange={e => handleChange("date_to", e.target.value)}
            />
            {hasFilter && (
              <button
                className="btn btn-ghost btn-sm px-2 text-base-content/50 hover:text-error"
                onClick={handleReset}
                title="ล้างตัวกรอง"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
