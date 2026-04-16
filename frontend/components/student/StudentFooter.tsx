import Link from "next/link";

const ORGS = [
  { icon: "🏢", label: "สำนักงานศึกษาธิการจังหวัดเลย" },
  { icon: "🏥", label: "โรงพยาบาลจิตเวชเลยราชนครินทร์" },
  { icon: "💻", label: "วิทยาลัยเทคนิคเลย" },
];

const DEV_TEAM = [
  { name: "กรรัก พร้อมจะบก",       role: "Developer" },
  { name: "สวรินทร์ จันทร์สว่าง",  role: "QA & Docs" },
  { name: "สุริยะ วิไลวงศ์",        role: "Senior Advisor" },
];

export default function StudentFooter() {
  return (
    <footer style={{
      background: "linear-gradient(155deg, #1e40af 0%, #4338ca 40%, #7c3aed 100%)",
      position: "relative", overflow: "hidden",
      paddingTop: 32, paddingBottom: 48,
    }}>
      {/* Dot grid */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.1, pointerEvents: "none",
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,.7) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }} />
      {/* Decorative circle */}
      <div style={{
        position: "absolute", bottom: -60, right: -60, width: 200, height: 200,
        borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none",
      }} />

      <div className="max-w-4xl mx-auto px-4 text-center" style={{ position: "relative" }}>
        {/* Title */}
        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "white", marginBottom: 4 }}>
          ระบบคัดกรองสุขภาพจิตนักเรียน จังหวัดเลย
        </h3>
        <p style={{ fontSize: "0.75rem", color: "rgba(199,210,254,0.65)", marginBottom: 20 }}>
          Loei Educational MindCare System (LEMCS)
        </p>

        {/* Orgs */}
        <div style={{
          width: "40%", height: 1, margin: "0 auto 20px",
          background: "rgba(255,255,255,0.15)",
        }} />
        <div className="flex flex-col md:flex-row justify-center items-center gap-5 md:gap-10">
          {ORGS.map((org) => (
            <div key={org.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 34, height: 34, borderRadius: "50%",
                background: "rgba(255,255,255,0.13)", border: "1px solid rgba(255,255,255,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1rem", flexShrink: 0,
              }}>
                {org.icon}
              </div>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "rgba(255,255,255,0.88)" }}>
                {org.label}
              </span>
            </div>
          ))}
        </div>

        {/* Dev team */}
        <div style={{
          marginTop: 22, paddingTop: 18,
          borderTop: "1px solid rgba(255,255,255,0.12)",
        }}>
          <p style={{ fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(199,210,254,0.45)", marginBottom: 10 }}>
            ทีมพัฒนาระบบ
          </p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-1">
            {DEV_TEAM.map((m) => (
              <span key={m.name} style={{ fontSize: "0.75rem", color: "rgba(199,210,254,0.75)" }}>
                {m.name}
                <span style={{ color: "rgba(199,210,254,0.4)", marginLeft: 5, fontSize: "0.68rem" }}>
                  {m.role}
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* Copyright */}
        <div style={{
          marginTop: 18, paddingTop: 16,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          fontSize: "0.7rem", color: "rgba(199,210,254,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 16,
          flexWrap: "wrap",
        }}>
          <span>&copy; {new Date().getFullYear()} LEMCS. สงวนลิขสิทธิ์.</span>
          <Link
            href="/committee"
            style={{ color: "rgba(199,210,254,0.55)", textDecoration: "none", borderBottom: "1px solid rgba(199,210,254,0.25)" }}
          >
            คณะกรรมการดำเนินงาน
          </Link>
        </div>
      </div>
    </footer>
  );
}
