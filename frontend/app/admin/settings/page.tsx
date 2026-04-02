"use client";

export default function SettingsPage() {
  const testUsers = [
    { username: "admin",       role: "systemadmin",     scope: "ดู+จัดการทุกอย่าง" },
    { username: "superadmin",  role: "superadmin",      scope: "ศธจ.เลย — ดูทุกสังกัด" },
    { username: "spp1admin",   role: "commissionadmin", scope: "สพป.เลย เขต 1" },
    { username: "vocadmin",    role: "commissionadmin", scope: "อาชีวศึกษา" },
    { username: "school_lp",   role: "schooladmin",     scope: "รร.เลยพิทยาคม" },
    { username: "school_ml",   role: "schooladmin",     scope: "รร.เมืองเลย" },
  ];

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">⚙️ ตั้งค่าระบบ</h1>
        <p className="text-base-content/60 text-sm">ข้อมูลระบบและรหัสทดสอบ</p>
      </div>

      {/* System Info */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title text-base">🖥️ ข้อมูลระบบ</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="text-base-content/60">ระบบ</div>
            <div className="font-medium">LEMCS — Loei Educational MindCare System</div>
            <div className="text-base-content/60">เวอร์ชัน</div>
            <div className="font-medium">1.0.0</div>
            <div className="text-base-content/60">Backend API</div>
            <div className="font-mono text-sm">
              <a href={`${apiBase}/docs`} target="_blank" className="link link-primary">{apiBase}/docs</a>
            </div>
            <div className="text-base-content/60">Framework</div>
            <div>Next.js 14 + FastAPI + PostgreSQL</div>
          </div>
        </div>
      </div>

      {/* Test Accounts */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title text-base">🔑 รหัสทดสอบ</h2>
          <p className="text-sm text-base-content/60 mb-3">รหัสผ่านทุกบัญชี: <code className="badge badge-ghost">password123</code></p>
          <div className="overflow-x-auto">
            <table className="table table-zebra text-sm">
              <thead>
                <tr><th>Username</th><th>Role</th><th>ขอบเขต</th></tr>
              </thead>
              <tbody>
                {testUsers.map(u => (
                  <tr key={u.username}>
                    <td><code className="font-mono">{u.username}</code></td>
                    <td><span className="badge badge-ghost badge-sm">{u.role}</span></td>
                    <td className="text-base-content/70">{u.scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title text-base">🔗 ลิงก์ด่วน</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "API Docs (Swagger)", href: `${apiBase}/docs`, icon: "📚" },
              { label: "Student Login", href: "/login", icon: "👤" },
              { label: "Admin Login", href: "/admin-login", icon: "🔐" },
            ].map(l => (
              <a key={l.href} href={l.href} target={l.href.startsWith("http") ? "_blank" : "_self"}
                className="btn btn-outline btn-sm justify-start gap-2">
                {l.icon} {l.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
