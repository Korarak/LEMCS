"use client";

import { useState } from "react";
import { api } from "@/lib/api";

const LEVEL_STYLES = {
  warning:  "border-l-4 border-warning bg-warning/5",
  urgent:   "border-l-4 border-error bg-error/5",
  critical: "border-l-4 border-error bg-error/10 ring-2 ring-error/30",
};

const LEVEL_LABELS = {
  warning:  "⚠️ เฝ้าระวัง",
  urgent:   "🔴 เร่งด่วน",
  critical: "🚨 วิกฤต",
};

const STATUS_LABELS = {
  new:           "ใหม่",
  acknowledged:  "รับทราบแล้ว",
  in_progress:   "กำลังดำเนินการ",
  referred:      "ส่งต่อแล้ว",
  closed:        "ปิดเคสแล้ว",
};

export default function AlertCard({ alert, onUpdate }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState(alert.status);
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleUpdate = async () => {
    setIsSaving(true);
    try {
      await api.patch(`/alerts/${alert.id}`, { status, note: note || undefined });
      onUpdate();
      setIsOpen(false);
      setNote(""); // clear notes input
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`card bg-base-100 shadow ${LEVEL_STYLES[alert.alert_level as keyof typeof LEVEL_STYLES]}`}>
      <div className="card-body py-4 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="font-semibold text-sm">
                {LEVEL_LABELS[alert.alert_level as keyof typeof LEVEL_LABELS]}
              </span>
              <span className={`badge badge-sm ${
                alert.status === "new" ? "badge-error" :
                alert.status === "closed" ? "badge-ghost" : "badge-warning"
              }`}>
                {STATUS_LABELS[alert.status as keyof typeof STATUS_LABELS] || alert.status}
              </span>
              <span className="text-xs text-base-content/40">
                {new Date(alert.created_at).toLocaleString("th-TH")}
              </span>
            </div>
            
            <p className="text-sm">
              <span className="font-medium text-base-content/80">โรงเรียน:</span> {alert.school_name} 
              <span className="mx-2">•</span> 
              <span className="font-medium text-base-content/80">ชั้น:</span> {alert.grade} ห้อง {alert.classroom}
            </p>
            <p className="text-sm mt-1">
              <span className="font-medium text-base-content/80">ประเมิน:</span> {alert.assessment_type} 
              <span className="mx-2">•</span> 
              <span className="font-medium text-base-content/80">คะแนน:</span> {alert.score}
            </p>

            {alert.note && (
              <div className="mt-3 bg-base-200/50 p-2 rounded text-xs text-base-content/70 whitespace-pre-line">
                <strong>บันทึกล่าสุด:</strong>
                <br />
                {alert.note}
              </div>
            )}

            {alert.suicide_risk && (
              <div className="mt-3 inline-flex items-center gap-1 bg-error/10 text-error px-2 py-1 rounded-md text-sm font-bold">
                <span>🚨</span> พบความเสี่ยงการฆ่าตัวตาย (ต้องดำเนินการทันที)
              </div>
            )}
          </div>

          <button
            className="btn btn-sm btn-outline btn-primary shrink-0 w-full sm:w-auto mt-2 sm:mt-0"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? "ยกเลิก" : "อัปเดตสถานะ"}
          </button>
        </div>

        {/* Collapsible detail */}
        {isOpen && (
          <div className="mt-4 pt-4 border-t border-base-200 space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="form-control">
              <label className="label py-1"><span className="label-text">เปลี่ยนสถานะ</span></label>
              <select
                className="select select-bordered select-sm w-full"
                value={status}
                onChange={e => setStatus(e.target.value)}
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="form-control">
              <label className="label py-1"><span className="label-text">บันทึกเพิ่มเติม (Note)</span></label>
              <textarea
                className="textarea textarea-bordered w-full text-sm leading-relaxed"
                placeholder="ระบุการช่วยเหลือเบื้องต้น หรือการส่งต่อ..."
                rows={3}
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>

            <div className="flex justify-end pt-2">
               <button
                 className="btn btn-primary btn-sm px-8 shadow-sm"
                 onClick={handleUpdate}
                 disabled={isSaving}
               >
                 {isSaving ? <span className="loading loading-spinner loading-xs" /> : "บันทึกการเปลี่ยนแปลง"}
               </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
