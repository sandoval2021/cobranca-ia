// Server-only helpers: gate de uso de IA por empresa.
// NUNCA importar de código cliente.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AiCycleRow = {
  id: string;
  company_id: string;
  cycle_start: string;
  cycle_end: string;
  base_limit: number;
  extra_limit: number;
  used_count: number;
  last_increment_at: string | null;
  warned_70_at: string | null;
  warned_90_at: string | null;
  blocked_at: string | null;
};

export type QuotaCheck = {
  allowed: boolean;
  reason?: "limit_reached" | "no_cycle" | "no_company";
  cycle?: AiCycleRow;
  used: number;
  total: number;
  percent: number;
  remaining: number;
};

/**
 * Verifica/cria o ciclo de IA da empresa e diz se ainda há saldo.
 * Não incrementa nada — chame {@link incrementAiUsage} APÓS enviar a resposta.
 */
export async function ensureAiQuota(companyId: string): Promise<QuotaCheck> {
  if (!companyId) {
    return { allowed: false, reason: "no_company", used: 0, total: 0, percent: 0, remaining: 0 };
  }
  const { data, error } = await supabaseAdmin.rpc("get_or_create_current_ai_cycle", {
    _company_id: companyId,
  });
  if (error || !data) {
    console.error("[ai-quota] ensure failed", error?.message);
    return { allowed: false, reason: "no_cycle", used: 0, total: 0, percent: 0, remaining: 0 };
  }
  const cycle = data as AiCycleRow;
  const total = (cycle.base_limit ?? 0) + (cycle.extra_limit ?? 0);
  const used = cycle.used_count ?? 0;
  const remaining = Math.max(0, total - used);
  const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return {
    allowed: total === 0 ? false : used < total,
    reason: used >= total ? "limit_reached" : undefined,
    cycle,
    used,
    total,
    percent,
    remaining,
  };
}

/** Incrementa atomicamente o contador de respostas IA no ciclo atual. */
export async function incrementAiUsage(companyId: string): Promise<AiCycleRow | null> {
  if (!companyId) return null;
  const { data, error } = await supabaseAdmin.rpc("increment_ai_usage", { _company_id: companyId });
  if (error) {
    console.error("[ai-quota] increment failed", error.message);
    return null;
  }
  return (data as AiCycleRow) ?? null;
}

/** Marca a assinatura como pausada por limite e registra timestamp do bloqueio. */
export async function markPausedByLimit(companyId: string, cycleId?: string): Promise<void> {
  const now = new Date().toISOString();
  await supabaseAdmin
    .from("company_subscriptions")
    .update({ status: "paused_limit", paused_limit_notified_at: now, updated_at: now })
    .eq("company_id", companyId);
  if (cycleId) {
    await supabaseAdmin
      .from("company_ai_usage_cycle")
      .update({ blocked_at: now, updated_at: now })
      .eq("id", cycleId);
  }
}
