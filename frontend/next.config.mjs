import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development" || process.env.DISABLE_PWA === "true",
  // ใช้ /offline.html (ซึ่งอยู่ใน precache list) เป็น navigation fallback
  // แทน createHandlerBoundToURL("/") ที่ทำให้เกิด non-precached-url error
  fallbacks: {
    document: "/offline.html",
  },
  workboxOptions: {
    disableDevLogs: true,
    // ล้าง cache เก่าที่ไม่ match build ปัจจุบันโดยอัตโนมัติ
    cleanupOutdatedCaches: true,
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
};

export default withPWA(nextConfig);
