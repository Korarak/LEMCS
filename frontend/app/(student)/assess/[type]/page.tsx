"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import QuestionCard from "@/components/assessment/QuestionCard";
import ProgressBar from "@/components/assessment/ProgressBar";
import { ASSESSMENT_QUESTIONS } from "@/lib/questions";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

export default function AssessmentPage() {
  const router = useRouter();
  const params = useParams();
  let type = (params?.type as string)?.toUpperCase() || "";
  type = type.replace(/-/g, ""); // รองรับทั้ง phqa และ phq-a
  const questions = ASSESSMENT_QUESTIONS[type as keyof typeof ASSESSMENT_QUESTIONS];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, number | string | boolean>>({});
  const [isAnimating, setIsAnimating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ตรวจสอบว่ามีคีย์คำถามนี้ในระบบหรือไม่
  useEffect(() => {
    if (!questions) {
      router.push("/dashboard");
    }
  }, [questions, router]);

  const handleAutosave = useCallback(async (currentResponses: any) => {
    if (Object.keys(currentResponses).length === 0) return;
    try {
      const token = localStorage.getItem("lemcs_token");
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:6800"}/api/assessments/autosave`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ assessment_type: type, responses: currentResponses }),
      });
    } catch (e) {
      console.error("Autosave failed", e);
    }
  }, [type]);

  // Auto-save ทุก 30 วินาที
  useEffect(() => {
    const interval = setInterval(() => {
      handleAutosave(responses);
    }, 30000);
    return () => clearInterval(interval);
  }, [responses, handleAutosave]);

  const handleAnswer = useCallback((questionKey: string, value: number | string | boolean) => {
    setResponses(prev => ({ ...prev, [questionKey]: value }));
    
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex(current => {
        if (current < questions.length - 1) {
          return current + 1;
        }
        return current;
      });
      setIsAnimating(false);
    }, 350);
  }, [questions]);

  const handleSubmit = async () => {
    setConfirmSubmit(false);
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const token = localStorage.getItem("lemcs_token");
      const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:6800"}/api/assessments/submit`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          assessment_type: type,
          responses,
        }),
      });

      if (!res.ok) {
        let errMsg = "Unknown Error";
        try {
           const errData = await res.json();
           errMsg = JSON.stringify(errData);
        } catch(e) {
           errMsg = await res.text();
        }
        throw new Error(`[${res.status}] ${errMsg}`);
      }

      const result = await res.json();
      router.push(`/result/${result.id}`);
    } catch (error: any) {
      console.error(error);
      setSubmitError(`เกิดข้อผิดพลาดในการส่งข้อมูล: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!questions) return <div className="min-h-[50vh] flex items-center justify-center"><span className="loading loading-spinner text-primary loading-lg"></span></div>;

  const currentQuestion = questions[currentIndex];
  const allAnswered = questions.every(q => responses[q.key] !== undefined);

  return (
    <div className="flex-1 w-full flex flex-col pb-10 mt-4">
      <ProgressBar current={currentIndex + 1} total={questions.length} />

      <div className="flex-1 flex flex-col items-center justify-center p-4 lg:p-8 w-full">
        <div className={`w-full transition-all duration-300 ease-out transform ${isAnimating ? "opacity-0 -translate-x-8" : "opacity-100 translate-x-0"}`}>
          <QuestionCard
            question={currentQuestion}
            questionNumber={currentIndex + 1}
            onAnswer={handleAnswer}
            selectedValue={responses[currentQuestion.key]}
            subtitle={type === "CDI" ? "เลือกประโยคที่ตรงกับความรู้สึก หรือความคิดของท่านมากที่สุดระยะ 2 สัปดาห์ที่ผ่านมา" : undefined}
          />
        </div>

        {/* ปุ่ม นำทาง */}
        <div className="flex justify-between w-full max-w-lg mx-auto mt-8 px-2">
          <button 
            className="btn btn-ghost text-base-content/80 hover:text-base-content"
            onClick={() => currentIndex === 0 ? router.push("/dashboard") : setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={isAnimating}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {currentIndex === 0 ? "กลับหน้าหลัก" : "ย้อนกลับ"}
          </button>
          
          {currentIndex < questions.length - 1 ? (
             <button
               className="btn btn-ghost"
               onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
               disabled={responses[currentQuestion.key] === undefined || isAnimating}
             >
               ข้ามไปข้อถัดไป →
             </button>
          ) : (
             <button
               className="btn btn-primary px-8 shadow-sm"
               onClick={() => setConfirmSubmit(true)}
               disabled={isSubmitting || !allAnswered}
             >
               {isSubmitting ? <span className="loading loading-spinner" /> : "ส่งคำตอบและประเมินผล"}
             </button>
          )}
        </div>

        {submitError && (
          <div className="alert alert-error max-w-lg mx-auto mt-4 text-sm">
            <span>✕</span>
            <span>{submitError}</span>
            <button className="btn btn-ghost btn-xs ml-auto" onClick={() => setSubmitError(null)}>✕</button>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmSubmit}
        title="ยืนยันการส่งแบบประเมิน"
        message="ต้องการส่งคำตอบและประเมินผลใช่หรือไม่?"
        detail="หลังจากส่งแล้วจะไม่สามารถแก้ไขคำตอบได้"
        confirmLabel="ส่งแบบประเมิน"
        confirmClass="btn-primary"
        loading={isSubmitting}
        onConfirm={handleSubmit}
        onCancel={() => setConfirmSubmit(false)}
      />
    </div>
  );
}
