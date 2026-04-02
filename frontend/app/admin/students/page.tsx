"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { api } from "@/lib/api";

const fetcher = (url: string) => api.get(url).then(r => r.data);

interface Student {
  id: string; student_code: string; first_name: string; last_name: string;
  gender: string; birthdate: string | null; grade: string; classroom: string;
  school_id: number; school_name: string; is_active: boolean; created_at: string | null;
}

const GENDER_ICON: Record<string, string> = { male: "👦", female: "👧" };
const INIT_FORM = { student_code: "", first_name: "", last_name: "", gender: "male", grade: "ม.1", classroom: "1", school_id: "" };
const GRADES = ["ป.4","ป.5","ป.6","ม.1","ม.2","ม.3","ม.4","ม.5","ม.6","ปวช.1","ปวช.2","ปวช.3"];

export default function StudentsPage() {
  const { data: schools } = useSWR("/admin/schools", fetcher);
  const [search, setSearch] = useState("");
  const [filterSchool, setFilterSchool] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState<"add"|"edit"|null>(null);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState({ ...INIT_FORM });
  const [saving, setSaving] = useState(false);
  const PAGE_SIZE = 20;

  const params = new URLSearchParams();
  if (filterSchool) params.set("school_id", filterSchool);
  if (filterGrade) params.set("grade", filterGrade);
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String(page * PAGE_SIZE));
  const { data: students, isLoading } = useSWR<Student[]>(`/admin/students?${params}`, fetcher);

  const filtered = search
    ? students?.filter(s => `${s.student_code} ${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()))
    : students;

  const openAdd = () => { setEditing(null); setForm({ ...INIT_FORM }); setModal("add"); };
  const openEdit = (s: Student) => {
    setEditing(s);
    setForm({ student_code: s.student_code, first_name: s.first_name, last_name: s.last_name,
      gender: s.gender || "male", grade: s.grade || "ม.1", classroom: s.classroom || "1",
      school_id: s.school_id?.toString() || "" });
    setModal("edit");
  };

  const handleSave = async () => {
    if (!form.student_code || !form.first_name || !form.last_name) return alert("กรุณากรอกข้อมูลที่จำเป็น");
    setSaving(true);
    try {
      const body = { ...form, school_id: form.school_id ? Number(form.school_id) : undefined };
      if (modal === "add") await api.post("/admin/students", body);
      else if (editing) await api.put(`/admin/students/${editing.id}`, body);
      setModal(null);
      mutate(`/admin/students?${params}`);
    } catch (e: any) { alert(e?.response?.data?.detail || "เกิดข้อผิดพลาด"); }
    finally { setSaving(false); }
  };

  const handleToggle = async (s: Student) => {
    if (!confirm(`${s.is_active ? "ปิด" : "เปิด"}บัญชี ${s.first_name} ${s.last_name}?`)) return;
    await api.delete(`/admin/students/${s.id}`);
    mutate(`/admin/students?${params}`);
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">ทะเบียนนักเรียน</h1>
          <p className="text-base-content/60 text-sm">ค้นหา เพิ่ม แก้ไข จัดการสถานะบัญชี</p>
        </div>
        <div className="flex gap-2">
          <a href="/admin/import" className="btn btn-ghost btn-sm border border-base-300">📥 Import CSV</a>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>➕ เพิ่มนักเรียน</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input type="search" className="input input-bordered input-sm w-52" placeholder="🔍 ค้นชื่อ / รหัส"
          value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
        <select className="select select-bordered select-sm"
          value={filterSchool} onChange={e => { setFilterSchool(e.target.value); setPage(0); }}>
          <option value="">ทุกโรงเรียน</option>
          {schools?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="select select-bordered select-sm"
          value={filterGrade} onChange={e => { setFilterGrade(e.target.value); setPage(0); }}>
          <option value="">ทุกระดับชั้น</option>
          {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        {(filterSchool || filterGrade) && (
          <button className="btn btn-ghost btn-sm text-error" onClick={() => { setFilterSchool(""); setFilterGrade(""); setPage(0); }}>✕ ล้างตัวกรอง</button>
        )}
      </div>

      {/* Table */}
      <div className="card bg-base-100 shadow overflow-x-auto">
        <table className="table table-zebra w-full text-sm">
          <thead>
            <tr className="bg-base-200/50">
              <th>รหัส</th><th>ชื่อ - นามสกุล</th><th>เพศ</th>
              <th>ชั้น/ห้อง</th><th>วันเกิด</th><th>โรงเรียน (ID)</th><th>สถานะ</th>
              <th>สร้างเมื่อ</th>
              <th className="text-center w-24">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="text-center py-10"><span className="loading loading-spinner"/></td></tr>
            ) : !filtered?.length ? (
              <tr><td colSpan={9} className="text-center py-10 text-base-content/40">ไม่พบข้อมูลนักเรียน</td></tr>
            ) : filtered.map(s => (
              <tr key={s.id} className={`hover ${!s.is_active ? "opacity-50" : ""}`}>
                <td className="font-mono text-xs">{s.student_code}</td>
                <td className="font-medium">{s.first_name} {s.last_name}</td>
                <td>{GENDER_ICON[s.gender] || "—"}</td>
                <td>{s.grade}/{s.classroom}</td>
                <td className="font-mono text-xs">{s.birthdate || <span className="text-base-content/30">—</span>}</td>
                <td className="text-xs text-base-content/70">
                  <span className="font-mono text-base-content/40 mr-1">[{s.school_id}]</span>
                  <span className="truncate max-w-32 inline-block align-bottom" title={s.school_name}>{s.school_name}</span>
                </td>
                <td>
                  <span className={`badge badge-xs ${s.is_active ? "badge-success" : "badge-error"}`}>
                    {s.is_active ? "เปิด" : "ปิด"}
                  </span>
                </td>
                <td className="font-mono text-xs text-base-content/50">
                  {s.created_at ? s.created_at.slice(0, 10) : "—"}
                </td>
                <td>
                  <div className="flex gap-1 justify-center">
                    <button className="btn btn-ghost btn-xs" onClick={() => openEdit(s)} title="แก้ไข">✏️</button>
                    <button className={`btn btn-ghost btn-xs ${s.is_active ? "text-error" : "text-success"}`}
                      onClick={() => handleToggle(s)} title={s.is_active ? "ปิดบัญชี" : "เปิดบัญชี"}>
                      {s.is_active ? "🚫" : "✅"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-base-200">
          <span className="text-sm text-base-content/50">
            หน้า {page + 1} — แสดง {filtered?.length || 0} รายการ
          </span>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← ก่อนหน้า</button>
            <button className="btn btn-ghost btn-xs" disabled={(filtered?.length || 0) < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>ถัดไป →</button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-lg mb-4">{modal === "add" ? "➕ เพิ่มนักเรียนใหม่" : "✏️ แก้ไขข้อมูลนักเรียน"}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-control">
                <label className="label"><span className="label-text">รหัสนักเรียน *</span></label>
                <input className="input input-bordered" value={form.student_code}
                  onChange={e => setForm({...form, student_code: e.target.value})} disabled={modal === "edit"}/>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">เพศ</span></label>
                <select className="select select-bordered" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
                  <option value="male">ชาย</option>
                  <option value="female">หญิง</option>
                </select>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">ชื่อ *</span></label>
                <input className="input input-bordered" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})}/>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">นามสกุล *</span></label>
                <input className="input input-bordered" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})}/>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">ระดับชั้น</span></label>
                <select className="select select-bordered" value={form.grade} onChange={e => setForm({...form, grade: e.target.value})}>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">ห้อง</span></label>
                <input className="input input-bordered" value={form.classroom} onChange={e => setForm({...form, classroom: e.target.value})}/>
              </div>
              <div className="form-control col-span-2">
                <label className="label"><span className="label-text">โรงเรียน</span></label>
                <select className="select select-bordered" value={form.school_id} onChange={e => setForm({...form, school_id: e.target.value})}>
                  <option value="">— เลือกโรงเรียน —</option>
                  {schools?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="loading loading-spinner loading-xs"/> : (modal === "add" ? "เพิ่ม" : "บันทึก")}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop"><button onClick={() => setModal(null)}>close</button></form>
        </dialog>
      )}
    </div>
  );
}
