"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import RoleGuard from "@/components/admin/RoleGuard";

const fetcher = (url: string) => api.get(url).then(r => r.data);

const TYPE_LABEL: Record<string, string> = {
  ST5:  "ST-5 ความเครียด",
  CDI:  "CDI ซึมเศร้า",
  PHQA: "PHQ-A ซึมเศร้า",
};

const SEVERITY_BADGE: Record<string, string> = {
  normal:     "badge-success",
  none:       "badge-success",
  mild:       "badge-info",
  moderate:   "badge-warning",
  severe:     "badge-error",
  very_severe:"badge-error",
  clinical:   "badge-error",
};

const SEVERITY_LABEL: Record<string, string> = {
  normal: "ปกติ", none: "ไม่มีอาการ", mild: "น้อย",
  moderate: "ปานกลาง", severe: "สูง", very_severe: "รุนแรง", clinical: "ต้องดูแล",
};

const ALL_GRADES = ["ป.1","ป.2","ป.3","ป.4","ป.5","ป.6","ม.1","ม.2","ม.3","ม.4","ม.5","ม.6"];

interface AssessmentDone {
  severity_level: string;
  score: number;
  filled_by_proxy: boolean;
  created_at: string | null;
}

interface StudentRow {
  id: string;
  student_code: string;
  first_name: string;
  last_name: string;
  gender: string;
  grade: string;
  classroom: string;
  age: number | null;
  available_types: string[];
  assessments_done: Record<string, AssessmentDone>;
}

function ProxyAssessPageInner() {
  const router = useRouter();
  const [grade,     setGrade]     = useState("");
  const [classroom, setClassroom] = useState("");

  const params = new URLSearchParams();
  if (grade)     params.set("grade", grade);
  if (classroom) params.set("classroom", classroom);

  const swrKey = grade ? `/admin/proxy-assess/students?${params}` : null;
  const { data: students, isLoading } = useSWR<StudentRow[]>(swrKey, fetcher);

  const done   = (students ?? []).filter(s => s.available_types.every(t => s.assessments_done[t])).length;
  const total  = (students ?? []).length;
  const pct    = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">📋 กรอกแบบประเมินชั้นเรียน</h1>
        <p className="text-sm text-base-content/60">ครูถามนักเรียนทีละคน แล้วกรอกคำตอบในระบบแทน</p>
      </div>

      {/* Filter */}
      <div className="card bg-base-100 shadow">
        <div className="card-body py-3 px-4 flex flex-wrap gap-3 items-end">
          <div className="form-control">
            <label className="label py-0.5"><span className="label-text text-xs">ระดับชั้น *</span></label>
            <select className="select select-bordered select-sm" value={grade} onChange={e => { setGrade(e.target.value); setClassroom(""); }}>
              <option value="">— เลือกชั้น —</option>
              {ALL_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="form-control">
            <label className="label py-0.5"><span className="label-text text-xs">ห้อง</span></label>
            <input
              type="text"
              className="input input-bordered input-sm w-20"
              placeholder="เช่น 1"
              value={classroom}
              onChange={e => setClassroom(e.target.value)}
            />
          </div>
          {!grade && (
            <p className="text-sm text-base-content/40 self-end pb-1">← เลือกชั้นเพื่อดูรายชื่อ</p>
          )}
        </div>
      </div>

      {/* Progress summary */}
      {grade && students && students.length > 0 && (
        <div className="card bg-base-100 shadow">
          <div className="card-body py-3 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">ความคืบหน้า ชั้น {grade}{classroom ? `/${classroom}` : ""}</span>
              <span className="text-sm font-bold text-primary">{done}/{total} คน ({pct}%)</span>
            </div>
            <progress className="progress progress-primary w-full" value={pct} max={100} />
          </div>
        </div>
      )}

      {/* Student list */}
      {grade && (
        <div className="card bg-base-100 shadow overflow-x-auto">
          <table className="table table-sm w-full">
            <thead>
              <tr className="bg-base-200/50">
                <th>รหัส</th>
                <th>ชื่อ – นามสกุล</th>
                <th className="text-center">อายุ</th>
                {["ST5","CDI","PHQA"].map(t => (
                  <th key={t} className="text-center text-xs">{TYPE_LABEL[t]}</th>
                ))}
                <th className="text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-10"><span className="loading loading-spinner"/></td></tr>
              ) : !students?.length ? (
                <tr><td colSpan={7} className="text-center py-10 text-base-content/40">ไม่พบนักเรียนในชั้นนี้</td></tr>
              ) : students.map(s => (
                <tr key={s.id} className="hover">
                  <td className="font-mono text-xs">{s.student_code}</td>
                  <td className="font-medium">{s.first_name} {s.last_name}</td>
                  <td className="text-center text-sm">{s.age ?? "—"}</td>
                  {["ST5","CDI","PHQA"].map(t => {
                    const avail = s.available_types.includes(t);
                    const done  = s.assessments_done[t];
                    return (
                      <td key={t} className="text-center">
                        {!avail ? (
                          <span className="text-base-content/20 text-xs">—</span>
                        ) : done ? (
                          <span className={`badge badge-xs ${SEVERITY_BADGE[done.severity_level] ?? "badge-ghost"}`}>
                            {SEVERITY_LABEL[done.severity_level] ?? done.severity_level}
                            {done.filled_by_proxy && <span className="ml-1 opacity-60">✏️</span>}
                          </span>
                        ) : (
                          <span className="badge badge-outline badge-xs text-base-content/40">ยังไม่ทำ</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="text-center">
                    <div className="flex gap-1 justify-center flex-wrap">
                      {s.available_types.map(t => (
                        <button
                          key={t}
                          className="btn btn-xs btn-outline"
                          onClick={() => router.push(`/admin/proxy-assess/${s.id}/${t.toLowerCase()}`)}
                          title={`กรอก ${TYPE_LABEL[t]}`}
                        >
                          {t}
                        </button>
                      ))}
                      {s.available_types.length === 0 && (
                        <span className="text-xs text-base-content/30">ไม่มีแบบประเมิน</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ProxyAssessPage() {
  return (
    <RoleGuard roles={["schooladmin"]}>
      <ProxyAssessPageInner />
    </RoleGuard>
  );
}
