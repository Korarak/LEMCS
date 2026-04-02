"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PendingAssessments from "@/components/dashboard/PendingAssessments";
import AssessmentHistory from "@/components/dashboard/AssessmentHistory";
import WellnessScore from "@/components/dashboard/WellnessScore";

const C = {
  indigo: "#4f46e5",
  purple: "#7c3aed",
  text: "#0f172a",
  muted: "#64748b",
  border: "rgba(79,70,229,.1)",
};

function SectionHeader({ icon, children }: { icon: React.ReactNode; children: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
      <div style={{
        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
        background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 2px 8px rgba(79,70,229,.3)",
      }}>
        {icon}
      </div>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: C.text, margin: 0 }}>{children}</h2>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("lemcs_token");
    if (!storedToken) {
      router.push("/login");
    } else {
      setToken(storedToken);
      fetchDashboardData(storedToken);
    }
  }, [router]);

  const fetchDashboardData = async (authToken: string) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const [resAvail, resHistory] = await Promise.all([
        fetch(`${baseUrl}/api/assessments/available`, { headers: { "Authorization": `Bearer ${authToken}` } }),
        fetch(`${baseUrl}/api/assessments/history`, { headers: { "Authorization": `Bearer ${authToken}` } })
      ]);
      if (resAvail.ok) setAssessments(await resAvail.json());
      if (resHistory.ok) setHistory(await resHistory.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!token || loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <span className="loading loading-spinner loading-lg" style={{ color: C.indigo }} />
          <div style={{ marginTop: 12, fontSize: "0.85rem", color: C.muted }}>กำลังโหลด...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in-up" style={{ padding: "24px 16px 80px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

        {/* Section: แบบประเมินที่เปิดให้ทำ */}
        <section>
          <SectionHeader icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }>
            แบบประเมินที่เปิดให้ทำ
          </SectionHeader>
          <PendingAssessments assessments={assessments} />
        </section>

        {/* Divider */}
        <div style={{
          height: 1, background: "linear-gradient(90deg, transparent, rgba(79,70,229,.15), transparent)",
        }} />

        {/* Section: สุขภาพจิตของคุณ */}
        {history.length > 0 && (
          <section>
            <SectionHeader icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            }>
              สุขภาพจิตของคุณ
            </SectionHeader>
            <WellnessScore history={history} />
          </section>
        )}

        {history.length > 0 && (
          <div style={{
            height: 1, background: "linear-gradient(90deg, transparent, rgba(79,70,229,.15), transparent)",
          }} />
        )}

        {/* Section: ประวัติการเข้าร่วม */}
        <section>
          <SectionHeader icon={
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          }>
            ประวัติการเข้าร่วม
          </SectionHeader>
          <AssessmentHistory history={history} />
        </section>

      </div>
    </div>
  );
}
