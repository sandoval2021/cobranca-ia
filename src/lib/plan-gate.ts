// Helper centralizador para fechar ações por plano/status.
// Usa checkPlanLimit existente e toast amigável padronizado.
import { toast } from "sonner";
import { checkPlanLimit, type LimitAction, type LimitKind } from "@/lib/plan-limits";

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
 * Verifica o gate de plano para uma ação. Se bloqueado, dispara toast amigável
 * e retorna { allowed: false }. Super Admin sem empresa nunca é bloqueado.
 */
export function ensurePlanAction(
  kind: LimitKind,
  action: LimitAction = "criar",
  overrideMessage?: string,
): PlanGateResult {
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
