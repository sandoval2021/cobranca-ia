// Limites locais por plano e status da empresa — 100% frontend/localStorage.
// IMPORTANTE: Não é segurança real. Em produção, validar limites no backend
// (Supabase RLS/RPC + status billing). Aqui ajuda apenas a UX do protótipo.

import {
  getCompanyStatus,
  getPlanById,
  type Company,
  type CompanyModuleKey,
  type CompanyPlan,
  type CompanyStatus,
  canCompanyUseModule,
} from "@/lib/companies";
import { getActiveCompany } from "@/lib/company-scope";
import { getCurrentRole } from "@/lib/local-auth";
import { listAllScreensRaw } from "@/lib/app-screens";
import { listAllTrialLeadsRaw } from "@/lib/trial-leads";
import { listAllReferralsRaw } from "@/lib/referrals";
import { listAllFinanceEntriesRaw } from "@/lib/financeiro-local";
import { listServers } from "@/lib/server-catalog";
import { listDnsRoutes } from "@/lib/dns-routes";

export type LimitKind =
  | "clientes"
  | "telas"
  | "testes"
  | "servidores"
  | "dns"
  | "financeiro"
  | "campanhas"
  | "indicacoes"
  | "backup"
  | "ia"
  | "geral";

export type LimitAction = "criar" | "editar" | "usar";

export type LimitDecision = {
  allowed: boolean;
  reason?:
    | "no_company"
    | "company_blocked"
    | "company_suspended"
    | "company_canceled"
    | "company_expired"
    | "module_locked"
    | "limit_reached"
    | "plan_missing";
  message?: string;
  used?: number;
  limit?: number;
  status?: CompanyStatus | "sem_empresa";
  plan?: CompanyPlan | null;
};

const MODULE_BY_KIND: Partial<Record<LimitKind, CompanyModuleKey>> = {
  clientes: "clientes",
  telas: "telas_app",
  testes: "testes",
  servidores: "servidores",
  dns: "dns_rotas",
  financeiro: "financeiro",
  campanhas: "campanhas",
  indicacoes: "indicacoes",
  backup: "backup",
  ia: "base_ia",
};

export function getActiveCompanyPlan(): CompanyPlan | null {
  const c = getActiveCompany();
  return getPlanById(c?.plano_id);
}

// ---------- Cálculo de uso por empresa ----------

function countByCompany(items: { company_id?: string | null }[], companyId: string): number {
  return items.filter((r) => r.company_id === companyId).length;
}

export type CompanyUsage = {
  clientes: number; // clientes únicos (customer_id em screens)
  telas: number;
  testes: number;
  servidores: number;
  dns_rotas: number;
  financeiro_entradas: number;
  indicacoes: number;
};

export function getCompanyUsage(companyId: string | null | undefined): CompanyUsage {
  if (!companyId) {
    return { clientes: 0, telas: 0, testes: 0, servidores: 0, dns_rotas: 0, financeiro_entradas: 0, indicacoes: 0 };
  }
  // Telas/clientes
  const all = listAllScreensRaw();
  let telas = 0;
  const customers = new Set<string>();
  for (const [cid, list] of Object.entries(all)) {
    const arr = (list || []).filter((s) => s.company_id === companyId);
    if (arr.length > 0) customers.add(cid);
    telas += arr.length;
  }
  // Testes
  const testes = countByCompany(listAllTrialLeadsRaw(), companyId);
  // Indicações
  const indicacoes = countByCompany(listAllReferralsRaw(), companyId);
  // Financeiro
  const financeiro_entradas = countByCompany(listAllFinanceEntriesRaw(), companyId);
  // Servidores/DNS — atualmente são globais (sem company_id). Reportamos 0 por enquanto
  // mas mantemos a estrutura para o futuro.
  const servidores = (listServers() as unknown as { company_id?: string | null }[])
    .filter((s) => s.company_id === companyId).length;
  const dns_rotas = (listDnsRoutes() as unknown as { company_id?: string | null }[])
    .filter((r) => r.company_id === companyId).length;

  return { clientes: customers.size, telas, testes, servidores, dns_rotas, financeiro_entradas, indicacoes };
}

export type PlanLimitsView = {
  clientes: number;
  telas: number;
  testes: number;
  servidores: number;
};

export function getPlanLimits(companyId?: string | null): PlanLimitsView {
  const c = companyId ? null : getActiveCompany();
  const plan = getPlanById(c?.plano_id ?? null) ?? getActiveCompanyPlan();
  return {
    clientes: plan?.limite_clientes ?? 0,
    telas: plan?.limite_telas ?? 0,
    testes: plan?.limite_testes ?? 0,
    servidores: plan?.limite_servidores ?? 0,
  };
}

// ---------- Status de bloqueio da empresa ----------

export function getCompanyBlockedReason(company: Company | null): LimitDecision["reason"] | null {
  if (!company) return "no_company";
  const status = getCompanyStatus(company);
  if (status === "cancelada") return "company_canceled";
  if (status === "suspensa") return "company_suspended";
  if (status === "vencida") return "company_expired";
  return null;
}

// ---------- Verificador principal ----------

function blockedByCompanyStatus(reason: LimitDecision["reason"]): LimitDecision {
  const msg =
    reason === "company_canceled"
      ? "Painel cancelado. Fale com o suporte."
      : reason === "company_suspended"
      ? "Painel suspenso. Fale com o suporte para reativar."
      : reason === "company_expired"
      ? "Painel vencido. Renove para liberar novas ações."
      : "Sem empresa vinculada.";
  return { allowed: false, reason, message: msg };
}

export function checkPlanLimit(kind: LimitKind, action: LimitAction = "criar"): LimitDecision {
  const role = getCurrentRole();
  const company = getActiveCompany();

  // Super Admin em visão global: nunca bloqueia.
  if (role === "super_admin" && !company) {
    return { allowed: true };
  }

  if (!company) {
    return { allowed: false, reason: "no_company", message: "Sua conta ainda não está vinculada a uma empresa.", status: "sem_empresa" };
  }

  const plan = getPlanById(company.plano_id);
  if (!plan) {
    return { allowed: false, reason: "plan_missing", message: "Plano não encontrado.", status: getCompanyStatus(company) };
  }

  const statusReason = getCompanyBlockedReason(company);
  const allowedWhenBlocked: LimitKind[] = ["backup", "geral"];
  const isEdit = action === "editar";

  if (statusReason && action === "criar" && !allowedWhenBlocked.includes(kind)) {
    return { ...blockedByCompanyStatus(statusReason), plan, status: getCompanyStatus(company) };
  }

  const moduleKey = MODULE_BY_KIND[kind];
  if (moduleKey && !canCompanyUseModule(company, moduleKey)) {
    return {
      allowed: false,
      reason: "module_locked",
      message: `O módulo "${kind}" não está liberado no plano ${plan.nome}.`,
      plan,
      status: getCompanyStatus(company),
    };
  }

  // Limites quantitativos (apenas em criação)
  if (action === "criar") {
    const usage = getCompanyUsage(company.id);
    let used = 0;
    let limit = Infinity;
    switch (kind) {
      case "clientes":
        used = usage.clientes; limit = plan.limite_clientes; break;
      case "telas":
        used = usage.telas; limit = plan.limite_telas; break;
      case "testes":
        used = usage.testes; limit = plan.limite_testes; break;
      case "servidores":
        used = usage.servidores; limit = plan.limite_servidores; break;
      default:
        limit = Infinity;
    }
    if (Number.isFinite(limit) && used >= limit) {
      return {
        allowed: false,
        reason: "limit_reached",
        message: `Limite do plano atingido: ${used} de ${limit}.`,
        used, limit, plan, status: getCompanyStatus(company),
      };
    }
    return { allowed: true, used, limit, plan, status: getCompanyStatus(company) };
  }

  // editar/usar: status vencida/suspensa não impede edição, apenas criação
  if (isEdit) return { allowed: true, plan, status: getCompanyStatus(company) };
  return { allowed: true, plan, status: getCompanyStatus(company) };
}

// ---------- Atalhos por área ----------

export function canCreateCustomer(): LimitDecision { return checkPlanLimit("clientes", "criar"); }
export function canCreateScreen(): LimitDecision { return checkPlanLimit("telas", "criar"); }
export function canCreateTrialLead(): LimitDecision { return checkPlanLimit("testes", "criar"); }
export function canCreateServer(): LimitDecision { return checkPlanLimit("servidores", "criar"); }
export function canCreateDnsRoute(): LimitDecision { return checkPlanLimit("dns", "criar"); }
export function canUseFinance(): LimitDecision { return checkPlanLimit("financeiro", "usar"); }
export function canUseCampaigns(): LimitDecision { return checkPlanLimit("campanhas", "criar"); }
export function canUseReferrals(): LimitDecision { return checkPlanLimit("indicacoes", "criar"); }
export function canUseBackup(): LimitDecision { return checkPlanLimit("backup", "usar"); }
export function canUseAiBase(): LimitDecision { return checkPlanLimit("ia", "usar"); }

// Aviso curto para UI (texto curto sem componente).
export function getLimitWarning(kind: LimitKind): string | null {
  const d = checkPlanLimit(kind, "criar");
  if (d.allowed) {
    if (Number.isFinite(d.limit ?? Infinity) && d.used != null && d.limit != null) {
      const left = d.limit - d.used;
      if (left <= 3) return `Próximo do limite do plano: ${d.used}/${d.limit}.`;
    }
    return null;
  }
  return d.message ?? "Ação bloqueada pelo plano.";
}
