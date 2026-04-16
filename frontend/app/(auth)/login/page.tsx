"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CommitteeContent from "@/components/committee/CommitteeContent";

const MONTHS = [
  { value: "01", label: "มกราคม" },
  { value: "02", label: "กุมภาพันธ์" },
  { value: "03", label: "มีนาคม" },
  { value: "04", label: "เมษายน" },
  { value: "05", label: "พฤษภาคม" },
  { value: "06", label: "มิถุนายน" },
  { value: "07", label: "กรกฎาคม" },
  { value: "08", label: "สิงหาคม" },
  { value: "09", label: "กันยายน" },
  { value: "10", label: "ตุลาคม" },
  { value: "11", label: "พฤศจิกายน" },
  { value: "12", label: "ธันวาคม" },
];

const currentYearBE = new Date().getFullYear() + 543;
const YEARS = Array.from({ length: 25 }, (_, i) => (currentYearBE - 5) - i);
const DAYS  = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, "0"));

// ── Design tokens ────────────────────────────────────────────────
const C = {
  indigo:      "#4f46e5",
  indigoDark:  "#3730a3",
  purple:      "#7c3aed",
  green:       "#10b981",
  greenBg:     "#f0fdf4",
  border:      "#e2e8f0",
  text:        "#0f172a",
  muted:       "#64748b",
  subtle:      "#94a3b8",
};

// ── Field style (base + done state) ─────────────────────────────
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
  appearance: "none" as const,
  WebkitAppearance: "none" as const,
  cursor: "inherit",
});

// ── Sub-components ───────────────────────────────────────────────
function StepDot({ done, active }: { done: boolean; active: boolean }) {
  return (
    <div style={{
      height: 6, borderRadius: 3,
      width: done ? 22 : active ? 14 : 6,
      background: done ? C.green : active ? C.indigo : C.border,
      transition: "all .3s cubic-bezier(.34,1.56,.64,1)",
    }} />
  );
}

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

function SelectCaret({ done }: { done: boolean }) {
  return (
    <div style={{
      position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
      pointerEvents: "none", display: "flex", alignItems: "center",
      color: done ? C.green : C.subtle,
      transition: "color .18s",
    }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
          stroke="currentColor" d="M19 9l-7 7-7-7"/>
      </svg>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();

  const [nationalId,  setNationalId]  = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [bDay,   setBDay]   = useState("");
  const [bMonth, setBMonth] = useState("");
  const [bYear,  setBYear]  = useState("");

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [shaking, setShaking] = useState(false);
  const [focus,   setFocus]   = useState("");

  const formatNID = (raw: string) => {
    const p = [raw.slice(0,1), raw.slice(1,5), raw.slice(5,10), raw.slice(10,12), raw.slice(12,13)];
    return p.filter(s => s).join("-");
  };

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 620);
  };

  const nidOk  = nationalId.length === 13;
  const dateOk = !!(bDay && bMonth && bYear);
  const codeOk = studentCode.length > 0;
  const ready  = nidOk && dateOk && codeOk;
  const doneCount = [nidOk, dateOk, codeOk].filter(Boolean).length;

  const monthLabel = MONTHS.find(m => m.value === bMonth)?.label ?? "";
  const dateChip   = dateOk ? `${parseInt(bDay)} ${monthLabel} ${bYear}` : "";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:6800"}/api/auth/login/bypass`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            national_id: nationalId,
            birthdate: `${parseInt(bYear) - 543}-${bMonth}-${bDay}`,
            student_code: studentCode.trim(),
          }),
        }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "ข้อมูลเข้าสู่ระบบไม่ถูกต้อง");
      }
      const d = await res.json();
      localStorage.setItem("lemcs_token", d.access_token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>

      {/* ════════════════════════════════════════════════════════
          LEFT  ·  Brand panel  (lg+ only)
      ════════════════════════════════════════════════════════ */}
      <aside
        className="hidden lg:flex flex-col justify-between"
        style={{
          width: 420, flexShrink: 0,
          background: "linear-gradient(155deg, #1e40af 0%, #4338ca 40%, #7c3aed 100%)",
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
              <HeartIcon size={22} color="white" />
            </div>
            <span style={{ color: "white", fontWeight: 800, fontSize: "1.2rem", letterSpacing: "-0.3px" }}>
              LEMCS
            </span>
          </div>

          <h2 style={{
            color: "white", fontSize: "2.6rem", fontWeight: 800,
            lineHeight: 1.15, letterSpacing: "-0.5px", marginBottom: 16,
          }}>
            ดูแลจิตใจ<br/>ของนักเรียน<br/>ทุกคน
          </h2>
          <p style={{ color: "rgba(199,210,254,0.88)", fontSize: "0.9rem", lineHeight: 1.75 }}>
            ระบบประเมินสุขภาพจิตนักเรียน จังหวัดเลย<br/>
            ครอบคลุมทุกระดับชั้น ป.4 — ปวช.3
          </p>
        </div>

        {/* Assessment cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "36px 0" }}>
          {[
            { icon: "🧠", code: "ST-5",  desc: "ประเมินความเครียด",        range: "0–15 คะแนน" },
            { icon: "💙", code: "PHQ-A", desc: "ภาวะซึมเศร้าวัยรุ่น",     range: "0–27 คะแนน" },
            { icon: "🌱", code: "CDI",   desc: "ภาวะซึมเศร้าในเด็ก",      range: "0–54 คะแนน" },
          ].map(a => (
            <div key={a.code} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "11px 14px", borderRadius: 10,
              background: "rgba(255,255,255,0.1)", backdropFilter: "blur(6px)",
              border: "1px solid rgba(255,255,255,0.15)",
            }}>
              <span style={{ fontSize: "1.25rem", lineHeight: 1 }}>{a.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: "white", fontWeight: 700, fontSize: "0.82rem" }}>{a.code} — {a.desc}</div>
                <div style={{ color: "rgba(199,210,254,0.7)", fontSize: "0.72rem", marginTop: 1 }}>{a.range}</div>
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
              <div style={{ color: "rgba(199,210,254,0.65)", fontSize: "0.7rem", marginTop: 1 }}>{s.label}</div>
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
        <div className="w-full max-w-sm fade-in-up" style={{ maxWidth: 380 }}>

          {/* Mobile-only header */}
          <div className="lg:hidden" style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{
              width: 54, height: 54, margin: "0 auto 10px",
              background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
              borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 6px 20px rgba(79,70,229,.28)",
            }}>
              <HeartIcon size={26} color="white" />
            </div>
            <div style={{ fontWeight: 800, fontSize: "1.45rem", color: C.indigo, letterSpacing: "-0.3px" }}>
              LEMCS
            </div>
            <div style={{ fontSize: "0.78rem", color: C.muted, marginTop: 2 }}>
              ระบบประเมินสุขภาพจิตนักเรียน จังหวัดเลย
            </div>
          </div>

          {/* ── Card ── */}
          <div
            className={shaking ? "shake" : ""}
            style={{
              background: "white", borderRadius: 20,
              boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 8px 36px rgba(79,70,229,.09)",
              border: "1px solid rgba(0,0,0,0.04)",
              padding: "32px 28px 24px",
            }}
          >
            {/* Card header */}
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: C.text, margin: 0 }}>
                เข้าสู่ระบบนักเรียน
              </h1>
              <p style={{ fontSize: "0.78rem", color: C.muted, marginTop: 4 }}>
                ยืนยันตัวตน 3 ขั้นตอน
              </p>
            </div>

            {/* Progress pills */}
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 24 }}>
              <StepDot done={nidOk}  active={!nidOk && doneCount === 0} />
              <StepDot done={dateOk} active={!dateOk && doneCount === 1} />
              <StepDot done={codeOk} active={!codeOk && doneCount === 2} />
              <span style={{ fontSize: 10.5, color: doneCount === 3 ? C.green : C.subtle, marginLeft: 6, fontWeight: 600, transition: "color .2s" }}>
                {doneCount === 3 ? "พร้อมเข้าสู่ระบบ ✓" : `${doneCount}/3 ครบแล้ว`}
              </span>
            </div>

            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* ── 1. National ID ── */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <FieldLabel n={1} done={nidOk}>เลขบัตรประจำตัวประชาชน</FieldLabel>
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                    color: nidOk ? C.green : C.subtle, transition: "color .2s",
                  }}>
                    {nationalId.length}/13
                  </span>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    type="text" inputMode="numeric" autoComplete="off"
                    placeholder="x-xxxx-xxxxx-xx-x"
                    value={formatNID(nationalId)}
                    onChange={e => setNationalId(e.target.value.replace(/\D/g, "").slice(0, 13))}
                    onFocus={() => setFocus("nid")} onBlur={() => setFocus("")}
                    maxLength={17}
                    style={{
                      ...baseField(nidOk, focus === "nid"),
                      textAlign: "center", letterSpacing: "0.1em",
                      fontFamily: "'Consolas','SF Mono',monospace", fontSize: "1rem",
                    }}
                  />
                  {/* progress bar */}
                  <div style={{
                    position: "absolute", bottom: 0, left: 10, right: 10,
                    height: 2, background: "#f1f5f9", borderRadius: 2, overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%", borderRadius: 2,
                      width: `${(nationalId.length / 13) * 100}%`,
                      background: nidOk
                        ? C.green
                        : "linear-gradient(90deg, #4f46e5, #7c3aed)",
                      transition: "width .12s linear, background .3s",
                    }} />
                  </div>
                </div>
              </div>

              {/* ── 2. Birthdate ── */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <FieldLabel n={2} done={dateOk}>วันเดือนปีเกิด (พ.ศ.)</FieldLabel>
                  {dateChip && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: C.green,
                      background: C.greenBg, border: "1px solid #86efac",
                      padding: "2px 8px", borderRadius: 20,
                    }}>
                      {dateChip}
                    </span>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.65fr 1.15fr", gap: 7 }}>
                  {/* Day */}
                  <div style={{ position: "relative" }}>
                    <select
                      value={bDay} onChange={e => setBDay(e.target.value)}
                      onFocus={() => setFocus("day")} onBlur={() => setFocus("")}
                      style={{ ...baseField(!!bDay, focus === "day"), paddingRight: 26, cursor: "pointer" }}
                    >
                      <option value="" disabled>วัน</option>
                      {DAYS.map(d => <option key={d} value={d}>{parseInt(d)}</option>)}
                    </select>
                    <SelectCaret done={!!bDay} />
                  </div>
                  {/* Month */}
                  <div style={{ position: "relative" }}>
                    <select
                      value={bMonth} onChange={e => setBMonth(e.target.value)}
                      onFocus={() => setFocus("month")} onBlur={() => setFocus("")}
                      style={{ ...baseField(!!bMonth, focus === "month"), paddingRight: 26, cursor: "pointer" }}
                    >
                      <option value="" disabled>เดือน</option>
                      {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <SelectCaret done={!!bMonth} />
                  </div>
                  {/* Year */}
                  <div style={{ position: "relative" }}>
                    <select
                      value={bYear} onChange={e => setBYear(e.target.value)}
                      onFocus={() => setFocus("year")} onBlur={() => setFocus("")}
                      style={{ ...baseField(!!bYear, focus === "year"), paddingRight: 26, cursor: "pointer" }}
                    >
                      <option value="" disabled>พ.ศ.</option>
                      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <SelectCaret done={!!bYear} />
                  </div>
                </div>
              </div>

              {/* ── 3. Student code ── */}
              <div>
                <FieldLabel n={3} done={codeOk}>รหัสประจำตัวนักเรียน</FieldLabel>
                <input
                  type="text" inputMode="numeric" autoComplete="off"
                  placeholder="เช่น 12345678901"
                  value={studentCode}
                  onChange={e => setStudentCode(e.target.value.replace(/\D/g, ""))}
                  onFocus={() => setFocus("code")} onBlur={() => setFocus("")}
                  maxLength={11}
                  style={{
                    ...baseField(codeOk, focus === "code"),
                    textAlign: "center", letterSpacing: "0.12em", fontSize: "1rem",
                  }}
                />
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
                    ? "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)"
                    : "#e2e8f0",
                  color: ready ? "white" : C.subtle,
                  boxShadow: ready && !loading
                    ? "0 4px 16px rgba(79,70,229,.32), 0 1px 3px rgba(0,0,0,.1)"
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

            {/* PDPA */}
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
          </div>

          {/* Admin link */}
          <div style={{ textAlign: "center", marginTop: 18 }}>
            <button
              onClick={() => router.push("/admin-login")}
              style={{
                background: "none", border: "none", padding: "8px 14px",
                borderRadius: 8, cursor: "pointer",
                fontSize: "0.78rem", color: C.muted,
                transition: "color .15s, background .15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.color = C.text; e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.background = "none"; }}
            >
              เข้าสู่ระบบสำหรับครู / ผู้ดูแลระบบ →
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

// ── Icon helpers ─────────────────────────────────────────────────
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
