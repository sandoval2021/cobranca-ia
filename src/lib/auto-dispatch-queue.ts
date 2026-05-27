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
  /** Data autoritativa do backend (YYYY-MM-DD), quando disponível. */
  due_date?: string | null;
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

function daysFromIso(iso?: string | null): number | null {
  if (!iso) return null;
  const dt = new Date(iso + "T00:00:00");
  if (isNaN(+dt)) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.floor((+dt - +today) / (1000 * 60 * 60 * 24));
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
    const backendIso = c.due_date ?? null;

    // Mesma prioridade do card (getCustomerDueInfo):
    // override (se for mais recente que backend) > backend > telas/due_day.
    // Se backend já alcançou/ultrapassou o override, o override é obsoleto
    // (renovação já confirmada) e deve ser ignorado para não ressuscitar
    // cobranças antigas.
    const useOverride = overrideIso && (!backendIso || backendIso < overrideIso);

    let days: number | null = null;
    if (useOverride) {
      days = daysFromIso(overrideIso);
    } else if (backendIso) {
      days = daysFromIso(backendIso);
    } else {
      const nd = nextDueDays(c.due_day, screens);
      if (nd == null) continue;
      days = nd as number;
    }
    if (days == null || !Number.isFinite(days)) continue;
    const rule = pickRule(days, rules);
    if (!rule) continue;
    const elapsed = -days;
    if (rule.daysOffset !== elapsed) continue;
    if (rule.blockNoWhatsapp && !onlyDigits(c.whatsapp ?? "")) continue;
    candidates.push({ client: c, days, rule });
  }
  candidates.sort((a, b) => {
    // Próximos do vencimento primeiro; vencidos vão para o fim (mais antigos por último).
    const rank = (d: number) => (d >= 0 ? d : 1000 + Math.abs(d));
    return rank(a.days) - rank(b.days);
  });
  const limited = candidates.slice(0, cfg.maxPerDay);

  // Index por bucket de horário (para que clientes com horários customizados
  // por valor não compartilhem a mesma fila de intervalos).
  const indexByHour = new Map<string, number>();
  return limited.map((cand): AutoDispatchQueueItem => {
    const hourKey = (() => {
      const hit = cfg.amountSchedules.find((a) => a.amountCents === (cand.client.amount_cents ?? -1));
      return hit?.sendHour ?? cfg.sendHour;
    })();
    const i = indexByHour.get(hourKey) ?? 0;
    indexByHour.set(hourKey, i + 1);
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
      scheduleTime: computeScheduleTime(cfg, i, new Date(), cand.client.amount_cents),
      message: applyTemplate(cand.rule.template, vars),
      cancelled: cancelled.has(cand.client.id),
      sent: sent.has(cand.client.id),
      order: i,
    };
  });
}

