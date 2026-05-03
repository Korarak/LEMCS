"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { api, getApiError } from "@/lib/api";
import { ASSESSMENT_QUESTIONS } from "@/lib/questions";
import RoleGuard from "@/components/admin/RoleGuard";

const fetcher = (url: string) => api.get(url).then(r => r.data);

const TYPE_LABEL: Record<string, string> = {
  ST5:  "ST-5 ความเครียด",
  CDI:  "CDI ซึมเศร้าในเด็ก",
  PHQA: "PHQ-A ซึมเศร้าวัยรุ่น",
};

const SEVERITY_COLOR: Record<string, string> = {
  normal: "text-success", none: "text-success", mild: "text-info",
  moderate: "text-warning", severe: "text-error", very_severe: "text-error", clinical: "text-error",
};
const SEVERITY_LABEL: Record<string, string> = {
  normal: "ปกติ", none: "ไม่มีอาการ", mild: "น้อย",
  moderate: "ปานกลาง", severe: "สูง", very_severe: "รุนแรง", clinical: "ต้องดูแล",
};

interface StudentInfo {
  id: string;
  first_name: string;
  last_name: string;
  student_code: string;
  grade: string;
  classroom: string;
  age: number | null;
  available_types: string[];
  assessments_done: Record<string, { severity_level: string; score: number; filled_by_proxy: boolean }>;
}

interface AssessmentResult {
  id: string;
  score: number;
  severity_level: string;
  suicide_risk: boolean;
  assessment_type: string;
}

function ProxyFormInner() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const studentId = params?.studentId as string;
  const typeRaw   = (params?.type as string)?.toUpperCase().replace(/-/g, "") ?? "";

  // context จากหน้า list
  const ctxGrade     = searchParams.get("grade") ?? "";
  const ctxClassroom = searchParams.get("classroom") ?? "";
  const ctxSchoolId  = searchParams.get("school_id") ?? "";

  const questions = ASSESSMENT_QUESTIONS[typeRaw as keyof typeof ASSESSMENT_QUESTIONS];

  // ดึงรายชื่อในชั้น (ถ้ามี context) เพื่อคำนวณ auto-advance
  const classParams = new URLSearchParams();
  if (ctxGrade)     classParams.set("grade", ctxGrade);
  if (ctxClassroom) classParams.set("classroom", ctxClassroom);
  if (ctxSchoolId)  classParams.set("school_id", ctxSchoolId);
  const hasClassCtx = !!(ctxGrade && (ctxSchoolId || true));

  const { data: studentList } = useSWR<StudentInfo[]>(
    hasClassCtx
      ? `/admin/proxy-assess/students?${classParams}`
      : `/admin/proxy-assess/students`,
    fetcher
  );
  const student = studentList?.find(s => s.id === studentId);

  // สร้าง URL พร้อม context
  const buildFormUrl = (sid: string, type: string) => {
    const p = new URLSearchParams();
    if (ctxGrade)     p.set("grade", ctxGrade);
    if (ctxClassroom) p.set("classroom", ctxClassroom);
    if (ctxSchoolId)  p.set("school_id", ctxSchoolId);
    return `/admin/proxy-assess/${sid}/${type.toLowerCase()}?${p}`;
  };

  // หาคนถัดไปในชั้นที่ยังไม่ครบ (หลัง submit)
  const findNext = (doneResult: AssessmentResult) => {
    if (!studentList) return null;
    const currentIdx = studentList.findIndex(s => s.id === studentId);
    // ตรวจว่า type อื่นของคนนี้ยังค้างอยู่ไหม (นับ result ที่เพิ่งได้ด้วย)
    const doneSelf = { ...(student?.assessments_done ?? {}), [doneResult.assessment_type]: true };
    const selfPending = student?.available_types.find(t => !doneSelf[t]);
    if (selfPending) return { studentId, type: selfPending };
    // ไปคนถัดไป
    for (let i = currentIdx + 1; i < studentList.length; i++) {
      const s = studentList[i];
      const pending = s.available_types.find(t => !s.assessments_done[t]);
      if (pending) return { studentId: s.id, type: pending };
    }
    return null;
  };

  // สถิติชั้นเรียน
  const classDone  = studentList?.filter(s => s.available_types.every(t => s.assessments_done[t])).length ?? 0;
  const classTotal = studentList?.length ?? 0;
  const currentPos = studentList ? studentList.findIndex(s => s.id === studentId) + 1 : 0;

  const [step,        setStep]        = useState<"confirm"|"form"|"result">("confirm");
  const [currentIdx,  setCurrentIdx]  = useState(0);
  const [responses,   setResponses]   = useState<Record<string, number | string | boolean>>({});
  const [isAnimating, setIsAnimating] = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [result,      setResult]      = useState<AssessmentResult | null>(null);
  const [nextTarget,  setNextTarget]  = useState<{ studentId: string; type: string } | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  // guard — redirect if wrong type for this student
  useEffect(() => {
    if (student && !student.available_types.includes(typeRaw)) {
      router.replace("/admin/proxy-assess");
    }
  }, [student, typeRaw, router]);

  const handleAnswer = useCallback((key: string, value: number | string | boolean) => {
    setResponses(prev => ({ ...prev, [key]: value }));
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIdx(idx => Math.min(idx + 1, questions.length - 1));
      setIsAnimating(false);
    }, 300);
  }, [questions]);

  const allAnswered = questions && Object.keys(responses).length === questions.length;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post("/admin/proxy-assess/submit", {
        student_id:      studentId,
        assessment_type: typeRaw,
        responses,
      });
      setResult(res.data);
      setNextTarget(findNext(res.data));
      setStep("result");
    } catch (e: any) {
      setError(getApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (!questions) {
    return <p className="text-center py-20 text-base-content/40">ไม่พบแบบประเมิน</p>;
  }

  const q = questions[currentIdx];

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Proxy banner — แสดงตลอด */}
      <div className="alert alert-info py-2 text-sm flex-wrap gap-y-1">
        <span>✏️</span>
        <span className="flex-1">
          กำลังกรอกแทน{" "}
          <strong>{student ? `${student.first_name} ${student.last_name}` : "..."}</strong>
          {student && ` — ชั้น ${student.grade}${student.classroom ? `/${student.classroom}` : ""}`}
          {" | "}{TYPE_LABEL[typeRaw] ?? typeRaw}
        </span>
        {classTotal > 0 && (
          <span className="text-xs opacity-70 ml-auto">
            {currentPos > 0 ? `คนที่ ${currentPos}/${classTotal}` : ""}{" "}
            · กรอกครบ {classDone}/{classTotal} คน
          </span>
        )}
      </div>

      {/* ── Step 1: PDPA Confirm ── */}
      {step === "confirm" && (
        <div className="card bg-base-100 shadow">
          <div className="card-body gap-4">
            <h2 className="card-title text-lg">ยืนยันก่อนเริ่มกรอก</h2>

            <div className="bg-base-200 rounded-xl p-4 space-y-1 text-sm">
              <p><span className="text-base-content/50">นักเรียน:</span>{" "}
                <strong>{student?.first_name} {student?.last_name}</strong> (รหัส {student?.student_code})</p>
              <p><span className="text-base-content/50">ชั้น:</span> {student?.grade}/{student?.classroom}</p>
              <p><span className="text-base-content/50">อายุ:</span> {student?.age ?? "—"} ปี</p>
              <p><span className="text-base-content/50">แบบประเมิน:</span> <strong>{TYPE_LABEL[typeRaw]}</strong> ({questions.length} ข้อ)</p>
            </div>

            <div className="alert alert-warning text-xs py-2">
              <span>⚠️</span>
              <span>การกรอกแทนนักเรียนจะถูกบันทึกใน audit log ว่าท่านเป็นผู้กรอก (PDPA)</span>
            </div>

            <div className="card-actions justify-end">
              <button className="btn btn-ghost" onClick={() => router.back()}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={() => setStep("form")}>
                ยืนยัน — เริ่มกรอก →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Question Form ── */}
      {step === "form" && (
        <div className="space-y-4">
          {/* Progress */}
          <div className="card bg-base-100 shadow p-4">
            <div className="flex justify-between text-xs text-base-content/50 mb-1">
              <span>ข้อ {currentIdx + 1} / {questions.length}</span>
              <span>{Object.keys(responses).length} ตอบแล้ว</span>
            </div>
            <progress
              className="progress progress-primary w-full"
              value={Object.keys(responses).length}
              max={questions.length}
            />
          </div>

          {/* Question navigator (small dots) */}
          <div className="flex flex-wrap gap-1 justify-center">
            {questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIdx(i)}
                className={`w-6 h-6 rounded-full text-xs transition-all ${
                  i === currentIdx
                    ? "bg-primary text-primary-content"
                    : responses[questions[i].key] !== undefined
                      ? "bg-primary/30 text-primary"
                      : "bg-base-200 text-base-content/40"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {/* Current question */}
          <div className={`card bg-base-100 shadow transition-opacity duration-300 ${isAnimating ? "opacity-0" : "opacity-100"}`}>
            <div className="card-body gap-5">
              {typeRaw === "CDI" && currentIdx === 0 && (
                <p className="text-sm font-medium text-primary/90 bg-primary/10 px-3 py-2 rounded-lg -mb-3">
                  เลือกประโยคที่ตรงกับความรู้สึก หรือความคิดของนักเรียนมากที่สุดในระยะ 2 สัปดาห์ที่ผ่านมา
                </p>
              )}
              <p className="text-base font-medium leading-relaxed">{q.text}</p>
              <div className="space-y-2">
                {q.options.map((opt: any) => (
                  <button
                    key={String(opt.value)}
                    onClick={() => handleAnswer(q.key, opt.value)}
                    className="w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm border-base-200 hover:border-primary/50 hover:bg-base-200/50"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between gap-2">
            <button
              className="btn btn-ghost btn-sm"
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx(i => i - 1)}
            >
              ← ย้อนกลับ
            </button>
            {currentIdx < questions.length - 1 ? (
              <button
                className="btn btn-ghost btn-sm"
                disabled={responses[q.key] === undefined}
                onClick={() => setCurrentIdx(i => i + 1)}
              >
                ถัดไป →
              </button>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                disabled={!allAnswered || submitting}
                onClick={handleSubmit}
              >
                {submitting
                  ? <span className="loading loading-spinner loading-xs"/>
                  : "ส่งคำตอบ ✓"
                }
              </button>
            )}
          </div>

          {error && (
            <div className="alert alert-error text-sm py-2">
              <span>❌ {error}</span>
            </div>
          )}

          {allAnswered && currentIdx < questions.length - 1 && (
            <div className="text-center">
              <button className="btn btn-primary btn-sm" disabled={submitting} onClick={handleSubmit}>
                {submitting ? <span className="loading loading-spinner loading-xs"/> : "ส่งคำตอบทั้งหมด ✓"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Result ── */}
      {step === "result" && result && (
        <div className="card bg-base-100 shadow">
          <div className="card-body gap-5 text-center">
            <div>
              <p className="text-4xl font-bold tabular-nums">{result.score}</p>
              <p className="text-base-content/50 text-sm mt-1">คะแนน</p>
            </div>

            <div>
              <p className={`text-2xl font-bold ${SEVERITY_COLOR[result.severity_level] ?? ""}`}>
                {SEVERITY_LABEL[result.severity_level] ?? result.severity_level}
              </p>
              <p className="text-base-content/50 text-sm">{TYPE_LABEL[typeRaw]}</p>
            </div>

            {result.suicide_risk && (
              <div className="alert alert-error">
                <span>🚨</span>
                <div className="text-left">
                  <p className="font-bold">ตรวจพบความเสี่ยงฆ่าตัวตาย</p>
                  <p className="text-sm">ระบบได้สร้าง alert อัตโนมัติแล้ว กรุณาติดต่อนักเรียนทันที</p>
                  <p className="text-sm font-medium mt-1">สายด่วนสุขภาพจิต 1323</p>
                </div>
              </div>
            )}

            <p className="text-xs text-base-content/40">บันทึกแล้ว — กรอกโดยครู (proxy)</p>

            {classTotal > 0 && (
              <div className="text-sm text-base-content/50">
                กรอกครบ <strong className="text-primary">{classDone + 1}/{classTotal}</strong> คนในชั้น
              </div>
            )}

            <div className="card-actions justify-center gap-2 flex-wrap">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  const p = new URLSearchParams();
                  if (ctxGrade)     p.set("grade", ctxGrade);
                  if (ctxClassroom) p.set("classroom", ctxClassroom);
                  if (ctxSchoolId)  p.set("school_id", ctxSchoolId);
                  router.push(`/admin/proxy-assess${p.toString() ? `?${p}` : ""}`);
                }}
              >
                ← กลับรายชื่อ
              </button>

              {nextTarget ? (
                <button
                  className="btn btn-primary btn-sm gap-1.5"
                  onClick={() => router.push(buildFormUrl(nextTarget.studentId, nextTarget.type))}
                >
                  คนถัดไป ({TYPE_LABEL[nextTarget.type]}) →
                </button>
              ) : classTotal > 0 ? (
                <span className="badge badge-success gap-1 self-center">✓ กรอกครบทุกคนในชั้นแล้ว</span>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProxyFormPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center"><span className="loading loading-spinner loading-md text-primary" /></div>}>
      <RoleGuard roles={["schooladmin"]}>
        <ProxyFormInner />
      </RoleGuard>
    </Suspense>
  );
}
