// Permissões e filtro de rotas por perfil — apenas frontend/local.
// Em produção, a segurança real deve vir de RLS + backend.

import type { LocalRole } from "@/lib/local-auth";
import {
  ROUTE_TO_MODULE,
  canCompanyUseModule,
  getCompanyStatus,
  type Company,
} from "@/lib/companies";

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
  // "/importar-clientes" — liberado para Dono importar a própria base (escopada por p_company_id).
  "/cobrancas",
  "/mensagens",
  "/ia",
  "/fila-simulada",
  "/relatorio",
];

// Rotas sempre permitidas para Owner mesmo sem empresa atual
export const OWNER_ALLOWED_ROUTES: string[] = [
  "/",
  "/auth",
  "/acesso-restrito",
  "/configuracao-inicial",
  "/ajuda",
  "/configuracoes-revenda",
];

export function isSuperAdminOnlyRoute(path: string): boolean {
  return SUPER_ADMIN_ONLY_ROUTES.some((p) => path === p || path.startsWith(p + "/"));
}

export function canAccessRoute(role: LocalRole, path: string): boolean {
  if (role === "super_admin") return true;
  if (isSuperAdminOnlyRoute(path)) return false;
  return true;
}

export type AccessDenialReason = "super_admin_only" | "plan_locked" | "company_suspended" | "no_company";

export function describeDenial(reason: AccessDenialReason): string {
  switch (reason) {
    case "super_admin_only":
      return "Esta área é exclusiva do Admin do sistema.";
    case "plan_locked":
      return "Este módulo não está liberado no seu plano.";
    case "company_suspended":
      return "Seu painel está vencido ou suspenso. Fale com o suporte para reativar.";
    case "no_company":
      return "Sua conta ainda não está vinculada a uma empresa.";
  }
}

// Owner-only: verifica rota considerando empresa atual e plano.
export function ownerRouteDenial(
  path: string,
  company: Company | null,
): AccessDenialReason | null {
  if (isSuperAdminOnlyRoute(path)) return "super_admin_only";
  // Rotas sempre liberadas
  if (OWNER_ALLOWED_ROUTES.some((p) => path === p || path.startsWith(p + "/"))) return null;
  if (!company) return "no_company";
  const status = getCompanyStatus(company);
  const blockedStatus = status === "vencida" || status === "suspensa" || status === "cancelada";
  const mod = ROUTE_TO_MODULE[path];
  if (mod && !canCompanyUseModule(company, mod)) return "plan_locked";
  if (blockedStatus) {
    // Em status bloqueado, libera apenas algumas rotas básicas
    const allowedWhenBlocked = ["/ajuda", "/configuracoes-revenda", "/backup-geral", "/financeiro", "/"];
    if (!allowedWhenBlocked.includes(path)) return "company_suspended";
  }
  return null;
}

export function roleLabel(role: LocalRole): string {
  switch (role) {
    case "super_admin":
      return "Admin do sistema";
    case "owner":
      return "Dono";
    case "admin":
    case "member":
      return "Admin";
  }
}
