"use client";

import { useState, useMemo } from "react";
import useSWR, { mutate } from "swr";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

const fetcher = (url: string) => api.get(url).then(r => r.data);

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

export default function SchoolsPage() {
  const { toast } = useToast();
  const { data: schools,      isLoading } = useSWR<School[]>("/admin/schools", fetcher);
  const { data: districts     = [] }      = useSWR<District[]>("/admin/districts", fetcher);
  const { data: affiliations  = [] }      = useSWR<Affiliation[]>("/admin/affiliations", fetcher);

  // ── filters ─────────────────────────────────────────────────────────────
  const [filterAff,  setFilterAff]  = useState("");
  const [filterDist, setFilterDist] = useState("");
  const [filterType, setFilterType] = useState("");
  const [search,     setSearch]     = useState("");

  // ── modal ────────────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState<School | null>(null);
  const [form,      setForm]      = useState({ name: "", affiliation_id: "", district_id: 0, school_type: "" });
  const [saving,       setSaving]      = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<School | null>(null);

  // Lookups
  const districtMap    = useMemo(() => new Map(districts.map(d    => [d.id, d.name])), [districts]);
  const affiliationMap = useMemo(() => new Map(affiliations.map(a => [a.id, a.name])), [affiliations]);

  // Districts grouped by affiliation for <optgroup>
  const districtsByAff = useMemo(() => {
    const map = new Map<number, District[]>();
    districts.forEach(d => {
      if (!map.has(d.affiliation_id)) map.set(d.affiliation_id, []);
      map.get(d.affiliation_id)!.push(d);
    });
    return map;
  }, [districts]);

  // Districts in selected affiliation (for filter cascade)
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
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        districtMap.get(s.district_id)?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [schools, filterAff, filterDist, filterType, search, districts, districtMap]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", affiliation_id: "", district_id: 0, school_type: "" });
    setModalOpen(true);
  };
  const openEdit = (s: School) => {
    const d = districts.find(d => d.id === s.district_id);
    setEditing(s);
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
      mutate("/admin/schools");
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
      mutate("/admin/schools");
      toast(`ลบ ${deleteTarget.name} สำเร็จ`, "success");
    } catch (e: any) {
      toast(e?.response?.data?.detail || "เกิดข้อผิดพลาด", "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  const hasFilter = filterAff || filterDist || filterType || search;

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">จัดการโรงเรียน</h1>
          <p className="text-base-content/60 text-sm">สถานศึกษาในเครือข่าย LEMCS</p>
        </div>
        <button className="btn btn-primary btn-sm gap-1" onClick={openAdd}>
          <span>+</span> เพิ่มโรงเรียน
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card bg-base-100 shadow">
        <div className="card-body py-3 px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {/* Search */}
            <div className="relative">
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

            {/* Type */}
            <div className="flex gap-2">
              <select
                className="select select-bordered select-sm flex-1"
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
              >
                <option value="">ทุกประเภท</option>
                {SCHOOL_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {hasFilter && (
                <button
                  className="btn btn-ghost btn-sm px-2 text-base-content/50 hover:text-error"
                  title="ล้างตัวกรอง"
                  onClick={() => { setFilterAff(""); setFilterDist(""); setFilterType(""); setSearch(""); }}
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
              <th className="w-20 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-12"><span className="loading loading-spinner" /></td></tr>
            ) : filteredSchools.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16 text-base-content/40">
                  <p className="text-4xl mb-2">🏫</p>
                  <p>{hasFilter ? "ไม่พบโรงเรียนที่ตรงกับตัวกรอง" : "ยังไม่มีข้อมูลโรงเรียน"}</p>
                </td>
              </tr>
            ) : filteredSchools.map((s, i) => {
              const d = districts.find(d => d.id === s.district_id);
              return (
                <tr key={s.id} className="hover">
                  <td className="text-center font-mono text-xs text-base-content/30">{i + 1}</td>
                  <td className="font-medium">{s.name}</td>
                  <td className="text-xs text-base-content/60">
                    {d ? affiliationMap.get(d.affiliation_id) || "—" : "—"}
                  </td>
                  <td className="text-sm text-base-content/70">{districtMap.get(s.district_id) || "—"}</td>
                  <td>
                    {s.school_type ? (
                      <span className={`badge badge-sm ${TYPE_BADGE[s.school_type] || "badge-ghost"}`}>
                        {s.school_type}
                      </span>
                    ) : (
                      <span className="text-base-content/30">—</span>
                    )}
                  </td>
                  <td className="text-center">
                    <div className="flex gap-1 justify-center">
                      <button className="btn btn-ghost btn-xs" onClick={() => openEdit(s)} title="แก้ไข">✏️</button>
                      <button className="btn btn-ghost btn-xs text-error" onClick={() => setDeleteTarget(s)} title="ลบ">🗑️</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
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

      {/* Modal */}
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
