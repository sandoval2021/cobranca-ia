// Helper centralizador para fechar ações por plano/status.
// Usa checkPlanLimit existente e toast amigável padronizado.
import { toast } from "sonner";
import { checkPlanLimit, type LimitAction, type LimitKind } from "@/lib/plan-limits";
import { getCurrentLocalUser, isSuperAdmin } from "@/lib/local-auth";
import { getActiveCompany } from "@/lib/company-scope";
import { getCompanyStatus } from "@/lib/companies";

const DEFAULTS: Partial<Record<LimitKind, string>> = {
  clientes: "Sua conta está vencida. Renove para cadastrar novos clientes.",
  testes: "Renove sua conta para criar novos testes grátis.",
  telas: "Renove sua conta para cadastrar novas telas/aplicativos.",
  servidores: "Renove sua conta para cadastrar novos servidores.",
};
const CHARGE_MSG = "Renove sua conta para enviar novas cobranças.";

const IMPORT_MSG = "Renove sua conta para importar novos clientes.";
const SERVICE_MSG = "Renove sua conta para alterar seus serviços.";

export type PlanGateResult = { allowed: boolean; message?: string };

/**
 * Detecta se o estado de sessão/empresa ainda não terminou de carregar.
 * Quando true, NÃO devemos disparar alertas de bloqueio (evita falso positivo
 * no refresh enquanto Supabase + scope local estão hidratando).
 */
function isAuthStateLoading(): boolean {
  if (typeof window === "undefined") return true;
  const localUser = getCurrentLocalUser();
  // Sem sessão local restaurada ainda → considerar loading.
  if (!localUser) return true;
  // Owner sem empresa resolvida ainda → loading (será hidratada por syncDefaultCompanyForUser).
  if (localUser.role === "owner" && !getActiveCompany()) return true;
  return false;
}

/**
 * Verifica o gate de plano para uma ação. Se bloqueado, dispara toast amigável
 * e retorna { allowed: false }. Super Admin nunca é bloqueado.
 * Enquanto o estado de auth/empresa ainda está carregando, NÃO mostra alerta.
 */
export function ensurePlanAction(
  kind: LimitKind,
  action: LimitAction = "criar",
  overrideMessage?: string,
): PlanGateResult {
  // Super admin nunca vê alerta de renovação.
  if (isSuperAdmin()) return { allowed: true };

  // Enquanto o estado está carregando, não mostra alerta falso.
  if (isAuthStateLoading()) return { allowed: true };

  // Se a empresa tem plano válido (teste/ativa), não mostra alerta de renovação.
  const company = getActiveCompany();
  if (company) {
    const status = getCompanyStatus(company);
    if (status === "teste" || status === "ativa") {
      // Mesmo assim respeita limites quantitativos/módulos.
      const d = checkPlanLimit(kind, action);
      if (d.allowed) return { allowed: true };
      // Bloqueio real (limite/módulo), não é renovação — usa mensagem do decision.
      const msg = d.message ?? "Ação bloqueada pelo plano atual.";
      toast.error(msg, {
        description: "Acesse Meus dados para ver seu plano ou fale com o suporte.",
      });
      return { allowed: false, message: msg };
    }
  }

  const d = checkPlanLimit(kind, action);
  if (d.allowed) return { allowed: true };
  const msg = overrideMessage ?? DEFAULTS[kind] ?? d.message ?? "Ação bloqueada pelo plano atual.";
  toast.error(msg, {
    description: "Acesse Meus dados para ver seu plano ou fale com o suporte.",
  });
  return { allowed: false, message: msg };
}

export function ensureCanImportCustomers(): PlanGateResult {
  return ensurePlanAction("clientes", "criar", IMPORT_MSG);
}

export function ensureCanCreateCharge(): PlanGateResult {
  return ensurePlanAction("clientes", "criar", CHARGE_MSG);
}

export function ensureCanEditService(): PlanGateResult {
  return ensurePlanAction("geral", "criar", SERVICE_MSG);
}

