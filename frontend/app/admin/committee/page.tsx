"use client";

import CommitteeContent from "@/components/committee/CommitteeContent";

export default function AdminCommitteePage() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div>
        <h1 className="text-2xl font-bold">คณะกรรมการดำเนินงาน</h1>
        <p className="text-sm text-base-content/60 mt-1">
          ประกาศสำนักงานศึกษาธิการจังหวัดเลย — แต่งตั้งคณะทำงานป้องกันและแก้ไขปัญหา
          สุขภาพจิตนักเรียน นักศึกษาในสถานศึกษาจังหวัดเลย (มีนาคม ๒๕๖๙)
        </p>
      </div>
      <CommitteeContent />
    </div>
  );
}
