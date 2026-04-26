"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { getAdminRole, type AdminRole } from "@/lib/auth";

type NavItem = { href: string; label: string; icon: string; roles?: AdminRole[] };
type NavSection = { label: string; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    label: "ภาพรวม",
    items: [
      { href: "/admin/dashboard", label: "ภาพรวม",      icon: "📊" },
      { href: "/admin/alerts",    label: "การแจ้งเตือน", icon: "🚨" },
      { href: "/admin/reports",   label: "รายงาน",       icon: "📋" },
    ],
  },
  {
    label: "จัดการข้อมูล",
    items: [
      { href: "/admin/organization",  label: "สังกัด / เขตพื้นที่",      icon: "🏛️", roles: ["systemadmin"] },
      { href: "/admin/schools",       label: "โรงเรียน",               icon: "🏫", roles: ["systemadmin", "superadmin"] },
      { href: "/admin/students",      label: "นักเรียน",               icon: "👥" },
      { href: "/admin/proxy-assess",  label: "กรอกแบบประเมินชั้นเรียน", icon: "📋", roles: ["schooladmin"] },
    ],
  },
  {
    label: "ระบบ",
    items: [
      { href: "/admin/survey-rounds", label: "รอบการสำรวจ",        icon: "📅", roles: ["systemadmin", "superadmin"] },
      { href: "/admin/users",        label: "ผู้ใช้งาน",          icon: "👤", roles: ["systemadmin", "superadmin"] },
      { href: "/admin/import",     label: "นำเข้าข้อมูล",        icon: "📥", roles: ["systemadmin", "schooladmin"] },
      { href: "/admin/import-skr", label: "นำเข้าข้อมูล สกร.",   icon: "📗", roles: ["systemadmin", "superadmin"] },
      { href: "/admin/audit-logs", label: "Audit Log",            icon: "🔍", roles: ["systemadmin", "superadmin"] },
      { href: "/admin/committee",  label: "คณะกรรมการดำเนินงาน", icon: "📜" },
      { href: "/admin/settings",   label: "ตั้งค่าระบบ",         icon: "⚙️", roles: ["systemadmin"] },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [role, setRole] = useState<AdminRole | null>(null);

  useEffect(() => { setRole(getAdminRole()); }, []);

  function visibleItems(items: NavItem[]): NavItem[] {
    if (!role) return [];
    return items.filter(item => !item.roles || item.roles.includes(role));
  }

  return (
    <ToastProvider>
    <div className="drawer lg:drawer-open">
      <input
        id="admin-drawer"
        type="checkbox"
        className="drawer-toggle"
        checked={drawerOpen}
        onChange={e => setDrawerOpen(e.target.checked)}
      />

      <div className="drawer-content flex flex-col">
        {/* Mobile Navbar */}
        <div className="navbar bg-base-100 shadow-sm lg:hidden">
          <label htmlFor="admin-drawer" className="btn btn-ghost drawer-button">☰</label>
          <span className="font-bold text-primary">💙 LEMCS Admin</span>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6 bg-base-200/30 min-h-screen">
          {children}
        </main>
      </div>

      {/* Sidebar */}
      <div className="drawer-side z-50">
        <label htmlFor="admin-drawer" className="drawer-overlay" />
        <aside className="min-h-screen w-64 bg-base-100 flex flex-col border-r border-base-200">
          {/* Logo */}
          <div className="p-5 border-b border-base-200">
            <p className="font-bold text-primary text-xl tracking-tight">💙 LEMCS</p>
            <p className="text-xs text-base-content/70 mt-0.5 font-medium">Loei Educational MindCare System</p>
            <p className="text-xs text-base-content/40 mt-0.5 leading-tight">ระบบคัดกรองสุขภาพจิตนักเรียน<br/>จังหวัดเลย</p>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
            {NAV_SECTIONS.map(section => {
              const items = visibleItems(section.items);
              if (!items.length) return null;
              return (
              <div key={section.label}>
                <p className="text-xs font-semibold text-base-content/40 uppercase tracking-widest px-2 mb-1">
                  {section.label}
                </p>
                <div className="space-y-0.5">
                  {items.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setDrawerOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${
                        pathname === item.href
                          ? "bg-primary text-primary-content font-medium shadow-sm"
                          : "hover:bg-base-200 text-base-content/80"
                      }`}
                    >
                      <span className="text-base">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-3 border-t border-base-200">
            <button
              className="flex items-center gap-3 px-3 py-2 rounded-lg w-full text-sm text-error hover:bg-error/10 transition-colors"
              onClick={() => setConfirmLogout(true)}
            >
              <span>🚪</span>
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </aside>
      </div>
    </div>
      <ConfirmModal
        open={confirmLogout}
        title="ออกจากระบบ"
        message="ต้องการออกจากระบบใช่หรือไม่?"
        confirmLabel="ออกจากระบบ"
        confirmClass="btn-error"
        onConfirm={() => {
          localStorage.removeItem("access_token");
          localStorage.removeItem("lemcs_token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/admin-login";
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </ToastProvider>
  );
}
