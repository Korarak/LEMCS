"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

const fetcher = (url: string) => api.get(url).then(r => r.data);

const SEVERITY_LABEL: Record<string, string> = {
  normal:     "ปกติ",
  none:       "ไม่มีอาการ",
  mild:       "ระดับน้อย",
  moderate:   "ระดับปานกลาง",
  severe:     "ระดับสูง",
  very_severe:"รุนแรงมาก",
  clinical:   "ต้องดูแล",
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

const PAGE_SIZE = 50;

export default function ReportsPage() {
  const { toast } = useToast();
  const [schoolId,       setSchoolId]       = useState("");
  const [assessmentType, setAssessmentType] = useState("");
  const [dateFrom,       setDateFrom]       = useState("");
  const [dateTo,         setDateTo]         = useState("");
  const [page,           setPage]           = useState(0);

  const { data: schools } = useSWR("/admin/schools", fetcher);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (schoolId)       p.set("school_id",       schoolId);
    if (assessmentType) p.set("assessment_type",  assessmentType);
    p.set("limit",  String(PAGE_SIZE));
    p.set("offset", String(page * PAGE_SIZE));
    return p.toString();
  }, [schoolId, assessmentType, page]);

  const { data: reports, isLoading } = useSWR(`/reports/data?${qs}`, fetcher);

  const handleFilterChange = () => setPage(0);

  const handleExportPDF = async () => {
    try {
      const body: any = {};
      if (schoolId)       body.school_id       = Number(schoolId);
      if (assessmentType) body.assessment_type = assessmentType;
      if (dateFrom)       body.date_from       = dateFrom;
      if (dateTo)         body.date_to         = dateTo;
      const res = await api.post("/reports/export/pdf", body, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "lemcs_report.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      toast("ไม่สามารถส่งออก PDF ได้", "error");
    }
  };

  const handleExportExcel = async () => {
    try {
      const body: any = {};
      if (schoolId)       body.school_id       = Number(schoolId);
      if (assessmentType) body.assessment_type = assessmentType;
      if (dateFrom)       body.date_from       = dateFrom;
      if (dateTo)         body.date_to         = dateTo;
      const res = await api.post("/reports/export/excel", body, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "lemcs_report.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      toast("ไม่สามารถส่งออก Excel ได้", "error");
    }
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">รายงานผลการประเมิน</h1>
          <p className="text-base-content/60 text-sm">ข้อมูลรายบุคคล</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline btn-sm text-error bg-white" onClick={handleExportPDF}>
            📄 ส่งออก PDF
          </button>
          <button className="btn btn-outline btn-sm text-success bg-white" onClick={handleExportExcel}>
            📊 ส่งออก Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card bg-base-100 shadow">
        <div className="card-body py-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <select
              className="select select-bordered select-sm w-full"
              value={schoolId}
              onChange={e => { setSchoolId(e.target.value); handleFilterChange(); }}
            >
              <option value="">ทุกโรงเรียน</option>
              {schools?.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <select
              className="select select-bordered select-sm w-full"
              value={assessmentType}
              onChange={e => { setAssessmentType(e.target.value); handleFilterChange(); }}
            >
              <option value="">ทุกแบบประเมิน</option>
              <option value="ST5">ST-5 (ความเครียด)</option>
              <option value="PHQA">PHQ-A (ซึมเศร้า)</option>
              <option value="CDI">CDI (ซึมเศร้าเด็ก)</option>
            </select>

            <input
              type="date"
              className="input input-bordered input-sm w-full"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); handleFilterChange(); }}
            />
            <input
              type="date"
              className="input input-bordered input-sm w-full"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); handleFilterChange(); }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card bg-base-100 shadow overflow-x-auto">
        <table className="table table-zebra w-full text-sm">
          <thead>
            <tr className="bg-base-200/50">
              <th>วันที่เข้าทำ</th>
              <th>ประเภท</th>
              <th>นักเรียน</th>
              <th>ชั้น/ห้อง</th>
              <th>โรงเรียน</th>
              <th className="text-center">คะแนน</th>
              <th>ระดับความเสี่ยง</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <span className="loading loading-spinner loading-md" />
                </td>
              </tr>
            ) : !reports || reports.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-base-content/40">
                  ไม่พบข้อมูลรายงาน
                </td>
              </tr>
            ) : (
              reports.map((r: any) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString("th-TH", {
                      year: "numeric", month: "short", day: "numeric",
                    })}
                  </td>
                  <td>
                    <span className="badge badge-sm badge-ghost font-mono">{r.assessment_type}</span>
                  </td>
                  <td>{r.first_name} {r.last_name}</td>
                  <td>{r.grade}/{r.classroom}</td>
                  <td className="max-w-[160px] truncate" title={r.school_name}>{r.school_name}</td>
                  <td className="text-center font-bold tabular-nums">{r.score}</td>
                  <td>
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className={`badge badge-sm ${SEVERITY_BADGE[r.severity_level] ?? "badge-ghost"}`}>
                        {SEVERITY_LABEL[r.severity_level] ?? r.severity_level}
                      </span>
                      {r.suicide_risk && (
                        <span className="badge badge-sm badge-error gap-1">⚠️ เสี่ยง</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!isLoading && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-base-content/50">
            แสดงหน้า {page + 1} (แถวที่ {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + (reports?.length ?? 0)})
          </span>
          <div className="join">
            <button
              className="join-item btn btn-sm"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >
              ‹ ก่อนหน้า
            </button>
            <button
              className="join-item btn btn-sm"
              disabled={!reports || reports.length < PAGE_SIZE}
              onClick={() => setPage(p => p + 1)}
            >
              ถัดไป ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
