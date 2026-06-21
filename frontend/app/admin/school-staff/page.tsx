"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, getApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import RoleGuard from "@/components/admin/RoleGuard";

const fetcher = (url: string) => api.get(url).then(r => r.data);

interface StaffUser {
  id: string;
  username: string;
  role: string;
  role_label: string;
  is_active: boolean;
  last_login: string | null;
}

const ROLE_OPTIONS = [
  { value: "schooldirector", label: "ผู้อำนวยการ" },
  { value: "schoolteacher",  label: "ครู" },
];

const ROLE_BADGE: Record<string, string> = {
  schooldirector: "badge-primary",
  schoolteacher:  "badge-secondary",
};

const ROLE_PERMISSIONS: Record<string, string[]> = {
  schooldirector: ["ดูผลการประเมิน", "ดูการแจ้งเตือน", "ดูรายงาน", "ดูรายชื่อนักเรียน", "กรอกแบบประเมินแทนนักเรียน"],
  schoolteacher:  ["กรอกแบบประเมินแทนนักเรียนเท่านั้น"],
};

const EMPTY_FORM = { username: "", password: "", role: "schoolteacher" };

function SchoolStaffPageInner() {
  const { toast } = useToast();
  const { data: staff = [], isLoading, mutate } = useSWR<StaffUser[]>("/admin/school-staff", fetcher);

  const [modal, setModal] = useState<"add" | "edit" | "reset" | null>(null);
  const [target, setTarget] = useState<StaffUser | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [resetPw, setResetPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StaffUser | null>(null);

  function openAdd() {
    setForm({ ...EMPTY_FORM });
    setShowPw(false);
    setModal("add");
  }

  function openEdit(u: StaffUser) {
    setTarget(u);
    setForm({ username: u.username, password: "", role: u.role });
    setModal("edit");
  }

  function openReset(u: StaffUser) {
    setTarget(u);
    setResetPw("");
    setShowPw(false);
    setModal("reset");
  }

  async function handleAdd() {
    if (!form.username.trim()) return toast("กรุณาระบุชื่อผู้ใช้", "error");
    if (!form.password) return toast("กรุณาระบุรหัสผ่าน", "error");
    setSaving(true);
    try {
      await api.post("/admin/school-staff", {
        username: form.username.trim(),
        password: form.password,
        role: form.role,
      });
      await mutate();
      setModal(null);
      toast("เพิ่มผู้ใช้งานสำเร็จ", "success");
    } catch (e) {
      toast(getApiError(e), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit() {
    if (!target) return;
    setSaving(true);
    try {
      await api.put(`/admin/school-staff/${target.id}`, { role: form.role });
      await mutate();
      setModal(null);
      toast("อัปเดตสำเร็จ", "success");
    } catch (e) {
      toast(getApiError(e), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!target || !resetPw) return toast("กรุณาระบุรหัสผ่านใหม่", "error");
    setSaving(true);
    try {
      await api.post(`/admin/school-staff/${target.id}/reset-password`, { new_password: resetPw });
      setModal(null);
      toast("รีเซ็ตรหัสผ่านสำเร็จ", "success");
    } catch (e) {
      toast(getApiError(e), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(u: StaffUser) {
    try {
      await api.delete(`/admin/school-staff/${u.id}`);
      await mutate();
      toast(u.is_active ? "ปิดการใช้งานแล้ว" : "เปิดการใช้งานแล้ว", "success");
    } catch (e) {
      toast(getApiError(e), "error");
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ผู้ใช้งานโรงเรียน</h1>
          <p className="text-sm text-base-content/60 mt-1">จัดการบัญชีครูและผู้อำนวยการในโรงเรียนของคุณ</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ เพิ่มผู้ใช้</button>
      </div>

      {/* Permission reference */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ROLE_OPTIONS.map(r => (
          <div key={r.value} className="card bg-base-100 border border-base-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={`badge ${ROLE_BADGE[r.value]}`}>{r.label}</span>
            </div>
            <ul className="text-xs text-base-content/70 space-y-0.5">
              {ROLE_PERMISSIONS[r.value].map(p => (
                <li key={p} className="flex items-center gap-1.5">
                  <span className="text-success">✓</span>{p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Staff table */}
      <div className="card bg-base-100 border border-base-200">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <span className="loading loading-spinner loading-md" />
          </div>
        ) : staff.length === 0 ? (
          <div className="text-center py-12 text-base-content/50">
            <p className="text-3xl mb-2">👥</p>
            <p>ยังไม่มีผู้ใช้งาน — กดปุ่ม &ldquo;เพิ่มผู้ใช้&rdquo; เพื่อเริ่มต้น</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>ชื่อผู้ใช้</th>
                  <th>ประเภท</th>
                  <th>สถานะ</th>
                  <th>เข้าใช้งานล่าสุด</th>
                  <th className="text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(u => (
                  <tr key={u.id} className={!u.is_active ? "opacity-50" : ""}>
                    <td className="font-medium">{u.username}</td>
                    <td>
                      <span className={`badge badge-sm ${ROLE_BADGE[u.role] ?? "badge-neutral"}`}>
                        {u.role_label}
                      </span>
                    </td>
                    <td>
                      {u.is_active
                        ? <span className="badge badge-sm badge-success">ใช้งาน</span>
                        : <span className="badge badge-sm badge-ghost">ปิดใช้งาน</span>
                      }
                    </td>
                    <td className="text-xs text-base-content/50">
                      {u.last_login
                        ? new Date(u.last_login).toLocaleString("th-TH")
                        : "ยังไม่เคย"}
                    </td>
                    <td>
                      <div className="flex gap-1 justify-end">
                        <button className="btn btn-xs btn-ghost" onClick={() => openEdit(u)}>แก้ไข</button>
                        <button className="btn btn-xs btn-ghost" onClick={() => openReset(u)}>รหัสผ่าน</button>
                        <button
                          className={`btn btn-xs ${u.is_active ? "btn-error btn-outline" : "btn-success btn-outline"}`}
                          onClick={() => setDeleteTarget(u)}
                        >
                          {u.is_active ? "ปิด" : "เปิด"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add modal */}
      {modal === "add" && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-lg mb-4">เพิ่มผู้ใช้งาน</h3>
            <div className="space-y-3">
              <label className="form-control">
                <span className="label-text text-sm font-medium mb-1 block">ประเภท</span>
                <select
                  className="select select-bordered w-full"
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                >
                  {ROLE_OPTIONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <p className="text-xs text-base-content/50 mt-1">
                  {ROLE_PERMISSIONS[form.role]?.[0]}
                </p>
              </label>
              <label className="form-control">
                <span className="label-text text-sm font-medium mb-1 block">ชื่อผู้ใช้</span>
                <input
                  className="input input-bordered w-full"
                  placeholder="เช่น teacher_napa"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                />
              </label>
              <label className="form-control">
                <span className="label-text text-sm font-medium mb-1 block">รหัสผ่าน</span>
                <div className="relative">
                  <input
                    className="input input-bordered w-full pr-10"
                    type={showPw ? "text" : "password"}
                    placeholder="รหัสผ่านเริ่มต้น"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content"
                    onClick={() => setShowPw(s => !s)}
                  >
                    {showPw ? "🙈" : "👁️"}
                  </button>
                </div>
              </label>
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>ยกเลิก</button>
              <button className="btn btn-primary" disabled={saving} onClick={handleAdd}>
                {saving ? <span className="loading loading-spinner loading-xs" /> : "เพิ่ม"}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setModal(null)} />
        </dialog>
      )}

      {/* Edit modal */}
      {modal === "edit" && target && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-lg mb-4">แก้ไขผู้ใช้: {target.username}</h3>
            <label className="form-control">
              <span className="label-text text-sm font-medium mb-1 block">ประเภท</span>
              <select
                className="select select-bordered w-full"
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              >
                {ROLE_OPTIONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </label>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>ยกเลิก</button>
              <button className="btn btn-primary" disabled={saving} onClick={handleEdit}>
                {saving ? <span className="loading loading-spinner loading-xs" /> : "บันทึก"}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setModal(null)} />
        </dialog>
      )}

      {/* Reset password modal */}
      {modal === "reset" && target && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-lg mb-4">รีเซ็ตรหัสผ่าน: {target.username}</h3>
            <div className="relative">
              <input
                className="input input-bordered w-full pr-10"
                type={showPw ? "text" : "password"}
                placeholder="รหัสผ่านใหม่"
                value={resetPw}
                onChange={e => setResetPw(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content"
                onClick={() => setShowPw(s => !s)}
              >
                {showPw ? "🙈" : "👁️"}
              </button>
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>ยกเลิก</button>
              <button className="btn btn-warning" disabled={saving} onClick={handleReset}>
                {saving ? <span className="loading loading-spinner loading-xs" /> : "รีเซ็ต"}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setModal(null)} />
        </dialog>
      )}

      {/* Toggle active confirm */}
      <ConfirmModal
        open={!!deleteTarget}
        title={deleteTarget?.is_active ? "ปิดการใช้งาน" : "เปิดการใช้งาน"}
        message={
          deleteTarget?.is_active
            ? `ต้องการปิดการใช้งานบัญชี "${deleteTarget?.username}" ใช่หรือไม่?`
            : `ต้องการเปิดการใช้งานบัญชี "${deleteTarget?.username}" ใช่หรือไม่?`
        }
        confirmLabel={deleteTarget?.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
        confirmClass={deleteTarget?.is_active ? "btn-error" : "btn-success"}
        onConfirm={async () => {
          if (deleteTarget) await handleToggle(deleteTarget);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default function SchoolStaffPage() {
  return (
    <RoleGuard roles={["schooladmin"]}>
      <SchoolStaffPageInner />
    </RoleGuard>
  );
}
