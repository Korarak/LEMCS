"use client";

import { useState, useMemo } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

const fetcher = (url: string) => api.get(url).then(r => r.data);

interface Affiliation { id: number; name: string; }
interface District    { id: number; name: string; affiliation_id: number; }

// ── Affiliation Section ───────────────────────────────────────────────────────
function AffiliationSection({
  affiliations, isLoading,
}: { affiliations: Affiliation[]; isLoading: boolean }) {
  const { toast } = useToast();
  const [modal,   setModal]   = useState<"add" | "edit" | null>(null);
  const [target,  setTarget]  = useState<Affiliation | null>(null);
  const [name,    setName]    = useState("");
  const [saving,  setSaving]  = useState(false);
  const [confirm, setConfirm] = useState<Affiliation | null>(null);

  const openAdd  = () => { setTarget(null); setName(""); setModal("add"); };
  const openEdit = (a: Affiliation) => { setTarget(a); setName(a.name); setModal("edit"); };

  const handleSave = async () => {
    if (!name.trim()) { toast("กรุณากรอกชื่อสังกัด", "warning"); return; }
    setSaving(true);
    try {
      if (modal === "add") {
        await api.post("/admin/affiliations", { name });
      } else if (target) {
        await api.put(`/admin/affiliations/${target.id}`, { name });
      }
      setModal(null);
      globalMutate("/admin/affiliations");
      globalMutate("/admin/districts");
      toast(modal === "add" ? "เพิ่มสังกัดสำเร็จ" : "แก้ไขสังกัดสำเร็จ", "success");
    } catch (e: any) {
      toast(e?.response?.data?.detail || "เกิดข้อผิดพลาด", "error");
    } finally { setSaving(false); }
  };

  const handleDelete = async (a: Affiliation) => {
    setSaving(true);
    try {
      await api.delete(`/admin/affiliations/${a.id}`);
      setConfirm(null);
      globalMutate("/admin/affiliations");
      globalMutate("/admin/districts");
      toast("ลบสังกัดสำเร็จ", "success");
    } catch (e: any) {
      toast(e?.response?.data?.detail || "ไม่สามารถลบได้", "error");
    } finally { setSaving(false); }
  };

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="card-title text-base">สังกัด (Affiliations)</h2>
            <p className="text-xs text-base-content/50">หน่วยงานต้นสังกัดระดับบน เช่น สพฐ., อาชีวศึกษา</p>
          </div>
          <button className="btn btn-primary btn-sm gap-1" onClick={openAdd}>+ เพิ่มสังกัด</button>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="skeleton h-10 w-full rounded-lg" />)}</div>
        ) : affiliations.length === 0 ? (
          <p className="text-sm text-base-content/40 text-center py-6">ยังไม่มีข้อมูลสังกัด</p>
        ) : (
          <div className="divide-y divide-base-200">
            {affiliations.map((a, i) => (
              <div key={a.id} className="flex items-center justify-between py-2.5 group">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-base-content/30 w-6 text-right">{i + 1}</span>
                  <p className="text-sm font-medium">{a.name}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="btn btn-ghost btn-xs" onClick={() => openEdit(a)} title="แก้ไข">✏️</button>
                  <button className="btn btn-ghost btn-xs text-error" onClick={() => setConfirm(a)} title="ลบ">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modal && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-lg mb-4">{modal === "add" ? "เพิ่มสังกัดใหม่" : "แก้ไขสังกัด"}</h3>
            <div className="form-control">
              <label className="label"><span className="label-text">ชื่อสังกัด *</span></label>
              <input
                className="input input-bordered w-full"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="เช่น สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน"
                autoFocus
                onKeyDown={e => e.key === "Enter" && handleSave()}
              />
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>ยกเลิก</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? <span className="loading loading-spinner loading-xs" /> : modal === "add" ? "เพิ่ม" : "บันทึก"}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop"><button onClick={() => setModal(null)}>close</button></form>
        </dialog>
      )}

      {/* Delete Confirm */}
      {confirm && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-lg text-error mb-2">ยืนยันการลบ</h3>
            <p className="text-sm mb-1">ต้องการลบสังกัด:</p>
            <p className="font-semibold text-sm mb-3 p-2 bg-base-200 rounded">{confirm.name}</p>
            <p className="text-xs text-base-content/50">หากยังมีเขตพื้นที่อยู่ในสังกัดนี้ จะไม่สามารถลบได้</p>
            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>ยกเลิก</button>
              <button className="btn btn-error btn-sm" onClick={() => handleDelete(confirm)} disabled={saving}>
                {saving ? <span className="loading loading-spinner loading-xs" /> : "ลบ"}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop"><button onClick={() => setConfirm(null)}>close</button></form>
        </dialog>
      )}
    </div>
  );
}

// ── District Section ──────────────────────────────────────────────────────────
function DistrictSection({
  districts, affiliations, isLoading,
}: { districts: District[]; affiliations: Affiliation[]; isLoading: boolean }) {
  const { toast } = useToast();
  const [modal,      setModal]      = useState<"add" | "edit" | null>(null);
  const [target,     setTarget]     = useState<District | null>(null);
  const [form,       setForm]       = useState({ name: "", affiliation_id: "" });
  const [saving,     setSaving]     = useState(false);
  const [confirm,    setConfirm]    = useState<District | null>(null);
  const [filterAff,  setFilterAff]  = useState("");
  const [search,     setSearch]     = useState("");

  const openAdd = () => {
    setTarget(null);
    setForm({ name: "", affiliation_id: affiliations[0]?.id.toString() || "" });
    setModal("add");
  };
  const openEdit = (d: District) => {
    setTarget(d);
    setForm({ name: d.name, affiliation_id: d.affiliation_id.toString() });
    setModal("edit");
  };

  const handleSave = async () => {
    if (!form.name.trim())    { toast("กรุณากรอกชื่อเขตพื้นที่", "warning"); return; }
    if (!form.affiliation_id) { toast("กรุณาเลือกสังกัด", "warning"); return; }
    setSaving(true);
    try {
      const body = { name: form.name, affiliation_id: Number(form.affiliation_id) };
      if (modal === "add") {
        await api.post("/admin/districts", body);
      } else if (target) {
        await api.put(`/admin/districts/${target.id}`, body);
      }
      setModal(null);
      globalMutate("/admin/districts");
      toast(modal === "add" ? "เพิ่มเขตพื้นที่สำเร็จ" : "แก้ไขเขตพื้นที่สำเร็จ", "success");
    } catch (e: any) {
      toast(e?.response?.data?.detail || "เกิดข้อผิดพลาด", "error");
    } finally { setSaving(false); }
  };

  const handleDelete = async (d: District) => {
    setSaving(true);
    try {
      await api.delete(`/admin/districts/${d.id}`);
      setConfirm(null);
      globalMutate("/admin/districts");
      toast("ลบเขตพื้นที่สำเร็จ", "success");
    } catch (e: any) {
      toast(e?.response?.data?.detail || "ไม่สามารถลบได้", "error");
    } finally { setSaving(false); }
  };

  const affMap = useMemo(
    () => new Map(affiliations.map(a => [a.id, a.name])),
    [affiliations],
  );

  const filtered = useMemo(() => {
    let list = filterAff ? districts.filter(d => String(d.affiliation_id) === filterAff) : districts;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d => d.name.toLowerCase().includes(q));
    }
    return list;
  }, [districts, filterAff, search]);

  // Group by affiliation for display
  const grouped = useMemo(() => {
    const map = new Map<number, District[]>();
    filtered.forEach(d => {
      if (!map.has(d.affiliation_id)) map.set(d.affiliation_id, []);
      map.get(d.affiliation_id)!.push(d);
    });
    return map;
  }, [filtered]);

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="card-title text-base">เขตพื้นที่ (Districts)</h2>
            <p className="text-xs text-base-content/50">หน่วยงานเขตพื้นที่ ต้องสังกัดอยู่ใน Affiliation ใดอย่างหนึ่ง</p>
          </div>
          <button className="btn btn-primary btn-sm gap-1" onClick={openAdd} disabled={affiliations.length === 0}>
            + เพิ่มเขตพื้นที่
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-40">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 text-xs">🔍</span>
            <input
              type="search"
              className="input input-bordered input-sm w-full pl-7"
              placeholder="ค้นหาชื่อเขต…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="select select-bordered select-sm"
            value={filterAff}
            onChange={e => setFilterAff(e.target.value)}
          >
            <option value="">ทุกสังกัด ({districts.length})</option>
            {affiliations.map(a => (
              <option key={a.id} value={String(a.id)}>
                {a.name} ({districts.filter(d => d.affiliation_id === a.id).length})
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-10 w-full rounded-lg" />)}</div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-base-content/40 text-center py-6">ไม่พบข้อมูล</p>
        ) : (
          <div className="space-y-4">
            {Array.from(grouped.entries()).map(([affId, dists]) => (
              <div key={affId}>
                {/* Affiliation header */}
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                    🏛️ {affMap.get(affId) || `สังกัด #${affId}`}
                  </span>
                  <div className="flex-1 h-px bg-primary/20" />
                  <span className="text-xs text-base-content/40">{dists.length} เขต</span>
                </div>

                <div className="divide-y divide-base-200 pl-4">
                  {dists.map(d => (
                    <div key={d.id} className="flex items-center justify-between py-2 group">
                      <div className="flex items-center gap-2">
                        <span className="text-base-content/30 text-sm">↳</span>
                        <p className="text-sm">{d.name}</p>
                        <span className="badge badge-xs badge-ghost font-mono">#{d.id}</span>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="btn btn-ghost btn-xs" onClick={() => openEdit(d)} title="แก้ไข">✏️</button>
                        <button className="btn btn-ghost btn-xs text-error" onClick={() => setConfirm(d)} title="ลบ">🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modal && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg mb-4">
              {modal === "add" ? "เพิ่มเขตพื้นที่ใหม่" : "แก้ไขเขตพื้นที่"}
            </h3>
            <div className="space-y-4">
              <div className="form-control">
                <label className="label"><span className="label-text">สังกัด *</span></label>
                <select
                  className="select select-bordered w-full"
                  value={form.affiliation_id}
                  onChange={e => setForm({ ...form, affiliation_id: e.target.value })}
                >
                  <option value="">— เลือกสังกัด —</option>
                  {affiliations.map(a => (
                    <option key={a.id} value={String(a.id)}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">ชื่อเขตพื้นที่ *</span></label>
                <input
                  className="input input-bordered w-full"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="เช่น สำนักงานเขตพื้นที่การศึกษาประถมศึกษาเลย เขต 1"
                  autoFocus
                  onKeyDown={e => e.key === "Enter" && handleSave()}
                />
              </div>
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>ยกเลิก</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? <span className="loading loading-spinner loading-xs" /> : modal === "add" ? "เพิ่ม" : "บันทึก"}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop"><button onClick={() => setModal(null)}>close</button></form>
        </dialog>
      )}

      {/* Delete Confirm */}
      {confirm && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-lg text-error mb-2">ยืนยันการลบ</h3>
            <p className="text-sm mb-1">ต้องการลบเขตพื้นที่:</p>
            <p className="font-semibold text-sm mb-3 p-2 bg-base-200 rounded">{confirm.name}</p>
            <p className="text-xs text-base-content/50">หากยังมีโรงเรียนอยู่ในเขตนี้ จะไม่สามารถลบได้</p>
            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>ยกเลิก</button>
              <button className="btn btn-error btn-sm" onClick={() => handleDelete(confirm)} disabled={saving}>
                {saving ? <span className="loading loading-spinner loading-xs" /> : "ลบ"}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop"><button onClick={() => setConfirm(null)}>close</button></form>
        </dialog>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OrganizationPage() {
  const { data: affiliations = [], isLoading: loadAff } = useSWR<Affiliation[]>("/admin/affiliations", fetcher);
  const { data: districts    = [], isLoading: loadDist } = useSWR<District[]>("/admin/districts", fetcher);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">โครงสร้างองค์กร</h1>
        <p className="text-base-content/60 text-sm">
          จัดการสังกัดและเขตพื้นที่ — ข้อมูลเหล่านี้ใช้เป็น dropdown ทั่วทั้งระบบ
        </p>
      </div>

      {/* Hierarchy hint */}
      <div className="alert alert-info text-sm py-2">
        <span>🏛️</span>
        <span>
          <strong>ลำดับชั้น:</strong> สังกัด (Affiliation) → เขตพื้นที่ (District) → โรงเรียน (School)
          — ต้องสร้างสังกัดก่อน จึงจะเพิ่มเขตพื้นที่ได้ และต้องมีเขตพื้นที่ก่อน จึงจะเพิ่มโรงเรียนได้
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <AffiliationSection affiliations={affiliations} isLoading={loadAff} />
        <DistrictSection    districts={districts} affiliations={affiliations} isLoading={loadDist} />
      </div>
    </div>
  );
}
