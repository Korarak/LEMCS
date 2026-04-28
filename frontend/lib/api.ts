import axios from "axios";

const rawUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:6800/api";
const baseUrl = rawUrl.endsWith('/api') ? rawUrl : `${rawUrl}/api`;

export const api = axios.create({
  baseURL: baseUrl,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// Interceptor: ใส่ JWT token ทุก request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token") || localStorage.getItem("lemcs_token");
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
        localStorage.setItem("lemcs_token", access_token);
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch {
        // Refresh failed → redirect ตาม path
        if (typeof window !== "undefined") {
          localStorage.removeItem("access_token");
          localStorage.removeItem("lemcs_token");
          localStorage.removeItem("refresh_token");
          const isAdmin = window.location.pathname.startsWith("/admin");
          window.location.href = isAdmin ? "/admin-login" : "/login";
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export function getApiError(e: unknown, fallback = "เกิดข้อผิดพลาด"): string {
  const detail = (e as any)?.response?.data?.detail;
  if (!detail) return fallback;
  // Pydantic v2: array of {type, loc, msg, input, url}
  if (Array.isArray(detail)) {
    const msgs = detail.map((d: any) => d?.msg || String(d)).filter(Boolean);
    return msgs.length ? msgs.join(", ") : fallback;
  }
  if (typeof detail === "object") {
    const lines: string[] = [detail.message, detail.hint];
    if (detail.affected_users) lines.push(`บัญชีที่ต้องจัดการ: ${detail.affected_users}`);
    const joined = lines.filter(Boolean).join("\n");
    return joined || fallback;
  }
  return String(detail) || fallback;
}

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
