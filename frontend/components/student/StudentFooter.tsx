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
        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "white", marginBottom: 8 }}>
          ระบบสำรวจและประเมินสุขภาพจิตนักเรียน จังหวัดเลย (LEMCS)
        </h3>
        <p style={{ fontSize: "0.82rem", color: "rgba(199,210,254,0.8)", maxWidth: 480, margin: "0 auto 24px", lineHeight: 1.7 }}>
          พัฒนาระบบเพื่อให้การประเมินและการเข้าถึงแหล่งข้อมูลช่วยเหลือนักเรียนเป็นไปอย่างปลอดภัยและมีประสิทธิภาพ
        </p>

        <div style={{
          width: "40%", height: 1, margin: "0 auto 24px",
          background: "rgba(255,255,255,0.15)",
        }} />

        <div className="flex flex-col md:flex-row justify-center items-center gap-6 md:gap-12">
          {[
            { icon: "🏢", label: "สำนักงานศึกษาธิการจังหวัดเลย" },
            { icon: "🏥", label: "โรงพยาบาลจิตเวชเลยราชนครินทร์" },
            { icon: "💻", label: "วิทยาลัยเทคนิคเลย" },
          ].map((org) => (
            <div key={org.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 38, height: 38, borderRadius: "50%",
                background: "rgba(255,255,255,0.14)", backdropFilter: "blur(6px)",
                border: "1px solid rgba(255,255,255,0.22)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.1rem",
              }}>
                {org.icon}
              </div>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
                {org.label}
              </span>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 24, paddingTop: 20,
          borderTop: "1px solid rgba(255,255,255,0.12)",
          fontSize: "0.72rem", color: "rgba(199,210,254,0.55)",
        }}>
          &copy; {new Date().getFullYear()} LEMCS Loei Educational MindCare System. สงวนลิขสิทธิ์.
        </div>
      </div>
    </footer>
  );
}
