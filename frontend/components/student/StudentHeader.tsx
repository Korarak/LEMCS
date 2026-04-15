"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface StudentProfile {
  student_code: string;
  first_name: string;
  last_name: string;
  gender: string | null;
  grade: string | null;
  classroom: string | null;
  school_name: string | null;
  birthdate: string | null;
}

function calcAge(birthdate: string): number {
  const [y, m, d] = birthdate.split("-").map(Number);
  const today = new Date();
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}

function genderPrefix(gender: string | null): string {
  if (gender === "ชาย") return "ด.ช.";
  if (gender === "หญิง") return "ด.ญ.";
  return "";
}

function genderIcon(gender: string | null): string {
  if (gender === "ชาย") return "🙎‍♂️";
  if (gender === "หญิง") return "🙎‍♀️";
  return "🙎";
}

export default function StudentHeader() {
  const router = useRouter();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [profile, setProfile] = useState<StudentProfile | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("lemcs_token");
    if (!token) return;
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:6800";
    fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setProfile(data); })
      .catch(() => {});
  }, []);

  const doLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("lemcs_token");
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    }
    router.push("/login");
  };

  const prefix = genderPrefix(profile?.gender ?? null);
  const fullName = profile ? `${prefix ? prefix + " " : ""}${profile.first_name} ${profile.last_name}`.trim() : "";
  const gradeDisplay = profile?.classroom || profile?.grade || "";

  return (
    <header style={{
      background: "rgba(255,255,255,0.82)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      borderBottom: "1px solid rgba(99,102,241,0.12)",
      boxShadow: "0 1px 12px rgba(99,102,241,0.08)",
      position: "sticky",
      top: 0,
      zIndex: 50,
    }}>
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(99,102,241,0.30)",
          }}>
            <HeartIcon size={18} color="white" />
          </div>
          <div>
            <div style={{
              color: "#1e1b4b", fontWeight: 800, fontSize: "1.05rem",
              letterSpacing: "-0.3px", lineHeight: 1.2,
            }}>
              LEMCS
            </div>
            <div className="hidden sm:block" style={{ color: "#818cf8", fontSize: "0.68rem", fontWeight: 500 }}>
              ระบบประเมินสุขภาพจิต
            </div>
          </div>
        </div>

        {/* Student info pill (desktop) */}
        {profile && (
          <div className="hidden md:flex" style={{
            alignItems: "center", gap: 8,
            padding: "5px 14px", borderRadius: 20,
            background: "rgba(99,102,241,0.06)",
            border: "1px solid rgba(99,102,241,0.14)",
            fontSize: "0.82rem", color: "#374151",
          }}>
            <span style={{ fontSize: "0.9rem" }}>{genderIcon(profile.gender)}</span>
            <span style={{ fontWeight: 600, color: "#1e1b4b" }}>{fullName}</span>
            {profile.birthdate && (
              <><Dot /><span style={{ color: "#6366f1", fontWeight: 500 }}>{calcAge(profile.birthdate)} ปี</span></>
            )}
            {gradeDisplay && <><Dot /><span style={{ color: "#6b7280" }}>{gradeDisplay}</span></>}
            {profile.school_name && <><Dot /><span style={{ color: "#6b7280" }}>{profile.school_name}</span></>}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Mobile student info */}
          {profile && (
            <div className="md:hidden" style={{ textAlign: "right", marginRight: 6, lineHeight: 1.3 }}>
              <div style={{ color: "#1e1b4b", fontWeight: 600, fontSize: "0.82rem" }}>{fullName}</div>
              <div style={{ color: "#818cf8", fontSize: "0.7rem" }}>
                {profile.birthdate && `${calcAge(profile.birthdate)} ปี`}
                {profile.birthdate && gradeDisplay && " · "}
                {gradeDisplay}
              </div>
            </div>
          )}

          <button
            onClick={() => setConfirmLogout(true)}
            style={{
              background: "transparent",
              border: "1px solid rgba(99,102,241,0.3)",
              color: "#4f46e5",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: "0.8rem",
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: 500,
              transition: "background .15s, border-color .15s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(99,102,241,0.08)";
              e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "rgba(99,102,241,0.3)";
            }}
          >
            ออกจากระบบ
          </button>
        </div>
      </div>

      <ConfirmModal
        open={confirmLogout}
        title="ออกจากระบบ"
        message="ต้องการออกจากระบบใช่หรือไม่?"
        confirmLabel="ออกจากระบบ"
        confirmClass="btn-error"
        onConfirm={doLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </header>
  );
}

function Dot() {
  return (
    <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#d1d5db", flexShrink: 0, display: "inline-block" }} />
  );
}

function HeartIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 21.593C6.37 16.054 1 11.296 1 7.191 1 3.4 4.068 2 6.281 2c1.312 0 4.151.501 5.719 4.457C13.59 2.489 16.464 2 17.726 2 20.266 2 23 3.621 23 7.181c0 4.069-5.136 8.625-11 14.412z"
        fill={color}
      />
    </svg>
  );
}
