"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CommitteeContent from "@/components/committee/CommitteeContent";

// ── Design tokens (shared with student login) ─────────────────────
const C = {
  indigo:     "#4f46e5",
  indigoDark: "#3730a3",
  purple:     "#7c3aed",
  green:      "#10b981",
  greenBg:    "#f0fdf4",
  border:     "#e2e8f0",
  text:       "#0f172a",
  muted:      "#64748b",
  subtle:     "#94a3b8",
};

const baseField = (done: boolean, focused: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "11px 14px",
  border: `1.5px solid ${done ? C.green : focused ? C.indigo : C.border}`,
  borderRadius: 10,
  fontSize: "0.92rem",
  outline: "none",
  background: done ? C.greenBg : "#fff",
  color: C.text,
  transition: "border-color .18s, box-shadow .18s, background .18s",
  boxShadow: focused && !done ? "0 0 0 3px rgba(79,70,229,0.10)" : "none",
  fontFamily: "inherit",
});

function FieldLabel({ n, done, children }: { n: number; done: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
      <span style={{
        width: 19, height: 19, borderRadius: "50%", flexShrink: 0,
        background: done ? C.green : C.indigo,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 9.5, color: "#fff", fontWeight: 800,
        transition: "background .25s",
        boxShadow: done ? "0 0 0 3px rgba(16,185,129,.18)" : "0 0 0 3px rgba(79,70,229,.14)",
      }}>
        {done ? "✓" : n}
      </span>
      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: C.text }}>{children}</span>
    </div>
  );
}

export default function AdminLoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [shaking,  setShaking]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [focus,    setFocus]    = useState("");

  const userOk  = username.trim().length > 0;
  const passOk  = password.length >= 6;
  const ready   = userOk && passOk;
  const doneCount = [userOk, passOk].filter(Boolean).length;

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 620);
  };

  // ผู้ใช้ทดสอบสำหรับ dev (ลบออกก่อนขึ้น production)
  const DEV_ACCOUNTS = [
    { label: "⚙️ System Admin", username: "admin",        password: "password123", color: "#f59e0b" },
  ];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setLoading(true);
    setError("");

    try {
      const formData = new URLSearchParams();
      formData.append("username", username.trim());
      formData.append("password", password);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:6800"}/api/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
        }
      );

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง");
      }

      const data = await res.json();
      localStorage.setItem("lemcs_token", data.access_token);
      router.push("/admin/dashboard");
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>

      {/* ════════════════════════════════════════════════════════
          LEFT  ·  Brand panel  (lg+ only)
      ════════════════════════════════════════════════════════ */}
      <aside
        className="hidden lg:flex flex-col justify-between"
        style={{
          width: 420, flexShrink: 0,
          background: "linear-gradient(155deg, #1e3a5f 0%, #1e40af 40%, #1d4ed8 100%)",
          padding: "48px 44px", position: "sticky", top: 0,
          height: "100vh", overflow: "hidden",
        }}
      >
        {/* Decorative circles */}
        {[
          { t: -90, r: -90, s: 320, o: 0.06 },
          { b: 40,  l: -70, s: 280, o: 0.05 },
          { t: "42%", r: -50, s: 180, o: 0.04 },
        ].map((c, i) => (
          <div key={i} style={{
            position: "absolute", borderRadius: "50%",
            width: c.s, height: c.s,
            top: c.t as any, right: c.r as any, bottom: c.b as any, left: c.l as any,
            background: `rgba(255,255,255,${c.o})`,
            pointerEvents: "none",
          }} />
        ))}
        {/* Dot grid */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.12, pointerEvents: "none",
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,.7) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }} />

        {/* Logo */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 52 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.28)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <ShieldIcon size={22} color="white" />
            </div>
            <span style={{ color: "white", fontWeight: 800, fontSize: "1.2rem", letterSpacing: "-0.3px" }}>
              LEMCS Admin
            </span>
          </div>

          <h2 style={{
            color: "white", fontSize: "2.6rem", fontWeight: 800,
            lineHeight: 1.15, letterSpacing: "-0.5px", marginBottom: 16,
          }}>
            ระบบจัดการ<br/>สุขภาพจิต<br/>นักเรียน
          </h2>
          <p style={{ color: "rgba(186,230,253,0.88)", fontSize: "0.9rem", lineHeight: 1.75 }}>
            สำหรับครู เจ้าหน้าที่ และผู้ดูแลระบบ<br/>
            จังหวัดเลย — ครอบคลุม 100,000+ นักเรียน
          </p>
        </div>

        {/* Role cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "36px 0" }}>
          {[
            { icon: "🏫", role: "School Admin",      desc: "จัดการนักเรียนในโรงเรียน" },
            { icon: "🏛️", role: "Commission Admin",  desc: "ดูแลระดับเขตพื้นที่" },
            { icon: "⚙️", role: "System Admin",      desc: "บริหารระบบทั้งหมด" },
          ].map(r => (
            <div key={r.role} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "11px 14px", borderRadius: 10,
              background: "rgba(255,255,255,0.1)", backdropFilter: "blur(6px)",
              border: "1px solid rgba(255,255,255,0.15)",
            }}>
              <span style={{ fontSize: "1.25rem", lineHeight: 1 }}>{r.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: "white", fontWeight: 700, fontSize: "0.82rem" }}>{r.role}</div>
                <div style={{ color: "rgba(186,230,253,0.7)", fontSize: "0.72rem", marginTop: 1 }}>{r.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8, paddingTop: 20,
          borderTop: "1px solid rgba(255,255,255,0.15)",
        }}>
          {[
            { n: "100K+", label: "นักเรียน" },
            { n: "3",     label: "แบบประเมิน" },
            { n: "จ.เลย", label: "จังหวัด" },
          ].map(s => (
            <div key={s.label}>
              <div style={{ color: "white", fontWeight: 800, fontSize: "1.2rem" }}>{s.n}</div>
              <div style={{ color: "rgba(186,230,253,0.65)", fontSize: "0.7rem", marginTop: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </aside>

      {/* ════════════════════════════════════════════════════════
          RIGHT  ·  Form + Committee
      ════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, background: "#f8fafc", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

        {/* Form section */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "32px 20px" }}>
        <div className="w-full fade-in-up" style={{ maxWidth: 380 }}>

          {/* Mobile-only header */}
          <div className="lg:hidden" style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{
              width: 54, height: 54, margin: "0 auto 10px",
              background: "linear-gradient(135deg, #1e40af, #1d4ed8)",
              borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 6px 20px rgba(30,64,175,.28)",
            }}>
              <ShieldIcon size={26} color="white" />
            </div>
            <div style={{ fontWeight: 800, fontSize: "1.45rem", color: "#1e40af", letterSpacing: "-0.3px" }}>
              LEMCS Admin
            </div>
            <div style={{ fontSize: "0.78rem", color: C.muted, marginTop: 2 }}>
              ระบบจัดการสุขภาพจิตนักเรียน จังหวัดเลย
            </div>
          </div>

          {/* ── Card ── */}
          <div
            className={shaking ? "shake" : ""}
            style={{
              background: "white", borderRadius: 20,
              boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 8px 36px rgba(30,64,175,.09)",
              border: "1px solid rgba(0,0,0,0.04)",
              padding: "32px 28px 24px",
            }}
          >
            {/* Card header */}
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: C.text, margin: 0 }}>
                เข้าสู่ระบบผู้ดูแล
              </h1>
              <p style={{ fontSize: "0.78rem", color: C.muted, marginTop: 4 }}>
                สำหรับครู เจ้าหน้าที่ และผู้ดูแลระบบ
              </p>
            </div>

            {/* Progress pills */}
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 24 }}>
              {[userOk, passOk].map((done, i) => (
                <div key={i} style={{
                  height: 6, borderRadius: 3,
                  width: done ? 22 : (doneCount === i ? 14 : 6),
                  background: done ? C.green : (doneCount === i ? "#1e40af" : C.border),
                  transition: "all .3s cubic-bezier(.34,1.56,.64,1)",
                }} />
              ))}
              <span style={{
                fontSize: 10.5, color: doneCount === 2 ? C.green : C.subtle,
                marginLeft: 6, fontWeight: 600, transition: "color .2s",
              }}>
                {doneCount === 2 ? "พร้อมเข้าสู่ระบบ ✓" : `${doneCount}/2 ครบแล้ว`}
              </span>
            </div>

            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* ── 1. Username ── */}
              <div>
                <FieldLabel n={1} done={userOk}>ชื่อผู้ใช้งาน (Username)</FieldLabel>
                <input
                  type="text"
                  autoComplete="username"
                  placeholder="เช่น admin"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onFocus={() => setFocus("user")}
                  onBlur={() => setFocus("")}
                  style={baseField(userOk, focus === "user")}
                />
              </div>

              {/* ── 2. Password ── */}
              <div>
                <FieldLabel n={2} done={passOk}>รหัสผ่าน (Password)</FieldLabel>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPass ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocus("pass")}
                    onBlur={() => setFocus("")}
                    style={{ ...baseField(passOk, focus === "pass"), paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    style={{
                      position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer",
                      color: C.subtle, padding: 2, display: "flex", alignItems: "center",
                    }}
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              {/* ── Error ── */}
              {error && (
                <div className="fade-in-up" style={{
                  display: "flex", alignItems: "flex-start", gap: 9,
                  padding: "11px 13px", borderRadius: 9,
                  background: "#fff1f2", border: "1px solid #fecdd3",
                  color: "#be123c", fontSize: "0.8rem", lineHeight: 1.5,
                }}>
                  <svg style={{ flexShrink: 0, marginTop: 1 }} width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      stroke="currentColor"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                  {error}
                </div>
              )}

              {/* ── Submit ── */}
              <button
                type="submit"
                disabled={loading || !ready}
                style={{
                  width: "100%", padding: "12px 16px", border: "none",
                  borderRadius: 11, fontWeight: 700, fontSize: "0.92rem",
                  cursor: ready ? "pointer" : "not-allowed",
                  background: ready
                    ? "linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)"
                    : "#e2e8f0",
                  color: ready ? "white" : C.subtle,
                  boxShadow: ready && !loading
                    ? "0 4px 16px rgba(30,64,175,.32), 0 1px 3px rgba(0,0,0,.1)"
                    : "none",
                  transition: "all .25s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  marginTop: 4,
                }}
              >
                {loading ? (
                  <>
                    <span className="loading loading-spinner loading-sm" />
                    กำลังเข้าสู่ระบบ...
                  </>
                ) : (
                  <>
                    เข้าสู่ระบบ
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
                        stroke="currentColor" d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Security badge */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              marginTop: 18, fontSize: 10.5, color: C.subtle,
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  stroke="currentColor"
                  d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              ข้อมูลถูกเข้ารหัสและปกป้องตามมาตรฐาน PDPA
            </div>

            {/* ── Dev Quick Fill (ลบออกก่อนขึ้น prod) ── */}
            <div style={{
              marginTop: 20,
              padding: "12px 14px",
              borderRadius: 12,
              background: "linear-gradient(135deg, #fefce8, #fef9c3)",
              border: "1.5px dashed #fbbf24",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 12 }}>🛠️</span>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#92400e", letterSpacing: "0.3px" }}>
                  DEV — คลิกเพื่อเติม username/password
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {DEV_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.username}
                    type="button"
                    onClick={() => { setUsername(acc.username); setPassword(acc.password); setError(""); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "8px 12px", borderRadius: 8, border: "none",
                      cursor: "pointer",
                      background: `${acc.color}15`,
                      transition: "background .15s, transform .15s",
                      fontFamily: "inherit",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${acc.color}28`; e.currentTarget.style.transform = "translateX(2px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${acc.color}15`; e.currentTarget.style.transform = "none"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: acc.color, flexShrink: 0 }} />
                      <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#1e293b" }}>{acc.label}</span>
                    </div>
                    <span style={{ fontSize: "0.68rem", color: "#64748b", fontFamily: "monospace" }}>
                      {acc.username} / {acc.password}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Back to student login */}
          <div style={{ textAlign: "center", marginTop: 18 }}>
            <button
              onClick={() => router.push("/login")}
              style={{
                background: "none", border: "none", padding: "8px 14px",
                borderRadius: 8, cursor: "pointer",
                fontSize: "0.78rem", color: C.muted,
                transition: "color .15s, background .15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.color = C.text; e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.background = "none"; }}
            >
              ← กลับไปหน้าเข้าสู่ระบบของนักเรียน
            </button>
          </div>

        </div>
        </div>{/* /form section */}

        {/* ════ Committee section ════ */}
        <div style={{
          borderTop: "1px solid #e2e8f0",
          background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
          padding: "48px 24px 64px",
        }}>
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                คณะกรรมการดำเนินงาน
              </h2>
              <p style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 6 }}>
                ประกาศสำนักงานศึกษาธิการจังหวัดเลย — แต่งตั้งคณะทำงานป้องกันและแก้ไขปัญหาสุขภาพจิตนักเรียน
                นักศึกษาในสถานศึกษาจังหวัดเลย (มีนาคม ๒๕๖๙)
              </p>
            </div>
            <CommitteeContent />
          </div>
        </div>

      </div>{/* /right column */}
    </div>
  );
}

// ── Icon helpers ──────────────────────────────────────────────────
function ShieldIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
        stroke={color}
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
        stroke={color} d="M9 12l2 2 4-4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
        stroke="currentColor" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
        stroke="currentColor"
        d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
