import axios from "axios";

const rawUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
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
