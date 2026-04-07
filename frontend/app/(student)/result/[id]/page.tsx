"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ResultCard from "@/components/assessment/ResultCard";
import CrisisResources from "@/components/assessment/CrisisResources";

export default function ResultPage() {
  const params = useParams();
  const router = useRouter();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const token = localStorage.getItem("lemcs_token");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:6800"}/api/assessments/result/${params?.id}`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        
        if (!res.ok) throw new Error("Result not found");
        
        const data = await res.json();
        setResult(data);
      } catch (e) {
        console.error(e);
        router.push("/dashboard");
      } finally {
        setLoading(false);
      }
    };
    
    if (params?.id) {
      fetchResult();
    }
  }, [params, router]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><span className="loading loading-spinner loading-lg text-primary"></span></div>;
  }

  if (!result) return null;

  return (
    <div className="flex-1 w-full p-4 py-8 md:py-12 flex flex-col gap-8 items-center">
      {/* ⚠️ Suicide Risk: แสดง crisis resources เป็นอันดับแรก */}
      {result.suicide_risk && (
        <div className="w-full animate-bounce mt-4">
          <CrisisResources urgent={true} />
        </div>
      )}

      <ResultCard result={result} />

      <div className="w-full max-w-lg mx-auto flex flex-col gap-4">
        {/* แสดง resource ปกติในกรณีที่ไม่ได้เสี่ยงระดับ Suicide */}
        {!result.suicide_risk && (
          result.severity_level === "moderate" ||
          result.severity_level === "severe" ||
          result.severity_level === "very_severe" ||
          result.severity_level === "clinical"
        ) && (
           <CrisisResources urgent={false} />
        )}

        <button 
          onClick={() => router.push("/dashboard")} 
          className="btn btn-outline btn-block btn-lg bg-base-100"
        >
          กลับหน้าหลัก
        </button>
      </div>
    </div>
  );
}
