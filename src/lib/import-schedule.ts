// Local/simulated agenda of dispatches generated from imported customers.
// 100% client-side. Nothing is sent. Statuses persist in localStorage.

import type { ValidatedRow } from "./import-parse";
import {
  listRules,
  pickRule,
  applyTemplate,
  type ManualDispatchRule,
  type RulePriority,
} from "./manual-dispatch-rules";


export type DispatchKind =
  | "lembrete_leve"        // D-7
  | "lembrete_antecipado"  // D-3
  | "vence_amanha"         // D-1
  | "vence_hoje"           // D0
  | "venceu_ontem"         // D+1
  | "cobranca_amigavel"    // D+3
  | "cobranca_firme"       // D+7
  | "recuperacao_leve"     // D+15
  | "recuperar_cliente"    // D+30
  | "campanha_retorno"     // D+60
  | "bloqueado";

export type DispatchPriority = "alta" | "media" | "baixa" | "info";

export type ScheduleStatus =
  | "planejado"
  | "pronto"
  | "copiado"
  | "ignorado"
  | "revisar"
  | "bloqueado";

export type DispatchGroup =
  | "hoje"
  | "amanha"
  | "prox7"
  | "recuperacao"
  | "bloqueados";

export type ScheduleItem = {
  id: string;
  company_id?: string | null;
  name: string;
  whatsapp: string | null;
  amount_cents: number | null;
  due_date: string | null; // YYYY-MM-DD
  days: number | null;     // dias até vencimento (negativo = vencido)
  scheduled_for: string;   // YYYY-MM-DD (data planejada do disparo)
  kind: DispatchKind;
  kindLabel: string;
  priority: DispatchPriority;
  status: ScheduleStatus;
  reason: string;
  message: string;
  group: DispatchGroup;
  warning?: string;
};

const KIND_LABEL: Record<DispatchKind, string> = {
  lembrete_leve: "Lembrete leve (D-7)",
  lembrete_antecipado: "Lembrete antecipado (D-3)",
  vence_amanha: "Vence amanhã (D-1)",
  vence_hoje: "Vence hoje (D0)",
  venceu_ontem: "Venceu ontem (D+1)",
  cobranca_amigavel: "Cobrança amigável (D+3)",
  cobranca_firme: "Cobrança firme educada (D+7)",
  recuperacao_leve: "Recuperação leve (D+15)",
  recuperar_cliente: "Recuperar cliente (D+30)",
  campanha_retorno: "Campanha de retorno (D+60)",
  bloqueado: "Bloqueado",
};

export function kindLabel(k: DispatchKind): string {
  return KIND_LABEL[k];
}

// ---------- helpers ----------

function today0(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysUntil(due: string | null): number | null {
  if (!due) return null;
  const d = new Date(due + "T00:00:00");
  if (isNaN(+d)) return null;
  return Math.floor((+d - +today0()) / 86400000);
}

function fmtBRL(cents: number | null): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDateBR(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(+d)) return iso;
  return d.toLocaleDateString("pt-BR");
}

// ---------- message templates ----------

function msgFor(kind: DispatchKind, name: string, days: number): string {
  const n = name || "cliente";
  const d = Math.abs(days);
  switch (kind) {
    case "lembrete_leve":
      return `Olá ${n}, tudo bem? 😊\nSua mensalidade vence em ${d} dias.\nPassando só para te lembrar com antecedência, para evitar bloqueio do acesso.`;
    case "lembrete_antecipado":
      return `Olá ${n}, tudo bem? 😊\nSua mensalidade vence em ${d} dias.\nJá pode renovar para manter seus canais, filmes e séries funcionando normalmente.`;
    case "vence_amanha":
      return `Olá ${n}, tudo bem? 😊\nSua mensalidade vence amanhã.\nRenovando hoje, você evita qualquer interrupção no acesso.`;
    case "vence_hoje":
      return `Olá ${n}, tudo bem? 😊\nSua mensalidade vence hoje.\nPara evitar bloqueio do acesso aos canais, filmes e séries, você já pode renovar por aqui.`;
    case "venceu_ontem":
      return `Olá ${n}, tudo bem? 😊\nSua mensalidade venceu ontem.\nPosso te ajudar a renovar rapidinho para normalizar seu acesso.`;
    case "cobranca_amigavel":
      return `Olá ${n}, tudo bem? 😊\nSua mensalidade está pendente há ${d} dias.\nSe quiser, posso te ajudar a renovar agora e liberar seu acesso.`;
    case "cobranca_firme":
      return `Olá ${n}, tudo bem? 😊\nSua mensalidade está pendente há ${d} dias.\nPara continuar usando os canais, filmes e séries, é necessário regularizar a renovação.`;
    case "recuperacao_leve":
      return `Olá ${n}, tudo bem? 😊\nVi que sua lista ficou vencida há alguns dias.\nCaso queira voltar a usar seus canais, filmes e séries, posso te ajudar a reativar.`;
    case "recuperar_cliente":
      return `Olá ${n}, tudo bem? 😊\nFaz um tempinho que sua lista ficou vencida.\nEstamos com servidor atualizado e mais estável. Se quiser voltar a usar, posso te ajudar a reativar seu acesso.`;
    case "campanha_retorno":
      return `Olá ${n}, tudo bem? 😊\nPassando para avisar que tivemos melhorias no servidor, com mais estabilidade para canais, filmes e séries.\nSe quiser voltar conosco, me chama aqui que vejo uma condição para reativar seu acesso.`;
    case "bloqueado":
      return "";
  }
}

// ---------- classification ----------

function classify(days: number): { kind: DispatchKind; priority: DispatchPriority } {
  if (days >= 60) return { kind: "lembrete_leve", priority: "baixa" };
  if (days >= 7) return { kind: "lembrete_leve", priority: "baixa" };
  if (days >= 3) return { kind: "lembrete_antecipado", priority: "media" };
  if (days === 1) return { kind: "vence_amanha", priority: "alta" };
  if (days === 2) return { kind: "lembrete_antecipado", priority: "media" };
  if (days === 0) return { kind: "vence_hoje", priority: "alta" };
  if (days === -1) return { kind: "venceu_ontem", priority: "alta" };
  if (days >= -3) return { kind: "cobranca_amigavel", priority: "alta" };
  if (days >= -7) return { kind: "cobranca_firme", priority: "alta" };
  if (days >= -14) return { kind: "recuperacao_leve", priority: "media" };
  if (days >= -29) return { kind: "recuperacao_leve", priority: "media" };
  if (days >= -59) return { kind: "recuperar_cliente", priority: "media" };
  return { kind: "campanha_retorno", priority: "baixa" };
}

function groupOf(kind: DispatchKind, scheduledForISO: string, todayISO: string): DispatchGroup {
  if (kind === "bloqueado") return "bloqueados";
  if (kind === "recuperar_cliente" || kind === "campanha_retorno") return "recuperacao";
  if (scheduledForISO === todayISO) return "hoje";
  // amanha
  const tomorrow = new Date(todayISO + "T00:00:00");
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (scheduledForISO === isoDay(tomorrow)) return "amanha";
  return "prox7";
}

// ---------- builder ----------

function priorityFromRule(p: RulePriority): DispatchPriority {
  switch (p) {
    case "baixa": return "baixa";
    case "media": return "media";
    case "alta": return "alta";
    case "recuperacao": return "media";
    case "bloqueado": return "info";
  }
}

function isKnownKind(id: string): id is DispatchKind {
  return id in KIND_LABEL;
}

export function buildSchedule(rows: ValidatedRow[]): ScheduleItem[] {
  const out: ScheduleItem[] = [];
  const tISO = isoDay(today0());
  const phoneSeen = new Map<string, number>(); // phone → first index in out
  const rules: ManualDispatchRule[] = listRules();

  rows.forEach((r, idx) => {
    const name = (r.customer_name ?? "").trim() || "Cliente sem nome";
    const phone = r.whatsapp_e164;
    const due = r.expires_at;
    const days = daysUntil(due);
    const id = `imp_${idx}_${Date.now().toString(36)}`;

    // Bloqueios globais (cobre todas as regras default)
    const blockReasons: string[] = [];
    if (!phone) blockReasons.push("Sem WhatsApp cadastrado");
    if (!due) blockReasons.push("Sem data de vencimento");
    if (r.status === "invalid") blockReasons.push("Dados incompletos");
    if (r.status === "duplicate") blockReasons.push("Possível duplicado");

    if (phone) {
      if (phoneSeen.has(phone)) {
        blockReasons.push("Possível duplicado");
      } else {
        phoneSeen.set(phone, idx);
      }
    }

    if (blockReasons.length > 0) {
      const status: ScheduleStatus =
        blockReasons.includes("Sem data de vencimento") || blockReasons.includes("Possível duplicado")
          ? "revisar"
          : "bloqueado";
      out.push({
        id, name, whatsapp: phone, amount_cents: r.amount_cents,
        due_date: due, days, scheduled_for: tISO,
        kind: "bloqueado", kindLabel: KIND_LABEL.bloqueado,
        priority: "info", status,
        reason: blockReasons.join(" · "),
        message: "", group: "bloqueados",
      });
      return;
    }

    const d = days as number;
    const rule = pickRule(d, rules);

    if (!rule) {
      // Nenhuma regra ativa cobre este caso → marcar para revisão
      out.push({
        id, name, whatsapp: phone, amount_cents: r.amount_cents,
        due_date: due, days: d, scheduled_for: tISO,
        kind: "bloqueado", kindLabel: "Sem regra ativa",
        priority: "info", status: "revisar",
        reason: "Nenhuma regra de disparo ativa para este vencimento",
        message: "", group: "bloqueados",
      });
      return;
    }

    const kind: DispatchKind = isKnownKind(rule.id) ? rule.id : "lembrete_leve";
    const priority = priorityFromRule(rule.priority);

    // Regra: lista vencida 30+ dias → priorizar recuperação
    let warning: string | undefined;
    if (rule.recoveryOverApp && d <= -30) {
      warning = "Lista vencida há muito tempo. Primeiro tente recuperar o cliente antes de falar do aplicativo.";
    }

    const message = applyTemplate(rule.template, {
      nome: name,
      whatsapp: phone,
      vencimento: fmtDateBR(due),
      dias: Math.abs(d),
      valor: fmtBRL(r.amount_cents),
    });

    out.push({
      id, name, whatsapp: phone, amount_cents: r.amount_cents,
      due_date: due, days: d, scheduled_for: tISO,
      kind,
      kindLabel: rule.name,
      priority,
      status: "pronto",
      reason: reasonFor(kind, d),
      message,
      group: groupOf(kind, tISO, tISO),
      warning,
    });
  });

  return out;
}


function reasonFor(kind: DispatchKind, days: number): string {
  switch (kind) {
    case "lembrete_leve": return `Vence em ${days} dias`;
    case "lembrete_antecipado": return `Vence em ${days} dias`;
    case "vence_amanha": return "Vence amanhã";
    case "vence_hoje": return "Vence hoje";
    case "venceu_ontem": return "Venceu ontem";
    case "cobranca_amigavel": return `Vencido há ${Math.abs(days)} dias`;
    case "cobranca_firme": return `Vencido há ${Math.abs(days)} dias`;
    case "recuperacao_leve": return `Vencido há ${Math.abs(days)} dias`;
    case "recuperar_cliente": return `Vencido há ${Math.abs(days)} dias (30+)`;
    case "campanha_retorno": return `Vencido há ${Math.abs(days)} dias (60+)`;
    case "bloqueado": return "Bloqueado";
  }
}

// ---------- persistent status ----------

const STORAGE_KEY = "cobranca_ia_import_schedule_status_v1";

export type PersistedStatus = {
  status: ScheduleStatus;
  copied_at?: string;
  updated_at: string;
};

type PersistedMap = Record<string, PersistedStatus>;

function readPersisted(): PersistedMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const j = JSON.parse(raw);
    return j && typeof j === "object" ? j : {};
  } catch {
    return {};
  }
}

function writePersisted(m: PersistedMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
  } catch {
    // ignore
  }
}

// chave estável baseada em telefone + due + kind (id muda a cada parse)
export function statusKey(it: ScheduleItem): string {
  return `${it.whatsapp ?? "noph"}|${it.due_date ?? "nodue"}|${it.kind}`;
}

export function applyPersistedStatus(items: ScheduleItem[]): ScheduleItem[] {
  const map = readPersisted();
  return items.map((it) => {
    const k = statusKey(it);
    const p = map[k];
    if (!p) return it;
    return { ...it, status: p.status };
  });
}

export function setStatus(it: ScheduleItem, status: ScheduleStatus): void {
  const map = readPersisted();
  const k = statusKey(it);
  map[k] = {
    status,
    copied_at: status === "copiado" ? new Date().toISOString() : map[k]?.copied_at,
    updated_at: new Date().toISOString(),
  };
  writePersisted(map);
}

export function clearAllPersisted(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ---------- export TXT ----------

export function buildScheduleTxt(items: ScheduleItem[]): string {
  const now = new Date();
  const total = items.length;
  const blocked = items.filter((i) => i.group === "bloqueados").length;
  const planned = total - blocked;

  const lines: string[] = [];
  lines.push(`Agenda de disparos — Importação (CobraEasy)`);
  lines.push(`Gerado em: ${now.toLocaleString("pt-BR")}`);
  lines.push(`Total de clientes: ${total}`);
  lines.push(`Disparos planejados: ${planned}`);
  lines.push(`Bloqueados/Revisar: ${blocked}`);
  lines.push(`(Agenda local — nada foi enviado.)`);
  lines.push("");

  const groups: { key: DispatchGroup; title: string }[] = [
    { key: "hoje", title: "HOJE" },
    { key: "amanha", title: "AMANHÃ" },
    { key: "prox7", title: "PRÓXIMOS 7 DIAS" },
    { key: "recuperacao", title: "RECUPERAÇÃO" },
    { key: "bloqueados", title: "BLOQUEADOS / REVISAR" },
  ];

  for (const g of groups) {
    const list = items.filter((i) => i.group === g.key);
    if (list.length === 0) continue;
    lines.push(`=== ${g.title} (${list.length}) ===`);
    for (const it of list) {
      lines.push(`- ${it.name}`);
      lines.push(`  WhatsApp: ${it.whatsapp ?? "—"}`);
      lines.push(`  Vencimento: ${fmtDateBR(it.due_date)}`);
      lines.push(`  Valor: ${fmtBRL(it.amount_cents)}`);
      lines.push(`  Tipo: ${it.kindLabel}`);
      lines.push(`  Motivo: ${it.reason}`);
      lines.push(`  Status: ${it.status}`);
      if (it.warning) lines.push(`  Aviso: ${it.warning}`);
      if (it.message) {
        lines.push(`  Mensagem sugerida:`);
        for (const ml of it.message.split("\n")) lines.push(`    ${ml}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

// ---------- filter chips helper ----------

export type ChipKey =
  | "todos"
  | "hoje"
  | "amanha"
  | "prox7"
  | "vencidos"
  | "recuperar"
  | "inativos"
  | "bloqueados"
  | "copiados"
  | "pendentes"
  | "ignorados"
  | "revisados";

export function matchesChip(it: ScheduleItem, k: ChipKey): boolean {
  switch (k) {
    case "todos": return true;
    case "hoje": return it.group === "hoje";
    case "amanha": return it.group === "amanha";
    case "prox7": return it.group === "prox7" || it.group === "hoje" || it.group === "amanha";
    case "vencidos": return it.days != null && it.days < 0 && it.kind !== "bloqueado";
    case "recuperar": return it.kind === "recuperar_cliente";
    case "inativos": return it.kind === "campanha_retorno";
    case "bloqueados": return it.group === "bloqueados";
    case "copiados": return it.status === "copiado";
    case "pendentes": return it.status === "pronto" || it.status === "planejado";
    case "ignorados": return it.status === "ignorado";
    case "revisados": return it.status === "revisar";
  }
}

export const CHIP_LABEL: Record<ChipKey, string> = {
  todos: "Todos",
  hoje: "Hoje",
  amanha: "Amanhã",
  prox7: "Próx. 7 dias",
  vencidos: "Vencidos",
  recuperar: "Recuperar cliente",
  inativos: "Inativos",
  bloqueados: "Bloqueados",
  copiados: "Copiados",
  pendentes: "Pendentes",
  ignorados: "Ignorados",
  revisados: "Revisados",
};

export const GROUP_LABEL: Record<DispatchGroup, string> = {
  hoje: "Hoje",
  amanha: "Amanhã",
  prox7: "Próximos 7 dias",
  recuperacao: "Recuperação",
  bloqueados: "Bloqueados para revisar",
};

export function fmtBRLPublic(cents: number | null): string {
  return fmtBRL(cents);
}

export function fmtDateBRPublic(iso: string | null): string {
  return fmtDateBR(iso);
}

// ====================================================================
// Cross-screen persistence: full agenda items (last import) + summary
// ====================================================================

const ITEMS_KEY = "cobranca_ia_import_schedule_items_v1";
const ITEMS_EVENT = "cobranca_ia_import_schedule:changed";

import { getCurrentRole } from "./local-auth";
import { getActiveCompanyId } from "./company-scope";

function scopedFilter(items: ScheduleItem[]): ScheduleItem[] {
  const role = getCurrentRole();
  const activeId = getActiveCompanyId();
  if (role === "super_admin" && !activeId) return items;
  if (!activeId) return [];
  return items.filter((i) => i.company_id === activeId);
}

export function saveImportScheduleItems(items: ScheduleItem[]): void {
  if (typeof window === "undefined") return;
  try {
    const activeId = getActiveCompanyId();
    const tagged = items.map((it) =>
      it.company_id ? it : { ...it, company_id: activeId ?? null },
    );
    const payload = { saved_at: new Date().toISOString(), items: tagged };
    window.localStorage.setItem(ITEMS_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent(ITEMS_EVENT));
  } catch {
    // ignore quota
  }
}

export function listImportScheduleItems(): ScheduleItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ITEMS_KEY);
    if (!raw) return [];
    const j = JSON.parse(raw);
    const items: ScheduleItem[] = Array.isArray(j) ? j : Array.isArray(j?.items) ? j.items : [];
    return scopedFilter(applyPersistedStatus(items));
  } catch {
    return [];
  }
}

export function listAllImportScheduleItemsRaw(): ScheduleItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ITEMS_KEY);
    if (!raw) return [];
    const j = JSON.parse(raw);
    const items: ScheduleItem[] = Array.isArray(j) ? j : Array.isArray(j?.items) ? j.items : [];
    return applyPersistedStatus(items);
  } catch {
    return [];
  }
}

export function clearImportScheduleItems(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ITEMS_KEY);
    window.dispatchEvent(new CustomEvent(ITEMS_EVENT));
  } catch {
    // ignore
  }
}

export type ImportScheduleSummary = {
  total: number;
  planned: number;
  blocked: number;
  today: number;
  tomorrow: number;
  next7: number;
  overdueRecent: number;
  recover: number;
  inactive: number;
  pending: number;
  copied: number;
  ignored: number;
  review: number;
  noWa: number;
  noDue: number;
  dup: number;
  saved_at: string | null;
};

export function getImportScheduleSummary(): ImportScheduleSummary {
  const items = listImportScheduleItems();
  let saved_at: string | null = null;
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(ITEMS_KEY);
      if (raw) {
        const j = JSON.parse(raw);
        saved_at = typeof j?.saved_at === "string" ? j.saved_at : null;
      }
    } catch {
      // ignore
    }
  }
  const blocked = items.filter((i) => i.group === "bloqueados").length;
  return {
    total: items.length,
    planned: items.length - blocked,
    blocked,
    today: items.filter((i) => i.group === "hoje").length,
    tomorrow: items.filter((i) => i.group === "amanha").length,
    next7: items.filter((i) => i.group === "prox7" || i.group === "hoje" || i.group === "amanha").length,
    overdueRecent: items.filter((i) => i.days != null && i.days < 0 && i.days >= -7).length,
    recover: items.filter((i) => i.kind === "recuperar_cliente").length,
    inactive: items.filter((i) => i.kind === "campanha_retorno").length,
    pending: items.filter((i) => i.status === "pronto" || i.status === "planejado").length,
    copied: items.filter((i) => i.status === "copiado").length,
    ignored: items.filter((i) => i.status === "ignorado").length,
    review: items.filter((i) => i.status === "revisar").length,
    noWa: items.filter((i) => !i.whatsapp).length,
    noDue: items.filter((i) => !i.due_date).length,
    dup: items.filter((i) => i.reason.toLowerCase().includes("duplicado")).length,
    saved_at,
  };
}

export function getImportScheduleStatus(it: ScheduleItem): ScheduleStatus {
  const map = readPersisted();
  const k = statusKey(it);
  return map[k]?.status ?? it.status;
}

export function updateImportScheduleStatus(it: ScheduleItem, status: ScheduleStatus): void {
  setStatus(it, status);
  // Also reflect in saved list so re-reads keep the new status.
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(ITEMS_KEY);
    if (raw) {
      const j = JSON.parse(raw);
      const items: ScheduleItem[] = Array.isArray(j?.items) ? j.items : Array.isArray(j) ? j : [];
      const k = statusKey(it);
      const next = items.map((x) => (statusKey(x) === k ? { ...x, status } : x));
      const payload = { saved_at: j?.saved_at ?? new Date().toISOString(), items: next };
      window.localStorage.setItem(ITEMS_KEY, JSON.stringify(payload));
    }
    window.dispatchEvent(new CustomEvent(ITEMS_EVENT));
  } catch {
    // ignore
  }
}

export const IMPORT_SCHEDULE_EVENT = ITEMS_EVENT;
