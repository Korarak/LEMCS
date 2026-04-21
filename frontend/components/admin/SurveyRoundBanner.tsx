"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR, { mutate } from "swr";
import { api } from "@/lib/api";

const fetcher = (url: string) => api.get(url).then(r => r.data);

interface SurveyRound {
  id: string;
  label: string;
  academic_year: string;
  term: number;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
}

// ─── Modal: เปิดรอบ ──────────────────────────────────────────────────────────
function OpenRoundModal({
  onClose,
  onConfirm,
}: {
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

// ─── Modal: ปิดรอบ ────────────────────────────────────────────────────────────
function CloseRoundModal({
  round,
  onClose,
  onConfirm,
}: {
  round: SurveyRound;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  const openedAt = new Date(round.opened_at).toLocaleDateString("th-TH", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const handleConfirm = async () => {
    setLoading(true);
    try { await onConfirm(); }
    finally { setLoading(false); }
  };

  return (
    <dialog open className="modal modal-open">
      <div className="modal-box max-w-md">

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-error" fill="none"
              viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h3 className="font-bold text-xl text-center mb-1">ปิดรอบการสำรวจ</h3>
        <p className="text-center text-base-content/50 text-sm mb-5">
          การดำเนินการนี้ไม่สามารถย้อนกลับได้
        </p>

        {/* Round info card */}
        <div className="bg-base-200 rounded-xl p-4 space-y-2 mb-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-base-content/60">รอบที่กำลังจะปิด</span>
            <span className="badge badge-error badge-sm gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              กำลังเปิดอยู่
            </span>
          </div>
          <p className="font-bold text-base">{round.label}</p>
          <p className="text-xs text-base-content/50">
            ปีการศึกษา {round.academic_year} · ภาคเรียน {round.term}
          </p>
          <p className="text-xs text-base-content/40">เปิดเมื่อ {openedAt}</p>
        </div>

        {/* Consequences */}
        <div className="space-y-2 mb-6">
          <p className="text-sm font-medium text-base-content/70">ผลที่จะเกิดขึ้น:</p>
          <div className="flex items-start gap-2 text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-success mt-0.5 flex-shrink-0"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span className="text-base-content/70">
              ข้อมูลทั้งหมดในรอบนี้จะถูก<strong>บันทึกถาวร</strong>สำหรับดูย้อนหลัง
            </span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-warning mt-0.5 flex-shrink-0"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span className="text-base-content/70">
              นักเรียน<strong>จะไม่สามารถทำแบบประเมินได้</strong>จนกว่าจะเปิดรอบใหม่
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button className="btn btn-ghost flex-1" onClick={onClose} disabled={loading}>
            ยกเลิก
          </button>
          <button
            className="btn btn-error flex-1 gap-2"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading
              ? <span className="loading loading-spinner loading-sm" />
              : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
                </svg>
              )}
            ยืนยัน ปิดการสำรวจ
          </button>
        </div>

      </div>
      <div className="modal-backdrop" onClick={!loading ? onClose : undefined} />
    </dialog>
  );
}

// ─── Banner หลัก ──────────────────────────────────────────────────────────────
export default function SurveyRoundBanner() {
  const { data: current, isLoading } = useSWR<SurveyRound | null>(
    "/survey-rounds/current", fetcher, { refreshInterval: 30000 }
  );
  const { data: rounds } = useSWR<SurveyRound[]>("/survey-rounds", fetcher);

  const [showOpenModal, setShowOpenModal]   = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = async (label: string, academic_year: string, term: number) => {
    setError(null);
    try {
      await api.post("/survey-rounds/open", { label, academic_year, term });
      mutate("/survey-rounds/current");
      mutate("/survey-rounds");
      setShowOpenModal(false);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "เกิดข้อผิดพลาด");
    }
  };

  const handleClose = async () => {
    if (!current) return;
    setError(null);
    try {
      await api.post(`/survey-rounds/${current.id}/close`);
      mutate("/survey-rounds/current");
      mutate("/survey-rounds");
      setShowCloseModal(false);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "เกิดข้อผิดพลาด");
    }
  };

  if (isLoading) return null;

  const closedCount = rounds?.filter(r => r.status === "closed").length ?? 0;

  return (
    <>
      {showOpenModal && (
        <OpenRoundModal onClose={() => setShowOpenModal(false)} onConfirm={handleOpen} />
      )}
      {showCloseModal && current && (
        <CloseRoundModal
          round={current}
          onClose={() => setShowCloseModal(false)}
          onConfirm={handleClose}
        />
      )}

      <div className={`rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        current ? "bg-success/10 border-success/30" : "bg-warning/10 border-warning/30"
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            current ? "bg-success animate-pulse" : "bg-warning"
          }`} />
          <div>
            {current ? (
              <>
                <p className="text-sm font-semibold text-success">
                  กำลังสำรวจ: {current.label}
                </p>
                <p className="text-xs text-base-content/50">
                  เปิดเมื่อ {new Date(current.opened_at).toLocaleDateString("th-TH", {
                    day: "numeric", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                  {closedCount > 0 && ` · ย้อนหลัง ${closedCount} รอบ`}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-warning">ยังไม่เปิดรอบการสำรวจ</p>
                <p className="text-xs text-base-content/50">
                  นักเรียนจะไม่สามารถทำแบบประเมินได้จนกว่าจะเปิดรอบ
                  {closedCount > 0 && ` · มีประวัติ ${closedCount} รอบ`}
                </p>
              </>
            )}
            {error && <p className="text-xs text-error mt-1">{error}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Link href="/admin/survey-rounds" className="btn btn-ghost btn-xs text-base-content/50">
            จัดการรอบ →
          </Link>
          {current ? (
            <button
              className="btn btn-error btn-sm gap-1.5"
              onClick={() => setShowCloseModal(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
              </svg>
              ปิดการสำรวจ
            </button>
          ) : (
            <button
              className="btn btn-success btn-sm gap-1.5"
              onClick={() => setShowOpenModal(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none"
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              เปิดการสำรวจ
            </button>
          )}
        </div>
      </div>
    </>
  );
}
