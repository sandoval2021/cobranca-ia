// Permissões e filtro de rotas por perfil — apenas frontend/local.
// Em produção, a segurança real deve vir de RLS + backend.

import type { LocalRole } from "@/lib/local-auth";

// Rotas que apenas Super Admin pode acessar
export const SUPER_ADMIN_ONLY_ROUTES: string[] = [
  "/admin-dns-rotas",
  "/preparacao-backend",
  "/diagnostico",
  "/seguranca-local",
  "/catalogo-servidores",
  "/configuracoes",
  "/empresas",
  "/regras-disparo",
  "/base-conhecimento",
  "/importar-clientes",
  "/cobrancas",
  "/mensagens",
  "/ia",
  "/fila-simulada",
  "/relatorio",
];

// Rotas sempre permitidas para Owner
export const OWNER_ALLOWED_ROUTES: string[] = [
  "/",
  "/auth",
  "/acesso-restrito",
  "/configuracao-inicial",
  "/clientes",
  "/operacao-dia",
  "/campanhas-manuais",
  "/pendencias",
  "/testes",
  "/indicacoes",
  "/financeiro",
  "/configuracoes-revenda",
  "/backup-geral",
  "/ajuda",
];

export function isSuperAdminOnlyRoute(path: string): boolean {
  return SUPER_ADMIN_ONLY_ROUTES.some((p) => path === p || path.startsWith(p + "/"));
}

export function canAccessRoute(role: LocalRole, path: string): boolean {
  if (role === "super_admin") return true;
  if (isSuperAdminOnlyRoute(path)) return false;
  return (
    OWNER_ALLOWED_ROUTES.some((p) => path === p || path.startsWith(p + "/")) ||
    !isSuperAdminOnlyRoute(path)
  );
}

export function roleLabel(role: LocalRole): string {
  return role === "super_admin" ? "Admin do sistema" : "Dono";
}
