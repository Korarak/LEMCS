"use client";

import { useState, useEffect } from "react";
import RoleGuard from "@/components/admin/RoleGuard";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { api, getApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { hasRole } from "@/lib/auth";

interface Affiliation { id: number; name: string; abbreviation?: string | null; }

function DangerZone() {
  const { toast: showToast } = useToast();
  const [affiliations, setAffiliations] = useState<Affiliation[]>([]);
  const [truncateAffId, setTruncateAffId] = useState<number | "">("");
  const [confirm, setConfirm] = useState(false);
  const [truncating, setTruncating] = useState(false);

  useEffect(() => {
    api.get("/admin/affiliations").then(r => setAffiliations(r.data)).catch(() => {});
  }, []);

  const doTruncate = async () => {
    if (!truncateAffId) return;
    setTruncating(true);
    setConfirm(false);
    try {
      const res = await api.delete(`/admin/students/by-affiliation/${truncateAffId}`);
      showToast(`ลบนักศึกษาของ "${res.data.affiliation_name}" สำเร็จ — ${res.data.deleted_students} คน`, "success");
      setTruncateAffId("");
    } catch (e: any) {
      showToast(getApiError(e), "error");
    } finally {
      setTruncating(false);
    }
  };

  const selectedAff = affiliations.find(a => a.id === truncateAffId);

  return (
    <>
      <div className="divider text-base-content/30 text-xs">โซนอันตราย</div>
      <div className="card bg-base-100 border-2 border-error/30 shadow-sm">
        <div className="card-body p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-error text-lg">🗑️</span>
            <div>
              <h2 className="font-bold text-error text-sm">ล้างข้อมูลนักศึกษาทั้งสังกัด</h2>
              <p className="text-xs text-base-content/50">ลบนักศึกษาและ account ทุกคนในทุกโรงเรียนของสังกัดที่เลือก — ใช้กรณี import ผิดทั้งสังกัด</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              className="select select-bordered select-sm select-error flex-1"
              value={truncateAffId}
              onChange={e => setTruncateAffId(Number(e.target.value) || "")}
            >
              <option value="">— เลือกสังกัด ({affiliations.length} สังกัด) —</option>
              {affiliations.map(a => (
                <option key={a.id} value={a.id}>{a.abbreviation ? `${a.abbreviation} — ${a.name}` : a.name}</option>
              ))}
            </select>
            <button
              className="btn btn-error btn-sm whitespace-nowrap"
              disabled={!truncateAffId || truncating}
              onClick={() => setConfirm(true)}
            >
              {truncating ? <span className="loading loading-spinner loading-xs" /> : "🗑️ ล้างทั้งสังกัด"}
            </button>
          </div>
          {truncateAffId && (
            <div className="alert alert-error py-2 text-xs">
              <span>⚠️ จะลบนักศึกษา <strong>ทุกคน</strong> ของสังกัด <strong>{selectedAff?.name}</strong> (ทุกโรงเรียนในสังกัด) — ไม่สามารถกู้คืนได้</span>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirm}
        title="⚠️ ล้างข้อมูลนักศึกษาทั้งสังกัด"
        message={`ต้องการลบนักศึกษาทั้งหมดของสังกัด "${selectedAff?.name}" ใช่หรือไม่?`}
        detail="จะลบนักศึกษาและ account ทุกคนในทุกโรงเรียนของสังกัดนี้ — ไม่สามารถย้อนกลับได้"
        confirmLabel="ยืนยัน ล้างทั้งสังกัด"
        confirmClass="btn-error"
        onConfirm={doTruncate}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}

function SettingsPageInner() {
  const isSuperAdmin = hasRole("superadmin", "systemadmin");

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">⚙️ ตั้งค่าระบบ</h1>
        <p className="text-base-content/60 text-sm">ข้อมูลระบบและเครื่องมือจัดการ</p>
      </div>

      {/* System Info */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title text-base">🖥️ ข้อมูลระบบ</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="text-base-content/60">ระบบ</div>
            <div className="font-medium">LEMCS — Loei Educational MindCare System</div>
            <div className="text-base-content/60">เวอร์ชัน</div>
            <div className="font-medium">1.0.0</div>
            <div className="text-base-content/60">ผู้ดูแลระบบ</div>
            <div className="font-medium">สำนักงานศึกษาธิการจังหวัดเลย</div>
            <div className="text-base-content/60">Framework</div>
            <div>Next.js 14 + FastAPI + PostgreSQL</div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title text-base">🔗 ลิงก์ด่วน</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "หน้าเข้าสู่ระบบนักเรียน", href: "/login",       icon: "👤" },
              { label: "หน้าเข้าสู่ระบบแอดมิน",  href: "/admin-login", icon: "🔐" },
            ].map(l => (
              <a key={l.href} href={l.href}
                className="btn btn-outline btn-sm justify-start gap-2">
                {l.icon} {l.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {isSuperAdmin && <DangerZone />}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RoleGuard roles={["systemadmin", "superadmin"]}>
      <SettingsPageInner />
    </RoleGuard>
  );
}
