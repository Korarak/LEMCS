import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "LEMCS — ระบบประเมินสุขภาพจิตนักเรียน จ.เลย",
  description: "ระบบสำรวจและประเมินความเครียดและภาวะซึมเศร้าในนักเรียน จ.เลย",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#3B82F6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" data-theme="lemcs">
      <body className={`${notoSansThai.className} bg-base-200 min-h-screen text-base-content antialiased`}>
        {children}
      </body>
    </html>
  );
}
