"use client";

import { useState } from "react";

interface ConsentModalProps {
  onAccept: () => void;
  onDecline: () => void;
}

export default function ConsentModal({ onAccept, onDecline }: ConsentModalProps) {
  const [checked, setChecked] = useState(false);

  return (
    <dialog open className="modal modal-bottom sm:modal-middle">
      <div className="modal-box">
        <h3 className="font-bold text-lg">
          🔒 ข้อตกลงการใช้ข้อมูลส่วนบุคคล (PDPA)
        </h3>

        <div className="py-4 space-y-3 text-sm text-base-content/80">
          <p>ระบบ LEMCS จะเก็บรวบรวมและประมวลผลข้อมูลของคุณดังนี้:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>ผลการประเมินสุขภาพจิต (ST-5, PHQ-A, CDI)</li>
            <li>ข้อมูลส่วนตัวพื้นฐานตามที่โรงเรียนให้ไว้</li>
          </ul>
          <p>ข้อมูลจะถูกใช้เพื่อ:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>ติดตามและดูแลสุขภาพจิตนักเรียน</li>
            <li>รายงานสรุปต่อครูแนะแนวและผู้บริหารโรงเรียน</li>
          </ul>
          <p className="text-xs text-base-content/50">
            ข้อมูลของคุณถูกเก็บอย่างปลอดภัยและเป็นความลับภายใต้ พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
          </p>
        </div>

        <div className="flex items-start gap-3 bg-base-200 rounded-lg p-3 my-4">
          <input
            type="checkbox"
            className="checkbox checkbox-primary mt-0.5"
            checked={checked}
            onChange={e => setChecked(e.target.checked)}
            id="consent-check"
          />
          <label htmlFor="consent-check" className="text-sm cursor-pointer select-none">
            ฉันรับทราบและยินยอมให้ระบบเก็บและใช้ข้อมูลของฉันตามที่ระบุไว้
          </label>
        </div>

        <div className="modal-action gap-2">
          <button className="btn btn-ghost" onClick={onDecline}>ไม่ยินยอม</button>
          <button
            className="btn btn-primary"
            onClick={onAccept}
            disabled={!checked}
          >
            ยินยอมและเริ่มทำแบบประเมิน
          </button>
        </div>
      </div>
    </dialog>
  );
}
