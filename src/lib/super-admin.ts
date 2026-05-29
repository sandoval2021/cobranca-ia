// Allowlist de Super Admin — Fase A: NUNCA mais expor lista no bundle público.
//
// A fonte da verdade é o backend (RPC `is_super_admin` no Supabase). A lista de
// e-mails permitidos vive em uma secret server-only (`SUPER_ADMIN_EMAILS`, sem
// prefixo VITE_) consumida apenas por server functions ou por queries SQL.
//
// Estas funções de cliente existem só para manter a API antiga em uso, mas
// agora retornam sempre `false`. Quem precisa decidir privilégio crítico deve
// consultar o backend.

export function isSuperAdminEmail(_email?: string | null): boolean {
  return false;
}

export function hasSuperAdminAllowlist(): boolean {
  return false;
}
