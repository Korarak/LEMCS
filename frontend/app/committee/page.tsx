import Link from "next/link";
import CommitteeContent from "@/components/committee/CommitteeContent";

export const metadata = {
  title: "คณะกรรมการดำเนินงาน — LEMCS",
};

export default function CommitteePage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #f8fafc 0%, #eef2ff 55%, #f5f3ff 100%)",
    }}>
      {/* Header */}
      <header style={{
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(99,102,241,0.12)",
        boxShadow: "0 1px 12px rgba(99,102,241,0.07)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 8px rgba(99,102,241,0.30)",
              fontSize: "1.1rem",
            }}>🧠</div>
            <div>
              <div style={{ color: "#1e1b4b", fontWeight: 800, fontSize: "1.05rem", lineHeight: 1.2 }}>
                LEMCS
              </div>
              <div className="hidden sm:block" style={{ color: "#818cf8", fontSize: "0.68rem", fontWeight: 500 }}>
                Loei Educational MindCare System
              </div>
            </div>
          </div>
          <Link
            href="/login"
            style={{
              background: "transparent",
              border: "1px solid rgba(99,102,241,0.3)",
              color: "#4f46e5",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: "0.8rem",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            เข้าสู่ระบบ
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">คณะกรรมการดำเนินงาน</h1>
          <p className="text-sm text-gray-500 mt-1">
            ประกาศสำนักงานศึกษาธิการจังหวัดเลย — แต่งตั้งคณะทำงานป้องกันและแก้ไขปัญหา
            สุขภาพจิตนักเรียน นักศึกษาในสถานศึกษาจังหวัดเลย
          </p>
        </div>
        <CommitteeContent />
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid rgba(99,102,241,0.1)",
        background: "rgba(255,255,255,0.6)",
        padding: "20px 16px",
        textAlign: "center",
        fontSize: "0.75rem",
        color: "rgba(107,114,128,0.7)",
      }}>
        &copy; {new Date().getFullYear()} LEMCS — Loei Educational MindCare System
      </footer>
    </div>
  );
}
