"use client";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  confirmClass?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  detail,
  confirmLabel = "ยืนยัน",
  confirmClass = "btn-error",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <dialog className="modal modal-open" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box max-w-sm">
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="py-3 text-base-content/75 text-sm leading-relaxed">{message}</p>
        {detail && (
          <p className="text-xs text-base-content/50 bg-base-200 rounded-lg px-3 py-2 -mt-1 mb-2">{detail}</p>
        )}
        <div className="modal-action mt-4">
          <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={loading}>
            ยกเลิก
          </button>
          <button
            className={`btn btn-sm ${confirmClass}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <span className="loading loading-spinner loading-xs" /> : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
