/**
 * Client-side JWT helpers — decode without verification (backend already verified).
 * Never use for security decisions; use for UX only (menu hiding, redirects).
 */

export type AdminRole = "systemadmin" | "superadmin" | "commissionadmin" | "schooladmin";

function decodeToken(token: string): Record<string, unknown> | null {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

export function getAdminRole(): AdminRole | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("access_token") ?? localStorage.getItem("lemcs_token");
  if (!token) return null;
  const payload = decodeToken(token);
  const role = payload?.role as string | undefined;
  if (!role || role === "student") return null;
  return role as AdminRole;
}

/** Returns true if the current user has at least one of the given roles */
export function hasRole(...roles: AdminRole[]): boolean {
  const role = getAdminRole();
  return role !== null && roles.includes(role);
}
