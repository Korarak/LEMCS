import Link from "next/link";

const PARTNER_ORGS = [
  "สำนักงานศึกษาธิการจังหวัดเลย",
  "สำนักงานสาธารณสุขจังหวัดเลย",
  "โรงพยาบาลเลย",
  "โรงพยาบาลจิตเวชเลยราชนครินทร์",
  "สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาเลย หนองบัวลำภู",
  "สำนักงานเขตพื้นที่การศึกษาประถมศึกษาเลย เขต 1",
  "สำนักงานเขตพื้นที่การศึกษาประถมศึกษาเลย เขต 2",
  "สำนักงานเขตพื้นที่การศึกษาประถมศึกษาเลย เขต 3",
  "สำนักงานอาชีวศึกษาจังหวัดเลย",
  "สำนักงานส่งเสริมการเรียนรู้จังหวัดเลย",
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

        {/* Partner orgs */}
        <div style={{
          width: "40%", height: 1, margin: "0 auto 20px",
          background: "rgba(255,255,255,0.15)",
        }} />
        <p style={{ fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(199,210,254,0.45)", marginBottom: 10 }}>
          หน่วยงานร่วมดำเนินงาน
        </p>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
          {PARTNER_ORGS.map((org) => (
            <span key={org} style={{
              fontSize: "0.72rem", color: "rgba(199,210,254,0.8)",
              padding: "2px 10px",
              background: "rgba(255,255,255,0.08)",
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.12)",
            }}>
              {org}
            </span>
          ))}
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
