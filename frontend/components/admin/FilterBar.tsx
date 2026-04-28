"use client";

import { useState, useCallback, type ReactNode } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import type { SurveyRound } from "@/types/survey-round";

const fetcher = (url: string) => api.get(url).then(r => r.data);

export interface DashboardFilters {
  survey_round_id: string;
  affiliation_id: string;
  district_id: string;
  school_id: string;
  assessment_type: string;
  grade: string;
  gender: string;
  date_from: string;
  date_to: string;
}

interface FilterBarProps {
  onFilterChange: (filters: DashboardFilters) => void;
  isSchoolAdmin?: boolean;
  children?: ReactNode;
}

const EMPTY: DashboardFilters = {
  survey_round_id: "",
  affiliation_id: "", district_id: "", school_id: "",
  assessment_type: "", grade: "", gender: "", date_from: "", date_to: "",
};

export default function FilterBar({ onFilterChange, isSchoolAdmin = false, children }: FilterBarProps) {
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY);

  const { data: rounds } = useSWR<SurveyRound[]>("/survey-rounds", fetcher);
  const activeRounds = rounds?.filter(r => r.status !== "cancelled") ?? [];

  const { data: affiliations } = useSWR("/admin/affiliations", fetcher);

  const districtUrl = filters.affiliation_id
    ? `/admin/districts?affiliation_id=${filters.affiliation_id}`
    : "/admin/districts";
  const { data: districts } = useSWR(districtUrl, fetcher);

  const schoolUrl = filters.district_id
    ? `/admin/schools?district_id=${filters.district_id}`
    : filters.affiliation_id
    ? `/admin/schools?affiliation_id=${filters.affiliation_id}`
    : "/admin/schools";
  const { data: schools } = useSWR(schoolUrl, fetcher);

  const update = useCallback((patch: Partial<DashboardFilters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    onFilterChange(next);
  }, [filters, onFilterChange]);

  const handleReset = () => {
    setFilters(EMPTY);
    onFilterChange(EMPTY);
  };

  const hasFilter = Object.values(filters).some(v => v !== "");

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body py-3 space-y-2">

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-base-content/50 whitespace-nowrap">รอบสำรวจ</span>
          <select
            className="select select-bordered select-sm flex-1"
            value={filters.survey_round_id}
            onChange={e => update({ survey_round_id: e.target.value, date_from: "", date_to: "" })}
          >
            <option value="">ทุกรอบ (ไม่กรอง)</option>
            {activeRounds.map(r => (
              <option key={r.id} value={r.id}>
                {r.label}
                {r.status === "open" ? " 🟢" : " ⬜"}
              </option>
            ))}
          </select>
          {filters.survey_round_id && (
            <span className="text-xs text-base-content/40 whitespace-nowrap">
              (วันที่จะถูกละเว้น)
            </span>
          )}
        </div>

        {/* แถว 1: สังกัด → เขต → โรงเรียน (ซ่อนสำหรับ schooladmin เพราะ scope ถูกล็อกที่ backend แล้ว) */}
        {!isSchoolAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select
              className="select select-bordered select-sm w-full"
              value={filters.affiliation_id}
              onChange={e => update({ affiliation_id: e.target.value, district_id: "", school_id: "" })}
            >
              <option value="">ทุกสังกัด</option>
              {affiliations?.map((a: any) => (
                <option key={a.id} value={a.id}>{a.abbreviation ? `${a.abbreviation} — ${a.name}` : a.name}</option>
              ))}
            </select>

            <select
              className="select select-bordered select-sm w-full"
              value={filters.district_id}
              onChange={e => update({ district_id: e.target.value, school_id: "" })}
            >
              <option value="">ทุกเขตพื้นที่</option>
              {districts?.map((d: any) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            <select
              className="select select-bordered select-sm w-full"
              value={filters.school_id}
              onChange={e => update({ school_id: e.target.value })}
            >
              <option value="">ทุกโรงเรียน</option>
              {schools?.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* แถวพิเศษจาก parent (เช่น สถานะ/ระดับสำหรับ alerts) */}
        {children}

        {/* แถว 2: ประเภท ระดับชั้น เพศ วันที่ */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {/* ประเภทแบบประเมิน */}
          <select
            className="select select-bordered select-sm w-full"
            value={filters.assessment_type}
            onChange={e => update({ assessment_type: e.target.value })}
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
            onChange={e => update({ grade: e.target.value })}
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
            onChange={e => update({ gender: e.target.value })}
          >
            <option value="">ทุกเพศ</option>
            <option value="ชาย">ชาย</option>
            <option value="หญิง">หญิง</option>
          </select>

          <input
            type="date"
            className="input input-bordered input-sm w-full disabled:opacity-40"
            value={filters.date_from}
            disabled={!!filters.survey_round_id}
            onChange={e => update({ date_from: e.target.value })}
          />

          {/* วันที่สิ้นสุด + ปุ่มล้าง */}
          <div className="flex gap-1">
            <input
              type="date"
              className="input input-bordered input-sm flex-1 min-w-0 disabled:opacity-40"
              value={filters.date_to}
              disabled={!!filters.survey_round_id}
              onChange={e => update({ date_to: e.target.value })}
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
