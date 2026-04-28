"use client";

import { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { api, getApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { getAdminRole } from "@/lib/auth";
import type { SurveyRound } from "@/types/survey-round";

const fetcher = (url: string) => api.get(url).then(r => r.data);

interface RoundStats {
  total: number;
  by_type: Record<string, number>;
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: SurveyRound["status"] }) {
  if (status === "open")
    return (
      <span className="badge badge-success gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
        กำลังเปิด
      </span>
    );
  if (status === "cancelled")
    return <span className="badge badge-warning">ยกเลิกแล้ว</span>;
  return <span className="badge badge-ghost">ปิดแล้ว</span>;
}

// ─── Stats chip ───────────────────────────────────────────────────────────────
function StatsChip({ roundId }: { roundId: string }) {
  const { data } = useSWR<RoundStats>(`/survey-rounds/${roundId}/stats`, fetcher);
  if (!data) return <span className="text-base-content/30 text-xs">—</span>;
  if (data.total === 0) return <span className="text-base-content/40 text-xs">ยังไม่มีข้อมูล</span>;
  return (
    <div className="flex flex-wrap gap-1">
      <span className="badge badge-outline badge-xs">{data.total} รายการ</span>
      {Object.entries(data.by_type).map(([type, count]) => (
        <span key={type} className="badge badge-ghost badge-xs">{type} {count}</span>
      ))}
    </div>
  );
}

// ─── Modal: เปิดรอบใหม่ ───────────────────────────────────────────────────────
function OpenRoundModal({ onClose, onConfirm }: {
  onClose: () => void;
  onConfirm: (label: string, academic_year: string, term: number) => Promise<void>;
}) {
  const today = new Date();
  const defaultYear = String(today.getFullYear() + 543);
  const defaultTerm = today.getMonth() + 1 >= 5 ? 1 : 2;
  const [label, setLabel] = useState(`ภาคเรียน ${defaultTerm}/${defaultYear}`);
  const [year, setYear] = useState(defaultYear);
  const [term, setTerm] = useState(defaultTerm);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try { await onConfirm(label, year, term); }
    finally { setLoading(false); }
  };

  return (
    <dialog open className="modal modal-open">
      <div className="modal-box max-w-sm">
        <h3 className="font-bold text-lg mb-4">เปิดรอบการสำรวจใหม่</h3>
        <div className="space-y-3">
          <label className="form-control">
            <span className="label-text text-sm mb-1">ชื่อรอบ</span>
            <input className="input input-bordered input-sm" value={label}
              onChange={e => setLabel(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="form-control">
              <span className="label-text text-sm mb-1">ปีการศึกษา (พ.ศ.)</span>
              <input className="input input-bordered input-sm" value={year}
                onChange={e => setYear(e.target.value)} />
            </label>
            <label className="form-control">
              <span className="label-text text-sm mb-1">ภาคเรียน</span>
              <select className="select select-bordered select-sm" value={term}
                onChange={e => setTerm(Number(e.target.value))}>
                <option value={1}>ภาคเรียน 1</option>
                <option value={2}>ภาคเรียน 2</option>
              </select>
            </label>
          </div>
        </div>
        <div className="modal-action mt-5">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-success btn-sm" onClick={handleSubmit}
            disabled={loading || !label.trim()}>
            {loading && <span className="loading loading-spinner loading-xs" />}
            เปิดการสำรวจ
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
}

// ─── Modal: ยกเลิกรอบ (soft) ──────────────────────────────────────────────────
function CancelRoundModal({ round, stats, onClose, onConfirm }: {
  round: SurveyRound;
  stats: RoundStats | undefined;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const handleConfirm = async () => {
    setLoading(true);
    try { await onConfirm(); }
    finally { setLoading(false); }
  };

  return (
    <dialog open className="modal modal-open">
      <div className="modal-box max-w-md">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-warning/15 flex items-center justify-center text-3xl">
            ⏸
          </div>
        </div>
        <h3 className="font-bold text-xl text-center mb-1">ยกเลิกรอบการสำรวจ</h3>
        <p className="text-center text-base-content/50 text-sm mb-5">รอบจะถูก mark ว่ายกเลิก ข้อมูลยังคงอยู่ในระบบ</p>

        <div className="bg-base-200 rounded-xl p-4 space-y-1 mb-4">
          <p className="font-semibold">{round.label}</p>
          <p className="text-xs text-base-content/50">ปีการศึกษา {round.academic_year} · ภาคเรียน {round.term}</p>
          {stats && stats.total > 0 && (
            <p className="text-xs text-base-content/60 mt-1">
              มีข้อมูล <strong>{stats.total} รายการ</strong> ที่จะยังคงอยู่ในระบบ (ไม่ถูกลบ)
            </p>
          )}
        </div>

        <div className="space-y-2 mb-5 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-success mt-0.5">✓</span>
            <span className="text-base-content/70">ข้อมูล assessment ทั้งหมดในรอบนี้<strong>ยังคงอยู่</strong></span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-success mt-0.5">✓</span>
            <span className="text-base-content/70">การแจ้งเตือนและ alert ยังคงอยู่ครบ</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-warning mt-0.5">⚠</span>
            <span className="text-base-content/70">นักเรียน<strong>จะหยุดทำแบบประเมินได้ทันที</strong></span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-warning mt-0.5">⚠</span>
            <span className="text-base-content/70">รอบนี้จะ<strong>ไม่ถูกนับในรายงานปกติ</strong></span>
          </div>
        </div>

        <div className="flex gap-3">
          <button className="btn btn-ghost flex-1" onClick={onClose} disabled={loading}>ยกเลิก</button>
          <button className="btn btn-warning flex-1" onClick={handleConfirm} disabled={loading}>
            {loading ? <span className="loading loading-spinner loading-sm" /> : "ยืนยัน ยกเลิกรอบ"}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={!loading ? onClose : undefined} />
    </dialog>
  );
}

// ─── Modal: ลบรอบถาวร (hard) ─────────────────────────────────────────────────
function DeleteRoundModal({ round, stats, onClose, onConfirm }: {
  round: SurveyRound;
  stats: RoundStats | undefined;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const CONFIRM_WORD = "ลบถาวร";

  const handleConfirm = async () => {
    setLoading(true);
    try { await onConfirm(); }
    finally { setLoading(false); }
  };

  return (
    <dialog open className="modal modal-open">
      <div className="modal-box max-w-md">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-error/15 flex items-center justify-center text-3xl">
            🗑
          </div>
        </div>
        <h3 className="font-bold text-xl text-center mb-1 text-error">ลบรอบถาวร</h3>
        <p className="text-center text-base-content/50 text-sm mb-5">การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>

        <div className="bg-base-200 rounded-xl p-4 space-y-1 mb-4">
          <p className="font-semibold">{round.label}</p>
          <p className="text-xs text-base-content/50">ปีการศึกษา {round.academic_year} · ภาคเรียน {round.term}</p>
          {stats && stats.total > 0 && (
            <p className="text-xs text-error/80 mt-1 font-medium">
              จะลบ {stats.total} assessment ออกจากระบบถาวร
            </p>
          )}
        </div>

        <div className="space-y-2 mb-5 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-error mt-0.5">✕</span>
            <span className="text-base-content/70">ข้อมูล assessment ทั้งหมด<strong>จะถูกลบถาวร</strong></span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-success mt-0.5">✓</span>
            <span className="text-base-content/70">Alert และการแจ้งเตือน<strong>ยังคงอยู่</strong> (ข้อมูล safety)</span>
          </div>
        </div>

        <div className="form-control mb-5">
          <label className="label pb-1">
            <span className="label-text text-sm">พิมพ์ <strong className="text-error">{CONFIRM_WORD}</strong> เพื่อยืนยัน</span>
          </label>
          <input
            className="input input-bordered input-sm input-error"
            placeholder={CONFIRM_WORD}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
          />
        </div>

        <div className="flex gap-3">
          <button className="btn btn-ghost flex-1" onClick={onClose} disabled={loading}>ยกเลิก</button>
          <button
            className="btn btn-error flex-1"
            onClick={handleConfirm}
            disabled={loading || confirm !== CONFIRM_WORD}
          >
            {loading ? <span className="loading loading-spinner loading-sm" /> : "ลบถาวร"}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={!loading ? onClose : undefined} />
    </dialog>
  );
}

// ─── หน้าหลัก ─────────────────────────────────────────────────────────────────
export default function SurveyRoundsPage() {
  const { toast } = useToast();
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);

  useEffect(() => {
    setIsSystemAdmin(getAdminRole() === "systemadmin");
  }, []);

  const { data: rounds, isLoading } = useSWR<SurveyRound[]>("/survey-rounds", fetcher);
  const { data: statsMap } = useSWR<Record<string, RoundStats>>(
    rounds ? ["survey-rounds-stats", rounds.map(r => r.id).join(",")] : null,
    async () => {
      const entries = await Promise.all(
        (rounds ?? []).map(async r => {
          const data = await fetcher(`/survey-rounds/${r.id}/stats`);
          return [r.id, data] as [string, RoundStats];
        })
      );
      return Object.fromEntries(entries);
    }
  );

  const [showOpen, setShowOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<SurveyRound | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SurveyRound | null>(null);

  const revalidate = () => {
    mutate("/survey-rounds");
    mutate("/survey-rounds/current");
  };

  const handleOpen = async (label: string, academic_year: string, term: number) => {
    try {
      await api.post("/survey-rounds/open", { label, academic_year, term });
      revalidate();
      setShowOpen(false);
      toast("เปิดรอบการสำรวจสำเร็จ", "success");
    } catch (e) {
      toast(getApiError(e), "error");
    }
  };

  const handleClose = async (round: SurveyRound) => {
    try {
      await api.post(`/survey-rounds/${round.id}/close`);
      revalidate();
      toast(`ปิดรอบ "${round.label}" สำเร็จ`, "success");
    } catch (e) {
      toast(getApiError(e), "error");
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await api.post(`/survey-rounds/${cancelTarget.id}/cancel`);
      revalidate();
      setCancelTarget(null);
      toast(`ยกเลิกรอบ "${cancelTarget.label}" แล้ว`, "success");
    } catch (e) {
      toast(getApiError(e), "error");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await api.delete(`/survey-rounds/${deleteTarget.id}`);
      revalidate();
      setDeleteTarget(null);
      toast(
        `ลบรอบ "${deleteTarget.label}" สำเร็จ · ลบข้อมูล ${res.data.assessments_removed} รายการ`,
        "success"
      );
    } catch (e) {
      toast(getApiError(e), "error");
    }
  };

  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString("th-TH", {
          day: "numeric", month: "short", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        })
      : "—";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">รอบการสำรวจ</h1>
          <p className="text-sm text-base-content/50 mt-0.5">
            {isSystemAdmin
              ? "เปิด / ปิด / ยกเลิก หรือลบรอบการสำรวจ"
              : "รายการรอบการสำรวจในระบบ (ดูข้อมูลได้อย่างเดียว)"}
          </p>
        </div>
        {isSystemAdmin && (
          <button
            className="btn btn-success btn-sm gap-2"
            onClick={() => setShowOpen(true)}
            disabled={rounds?.some(r => r.status === "open")}
            title={rounds?.some(r => r.status === "open") ? "ปิดรอบปัจจุบันก่อน" : undefined}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none"
              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
            </svg>
            เปิดรอบใหม่
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card bg-base-100 shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="p-12 text-center">
            <span className="loading loading-spinner loading-md text-primary" />
          </div>
        ) : !rounds?.length ? (
          <div className="p-12 text-center text-base-content/40 text-sm">
            ยังไม่มีรอบการสำรวจ
          </div>
        ) : (
          <table className="table table-sm">
            <thead>
              <tr className="text-xs text-base-content/50 uppercase">
                <th>ชื่อรอบ</th>
                <th>ปีการศึกษา / ภาคเรียน</th>
                <th>สถานะ</th>
                <th>ข้อมูล assessment</th>
                <th>วันเปิด</th>
                <th>วันปิด / ยกเลิก</th>
                {isSystemAdmin && <th className="text-right">การดำเนินการ</th>}
              </tr>
            </thead>
            <tbody>
              {rounds.map(r => {
                const stats = statsMap?.[r.id];
                return (
                  <tr key={r.id} className="hover">
                    <td className="font-medium">{r.label}</td>
                    <td className="text-base-content/60">
                      {r.academic_year} · ภาค {r.term}
                    </td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>
                      {statsMap
                        ? stats
                          ? (
                            <div className="flex flex-wrap gap-1">
                              <span className="badge badge-outline badge-xs">{stats.total} รายการ</span>
                              {Object.entries(stats.by_type).map(([type, count]) => (
                                <span key={type} className="badge badge-ghost badge-xs">{type} {count}</span>
                              ))}
                            </div>
                          )
                          : <span className="text-base-content/30 text-xs">ยังไม่มีข้อมูล</span>
                        : <span className="loading loading-xs loading-dots" />
                      }
                    </td>
                    <td className="text-xs text-base-content/60">{fmt(r.opened_at)}</td>
                    <td className="text-xs text-base-content/60">
                      {r.cancelled_at ? fmt(r.cancelled_at) : fmt(r.closed_at)}
                    </td>
                    {isSystemAdmin && (
                      <td>
                        <div className="flex justify-end gap-1.5">
                          {r.status === "open" && (
                            <>
                              <button
                                className="btn btn-xs btn-outline"
                                onClick={() => handleClose(r)}
                              >
                                ปิดรอบ
                              </button>
                              <button
                                className="btn btn-xs btn-warning"
                                onClick={() => setCancelTarget(r)}
                              >
                                ยกเลิก
                              </button>
                            </>
                          )}
                          <button
                            className="btn btn-xs btn-error btn-outline"
                            onClick={() => setDeleteTarget(r)}
                          >
                            ลบถาวร
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Legend — เฉพาะ systemadmin */}
      {isSystemAdmin && (
        <div className="text-xs text-base-content/40 space-y-0.5 pl-1">
          <p><strong>ปิดรอบ</strong> — หยุดรับแบบประเมิน ข้อมูลยังอยู่ครบ นับในรายงาน</p>
          <p><strong>ยกเลิก</strong> — หยุดรับแบบประเมิน ข้อมูลยังอยู่ แต่ไม่นับในรายงาน</p>
          <p><strong>ลบถาวร</strong> — ลบ assessment ทั้งหมดในรอบออกจากระบบถาวร (Alert ยังคงอยู่)</p>
        </div>
      )}

      {/* Modals — เฉพาะ systemadmin */}
      {isSystemAdmin && showOpen && (
        <OpenRoundModal onClose={() => setShowOpen(false)} onConfirm={handleOpen} />
      )}
      {isSystemAdmin && cancelTarget && (
        <CancelRoundModal
          round={cancelTarget}
          stats={statsMap?.[cancelTarget.id]}
          onClose={() => setCancelTarget(null)}
          onConfirm={handleCancel}
        />
      )}
      {isSystemAdmin && deleteTarget && (
        <DeleteRoundModal
          round={deleteTarget}
          stats={statsMap?.[deleteTarget.id]}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
