interface ProgressBarProps {
  current: number;  // ข้อปัจจุบัน (1-indexed)
  total: number;    // จำนวนข้อทั้งหมด
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
  const percentage = Math.round((current / total) * 100);

  return (
    <div className="sticky top-0 bg-base-100 z-10 px-4 py-3 shadow-sm">
      <div className="flex justify-between text-xs text-base-content/60 mb-1 font-medium">
        <span>ข้อ {current} / {total}</span>
        <span>{percentage}%</span>
      </div>
      <progress
        className="progress progress-primary w-full h-3"
        value={current}
        max={total}
      />
    </div>
  );
}
