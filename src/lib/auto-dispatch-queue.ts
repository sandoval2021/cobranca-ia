// Computa a fila de disparos automáticos de hoje (compartilhado entre painel e filtros).
import {
  computeScheduleTime,
  getAutoDispatchConfig,
  getCancelled,
  getSent,
  type AutoDispatchConfig,
} from "@/lib/auto-dispatch";
import { applyTemplate, listRules, pickRule } from "@/lib/manual-dispatch-rules";
import { nextDueDays, type AppScreen } from "@/lib/app-screens";
import { getCustomerDueOverride } from "@/lib/customer-due-override";

export type QueueClientLike = {
  id: string;
  name: string;
  whatsapp: string | null;
  due_day: number | null;
  amount_cents: number | null;
};

export type AutoDispatchQueueItem = {
  client: QueueClientLike;
  daysUntilDue: number;
  ruleId: string;
  ruleName: string;
  scheduleTime: Date;
  message: string;
  cancelled: boolean;
  sent: boolean;
  order: number; // posição planejada (0 = primeiro)
};

function onlyDigits(s: string) { return (s || "").replace(/\D+/g, ""); }
function fmtBRL(cents: number | null) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
function fmtDueDateBR(daysUntil: number): string {
  const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + daysUntil);
  return d.toLocaleDateString("pt-BR");
}

export function computeAutoDispatchQueue(
  items: QueueClientLike[] | null,
  allScreens: Record<string, AppScreen[]>,
  cfg: AutoDispatchConfig = getAutoDispatchConfig(),
): AutoDispatchQueueItem[] {
  if (!items) return [];
  const rules = listRules();
  const cancelled = getCancelled();
  const sent = getSent();

  type Cand = { client: QueueClientLike; days: number; rule: NonNullable<ReturnType<typeof pickRule>> };
  const candidates: Cand[] = [];
  for (const c of items) {
    const screens = allScreens[c.id] ?? [];
    const overrideIso = getCustomerDueOverride(c.id);
    let days: number;
    if (overrideIso) {
      const today = new Date(); today.setHours(0,0,0,0);
      const dt = new Date(overrideIso + "T00:00:00");
      days = Math.floor((+dt - +today) / (1000 * 60 * 60 * 24));
    } else {
      const nd = nextDueDays(c.due_day, screens);
      if (nd == null) continue;
      days = nd as number;
    }
    if (!Number.isFinite(days)) continue;
    const rule = pickRule(days, rules);
    if (!rule) continue;
    const elapsed = -days;
    if (rule.daysOffset !== elapsed) continue;
    if (rule.blockNoWhatsapp && !onlyDigits(c.whatsapp ?? "")) continue;
    candidates.push({ client: c, days, rule });
  }
  candidates.sort((a, b) => a.days - b.days);
  const limited = candidates.slice(0, cfg.maxPerDay);
  return limited.map((cand, i): AutoDispatchQueueItem => {
    const vars = {
      nome: cand.client.name,
      whatsapp: cand.client.whatsapp,
      vencimento: fmtDueDateBR(cand.days),
      dias: Math.abs(cand.days),
      valor: fmtBRL(cand.client.amount_cents),
    };
    return {
      client: cand.client,
      daysUntilDue: cand.days,
      ruleId: cand.rule.id,
      ruleName: cand.rule.name,
      scheduleTime: computeScheduleTime(cfg, i),
      message: applyTemplate(cand.rule.template, vars),
      cancelled: cancelled.has(cand.client.id),
      sent: sent.has(cand.client.id),
      order: i,
    };
  });
}
