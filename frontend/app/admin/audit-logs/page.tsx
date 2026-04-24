"use client";

import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import RoleGuard from "@/components/admin/RoleGuard";

const fetcher = (url: string) => api.get(url).then(r => r.data);

interface AuditLogItem {
  id: number;
  user_id: string | null;
  username: string | null;
  role: string | null;
  action: string;
  resource: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string | null;
}
interface AuditLogResponse { total: number; items: AuditLogItem[]; }

const ACTION_LABEL: Record<string, string> = {
  view_alert:          "เปิดดู alert",
  update_alert:        "อัปเดต alert",
  update_national_id:  "แก้ไขเลขบัตร ปชช.",
};

const ACTION_BADGE: Record<string, string> = {
  view_alert:          "badge-info",
  update_alert:        "badge-warning",
  update_national_id:  "badge-error",
};

const RESOURCE_PREFIX_OPTIONS = [
  { value: "", label: "ทุก resource" },
  { value: "alert:", label: "Alert" },
  { value: "student:", label: "Student" },
];

const ALL_ACTIONS = [
  { value: "", label: "ทุก action" },
  { value: "view_alert", label: "เปิดดู alert" },
  { value: "update_alert", label: "อัปเดต alert" },
  { value: "update_national_id", label: "แก้ไขเลขบัตร ปชช." },
];

const PAGE_SIZE = 50;

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "medium" });
}

function AuditLogsPageInner() {
  const [action,         setAction]         = useState("");
  const [resourcePrefix, setResourcePrefix] = useState("");
  const [dateFrom,       setDateFrom]       = useState("");
  const [dateTo,         setDateTo]         = useState("");
  const [page,           setPage]           = useState(0);
  const [expanded,       setExpanded]       = useState<number | null>(null);

  const params = new URLSearchParams();
  if (action)         params.set("action", action);
  if (resourcePrefix) params.set("resource_prefix", resourcePrefix);
  if (dateFrom)       params.set("date_from", dateFrom);
  if (dateTo)         params.set("date_to", dateTo + "T23:59:59");
  params.set("limit",  String(PAGE_SIZE));
  params.set("offset", String(page * PAGE_SIZE));

  const { data, isLoading } = useSWR<AuditLogResponse>(`/admin/audit-logs?${params}`, fetcher);
  const items      = data?.items ?? [];
  const total      = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const clearFilters = () => { setAction(""); setResourcePrefix(""); setDateFrom(""); setDateTo(""); setPage(0); };
  const hasFilter = !!(action || resourcePrefix || dateFrom || dateTo);

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-sm text-base-content/60">บันทึกการกระทำที่ส่งผลต่อข้อมูลสำคัญ (PDPA)</p>
      </div>

      {/* Filter bar */}
      <div className="card bg-base-100 shadow">
        <div className="card-body py-3 px-4">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="form-control">
              <label className="label py-0.5"><span className="label-text text-xs">Action</span></label>
              <select className="select select-bordered select-sm" value={action} onChange={e => { setAction(e.target.value); setPage(0); }}>
                {ALL_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            <div className="form-control">
              <label className="label py-0.5"><span className="label-text text-xs">Resource</span></label>
              <select className="select select-bordered select-sm" value={resourcePrefix} onChange={e => { setResourcePrefix(e.target.value); setPage(0); }}>
                {RESOURCE_PREFIX_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="form-control">
              <label className="label py-0.5"><span className="label-text text-xs">ตั้งแต่วันที่</span></label>
              <input type="date" className="input input-bordered input-sm" value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPage(0); }} />
            </div>
            <div className="form-control">
              <label className="label py-0.5"><span className="label-text text-xs">ถึงวันที่</span></label>
              <input type="date" className="input input-bordered input-sm" value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPage(0); }} />
            </div>
            {hasFilter && (
              <button className="btn btn-ghost btn-sm text-error self-end" onClick={clearFilters}>✕ ล้างตัวกรอง</button>
            )}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-3 text-sm text-base-content/60">
        <span>พบ <strong className="text-base-content">{total.toLocaleString()}</strong> รายการ</span>
        {hasFilter && <span className="badge badge-outline badge-sm">กรองอยู่</span>}
      </div>

      {/* Table */}
      <div className="card bg-base-100 shadow overflow-x-auto">
        <table className="table table-sm w-full">
          <thead>
            <tr className="bg-base-200/50">
              <th className="w-36">เวลา</th>
              <th className="w-32">ผู้กระทำ</th>
              <th className="w-24">Role</th>
              <th className="w-40">Action</th>
              <th>Resource</th>
              <th className="w-10 text-center">รายละเอียด</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-10"><span className="loading loading-spinner"/></td></tr>
            ) : !items.length ? (
              <tr><td colSpan={6} className="text-center py-10 text-base-content/40">ไม่พบข้อมูล</td></tr>
            ) : items.map(item => (
              <>
                <tr key={item.id} className="hover">
                  <td className="font-mono text-xs text-base-content/60">{formatDateTime(item.created_at)}</td>
                  <td>
                    <span className="font-medium text-xs">{item.username ?? <span className="text-base-content/30">—</span>}</span>
                  </td>
                  <td>
                    <span className="badge badge-outline badge-xs">{item.role ?? "—"}</span>
                  </td>
                  <td>
                    <span className={`badge badge-xs ${ACTION_BADGE[item.action] ?? "badge-ghost"}`}>
                      {ACTION_LABEL[item.action] ?? item.action}
                    </span>
                  </td>
                  <td className="font-mono text-xs text-base-content/70">{item.resource ?? "—"}</td>
                  <td className="text-center">
                    {item.details && Object.keys(item.details).length > 0 && (
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                        title="ดูรายละเอียด"
                      >
                        {expanded === item.id ? "▲" : "▼"}
                      </button>
                    )}
                  </td>
                </tr>
                {expanded === item.id && (
                  <tr key={`${item.id}-detail`} className="bg-base-200/40">
                    <td colSpan={6} className="py-2 px-4">
                      <pre className="text-xs font-mono whitespace-pre-wrap text-base-content/70 bg-base-200 rounded p-3 max-h-40 overflow-auto">
                        {JSON.stringify(item.details, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-base-200">
          <span className="text-sm text-base-content/50">
            {total > 0
              ? `แสดง ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} จาก ${total.toLocaleString()} รายการ`
              : "ไม่มีข้อมูล"}
          </span>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← ก่อนหน้า</button>
            <span className="text-xs text-base-content/50">{page + 1} / {totalPages || 1}</span>
            <button className="btn btn-ghost btn-xs" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>ถัดไป →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuditLogsPage() {
  return (
    <RoleGuard roles={["systemadmin", "superadmin"]}>
      <AuditLogsPageInner />
    </RoleGuard>
  );
}
