"use client";

import { useState, useMemo } from "react";
import useSWR, { mutate } from "swr";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

const fetcher = (url: string) => api.get(url).then(r => r.data);

interface SchoolStats {
  id: number;
  name: string;
  district_id: number;
  district_name: string;
  affiliation_name: string;
  school_type: string | null;
  student_count: number;
  last_import_at: string | null;
}

interface School    { id: number; name: string; district_id: number; school_type: string | null; }
interface District  { id: number; name: string; affiliation_id: number; }
interface Affiliation { id: number; name: string; }

const SCHOOL_TYPES = ["ประถมศึกษา", "มัธยมศึกษา", "อาชีวศึกษา", "เอกชน", "สกร.", "กศน."];
const TYPE_BADGE: Record<string, string> = {
  มัธยมศึกษา: "badge-info",
  ประถมศึกษา: "badge-success",
  อาชีวศึกษา: "badge-warning",
  เอกชน:      "badge-secondary",
  "กศน.":     "badge-ghost",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function ImportStatusBadge({ count, lastImport }: { count: number; lastImport: string | null }) {
  if (count === 0) {
    return <span className="badge badge-ghost badge-sm">ยังไม่มีข้อมูล</span>;
  }
  // ถ้า import ภายใน 30 วัน → ล่าสุด
  const isRecent = lastImport && (Date.now() - new Date(lastImport).getTime()) < 30 * 24 * 3600 * 1000;
  return (
    <span className={`badge badge-sm ${isRecent ? "badge-success" : "badge-warning"}`}>
      {isRecent ? "ล่าสุด" : "นานแล้ว"}
    </span>
  );
}

export default function SchoolsPage() {
  const { toast } = useToast();
  const { data: schools,      isLoading } = useSWR<SchoolStats[]>("/admin/schools/stats", fetcher);
  const { data: districts     = [] }      = useSWR<District[]>("/admin/districts", fetcher);
  const { data: affiliations  = [] }      = useSWR<Affiliation[]>("/admin/affiliations", fetcher);

  // ── filters ─────────────────────────────────────────────────────────────
  const [filterAff,  setFilterAff]  = useState("");
  const [filterDist, setFilterDist] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterImport, setFilterImport] = useState(""); // "imported" | "empty"
  const [search,     setSearch]     = useState("");

  // ── export loading ───────────────────────────────────────────────────────
  const [exportingPdf,   setExportingPdf]   = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // ── modal ────────────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState<School | null>(null);
  const [form,      setForm]      = useState({ name: "", affiliation_id: "", district_id: 0, school_type: "" });
  const [saving,       setSaving]      = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SchoolStats | null>(null);

  // Lookups
  const districtMap    = useMemo(() => new Map(districts.map(d    => [d.id, d.name])), [districts]);
  const affiliationMap = useMemo(() => new Map(affiliations.map(a => [a.id, a.name])), [affiliations]);

  // Districts grouped by affiliation
  const filteredDistrictOptions = useMemo(
    () => filterAff ? districts.filter(d => String(d.affiliation_id) === filterAff) : districts,
    [filterAff, districts],
  );

  // Modal: districts in selected affiliation
  const modalDistrictOptions = useMemo(
    () => form.affiliation_id ? districts.filter(d => String(d.affiliation_id) === form.affiliation_id) : [],
    [form.affiliation_id, districts],
  );

  // Filtered school list
  const filteredSchools = useMemo(() => {
    let list = schools || [];
    if (filterAff) {
      const distIds = new Set(districts.filter(d => String(d.affiliation_id) === filterAff).map(d => d.id));
      list = list.filter(s => distIds.has(s.district_id));
    }
    if (filterDist) list = list.filter(s => String(s.district_id) === filterDist);
    if (filterType) list = list.filter(s => s.school_type === filterType);
    if (filterImport === "imported") list = list.filter(s => s.student_count > 0);
    if (filterImport === "empty")    list = list.filter(s => s.student_count === 0);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.district_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [schools, filterAff, filterDist, filterType, filterImport, search, districts]);

  // Summary stats
  const totalStudents   = useMemo(() => filteredSchools.reduce((s, x) => s + x.student_count, 0), [filteredSchools]);
  const importedSchools = useMemo(() => filteredSchools.filter(s => s.student_count > 0).length, [filteredSchools]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", affiliation_id: "", district_id: 0, school_type: "" });
    setModalOpen(true);
  };
  const openEdit = (s: SchoolStats) => {
    const d = districts.find(d => d.id === s.district_id);
    setEditing({ id: s.id, name: s.name, district_id: s.district_id, school_type: s.school_type });
    setForm({
      name: s.name,
      affiliation_id: d ? String(d.affiliation_id) : "",
      district_id: s.district_id,
      school_type: s.school_type || "",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name)        { toast("กรุณากรอกชื่อสถานศึกษา", "warning"); return; }
    if (!form.district_id) { toast("กรุณาเลือกเขตพื้นที่", "warning"); return; }
    setSaving(true);
    try {
      const body = { name: form.name, district_id: form.district_id, school_type: form.school_type || null };
      if (editing) {
        await api.put(`/admin/schools/${editing.id}`, body);
      } else {
        await api.post("/admin/schools", body);
      }
      setModalOpen(false);
      mutate("/admin/schools/stats");
      toast(editing ? "แก้ไขโรงเรียนสำเร็จ" : "เพิ่มโรงเรียนสำเร็จ", "success");
    } catch (e: any) {
      toast(e?.response?.data?.detail || "เกิดข้อผิดพลาด", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/admin/schools/${deleteTarget.id}`);
      mutate("/admin/schools/stats");
      toast(`ลบ ${deleteTarget.name} สำเร็จ`, "success");
    } catch (e: any) {
      toast(e?.response?.data?.detail || "เกิดข้อผิดพลาด", "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  // ── Export helpers ────────────────────────────────────────────────────────

  const buildExportParams = () => {
    const p = new URLSearchParams();
    if (filterAff)  p.set("affiliation_id", filterAff);
    if (filterDist) p.set("district_id",    filterDist);
    return p.toString();
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const qs = buildExportParams();
      const res = await api.get(`/admin/schools/export/excel${qs ? "?" + qs : ""}`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "schools_report.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast("ไม่สามารถส่งออก Excel ได้", "error");
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPDF = async () => {
    setExportingPdf(true);
    try {
      const rows = filteredSchools;
      // สร้าง PDF ฝั่ง client ด้วย print window
      const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8"/>
  <title>รายงานสถานะ Import นักเรียน</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Sarabun', sans-serif; font-size: 11pt; color: #1a1a1a; padding: 20mm; }
    h1 { font-size: 16pt; font-weight: 700; text-align: center; margin-bottom: 4px; }
    .subtitle { text-align: center; color: #666; font-size: 10pt; margin-bottom: 16px; }
    .summary { display: flex; gap: 32px; margin-bottom: 16px; padding: 10px 16px; background: #f5f5f5; border-radius: 6px; }
    .summary-item { text-align: center; }
    .summary-item .val { font-size: 18pt; font-weight: 700; color: #2563eb; }
    .summary-item .lbl { font-size: 9pt; color: #555; }
    table { width: 100%; border-collapse: collapse; font-size: 10pt; }
    th { background: #1d4ed8; color: white; padding: 7px 8px; text-align: left; font-weight: 600; }
    td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
    tr:nth-child(even) td { background: #f8fafc; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 9pt; font-weight: 600; }
    .badge-ok   { background: #dcfce7; color: #15803d; }
    .badge-warn { background: #fef9c3; color: #a16207; }
    .badge-none { background: #f1f5f9; color: #64748b; }
    .count { font-weight: 700; color: #2563eb; }
    @media print { @page { margin: 15mm; } }
  </style>
</head>
<body>
  <h1>🧠 LEMCS — รายงานสถานะ Import นักเรียน</h1>
  <p class="subtitle">วันที่พิมพ์: ${new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}</p>
  <div class="summary">
    <div class="summary-item"><div class="val">${rows.length}</div><div class="lbl">โรงเรียนทั้งหมด</div></div>
    <div class="summary-item"><div class="val">${importedSchools}</div><div class="lbl">นำเข้าแล้ว</div></div>
    <div class="summary-item"><div class="val">${rows.length - importedSchools}</div><div class="lbl">ยังไม่มีข้อมูล</div></div>
    <div class="summary-item"><div class="val">${totalStudents.toLocaleString()}</div><div class="lbl">นักเรียนรวม</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>ชื่อสถานศึกษา</th>
        <th>สังกัด</th>
        <th>เขตพื้นที่</th>
        <th>ประเภท</th>
        <th style="text-align:right">จำนวนนักเรียน</th>
        <th>Import ล่าสุด</th>
        <th>สถานะ</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((s, i) => {
        const isRecent = s.last_import_at && (Date.now() - new Date(s.last_import_at).getTime()) < 30 * 24 * 3600 * 1000;
        const badge = s.student_count === 0
          ? `<span class="badge badge-none">ยังไม่มีข้อมูล</span>`
          : `<span class="badge ${isRecent ? "badge-ok" : "badge-warn"}">${isRecent ? "ล่าสุด" : "นานแล้ว"}</span>`;
        return `<tr>
          <td>${i + 1}</td>
          <td>${s.name}</td>
          <td>${s.affiliation_name || "—"}</td>
          <td>${s.district_name || "—"}</td>
          <td>${s.school_type || "—"}</td>
          <td style="text-align:right"><span class="count">${s.student_count.toLocaleString()}</span></td>
          <td>${formatDate(s.last_import_at)}</td>
          <td>${badge}</td>
        </tr>`;
      }).join("")}
    </tbody>
  </table>
</body>
</html>`;

      const win = window.open("", "_blank");
      if (!win) { toast("กรุณาอนุญาต popup เพื่อพิมพ์ PDF", "warning"); return; }
      win.document.write(html);
      win.document.close();
      win.onload = () => { win.focus(); win.print(); };
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportCSV = () => {
    const rows = filteredSchools;
    const header = ["#", "ชื่อสถานศึกษา", "สังกัด", "เขตพื้นที่", "ประเภท", "จำนวนนักเรียน", "Import ล่าสุด", "สถานะ"];
    const body = rows.map((s, i) => {
      const status = s.student_count === 0 ? "ยังไม่มีข้อมูล"
        : (s.last_import_at && (Date.now() - new Date(s.last_import_at).getTime()) < 30 * 24 * 3600 * 1000) ? "ล่าสุด" : "นานแล้ว";
      return [i + 1, s.name, s.affiliation_name, s.district_name, s.school_type || "", s.student_count, formatDate(s.last_import_at), status];
    });
    const csv = [header, ...body].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "schools_report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasFilter = filterAff || filterDist || filterType || filterImport || search;

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">จัดการโรงเรียน</h1>
          <p className="text-base-content/60 text-sm">สถานศึกษาในเครือข่าย LEMCS และสถานะการ Import ข้อมูลนักเรียน</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-outline btn-sm gap-1"
            onClick={handleExportCSV}
            disabled={isLoading || filteredSchools.length === 0}
          >
            📊 Excel / CSV
          </button>
          <button
            className="btn btn-outline btn-sm gap-1 text-error"
            onClick={handleExportPDF}
            disabled={isLoading || exportingPdf || filteredSchools.length === 0}
          >
            {exportingPdf ? <span className="loading loading-spinner loading-xs" /> : "📄"} พิมพ์ PDF
          </button>
          <button className="btn btn-primary btn-sm gap-1" onClick={openAdd}>
            <span>+</span> เพิ่มโรงเรียน
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {!isLoading && schools && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="stat bg-base-100 rounded-xl shadow py-3 px-4">
            <div className="stat-title text-xs">โรงเรียนทั้งหมด</div>
            <div className="stat-value text-xl">{filteredSchools.length.toLocaleString()}</div>
            <div className="stat-desc">สถานศึกษา</div>
          </div>
          <div className="stat bg-base-100 rounded-xl shadow py-3 px-4">
            <div className="stat-title text-xs">นำเข้าแล้ว</div>
            <div className="stat-value text-xl text-success">{importedSchools.toLocaleString()}</div>
            <div className="stat-desc">มีข้อมูลนักเรียน</div>
          </div>
          <div className="stat bg-base-100 rounded-xl shadow py-3 px-4">
            <div className="stat-title text-xs">ยังไม่มีข้อมูล</div>
            <div className="stat-value text-xl text-warning">{(filteredSchools.length - importedSchools).toLocaleString()}</div>
            <div className="stat-desc">รอ import</div>
          </div>
          <div className="stat bg-base-100 rounded-xl shadow py-3 px-4">
            <div className="stat-title text-xs">นักเรียนรวม</div>
            <div className="stat-value text-xl text-primary">{totalStudents.toLocaleString()}</div>
            <div className="stat-desc">คน (active)</div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="card bg-base-100 shadow">
        <div className="card-body py-3 px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none text-sm">🔍</span>
              <input
                type="search"
                className="input input-bordered input-sm w-full pl-8"
                placeholder="ค้นหาชื่อโรงเรียน…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Affiliation */}
            <select
              className="select select-bordered select-sm w-full"
              value={filterAff}
              onChange={e => { setFilterAff(e.target.value); setFilterDist(""); }}
            >
              <option value="">ทุกสังกัด</option>
              {affiliations.map(a => (
                <option key={a.id} value={String(a.id)}>{a.name}</option>
              ))}
            </select>

            {/* District (cascaded) */}
            <select
              className="select select-bordered select-sm w-full"
              value={filterDist}
              onChange={e => setFilterDist(e.target.value)}
              disabled={!filterAff && districts.length > 4}
            >
              <option value="">ทุกเขตพื้นที่</option>
              {filteredDistrictOptions.map(d => (
                <option key={d.id} value={String(d.id)}>{d.name}</option>
              ))}
            </select>

            {/* Import status filter + clear */}
            <div className="flex gap-2">
              <select
                className="select select-bordered select-sm flex-1"
                value={filterImport}
                onChange={e => setFilterImport(e.target.value)}
              >
                <option value="">ทุกสถานะ</option>
                <option value="imported">นำเข้าแล้ว</option>
                <option value="empty">ยังไม่มีข้อมูล</option>
              </select>
              {hasFilter && (
                <button
                  className="btn btn-ghost btn-sm px-2 text-base-content/50 hover:text-error"
                  title="ล้างตัวกรอง"
                  onClick={() => { setFilterAff(""); setFilterDist(""); setFilterType(""); setFilterImport(""); setSearch(""); }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      {!isLoading && (
        <div className="flex items-center gap-4 text-sm text-base-content/50">
          <span>พบ <strong className="text-base-content">{filteredSchools.length}</strong> สถานศึกษา</span>
          {hasFilter && schools && <span>(จากทั้งหมด {schools.length} แห่ง)</span>}
        </div>
      )}

      {/* Table */}
      <div className="card bg-base-100 shadow overflow-x-auto">
        <table className="table table-zebra w-full text-sm">
          <thead>
            <tr className="bg-base-200/50">
              <th className="w-10 text-center">#</th>
              <th>ชื่อสถานศึกษา</th>
              <th>สังกัด</th>
              <th>เขตพื้นที่</th>
              <th>ประเภท</th>
              <th className="text-right">นักเรียน</th>
              <th>Import ล่าสุด</th>
              <th>สถานะ</th>
              <th className="w-20 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="text-center py-12"><span className="loading loading-spinner" /></td></tr>
            ) : filteredSchools.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-16 text-base-content/40">
                  <p className="text-4xl mb-2">🏫</p>
                  <p>{hasFilter ? "ไม่พบโรงเรียนที่ตรงกับตัวกรอง" : "ยังไม่มีข้อมูลโรงเรียน"}</p>
                </td>
              </tr>
            ) : filteredSchools.map((s, i) => (
              <tr key={s.id} className="hover">
                <td className="text-center font-mono text-xs text-base-content/30">{i + 1}</td>
                <td className="font-medium">{s.name}</td>
                <td className="text-xs text-base-content/60">{s.affiliation_name || "—"}</td>
                <td className="text-sm text-base-content/70">{s.district_name || districtMap.get(s.district_id) || "—"}</td>
                <td>
                  {s.school_type ? (
                    <span className={`badge badge-sm ${TYPE_BADGE[s.school_type] || "badge-ghost"}`}>
                      {s.school_type}
                    </span>
                  ) : (
                    <span className="text-base-content/30">—</span>
                  )}
                </td>
                <td className="text-right">
                  <span className={`font-bold tabular-nums ${s.student_count > 0 ? "text-primary" : "text-base-content/30"}`}>
                    {s.student_count.toLocaleString()}
                  </span>
                  <span className="text-base-content/40 text-xs ml-0.5"> คน</span>
                </td>
                <td className="text-xs text-base-content/60 whitespace-nowrap">
                  {formatDate(s.last_import_at)}
                </td>
                <td>
                  <ImportStatusBadge count={s.student_count} lastImport={s.last_import_at} />
                </td>
                <td className="text-center">
                  <div className="flex gap-1 justify-center">
                    <button className="btn btn-ghost btn-xs" onClick={() => openEdit(s)} title="แก้ไข">✏️</button>
                    <button className="btn btn-ghost btn-xs text-error" onClick={() => setDeleteTarget(s)} title="ลบ">🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {filteredSchools.length > 0 && (
            <tfoot>
              <tr className="bg-base-200/30 text-sm font-semibold">
                <td colSpan={5} className="text-right pr-3 text-base-content/60">รวม</td>
                <td className="text-right text-primary tabular-nums">{totalStudents.toLocaleString()} คน</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="ลบโรงเรียน"
        message={`ต้องการลบ "${deleteTarget?.name}" ออกจากระบบ?\nโรงเรียนที่มีนักเรียนอยู่จะไม่สามารถลบได้`}
        confirmLabel="ลบ"
        confirmClass="btn-error"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Modal เพิ่ม/แก้ไขโรงเรียน */}
      {modalOpen && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg mb-4">
              {editing ? "แก้ไขโรงเรียน" : "เพิ่มโรงเรียนใหม่"}
            </h3>

            <div className="space-y-4">
              {/* ชื่อโรงเรียน */}
              <div className="form-control">
                <label className="label py-1"><span className="label-text">ชื่อสถานศึกษา *</span></label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="เช่น โรงเรียนเลยพิทยาคม"
                />
              </div>

              {/* สังกัด → เขต (cascaded) */}
              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text">สังกัด *</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={form.affiliation_id}
                  onChange={e => setForm({ ...form, affiliation_id: e.target.value, district_id: 0 })}
                >
                  <option value="">— เลือกสังกัดก่อน —</option>
                  {affiliations.map(a => (
                    <option key={a.id} value={String(a.id)}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text">เขตพื้นที่ *</span>
                  {!form.affiliation_id && (
                    <span className="label-text-alt text-xs text-base-content/40">เลือกสังกัดก่อน</span>
                  )}
                </label>
                <select
                  className="select select-bordered w-full"
                  value={form.district_id || ""}
                  onChange={e => setForm({ ...form, district_id: Number(e.target.value) })}
                  disabled={!form.affiliation_id}
                >
                  <option value="">— เลือกเขตพื้นที่ —</option>
                  {modalDistrictOptions.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* ประเภท */}
              <div className="form-control">
                <label className="label py-1"><span className="label-text">ประเภทสถานศึกษา</span></label>
                <div className="grid grid-cols-3 gap-2">
                  {SCHOOL_TYPES.map(t => (
                    <label key={t} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                      form.school_type === t
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-base-300 hover:border-base-400"
                    }`}>
                      <input
                        type="radio"
                        className="radio radio-primary radio-xs"
                        name="school_type"
                        value={t}
                        checked={form.school_type === t}
                        onChange={() => setForm({ ...form, school_type: t })}
                      />
                      {t}
                    </label>
                  ))}
                  <label className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                    !form.school_type
                      ? "border-base-400 bg-base-200"
                      : "border-base-300 hover:border-base-400"
                  }`}>
                    <input
                      type="radio"
                      className="radio radio-xs"
                      name="school_type"
                      value=""
                      checked={!form.school_type}
                      onChange={() => setForm({ ...form, school_type: "" })}
                    />
                    <span className="text-base-content/50">ไม่ระบุ</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setModalOpen(false)}>ยกเลิก</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? <span className="loading loading-spinner loading-xs" /> : editing ? "บันทึก" : "เพิ่มโรงเรียน"}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setModalOpen(false)}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
