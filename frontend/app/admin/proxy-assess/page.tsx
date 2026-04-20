"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

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

const ALL_GRADES = [
  "ป.1","ป.2","ป.3","ป.4","ป.5","ป.6",
  "ม.1","ม.2","ม.3","ม.4","ม.5","ม.6",
  "ปวช.1","ปวช.2","ปวช.3",
  "ปวส.1","ปวส.2",
];

interface AssessmentDone {
  severity_level: string;
  score: number;
  filled_by_proxy: boolean;
  created_at: string | null;
}

interface StudentRow {
  id: string;
  student_code: string;
  title: string | null;
  first_name: string;
  last_name: string;
  gender: string;
  grade: string;
  classroom: string;
  age: number | null;
  available_types: string[];
  assessments_done: Record<string, AssessmentDone>;
}

export default function ProxyAssessPage() {
  const router = useRouter();

  // ข้อมูล admin ที่ login
  const { data: me } = useSWR("/admin/me", fetcher);
  const isSchoolAdmin = me?.role === "schooladmin";

  // filter สำหรับ non-schooladmin
  const [affiliationId, setAffiliationId] = useState("");
  const [districtId,    setDistrictId]    = useState("");
  const [schoolId,      setSchoolId]      = useState("");

  const [grade,     setGrade]     = useState("");
  const [classroom, setClassroom] = useState("");

  // Cascade dropdowns
  const { data: affiliations } = useSWR(!isSchoolAdmin ? "/admin/affiliations" : null, fetcher);
  const { data: districts }    = useSWR(
    !isSchoolAdmin
      ? affiliationId
        ? `/admin/districts?affiliation_id=${affiliationId}`
        : "/admin/districts"
      : null,
    fetcher,
  );
  const { data: schools } = useSWR(
    !isSchoolAdmin
      ? districtId
        ? `/admin/schools?district_id=${districtId}`
        : affiliationId
        ? `/admin/schools?affiliation_id=${affiliationId}`
        : "/admin/schools"
      : null,
    fetcher,
  );

  // effective school
  const effectiveSchoolId = isSchoolAdmin ? (me?.school_id ?? "") : schoolId;

  // ดึงนักเรียน
  const canFetch = grade && (isSchoolAdmin || effectiveSchoolId);
  const params = new URLSearchParams();
  if (grade) params.set("grade", grade);
  if (classroom) params.set("classroom", classroom);
  if (!isSchoolAdmin && effectiveSchoolId) params.set("school_id", String(effectiveSchoolId));

  const { data: students, isLoading } = useSWR<StudentRow[]>(
    canFetch ? `/admin/proxy-assess/students?${params}` : null,
    fetcher,
  );

  const done  = (students ?? []).filter(s => s.available_types.every(t => s.assessments_done[t])).length;
  const total = (students ?? []).length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  const selectedSchoolName = isSchoolAdmin
    ? undefined
    : schools?.find((s: any) => String(s.id) === String(schoolId))?.name;

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">📋 กรอกแบบประเมินชั้นเรียน</h1>
        <p className="text-sm text-base-content/60">ครูถามนักเรียนทีละคน แล้วกรอกคำตอบในระบบแทน</p>
      </div>

      {/* Filter */}
      <div className="card bg-base-100 shadow">
        <div className="card-body py-3 px-4 space-y-3">

          {/* Org filters — เฉพาะ non-schooladmin */}
          {!isSchoolAdmin && me && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="form-control">
                <label className="label py-0.5"><span className="label-text text-xs">สังกัด</span></label>
                <select
                  className="select select-bordered select-sm w-full"
                  value={affiliationId}
                  onChange={e => { setAffiliationId(e.target.value); setDistrictId(""); setSchoolId(""); setGrade(""); }}
                >
                  <option value="">ทุกสังกัด</option>
                  {affiliations?.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-control">
                <label className="label py-0.5"><span className="label-text text-xs">เขตพื้นที่</span></label>
                <select
                  className="select select-bordered select-sm w-full"
                  value={districtId}
                  onChange={e => { setDistrictId(e.target.value); setSchoolId(""); setGrade(""); }}
                >
                  <option value="">ทุกเขตพื้นที่</option>
                  {districts?.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-control">
                <label className="label py-0.5"><span className="label-text text-xs">โรงเรียน *</span></label>
                <select
                  className="select select-bordered select-sm w-full"
                  value={schoolId}
                  onChange={e => { setSchoolId(e.target.value); setGrade(""); }}
                >
                  <option value="">— เลือกโรงเรียน —</option>
                  {schools?.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Grade + Classroom */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="form-control">
              <label className="label py-0.5"><span className="label-text text-xs">ระดับชั้น *</span></label>
              <select
                className="select select-bordered select-sm"
                value={grade}
                onChange={e => { setGrade(e.target.value); setClassroom(""); }}
                disabled={!isSchoolAdmin && !schoolId}
              >
                <option value="">— เลือกชั้น —</option>
                <optgroup label="ประถมศึกษา">
                  {ALL_GRADES.slice(0, 6).map(g => <option key={g} value={g}>{g}</option>)}
                </optgroup>
                <optgroup label="มัธยมศึกษา">
                  {ALL_GRADES.slice(6, 12).map(g => <option key={g} value={g}>{g}</option>)}
                </optgroup>
                <optgroup label="อาชีวศึกษา (ปวช.)">
                  {ALL_GRADES.slice(12, 15).map(g => <option key={g} value={g}>{g}</option>)}
                </optgroup>
                <optgroup label="อาชีวศึกษา (ปวส.)">
                  {ALL_GRADES.slice(15).map(g => <option key={g} value={g}>{g}</option>)}
                </optgroup>
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
                disabled={!grade}
              />
            </div>
            {!isSchoolAdmin && !schoolId && (
              <p className="text-sm text-base-content/40 self-end pb-1">← เลือกโรงเรียนก่อน</p>
            )}
            {(isSchoolAdmin || schoolId) && !grade && (
              <p className="text-sm text-base-content/40 self-end pb-1">← เลือกชั้นเพื่อดูรายชื่อ</p>
            )}
          </div>

        </div>
      </div>

      {/* Progress summary */}
      {grade && students && students.length > 0 && (
        <div className="card bg-base-100 shadow">
          <div className="card-body py-3 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">
                ความคืบหน้า {selectedSchoolName ? `${selectedSchoolName} · ` : ""}ชั้น {grade}{classroom ? `/${classroom}` : ""}
              </span>
              <span className="text-sm font-bold text-primary">{done}/{total} คน ({pct}%)</span>
            </div>
            <progress className="progress progress-primary w-full" value={pct} max={100} />
          </div>
        </div>
      )}

      {/* Student list */}
      {canFetch && (
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
                  <td className="font-medium">
                    {s.title && <span className="text-base-content/50 mr-1 text-xs">{s.title}</span>}
                    {s.first_name} {s.last_name}
                  </td>
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
