// Allowlist de Super Admin baseada em e-mail.
// Configurável via secret VITE_SUPER_ADMIN_EMAILS (lista separada por vírgulas).
// Fonte da verdade no frontend; o backend deve ter sua própria proteção (RLS).
const RAW =
  (import.meta.env.VITE_SUPER_ADMIN_EMAILS as string | undefined) ??
  (import.meta.env.VITE_SUPER_ADMIN_EMAIL as string | undefined) ??
  "";

const ALLOWLIST = RAW.split(/[\s,;]+/)
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ALLOWLIST.includes(email.trim().toLowerCase());
}

export function hasSuperAdminAllowlist(): boolean {
  return ALLOWLIST.length > 0;
}
