"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hasRole, type AdminRole } from "@/lib/auth";

interface Props {
  roles: AdminRole[];
  children: React.ReactNode;
}

/**
 * Renders children only if the current user has one of the required roles.
 * Redirects to /admin/dashboard otherwise.
 * This is a UX guard — backend is the authoritative security layer.
 */
export default function RoleGuard({ roles, children }: Props) {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const ok = hasRole(...roles);
    setAllowed(ok);
    if (!ok) router.replace("/admin/dashboard");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (allowed === null) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }
  if (!allowed) return null;
  return <>{children}</>;
}
