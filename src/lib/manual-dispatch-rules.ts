// Configurações locais de regras de disparo manual.
// 100% client-side: nada é enviado. Persistência em localStorage.

export type RuleType = "lembrete" | "cobranca" | "recuperacao" | "retorno" | "revisao";
export type RulePriority = "baixa" | "media" | "alta" | "recuperacao" | "bloqueado";
export type RuleTone = "amigavel" | "objetivo" | "firme" | "recuperacao" | "retorno";

export type ManualDispatchRule = {
  id: string;             // slug estável (default rules) ou rnd
  name: string;
  /**
   * Dias relativos ao vencimento.
   * Negativo = antes do vencimento (ex.: -7 = D-7).
   * 0 = no dia do vencimento.
   * Positivo = depois do vencimento (ex.: +7 = D+7).
   */
  daysOffset: number;
  type: RuleType;
  priority: RulePriority;
  tone: RuleTone;
  template: string;
  active: boolean;
  blockNoWhatsapp: boolean;
  blockNoDue: boolean;
  blockDuplicate: boolean;
  /** Se true, lista vencida 30+ dias evita priorizar app pago. */
  recoveryOverApp: boolean;
  created_at: string;
  updated_at: string;
};

export type DispatchLimits = {
  maxCopiesPerDay: number;
  avoidRepeatSameDay: boolean;
  warnIfCopiedToday: boolean;
  allowedDays: ("dom" | "seg" | "ter" | "qua" | "qui" | "sex" | "sab")[];
  startHour: string; // "HH:MM"
  endHour: string;   // "HH:MM"
};

const RULES_KEY = "cobranca_ia_manual_dispatch_rules_v1";
const LIMITS_KEY = "cobranca_ia_manual_dispatch_limits_v1";
export const MANUAL_RULES_EVENT = "cobranca_ia_manual_rules:changed";

export const RULE_TYPE_LABEL: Record<RuleType, string> = {
  lembrete: "Lembrete",
  cobranca: "Cobrança",
  recuperacao: "Recuperação",
  retorno: "Retorno",
  revisao: "Revisão",
};

export const RULE_PRIORITY_LABEL: Record<RulePriority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  recuperacao: "Recuperação",
  bloqueado: "Bloqueado",
};

export const RULE_TONE_LABEL: Record<RuleTone, string> = {
  amigavel: "Amigável",
  objetivo: "Objetivo",
  firme: "Firme educado",
  recuperacao: "Recuperação",
  retorno: "Retorno",
};

export const ALLOWED_VARIABLES = [
  "{nome}",
  "{whatsapp}",
  "{vencimento}",
  "{dias}",
  "{valor}",
  "{app}",
  "{tela}",
  "{rota}",
];

// ---------- defaults ----------

function nowIso() { return new Date().toISOString(); }

export function buildDefaultRules(): ManualDispatchRule[] {
  const t = nowIso();
  const base = (
    id: string,
    name: string,
    daysOffset: number,
    type: RuleType,
    priority: RulePriority,
    tone: RuleTone,
    template: string,
  ): ManualDispatchRule => ({
    id,
    name,
    daysOffset,
    type,
    priority,
    tone,
    template,
    active: true,
    blockNoWhatsapp: true,
    blockNoDue: true,
    blockDuplicate: true,
    recoveryOverApp: true,
    created_at: t,
    updated_at: t,
  });

  return [
    base("lembrete_leve", "D-7 — Lembrete leve", -7, "lembrete", "baixa", "amigavel",
      "Olá {nome}, tudo bem? 😊\nSua mensalidade vence em {dias} dias.\nPassando só para te lembrar com antecedência, para evitar bloqueio do acesso."),
    base("lembrete_antecipado", "D-3 — Lembrete antecipado", -3, "lembrete", "media", "amigavel",
      "Olá {nome}, tudo bem? 😊\nSua mensalidade vence em {dias} dias.\nJá pode renovar para manter seus canais, filmes e séries funcionando normalmente."),
    base("vence_amanha", "D-1 — Vence amanhã", -1, "lembrete", "alta", "objetivo",
      "Olá {nome}, tudo bem? 😊\nSua mensalidade vence amanhã ({vencimento}).\nRenovando hoje, você evita qualquer interrupção no acesso."),
    base("vence_hoje", "D0 — Vence hoje", 0, "cobranca", "alta", "objetivo",
      "Olá {nome}, tudo bem? 😊\nSua mensalidade vence hoje.\nPara evitar bloqueio do acesso, você já pode renovar por aqui. Valor: {valor}."),
    base("venceu_ontem", "D+1 — Venceu ontem", 1, "cobranca", "alta", "amigavel",
      "Olá {nome}, tudo bem? 😊\nSua mensalidade venceu ontem.\nPosso te ajudar a renovar rapidinho para normalizar seu acesso."),
    base("cobranca_amigavel", "D+3 — Cobrança amigável", 3, "cobranca", "alta", "amigavel",
      "Olá {nome}, tudo bem? 😊\nSua mensalidade está pendente há {dias} dias.\nSe quiser, posso te ajudar a renovar agora e liberar seu acesso."),
    base("cobranca_firme", "D+7 — Cobrança firme educada", 7, "cobranca", "alta", "firme",
      "Olá {nome}, tudo bem? 😊\nSua mensalidade está pendente há {dias} dias.\nPara continuar usando os canais, filmes e séries, é necessário regularizar a renovação."),
    base("recuperacao_leve", "D+15 — Recuperação leve", 15, "recuperacao", "media", "recuperacao",
      "Olá {nome}, tudo bem? 😊\nVi que sua lista ficou vencida há alguns dias.\nCaso queira voltar a usar seus canais, filmes e séries, posso te ajudar a reativar."),
    base("recuperar_cliente", "D+30 — Recuperar cliente", 30, "recuperacao", "recuperacao", "recuperacao",
      "Olá {nome}, tudo bem? 😊\nFaz um tempinho que sua lista ficou vencida.\nEstamos com servidor atualizado e mais estável. Se quiser voltar a usar, posso te ajudar a reativar seu acesso."),
    base("campanha_retorno", "D+60 — Campanha de retorno", 60, "retorno", "baixa", "retorno",
      "Olá {nome}, tudo bem? 😊\nPassando para avisar que tivemos melhorias no servidor, com mais estabilidade.\nSe quiser voltar conosco, me chama aqui que vejo uma condição para reativar seu acesso."),
  ];
}

export function buildDefaultLimits(): DispatchLimits {
  return {
    maxCopiesPerDay: 80,
    avoidRepeatSameDay: true,
    warnIfCopiedToday: true,
    allowedDays: ["seg", "ter", "qua", "qui", "sex", "sab"],
    startHour: "09:00",
    endHour: "20:00",
  };
}

// ---------- persistence ----------

function safeRead<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(MANUAL_RULES_EVENT));
  } catch {
    // ignore
  }
}

export function listRules(): ManualDispatchRule[] {
  const v = safeRead<ManualDispatchRule[]>(RULES_KEY);
  if (!v || !Array.isArray(v) || v.length === 0) return buildDefaultRules();
  return v.map((r) => ({ ...r }));
}

export function saveRules(rules: ManualDispatchRule[]): void {
  safeWrite(RULES_KEY, rules);
}

export function upsertRule(rule: ManualDispatchRule): ManualDispatchRule[] {
  const all = listRules();
  const idx = all.findIndex((r) => r.id === rule.id);
  const next = { ...rule, updated_at: nowIso() };
  if (idx === -1) all.push(next);
  else all[idx] = next;
  saveRules(all);
  return all;
}

export function removeRule(id: string): ManualDispatchRule[] {
  const all = listRules().filter((r) => r.id !== id);
  saveRules(all);
  return all;
}

export function restoreDefaultRules(): ManualDispatchRule[] {
  const def = buildDefaultRules();
  saveRules(def);
  return def;
}

export function getLimits(): DispatchLimits {
  const v = safeRead<DispatchLimits>(LIMITS_KEY);
  if (!v) return buildDefaultLimits();
  return { ...buildDefaultLimits(), ...v };
}

export function saveLimits(l: DispatchLimits): void {
  safeWrite(LIMITS_KEY, l);
}

export function restoreDefaultLimits(): DispatchLimits {
  const d = buildDefaultLimits();
  saveLimits(d);
  return d;
}

// ---------- export / import ----------

export type RulesBackup = {
  kind: "cobranca_ia.manual_dispatch_rules.v1";
  exported_at: string;
  rules: ManualDispatchRule[];
  limits: DispatchLimits;
};

export function buildBackup(): RulesBackup {
  return {
    kind: "cobranca_ia.manual_dispatch_rules.v1",
    exported_at: nowIso(),
    rules: listRules(),
    limits: getLimits(),
  };
}

export function parseBackup(text: string): RulesBackup {
  const j = JSON.parse(text);
  if (!j || j.kind !== "cobranca_ia.manual_dispatch_rules.v1") {
    throw new Error("Arquivo inválido: formato não reconhecido.");
  }
  if (!Array.isArray(j.rules)) throw new Error("Arquivo inválido: regras ausentes.");
  return j as RulesBackup;
}

export function mergeRules(current: ManualDispatchRule[], incoming: ManualDispatchRule[]): ManualDispatchRule[] {
  const map = new Map<string, ManualDispatchRule>();
  for (const r of current) map.set(r.id, r);
  for (const r of incoming) map.set(r.id, { ...r, updated_at: nowIso() });
  return Array.from(map.values());
}

// ---------- variable substitution ----------

export type RuleVars = Partial<{
  nome: string;
  whatsapp: string | null;
  vencimento: string;
  dias: number;
  valor: string;
  app: string;
  tela: string;
  rota: string;
}>;

export function applyTemplate(template: string, vars: RuleVars): string {
  return template.replace(/\{(\w+)\}/g, (_m, key) => {
    const v = (vars as Record<string, unknown>)[key];
    if (v == null || v === "") return "não informado";
    return String(v);
  });
}

// ---------- rule selection ----------

/**
 * Dado o número de dias até o vencimento (positivo = ainda no futuro,
 * negativo = vencido), seleciona a regra ativa mais apropriada.
 *
 * Heurística: convertemos para "elapsed" (dias passados desde o vencimento).
 * Escolhemos a regra ativa com maior daysOffset ≤ elapsed. Se nenhuma satisfaz,
 * pegamos a primeira (a mais antecipada).
 */
export function pickRule(daysUntilDue: number, rules: ManualDispatchRule[]): ManualDispatchRule | null {
  const active = rules.filter((r) => r.active).sort((a, b) => a.daysOffset - b.daysOffset);
  if (active.length === 0) return null;
  const elapsed = -daysUntilDue;
  let chosen: ManualDispatchRule | null = null;
  for (const r of active) {
    if (r.daysOffset <= elapsed) chosen = r;
    else break;
  }
  return chosen ?? active[0];
}

// ============================================================
// Sincronização com o banco (manual_dispatch_rules) — Fase 2E
// ============================================================

import { getActiveCompanyId } from "@/lib/company-scope";
import {
  bulkUpsertManualDispatchRulesDb,
  type ManualDispatchRuleDto,
} from "@/lib/manual-dispatch-rules/manual-dispatch-rules.functions";

export const MANUAL_RULES_SYNC_EVENT = "cobranca_ia_manual_rules:sync";

type RulesSyncState = { loaded: boolean; lastError: string | null; pendingLocal: number };
const rulesSyncState: RulesSyncState = { loaded: false, lastError: null, pendingLocal: 0 };

function emitRulesSync() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(MANUAL_RULES_SYNC_EVENT, { detail: { ...rulesSyncState } }));
}

export function getManualDispatchRulesSyncState(): RulesSyncState {
  return { ...rulesSyncState };
}

export function markManualDispatchRulesSyncError(message: string) {
  rulesSyncState.lastError = message;
  emitRulesSync();
}

function _isUuid(v: string | null | undefined): v is string {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function _hasLocalRulesData(): boolean {
  const raw = safeRead<ManualDispatchRule[]>(RULES_KEY);
  return Array.isArray(raw) && raw.length > 0;
}

export function hydrateManualDispatchRulesFromDb(companyId: string, rows: ManualDispatchRuleDto[]): void {
  if (typeof window === "undefined") return;
  if (!_isUuid(companyId)) return;
  if (rows.length === 0) {
    if (_hasLocalRulesData()) {
      rulesSyncState.loaded = true;
      rulesSyncState.lastError = null;
      rulesSyncState.pendingLocal = (safeRead<ManualDispatchRule[]>(RULES_KEY) ?? []).length;
      emitRulesSync();
    } else {
      rulesSyncState.loaded = true;
      rulesSyncState.lastError = null;
      rulesSyncState.pendingLocal = 0;
      emitRulesSync();
    }
    return;
  }
  const mapped: ManualDispatchRule[] = rows.map((r) => {
    let settings: Record<string, unknown> = {};
    try { settings = JSON.parse(r.settings ?? "{}"); } catch { settings = {}; }
    return {
      id: r.rule_key || r.id,
      name: r.name,
      daysOffset: r.days_offset ?? 0,
      type: (r.rule_type as RuleType) ?? "lembrete",
      priority: (r.priority as RulePriority) ?? "media",
      tone: (r.tone as RuleTone) ?? "amigavel",
      template: r.template ?? "",
      active: !!r.is_active,
      blockNoWhatsapp: settings.blockNoWhatsapp !== false,
      blockNoDue: settings.blockNoDue !== false,
      blockDuplicate: settings.blockDuplicate !== false,
      recoveryOverApp: settings.recoveryOverApp !== false,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  });
  saveRules(mapped);
  rulesSyncState.loaded = true;
  rulesSyncState.lastError = null;
  rulesSyncState.pendingLocal = 0;
  emitRulesSync();
}

export async function uploadLocalManualDispatchRulesToDb(): Promise<{ count: number }> {
  const companyId = getActiveCompanyId();
  if (!companyId) return { count: 0 };
  const list = listRules();
  if (list.length === 0) return { count: 0 };
  const rules = list.map((r) => ({
    rule_key: r.id,
    name: r.name,
    days_offset: r.daysOffset,
    rule_type: r.type,
    priority: r.priority,
    tone: r.tone,
    template: r.template,
    is_active: r.active,
    settings: {
      blockNoWhatsapp: r.blockNoWhatsapp,
      blockNoDue: r.blockNoDue,
      blockDuplicate: r.blockDuplicate,
      recoveryOverApp: r.recoveryOverApp,
    },
  }));
  return bulkUpsertManualDispatchRulesDb({ data: { companyId, rules } });
}
