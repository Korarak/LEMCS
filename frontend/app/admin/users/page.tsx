"use client";

import { useState, useMemo } from "react";
import useSWR, { mutate } from "swr";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

const fetcher = (url: string) => api.get(url).then(r => r.data);

interface AdminUser {
  id: string;
  username: string;
  role: string;
  school_id: number | null;
  affiliation_id: number | null;
  district_id: number | null;
  is_active: boolean;
  last_login: string | null;
}

const ALL_ROLES = ["systemadmin", "superadmin", "commissionadmin", "schooladmin"];

const ROLE_LABELS: Record<string, string> = {
  systemadmin:     "System Admin",
  superadmin:      "ศึกษาธิการจังหวัด",
  commissionadmin: "แอดมินเขต/สังกัด",
  schooladmin:     "แอดมินโรงเรียน",
};

const ROLE_BADGE: Record<string, string> = {
  systemadmin:     "badge-error",
  superadmin:      "badge-warning",
  commissionadmin: "badge-info",
  schooladmin:     "badge-success",
};

const ROLE_SCOPE_NOTE: Record<string, string> = {
  systemadmin:     "เข้าถึงได้ทุกข้อมูลในระบบ",
  superadmin:      "ดูข้อมูลทั้งจังหวัด",
  commissionadmin: "ต้องผูกสังกัด + เขตพื้นที่",
  schooladmin:     "ต้องผูกโรงเรียน",
};

const EMPTY_FORM = {
  username: "", password: "", role: "schooladmin",
  school_id: "", affiliation_id: "", district_id: "",
};

// ── Cascading school selector ──────────────────────────────────────────────
function SchoolSelector({
  value, onChange, affiliations, allDistricts,
}: {
  value: string;
  onChange: (id: string) => void;
  affiliations: any[];
  allDistricts: any[];
}) {
  const [helperAff,  setHelperAff]  = useState("");
  const [helperDist, setHelperDist] = useState("");

  const filteredDistricts = useMemo(
    () => helperAff ? allDistricts.filter((d: any) => String(d.affiliation_id) === helperAff) : [],
    [helperAff, allDistricts],
  );

  const { data: schools } = useSWR(
    helperDist ? `/admin/schools?district_id=${helperDist}` : null,
    fetcher,
  );

  return (
    <div className="space-y-2">
      <div>
        <label className="label py-0.5">
          <span className="label-text text-xs text-base-content/60">① เลือกสังกัด</span>
        </label>
        <select
          className="select select-bordered select-sm w-full"
          value={helperAff}
          onChange={e => { setHelperAff(e.target.value); setHelperDist(""); onChange(""); }}
        >
          <option value="">— เลือกสังกัด —</option>
          {affiliations.map((a: any) => (
            <option key={a.id} value={String(a.id)}>{a.name}</option>
          ))}
        </select>
      </div>

      {helperAff && (
        <div>
          <label className="label py-0.5">
            <span className="label-text text-xs text-base-content/60">② เลือกเขตพื้นที่</span>
          </label>
          <select
            className="select select-bordered select-sm w-full"
            value={helperDist}
            onChange={e => { setHelperDist(e.target.value); onChange(""); }}
          >
            <option value="">— เลือกเขตพื้นที่ —</option>
            {filteredDistricts.map((d: any) => (
              <option key={d.id} value={String(d.id)}>{d.name}</option>
            ))}
          </select>
        </div>
      )}

      {helperDist && (
        <div>
          <label className="label py-0.5">
            <span className="label-text text-xs text-base-content/60">③ เลือกโรงเรียน</span>
          </label>
          {!schools ? (
            <div className="flex items-center gap-2 px-2 py-2 text-sm text-base-content/50">
              <span className="loading loading-spinner loading-xs" /> กำลังโหลด…
            </div>
          ) : schools.length === 0 ? (
            <p className="text-sm text-base-content/50 px-2">ไม่พบโรงเรียนในเขตนี้</p>
          ) : (
            <select
              className={`select select-bordered select-sm w-full ${!value ? "select-warning" : "select-success"}`}
              value={value}
              onChange={e => onChange(e.target.value)}
            >
              <option value="">— เลือกโรงเรียน ({schools.length} แห่ง) —</option>
              {schools.map((s: any) => (
                <option key={s.id} value={String(s.id)}>{s.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {value && schools && (
        <div className="flex items-center gap-2 px-3 py-2 bg-success/10 border border-success/30 rounded-lg text-sm">
          <span className="text-success">✓</span>
          <span className="font-medium">{schools.find((s: any) => String(s.id) === value)?.name}</span>
        </div>
      )}
    </div>
  );
}

// ── Cascading district selector ────────────────────────────────────────────
function DistrictSelector({
  affValue, distValue,
  onAffChange, onDistChange,
  affiliations, allDistricts,
}: {
  affValue: string; distValue: string;
  onAffChange: (id: string) => void; onDistChange: (id: string) => void;
  affiliations: any[]; allDistricts: any[];
}) {
  const filteredDistricts = useMemo(
    () => affValue ? allDistricts.filter((d: any) => String(d.affiliation_id) === affValue) : [],
    [affValue, allDistricts],
  );

  return (
    <div className="space-y-2">
      <div>
        <label className="label py-0.5">
          <span className="label-text text-xs text-base-content/60">① เลือกสังกัด</span>
        </label>
        <select
          className="select select-bordered select-sm w-full"
          value={affValue}
          onChange={e => { onAffChange(e.target.value); onDistChange(""); }}
        >
          <option value="">— เลือกสังกัด —</option>
          {affiliations.map((a: any) => (
            <option key={a.id} value={String(a.id)}>{a.name}</option>
          ))}
        </select>
      </div>

      {affValue && (
        <div>
          <label className="label py-0.5">
            <span className="label-text text-xs text-base-content/60">② เลือกเขตพื้นที่</span>
          </label>
          <select
            className={`select select-bordered select-sm w-full ${!distValue ? "select-warning" : "select-success"}`}
            value={distValue}
            onChange={e => onDistChange(e.target.value)}
          >
            <option value="">— เลือกเขตพื้นที่ —</option>
            {filteredDistricts.map((d: any) => (
              <option key={d.id} value={String(d.id)}>{d.name}</option>
            ))}
          </select>
        </div>
      )}

      {distValue && (
        <div className="flex items-center gap-2 px-3 py-2 bg-success/10 border border-success/30 rounded-lg text-sm">
          <span className="text-success">✓</span>
          <span className="font-medium">
            {filteredDistricts.find((d: any) => String(d.id) === distValue)?.name}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function UsersPage() {
  const { toast } = useToast();

  const { data: me } = useSWR<AdminUser>("/admin/me", fetcher);
  const isSuperadmin = me?.role === "superadmin";
  // superadmin ไม่สามารถจัดการ systemadmin ได้
  const ROLES = isSuperadmin
    ? ALL_ROLES.filter(r => r !== "systemadmin")
    : ALL_ROLES;

  const { data: users, isLoading } = useSWR<AdminUser[]>("/admin/users", fetcher);
  const { data: schools      = [] } = useSWR("/admin/schools",       fetcher);
  const { data: districts    = [] } = useSWR("/admin/districts",     fetcher);
  const { data: affiliations = [] } = useSWR("/admin/affiliations",  fetcher);

  const [modal,      setModal]     = useState<"add" | "edit" | "reset" | null>(null);
  const [target,     setTarget]    = useState<AdminUser | null>(null);
  const [form,       setForm]      = useState({ ...EMPTY_FORM });
  const [resetPw,    setResetPw]   = useState("");
  const [showPw,     setShowPw]    = useState(false);
  const [saving,     setSaving]    = useState(false);
  const [filterRole, setFilterRole] = useState("");
  const [search,     setSearch]    = useState("");

  // Confirm modal state
  const [confirm, setConfirm] = useState<{
    open: boolean;
    title: string;
    message: string;
    detail?: string;
    confirmLabel: string;
    confirmClass: string;
    action: () => Promise<void>;
  }>({
    open: false, title: "", message: "", confirmLabel: "ยืนยัน",
    confirmClass: "btn-error", action: async () => {},
  });
  const [confirming, setConfirming] = useState(false);

  const closeConfirm = () => setConfirm(prev => ({ ...prev, open: false }));

  const runConfirm = async () => {
    setConfirming(true);
    try {
      await confirm.action();
    } finally {
      setConfirming(false);
      closeConfirm();
    }
  };

  // Lookup helpers
  const schoolMap      = useMemo(() => new Map<number, string>(schools.map((s: any)      => [s.id, s.name as string])),      [schools]);
  const districtMap    = useMemo(() => new Map<number, string>(districts.map((d: any)    => [d.id, d.name as string])),    [districts]);
  const affiliationMap = useMemo(() => new Map<number, string>(affiliations.map((a: any) => [a.id, a.name as string])), [affiliations]);

  const resolveOrg = (u: AdminUser) => {
    if (u.role === "schooladmin"     && u.school_id)      return { label: schoolMap.get(u.school_id)           || `รร.#${u.school_id}`,       icon: "🏫" };
    if (u.role === "commissionadmin" && u.district_id)    return { label: districtMap.get(u.district_id)       || `เขต#${u.district_id}`,     icon: "🏢" };
    if (u.role === "commissionadmin" && u.affiliation_id) return { label: affiliationMap.get(u.affiliation_id) || `สังกัด#${u.affiliation_id}`, icon: "🏛️" };
    if (["superadmin", "systemadmin"].includes(u.role))  return { label: "ทุกสถานศึกษา", icon: "🌐" };
    return { label: "—", icon: "" };
  };

  // ── Open modals ──────────────────────────────────────────────────────────
  const openAdd = () => {
    setTarget(null);
    setForm({ ...EMPTY_FORM });
    setShowPw(false);
    setModal("add");
  };

  const openEdit = (u: AdminUser) => {
    setTarget(u);
    setForm({
      username:       u.username,
      password:       "",
      role:           u.role,
      school_id:      u.school_id?.toString()      || "",
      affiliation_id: u.affiliation_id?.toString() || "",
      district_id:    u.district_id?.toString()    || "",
    });
    setModal("edit");
  };

  const openReset = (u: AdminUser) => {
    setTarget(u);
    setResetPw("");
    setShowPw(false);
    setModal("reset");
  };

  // ── Save (add / edit) ────────────────────────────────────────────────────
  const handleSave = async () => {
    if (modal === "add" && (!form.username.trim() || !form.password)) {
      toast("กรุณากรอก Username และ Password", "error"); return;
    }
    if (form.role === "schooladmin" && !form.school_id) {
      toast("กรุณาเลือกโรงเรียน", "error"); return;
    }
    if (form.role === "commissionadmin" && !form.district_id) {
      toast("กรุณาเลือกเขตพื้นที่", "error"); return;
    }

    setSaving(true);
    try {
      const body = {
        ...form,
        school_id:      form.school_id      ? Number(form.school_id)      : null,
        affiliation_id: form.affiliation_id ? Number(form.affiliation_id) : null,
        district_id:    form.district_id    ? Number(form.district_id)    : null,
      };
      if (modal === "add") {
        await api.post("/admin/users", body);
        toast(`เพิ่มผู้ใช้ "${form.username}" สำเร็จ`, "success");
      } else if (modal === "edit" && target) {
        const { username, password, ...rest } = body;
        await api.put(`/admin/users/${target.id}`, rest);
        toast(`อัปเดตข้อมูล "${target.username}" สำเร็จ`, "success");
      }
      setModal(null);
      mutate("/admin/users");
    } catch (e: any) {
      toast(e?.response?.data?.detail || "เกิดข้อผิดพลาด กรุณาลองใหม่", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Reset password ───────────────────────────────────────────────────────
  const handleResetValidate = () => {
    if (!resetPw || resetPw.length < 8) {
      toast("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร", "error"); return;
    }
    setConfirm({
      open: true,
      title: "ยืนยันรีเซ็ตรหัสผ่าน",
      message: `รีเซ็ตรหัสผ่านของ "${target?.username}" — ผู้ใช้จะต้องเข้าสู่ระบบด้วยรหัสผ่านใหม่ทันที`,
      detail: undefined,
      confirmLabel: "รีเซ็ตรหัสผ่าน",
      confirmClass: "btn-warning",
      action: async () => {
        await api.post(`/admin/users/${target!.id}/reset-password`, { new_password: resetPw });
        setModal(null);
        toast(`รีเซ็ตรหัสผ่านของ "${target?.username}" สำเร็จ`, "success");
      },
    });
  };

  // ── Toggle active ────────────────────────────────────────────────────────
  const handleToggle = (u: AdminUser) => {
    const action = u.is_active ? "ปิด" : "เปิด";
    setConfirm({
      open: true,
      title: `${action}การใช้งานบัญชี`,
      message: u.is_active
        ? `ปิดบัญชี "${u.username}" — ผู้ใช้จะไม่สามารถเข้าสู่ระบบได้ทันที`
        : `เปิดบัญชี "${u.username}" — ผู้ใช้จะสามารถเข้าสู่ระบบได้อีกครั้ง`,
      detail: `Role: ${ROLE_LABELS[u.role] || u.role}`,
      confirmLabel: `${action}บัญชี`,
      confirmClass: u.is_active ? "btn-error" : "btn-success",
      action: async () => {
        await api.delete(`/admin/users/${u.id}`);
        mutate("/admin/users");
        toast(`${action}บัญชี "${u.username}" สำเร็จ`, u.is_active ? "warning" : "success");
      },
    });
  };

  // ── Delete confirmation (future-proofing via separate confirm flow) ───────
  const handleDeleteConfirm = (u: AdminUser) => {
    setConfirm({
      open: true,
      title: "ลบผู้ใช้งาน",
      message: `ลบบัญชี "${u.username}" ออกจากระบบถาวร — การดำเนินการนี้ไม่สามารถย้อนกลับได้`,
      detail: `Role: ${ROLE_LABELS[u.role] || u.role}`,
      confirmLabel: "ลบถาวร",
      confirmClass: "btn-error",
      action: async () => {
        await api.delete(`/admin/users/${u.id}/permanent`);
        mutate("/admin/users");
        toast(`ลบบัญชี "${u.username}" สำเร็จ`, "info");
      },
    });
  };

  // ── Filtered list ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = filterRole ? users?.filter(u => u.role === filterRole) : users;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list?.filter(u =>
        u.username.toLowerCase().includes(q) ||
        (u.school_id      && schoolMap.get(u.school_id)?.toLowerCase().includes(q)) ||
        (u.district_id    && districtMap.get(u.district_id)?.toLowerCase().includes(q)) ||
        (u.affiliation_id && affiliationMap.get(u.affiliation_id)?.toLowerCase().includes(q))
      );
    }
    return list || [];
  }, [users, filterRole, search, schoolMap, districtMap, affiliationMap]);

  const lastLoginLabel = (u: AdminUser) => {
    if (!u.last_login) return null;
    return new Date(u.last_login).toLocaleDateString("th-TH", {
      day: "numeric", month: "short", year: "numeric",
    });
  };

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">จัดการผู้ใช้งาน</h1>
          <p className="text-base-content/60 text-sm">เพิ่ม แก้ไข และกำหนดสิทธิ์ผู้ใช้งานระบบ LEMCS</p>
        </div>
        <button className="btn btn-primary btn-sm gap-1" onClick={openAdd}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          เพิ่มผู้ใช้
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="join flex-wrap">
          {["", ...ROLES].map(r => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              className={`join-item btn btn-xs ${filterRole === r ? "btn-primary" : "btn-ghost border border-base-300"}`}
            >
              {r === "" ? "ทั้งหมด" : ROLE_LABELS[r]}
              {r !== "" && (
                <span className="badge badge-xs ml-1 opacity-60">
                  {users?.filter(u => u.role === r).length ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>
        <input
          type="search"
          className="input input-bordered input-xs flex-1 max-w-xs"
          placeholder="ค้นหา username / โรงเรียน / เขต…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* ── Summary badges ── */}
      <div className="flex flex-wrap gap-2">
        {ROLES.map(r => {
          const count = users?.filter(u => u.role === r && u.is_active).length ?? 0;
          return (
            <div key={r} className={`badge gap-1 ${ROLE_BADGE[r]} badge-outline`}>
              <span className="font-semibold">{count}</span>
              <span className="opacity-80 text-xs">{ROLE_LABELS[r]}</span>
            </div>
          );
        })}
        <div className="badge badge-ghost badge-outline gap-1">
          <span className="font-semibold">{users?.filter(u => !u.is_active).length ?? 0}</span>
          <span className="opacity-80 text-xs">ปิดการใช้งาน</span>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="card bg-base-100 shadow overflow-x-auto">
        <table className="table table-zebra w-full text-sm">
          <thead>
            <tr className="bg-base-200/50 text-base-content/70">
              <th>Username</th>
              <th>Role</th>
              <th>สังกัดองค์กร</th>
              <th>เข้าใช้งานล่าสุด</th>
              <th>สถานะ</th>
              <th className="text-center w-32">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-16">
                  <span className="loading loading-spinner loading-md" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16 text-base-content/40">
                  {search ? "ไม่พบผู้ใช้ที่ค้นหา" : "ยังไม่มีผู้ใช้งาน"}
                </td>
              </tr>
            ) : filtered.map(u => {
              const org = resolveOrg(u);
              const ll  = lastLoginLabel(u);
              return (
                <tr key={u.id} className={`hover transition-opacity ${!u.is_active ? "opacity-40" : ""}`}>
                  <td>
                    <span className="font-mono font-semibold tracking-tight">{u.username}</span>
                  </td>
                  <td>
                    <span className={`badge badge-sm ${ROLE_BADGE[u.role] || "badge-ghost"}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td>
                    <span className="flex items-center gap-1.5 text-sm text-base-content/80">
                      <span>{org.icon}</span>
                      <span>{org.label}</span>
                    </span>
                  </td>
                  <td className="text-xs text-base-content/60 whitespace-nowrap">
                    {ll
                      ? ll
                      : <span className="italic text-base-content/30">ยังไม่เคย</span>
                    }
                  </td>
                  <td>
                    <span className={`badge badge-xs ${u.is_active ? "badge-success" : "badge-error"}`}>
                      {u.is_active ? "ใช้งาน" : "ปิด"}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1 justify-center">
                      {/* Edit */}
                      <div className="tooltip" data-tip="แก้ไขสิทธิ์">
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => openEdit(u)}
                        >
                          ✏️
                        </button>
                      </div>

                      {/* Reset password */}
                      <div className="tooltip" data-tip="รีเซ็ตรหัสผ่าน">
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => openReset(u)}
                        >
                          🔑
                        </button>
                      </div>

                      {/* Toggle active — sensitive action → confirm modal */}
                      <div className="tooltip" data-tip={u.is_active ? "ปิดบัญชี" : "เปิดบัญชี"}>
                        <button
                          className={`btn btn-ghost btn-xs ${u.is_active ? "text-error hover:bg-error/10" : "text-success hover:bg-success/10"}`}
                          onClick={() => handleToggle(u)}
                        >
                          {u.is_active ? "🚫" : "✅"}
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-4 py-2 text-xs text-base-content/40 border-t border-base-200">
          แสดง {filtered.length} / {users?.length ?? 0} รายการ
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          Add / Edit Modal
      ══════════════════════════════════════════════ */}
      {(modal === "add" || modal === "edit") && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-lg mb-0.5">
              {modal === "add" ? "เพิ่มผู้ใช้ใหม่" : `แก้ไข: ${target?.username}`}
            </h3>
            <p className="text-xs text-base-content/50 mb-5">
              {ROLE_SCOPE_NOTE[form.role]}
            </p>

            <div className="space-y-5">
              {/* Username + Password (add only) */}
              {modal === "add" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-sm font-medium">Username <span className="text-error">*</span></span>
                    </label>
                    <input
                      className="input input-bordered input-sm"
                      value={form.username}
                      onChange={e => setForm({ ...form, username: e.target.value })}
                      placeholder="เช่น school_loei"
                      autoComplete="off"
                      autoFocus
                    />
                  </div>
                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-sm font-medium">Password <span className="text-error">*</span></span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPw ? "text" : "password"}
                        className="input input-bordered input-sm w-full pr-9"
                        value={form.password}
                        onChange={e => setForm({ ...form, password: e.target.value })}
                        placeholder="≥ 8 ตัวอักษร"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content"
                        onClick={() => setShowPw(v => !v)}
                        tabIndex={-1}
                      >
                        {showPw ? "🙈" : "👁"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Role */}
              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text text-sm font-medium">Role <span className="text-error">*</span></span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map(r => (
                    <label
                      key={r}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                        form.role === r
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-base-300 hover:border-base-400"
                      }`}
                    >
                      <input
                        type="radio"
                        className="radio radio-primary radio-sm"
                        name="role"
                        value={r}
                        checked={form.role === r}
                        onChange={() => setForm({ ...form, role: r, school_id: "", affiliation_id: "", district_id: "" })}
                      />
                      <div>
                        <p className="text-sm font-medium leading-tight">{ROLE_LABELS[r]}</p>
                        <p className="text-xs text-base-content/50 leading-tight">{r}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Org assignment */}
              {form.role === "schooladmin" && (
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-sm font-medium">ผูกโรงเรียน <span className="text-error">*</span></span>
                    <span className="label-text-alt text-xs text-base-content/40">สังกัด → เขต → โรงเรียน</span>
                  </label>
                  <div className="bg-base-200/50 rounded-xl p-3">
                    <SchoolSelector
                      value={form.school_id}
                      onChange={id => setForm({ ...form, school_id: id })}
                      affiliations={affiliations}
                      allDistricts={districts}
                    />
                  </div>
                </div>
              )}

              {form.role === "commissionadmin" && (
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-sm font-medium">ผูกเขตพื้นที่ <span className="text-error">*</span></span>
                    <span className="label-text-alt text-xs text-base-content/40">สังกัด → เขต</span>
                  </label>
                  <div className="bg-base-200/50 rounded-xl p-3">
                    <DistrictSelector
                      affValue={form.affiliation_id}
                      distValue={form.district_id}
                      onAffChange={id => setForm({ ...form, affiliation_id: id, district_id: "" })}
                      onDistChange={id => setForm({ ...form, district_id: id })}
                      affiliations={affiliations}
                      allDistricts={districts}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="modal-action pt-3 border-t border-base-200 mt-5">
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)} disabled={saving}>
                ยกเลิก
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving
                  ? <span className="loading loading-spinner loading-xs" />
                  : modal === "add" ? "เพิ่มผู้ใช้" : "บันทึกการเปลี่ยนแปลง"
                }
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setModal(null)}>close</button>
          </form>
        </dialog>
      )}

      {/* ══════════════════════════════════════════════
          Reset Password Modal
      ══════════════════════════════════════════════ */}
      {modal === "reset" && target && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-lg mb-1">รีเซ็ตรหัสผ่าน</h3>
            <p className="text-sm text-base-content/60 mb-4">
              ผู้ใช้: <span className="font-mono font-bold text-base-content">{target.username}</span>
            </p>

            <div className="alert alert-warning text-xs mb-4 py-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              รหัสผ่านเดิมจะใช้ไม่ได้ทันทีหลังรีเซ็ต
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">รหัสผ่านใหม่ <span className="text-error">*</span></span>
                <span className="label-text-alt text-xs text-base-content/40">≥ 8 ตัวอักษร</span>
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  className="input input-bordered w-full pr-10"
                  value={resetPw}
                  onChange={e => setResetPw(e.target.value)}
                  placeholder="รหัสผ่านใหม่"
                  autoComplete="new-password"
                  autoFocus
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content"
                  onClick={() => setShowPw(v => !v)}
                  tabIndex={-1}
                >
                  {showPw ? "🙈" : "👁"}
                </button>
              </div>
              {resetPw.length > 0 && resetPw.length < 8 && (
                <label className="label py-0.5">
                  <span className="label-text-alt text-error text-xs">ต้องมีอย่างน้อย 8 ตัวอักษร</span>
                </label>
              )}
            </div>

            <div className="modal-action border-t border-base-200 mt-5 pt-3">
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>ยกเลิก</button>
              <button
                className="btn btn-warning btn-sm"
                onClick={handleResetValidate}
                disabled={!resetPw || resetPw.length < 8}
              >
                ดำเนินการรีเซ็ต
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setModal(null)}>close</button>
          </form>
        </dialog>
      )}

      {/* ══════════════════════════════════════════════
          Confirm Modal (shared for all sensitive actions)
      ══════════════════════════════════════════════ */}
      <ConfirmModal
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        detail={confirm.detail}
        confirmLabel={confirm.confirmLabel}
        confirmClass={confirm.confirmClass}
        loading={confirming}
        onConfirm={runConfirm}
        onCancel={closeConfirm}
      />
    </div>
  );
}
