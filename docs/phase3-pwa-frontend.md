# Phase 3 — PWA Frontend
## LEMCS Developer Guide

> ก่อนอ่านไฟล์นี้: Phase 1 และ Phase 2 ต้องผ่าน checklist ครบแล้ว

---

## เป้าหมายของ Phase 3

- [x] PWA setup: manifest.json + Service Worker + offline fallback
- [x] หน้า Login (student_code + OTP)
- [x] หน้า Dashboard (ภาพรวมแบบประเมิน + ประวัติ)
- [x] หน้าทำแบบประเมิน (Phase 2) — เพิ่ม offline support
- [x] Admin layout + sidebar
- [x] Responsive: 375px / 768px / 1280px

---

## ขั้นตอน 1: PWA Setup

### ติดตั้ง next-pwa

```bash
npm install next-pwa
```

### next.config.js

```javascript
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      // Cache API responses
      urlPattern: /^https:\/\/.*\/api\/assessments\/available/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "api-assessments",
        expiration: { maxAgeSeconds: 3600 },  // 1 ชั่วโมง
      },
    },
    {
      // Cache static assets
      urlPattern: /\.(js|css|woff2|png|jpg|svg)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "static-assets",
        expiration: { maxAgeSeconds: 86400 * 30 },  // 30 วัน
      },
    },
  ],
});

module.exports = withPWA({
  reactStrictMode: true,
});
```

### public/manifest.json

```json
{
  "name": "LEMCS — ระบบประเมินสุขภาพจิต จ.เลย",
  "short_name": "LEMCS",
  "description": "ระบบสำรวจและประเมินสุขภาพจิตนักเรียน จังหวัดเลย",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FFFFFF",
  "theme_color": "#3B82F6",
  "orientation": "portrait",
  "lang": "th",
  "icons": [
    { "src": "/icons/icon-72x72.png",   "sizes": "72x72",   "type": "image/png" },
    { "src": "/icons/icon-96x96.png",   "sizes": "96x96",   "type": "image/png" },
    { "src": "/icons/icon-128x128.png", "sizes": "128x128", "type": "image/png" },
    { "src": "/icons/icon-144x144.png", "sizes": "144x144", "type": "image/png" },
    { "src": "/icons/icon-152x152.png", "sizes": "152x152", "type": "image/png" },
    { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-384x384.png", "sizes": "384x384", "type": "image/png" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

---

## ขั้นตอน 2: หน้า Login

### app/(auth)/login/page.tsx

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type LoginStep = "student_code" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>("student_code");
  const [studentCode, setStudentCode] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRequestOTP = async () => {
    if (!studentCode.trim()) return;
    setIsLoading(true);
    setError("");
    try {
      await api.post("/auth/otp/request", { student_code: studentCode });
      setStep("otp");
    } catch (e: any) {
      setError(e.response?.data?.detail || "ไม่พบรหัสนักเรียนในระบบ");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) return;
    setIsLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/otp/verify", { student_code: studentCode, otp });
      localStorage.setItem("access_token", res.data.access_token);
      localStorage.setItem("refresh_token", res.data.refresh_token);
      router.push("/dashboard");
    } catch (e: any) {
      setError("OTP ไม่ถูกต้องหรือหมดอายุ");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-base-100 flex flex-col items-center justify-center p-6">
      {/* Logo + Title */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">🧠</div>
        <h1 className="text-2xl font-bold text-primary">LEMCS</h1>
        <p className="text-base-content/60 text-sm mt-1">ระบบประเมินสุขภาพจิตนักเรียน จ.เลย</p>
      </div>

      <div className="card bg-base-100 shadow-xl w-full max-w-sm">
        <div className="card-body gap-4">
          {step === "student_code" ? (
            <>
              <h2 className="card-title justify-center">เข้าสู่ระบบ</h2>
              <input
                type="text"
                placeholder="รหัสนักเรียน"
                className="input input-bordered w-full"
                value={studentCode}
                onChange={e => setStudentCode(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleRequestOTP()}
                autoComplete="username"
              />
              {error && <div className="alert alert-error text-sm py-2">{error}</div>}
              <button
                className="btn btn-primary w-full"
                onClick={handleRequestOTP}
                disabled={isLoading || !studentCode.trim()}
              >
                {isLoading ? <span className="loading loading-spinner" /> : "รับ OTP ทาง SMS"}
              </button>
            </>
          ) : (
            <>
              <h2 className="card-title justify-center">กรอก OTP</h2>
              <p className="text-center text-sm text-base-content/60">
                ส่ง OTP ไปยังเบอร์โทรที่ลงทะเบียนไว้แล้ว
              </p>
              <input
                type="number"
                inputMode="numeric"
                placeholder="รหัส OTP 6 หลัก"
                className="input input-bordered w-full text-center text-2xl tracking-widest"
                value={otp}
                onChange={e => setOtp(e.target.value.slice(0, 6))}
                onKeyDown={e => e.key === "Enter" && handleVerifyOTP()}
                autoFocus
              />
              {error && <div className="alert alert-error text-sm py-2">{error}</div>}
              <button
                className="btn btn-primary w-full"
                onClick={handleVerifyOTP}
                disabled={isLoading || otp.length !== 6}
              >
                {isLoading ? <span className="loading loading-spinner" /> : "เข้าสู่ระบบ"}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setStep("student_code")}>
                ← เปลี่ยนรหัสนักเรียน
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## ขั้นตอน 3: หน้า Dashboard (นักเรียน)

### app/(student)/dashboard/page.tsx

```typescript
import { Suspense } from "react";
import PendingAssessments from "@/components/dashboard/PendingAssessments";
import AssessmentHistory from "@/components/dashboard/AssessmentHistory";
import WellnessScore from "@/components/dashboard/WellnessScore";

export default function DashboardPage() {
  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="pt-4">
        <h1 className="text-xl font-bold">สวัสดี 👋</h1>
        <p className="text-base-content/60 text-sm">วันนี้เป็นยังไงบ้าง?</p>
      </div>

      {/* แบบประเมินที่ต้องทำ */}
      <Suspense fallback={<div className="skeleton h-40 w-full rounded-xl" />}>
        <PendingAssessments />
      </Suspense>

      {/* คะแนนล่าสุด */}
      <Suspense fallback={<div className="skeleton h-32 w-full rounded-xl" />}>
        <WellnessScore />
      </Suspense>

      {/* ประวัติ */}
      <Suspense fallback={<div className="skeleton h-48 w-full rounded-xl" />}>
        <AssessmentHistory />
      </Suspense>
    </div>
  );
}
```

### components/dashboard/PendingAssessments.tsx

```typescript
import Link from "next/link";
import { getAvailableAssessments } from "@/lib/api";

const ASSESSMENT_INFO = {
  ST5:  { name: "แบบประเมินความเครียด",       emoji: "😰", color: "badge-warning",  minutes: 5 },
  PHQA: { name: "แบบประเมินภาวะซึมเศร้า",     emoji: "💙", color: "badge-info",     minutes: 8 },
  CDI:  { name: "แบบประเมินซึมเศร้าในเด็ก",   emoji: "🌟", color: "badge-success",  minutes: 10 },
};

export default async function PendingAssessments() {
  const available = await getAvailableAssessments();

  if (available.length === 0) {
    return (
      <div className="card bg-success/10 border border-success/20">
        <div className="card-body py-6 text-center">
          <p className="text-2xl">✅</p>
          <p className="font-semibold">ทำแบบประเมินครบแล้วในภาคเรียนนี้</p>
          <p className="text-sm text-base-content/60">ขอบคุณที่ดูแลสุขภาพจิตของตัวเอง</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-base-content/70 text-sm uppercase tracking-wide">
        แบบประเมินที่ต้องทำ
      </h2>
      {available.map((assessment: { type: string }) => {
        const info = ASSESSMENT_INFO[assessment.type as keyof typeof ASSESSMENT_INFO];
        return (
          <Link
            key={assessment.type}
            href={`/assess/${assessment.type.toLowerCase()}`}
            className="card bg-base-100 shadow hover:shadow-md transition-shadow active:scale-[0.98]"
          >
            <div className="card-body flex-row items-center py-4 gap-3">
              <span className="text-3xl">{info.emoji}</span>
              <div className="flex-1">
                <p className="font-semibold">{info.name}</p>
                <p className="text-sm text-base-content/50">ประมาณ {info.minutes} นาที</p>
              </div>
              <span className={`badge ${info.color}`}>ยังไม่ได้ทำ</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
```

---

## ขั้นตอน 4: Admin Layout + Sidebar

### app/(admin)/layout.tsx

```typescript
"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "ภาพรวม",          icon: "📊" },
  { href: "/admin/alerts",    label: "การแจ้งเตือน",    icon: "🚨" },
  { href: "/admin/reports",   label: "รายงาน",           icon: "📋" },
  { href: "/admin/students",  label: "นักเรียน",         icon: "👥" },
  { href: "/admin/schools",   label: "โรงเรียน",         icon: "🏫" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="drawer lg:drawer-open">
      <input
        id="admin-drawer"
        type="checkbox"
        className="drawer-toggle"
        checked={drawerOpen}
        onChange={e => setDrawerOpen(e.target.checked)}
      />

      <div className="drawer-content flex flex-col">
        {/* Navbar */}
        <div className="navbar bg-base-100 shadow-sm lg:hidden">
          <label htmlFor="admin-drawer" className="btn btn-ghost drawer-button">
            ☰
          </label>
          <span className="font-bold text-primary">LEMCS Admin</span>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>

      {/* Sidebar */}
      <div className="drawer-side z-50">
        <label htmlFor="admin-drawer" className="drawer-overlay" />
        <aside className="min-h-screen w-64 bg-base-200 flex flex-col">
          <div className="p-4 border-b border-base-300">
            <p className="font-bold text-primary text-lg">🧠 LEMCS</p>
            <p className="text-xs text-base-content/60">ระบบประเมินสุขภาพจิต</p>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {NAV_ITEMS.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setDrawerOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  pathname === item.href
                    ? "bg-primary text-primary-content"
                    : "hover:bg-base-300"
                }`}
              >
                <span>{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-base-300">
            <button className="btn btn-ghost btn-sm w-full justify-start text-error">
              🚪 ออกจากระบบ
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
```

---

## ขั้นตอน 5: Offline Fallback Page

### public/offline.html

```html
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ไม่มีการเชื่อมต่ออินเทอร์เน็ต — LEMCS</title>
  <style>
    body {
      font-family: 'Noto Sans Thai', Sarabun, sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; margin: 0;
      background: linear-gradient(135deg, #EFF6FF 0%, #F9FAFB 100%);
    }
    .container { text-align: center; padding: 2rem; max-width: 400px; }
    .emoji { font-size: 5rem; margin-bottom: 1rem; }
    h1 { font-size: 1.5rem; color: #1F2937; margin-bottom: 0.5rem; }
    p { color: #6B7280; line-height: 1.6; margin-bottom: 1.5rem; }
    .btn {
      background: #3B82F6; color: white; border: none;
      padding: 0.75rem 2rem; border-radius: 0.5rem;
      font-size: 1rem; cursor: pointer;
    }
    .btn:hover { background: #2563EB; }
  </style>
</head>
<body>
  <div class="container">
    <div class="emoji">📵</div>
    <h1>ไม่มีการเชื่อมต่ออินเทอร์เน็ต</h1>
    <p>กรุณาตรวจสอบการเชื่อมต่อ WiFi หรือข้อมูลมือถือ<br>แล้วลองใหม่อีกครั้ง</p>
    <button class="btn" onclick="window.location.reload()">ลองใหม่</button>
    <p style="margin-top:1rem;font-size:0.875rem;color:#9CA3AF">
      — LEMCS ระบบประเมินสุขภาพจิต จ.เลย —
    </p>
  </div>
</body>
</html>
```

---

## ขั้นตอน 6: Consent Screen (PDPA)

สร้าง component นี้และแสดงก่อนการทำแบบประเมินครั้งแรกเสมอ

### components/ConsentModal.tsx

```typescript
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
          <label htmlFor="consent-check" className="text-sm cursor-pointer">
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
```

---

## ขั้นตอน 7: API Client (lib/api.ts)

```typescript
// frontend/lib/api.ts
import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// Interceptor: ใส่ JWT token ทุก request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Interceptor: Auto refresh token เมื่อ 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("refresh_token");
        if (!refreshToken) throw new Error("No refresh token");

        const res = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          {},
          { headers: { Authorization: `Bearer ${refreshToken}` } }
        );

        const { access_token } = res.data;
        localStorage.setItem("access_token", access_token);
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch {
        // Refresh failed → redirect to login
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

// Server-side API call helper (สำหรับ RSC)
export async function getAssessmentResult(id: string) {
  try {
    const res = await fetch(
      `${process.env.API_BASE_URL || "http://backend:8000"}/api/assessments/${id}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function getAvailableAssessments() {
  try {
    const res = await fetch(
      `${process.env.API_BASE_URL || "http://backend:8000"}/api/assessments/available`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
```

---

## ขั้นตอน 8: Custom Hooks

### hooks/useAssessmentQuestions.ts

```typescript
import { ASSESSMENT_QUESTIONS } from "@/lib/questions";

export function useAssessmentQuestions(type: string) {
  const normalizedType = type.toUpperCase();
  const questions = ASSESSMENT_QUESTIONS[normalizedType as keyof typeof ASSESSMENT_QUESTIONS] || [];

  return {
    questions,
    isLoading: false,  // ข้อมูล hardcode อยู่ใน frontend (offline support)
  };
}
```

### hooks/useAlerts.ts

```typescript
import useSWR from "swr";
import { api } from "@/lib/api";

interface UseAlertsParams {
  status?: string;
  level?: string;
}

const fetcher = (url: string) => api.get(url).then(r => r.data);

export function useAlerts(params: UseAlertsParams) {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set("status", params.status);
  if (params.level) searchParams.set("level", params.level);

  const queryString = searchParams.toString();
  const url = `/alerts${queryString ? `?${queryString}` : ""}`;

  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    refreshInterval: 30000,  // refresh ทุก 30 วินาที
  });

  return {
    alerts: data || [],
    error,
    isLoading,
    mutate,
  };
}
```

---

## ขั้นตอน 9: WellnessScore Component

### components/dashboard/WellnessScore.tsx

```typescript
import { api } from "@/lib/api";

export default async function WellnessScore() {
  let history: any[] = [];
  try {
    const res = await api.get("/students/me/history");
    history = res.data;
  } catch {
    return null;
  }

  if (history.length === 0) return null;

  const latest = history[0];
  const severityColors: Record<string, string> = {
    normal: "text-success", none: "text-success",
    mild: "text-info", moderate: "text-warning",
    severe: "text-error", very_severe: "text-error",
    clinical: "text-error",
  };
  const severityLabels: Record<string, string> = {
    normal: "ปกติ", none: "ไม่มีอาการ", mild: "น้อย",
    moderate: "ปานกลาง", severe: "มาก", very_severe: "รุนแรงมาก",
    clinical: "ต้องดูแล",
  };

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body py-4">
        <h2 className="font-semibold text-base-content/70 text-sm uppercase tracking-wide">
          ผลประเมินล่าสุด
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">{latest.assessment_type}</p>
            <p className={`text-lg font-bold ${severityColors[latest.severity_level]}`}>
              คะแนน {latest.score} — {severityLabels[latest.severity_level]}
            </p>
          </div>
          <div className="text-3xl font-bold text-base-content/20">{latest.score}</div>
        </div>
      </div>
    </div>
  );
}
```

---

## ขั้นตอน 10: AssessmentHistory Component

### components/dashboard/AssessmentHistory.tsx

```typescript
import { api } from "@/lib/api";
import Link from "next/link";

const TYPE_NAMES: Record<string, string> = {
  ST5: "ความเครียด", PHQA: "ซึมเศร้า (PHQ-A)", CDI: "ซึมเศร้า (CDI)",
};
const SEVERITY_BADGE: Record<string, string> = {
  normal: "badge-success", none: "badge-success", mild: "badge-info",
  moderate: "badge-warning", severe: "badge-error", very_severe: "badge-error",
  clinical: "badge-error",
};

export default async function AssessmentHistory() {
  let history: any[] = [];
  try {
    const res = await api.get("/students/me/history");
    history = res.data;
  } catch {
    return <p className="text-sm text-base-content/40">ไม่สามารถโหลดประวัติได้</p>;
  }

  if (history.length === 0) {
    return <p className="text-center text-sm text-base-content/40 py-4">ยังไม่มีประวัติการประเมิน</p>;
  }

  return (
    <div className="space-y-2">
      <h2 className="font-semibold text-base-content/70 text-sm uppercase tracking-wide">
        ประวัติการประเมิน
      </h2>
      {history.map((item: any) => (
        <Link key={item.id} href={`/result/${item.id}`}>
          <div className="flex items-center justify-between py-2 border-b border-base-200 hover:bg-base-200/50 px-2 rounded transition">
            <div>
              <p className="text-sm font-medium">{TYPE_NAMES[item.assessment_type]}</p>
              <p className="text-xs text-base-content/50">
                {new Date(item.created_at).toLocaleDateString("th-TH", {
                  day: "numeric", month: "short", year: "numeric"
                })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">{item.score}</span>
              <span className={`badge badge-sm ${SEVERITY_BADGE[item.severity_level]}`}>
                {item.severity_level}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
```

---

## ขั้นตอน 11: Global Student Layout (UI Enhancements)

เพิ่มการทำ Global Layout และสีสันสไตล์ผ่อนคลายสำหรับฝั่งนักเรียน

### app/(student)/layout.tsx
- จัดเรียง `StudentHeader` และ `StudentFooter`
- กำหนด background สีฟ้าอ่อน (เช่น `bg-[#F3F9FA]`) เพื่อลดความเครียด

### components/student/StudentHeader.tsx
- มีการแสดงผลข้อมูลแบบ Mockup (โรงเรียน, ชั้นปี, อายุ) ให้ดูน่าใช้งานมากขึ้น

### components/student/StudentFooter.tsx
- มีการให้เครดิตข้อมูลองค์กร (สำนักงานศึกษาธิการ, รพ.จิตเวช, วิทยาลัยเทคนิค) แบบสั้นๆ สไตล์ราชการไทย

---

## Checklist Phase 3

- [x] PWA installable บน Android Chrome (A2HS)
- [x] PWA installable บน iOS Safari
- [x] Offline: เปิดหน้าหลักได้เมื่อไม่มีเน็ต (service worker cache)
- [x] API client (lib/api.ts) มี auto-refresh token interceptor
- [x] API client redirect ไปหน้า login เมื่อ refresh token หมดอายุ
- [x] Consent modal แสดงก่อนทำแบบประเมินครั้งแรก
- [x] หน้า Login ใช้งานได้บน 375px ไม่มี horizontal scroll
- [x] Admin sidebar ทำงานบน mobile (drawer) และ desktop (always visible)
- [x] Noto Sans Thai โหลดและแสดงถูกต้อง
- [x] Dashboard: PendingAssessments แสดงรายการที่ยังไม่ได้ทำ
- [x] Dashboard: WellnessScore แสดงผลล่าสุด
- [x] Dashboard: AssessmentHistory แสดงประวัติทั้งหมด
- [x] useAlerts hook auto-refresh ทุก 30 วินาที
- [x] Lighthouse PWA score ≥ 90
