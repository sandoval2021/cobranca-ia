// Módulo financeiro DB-first. Cache local + espelhamento síncrono no banco.
// Escrita: localStorage primeiro (UX instantânea) + mirror fire-and-forget no banco.
// Leitura: cache local hidratado pelo useFinanceSync (banco é a fonte oficial).
import { mirror } from "./sync/mirror";
import {
  upsertFinanceEntryDb,
  deleteFinanceEntryDb,
  upsertFinanceGoalDb,
  deleteFinanceGoalDb,
} from "./financeiro/financeiro.functions";

function entryToDb(e: FinanceEntry) {
  return {
    id: e.id,
    tipo: e.type,
    categoria: null,
    descricao: e.note ?? null,
    valor_cents: Math.round((e.amount_received ?? 0) * 100),
    data: e.date,
    metodo_pagamento: e.method ?? null,
    cliente_id: null,
    servico_id: null,
    observacoes: null,
    extraJson: JSON.stringify(e),
  };
}

function goalToDb(g: FinanceGoal) {
  return {
    id: g.id,
    mes: g.deadline ?? g.name,
    categoria: null,
    valor_cents: Math.round((g.target ?? 0) * 100),
    observacoes: g.description ?? null,
    extraJson: JSON.stringify(g),
  };
}

export type PaymentMethod = "pix" | "dinheiro" | "cartao" | "outro";
export type EntryType =
  | "renovacao_lista"
  | "renovacao_app"
  | "venda_nova"
  | "teste_convertido"
  | "indicacao"
  | "bonificacao"
  | "outro";
export type ReserveMode = "percentual" | "valor_fixo" | "desativado";
export type GoalStatus = "ativo" | "concluido" | "pausado";

export type ServerCost = {
  server_id: string;
  monthly?: number;
  per_screen?: number;
  notes?: string;
};

export type AppCost = {
  app_key: string;
  license_cost?: number;
  suggested_price?: number;
  notes?: string;
};

export type FinanceSettings = {
  default_screen_cost: number;
  monthly_fixed_cost: number;
  reserve_mode: ReserveMode;
  reserve_value: number; // percent (0-100) ou valor fixo (R$)
  default_goal_id?: string;
  servers: ServerCost[];
  apps: AppCost[];
  created_at: string;
  updated_at: string;
};

export type FinanceEntry = {
  id: string;
  company_id?: string | null;
  date: string; // yyyy-mm-dd
  customer_name?: string;
  customer_whatsapp?: string;
  screen_label?: string;
  app_label?: string;
  server_ids?: string[];
  amount_received: number;
  method: PaymentMethod;
  type: EntryType;
  cost_screen: number;
  cost_server: number;
  cost_app: number;
  cost_fixed: number;
  reserve: number;
  net_profit: number;
  goal_id?: string;
  note?: string;
  created_at: string;
  updated_at: string;
};

export type FinanceGoal = {
  id: string;
  company_id?: string | null;
  name: string;
  target: number;
  reserved: number;
  deadline?: string;
  status: GoalStatus;
  description?: string;
  created_at: string;
  updated_at: string;
};

export type FinanceDraft = Partial<FinanceEntry> & { source?: string };

const SETTINGS_KEY = "cobranca_ia_finance_settings_v1";
const ENTRIES_KEY = "cobranca_ia_finance_entries_v1";
const GOALS_KEY = "cobranca_ia_finance_goals_v1";
const DRAFT_KEY = "cobranca_ia_finance_draft_v1";
export const FINANCE_EVENT = "cobranca_ia_finance:changed";
export const FINANCE_DRAFT_EVENT = "cobranca_ia_finance_draft:changed";

function nowIso() { return new Date().toISOString(); }
function todayIso() { return new Date().toISOString().slice(0, 10); }
export function newFinanceId(_prefix = "fin"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "00000000-0000-4000-8000-" + Math.random().toString(16).slice(2, 14).padEnd(12, "0");
}

export function formatBRL(n: number): string {
  if (!isFinite(n)) n = 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function isBrowser() { return typeof window !== "undefined"; }

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch { return fallback; }
}

function writeJson(key: string, value: unknown, eventName = FINANCE_EVENT) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(eventName));
  } catch { /* noop */ }
}

// ---------- Settings ----------
const DEFAULT_SETTINGS: FinanceSettings = {
  default_screen_cost: 10,
  monthly_fixed_cost: 0,
  reserve_mode: "percentual",
  reserve_value: 10,
  servers: [],
  apps: [],
  created_at: nowIso(),
  updated_at: nowIso(),
};

export function getFinanceSettings(): FinanceSettings {
  const s = readJson<FinanceSettings | null>(SETTINGS_KEY, null);
  if (!s) return { ...DEFAULT_SETTINGS };
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    servers: Array.isArray(s.servers) ? s.servers : [],
    apps: Array.isArray(s.apps) ? s.apps : [],
  };
}

export function saveFinanceSettings(patch: Partial<FinanceSettings>): FinanceSettings {
  const cur = getFinanceSettings();
  const next: FinanceSettings = { ...cur, ...patch, updated_at: nowIso() };
  writeJson(SETTINGS_KEY, next);
  return next;
}

export function getServerCost(serverId: string): ServerCost | undefined {
  return getFinanceSettings().servers.find((s) => s.server_id === serverId);
}
export function upsertServerCost(c: ServerCost): void {
  const s = getFinanceSettings();
  const idx = s.servers.findIndex((x) => x.server_id === c.server_id);
  if (idx >= 0) s.servers[idx] = c; else s.servers.push(c);
  saveFinanceSettings({ servers: [...s.servers] });
}

export function getAppCost(appKey: string): AppCost | undefined {
  return getFinanceSettings().apps.find((a) => a.app_key === appKey);
}
export function upsertAppCost(c: AppCost): void {
  const s = getFinanceSettings();
  const idx = s.apps.findIndex((x) => x.app_key === c.app_key);
  if (idx >= 0) s.apps[idx] = c; else s.apps.push(c);
  saveFinanceSettings({ apps: [...s.apps] });
}

// ---------- Entries ----------
import { getCurrentRole } from "./local-auth";
import { getActiveCompanyId } from "./company-scope";

function scopedFilter<T extends { company_id?: string | null }>(list: T[]): T[] {
  const role = getCurrentRole();
  const activeId = getActiveCompanyId();
  if (role === "super_admin" && !activeId) return list;
  if (!activeId) return [];
  return list.filter((r) => r.company_id === activeId);
}

export function listFinanceEntries(): FinanceEntry[] {
  const arr = readJson<FinanceEntry[]>(ENTRIES_KEY, []);
  return scopedFilter(Array.isArray(arr) ? arr : []);
}

export function listAllFinanceEntriesRaw(): FinanceEntry[] {
  const arr = readJson<FinanceEntry[]>(ENTRIES_KEY, []);
  return Array.isArray(arr) ? arr : [];
}

export function saveFinanceEntry(e: Omit<FinanceEntry, "id" | "created_at" | "updated_at"> & { id?: string }): FinanceEntry {
  const list = listAllFinanceEntriesRaw();
  const id = e.id ?? newFinanceId("fin");
  const activeId = getActiveCompanyId();
  const entry: FinanceEntry = {
    ...e,
    id,
    company_id: e.company_id ?? activeId ?? null,
    created_at: nowIso(),
    updated_at: nowIso(),
  } as FinanceEntry;
  list.unshift(entry);
  writeJson(ENTRIES_KEY, list);
  if (entry.goal_id && entry.reserve > 0) {
    addGoalReserve(entry.goal_id, entry.reserve);
  }
  mirror((companyId) => upsertFinanceEntryDb({ data: { companyId, ...entryToDb(entry) } }));
  return entry;
}

export function updateFinanceEntry(id: string, patch: Partial<FinanceEntry>): void {
  const list = listAllFinanceEntriesRaw();
  const idx = list.findIndex((e) => e.id === id);
  if (idx < 0) return;
  const prev = list[idx];
  const next = { ...prev, ...patch, company_id: patch.company_id ?? prev.company_id, updated_at: nowIso() };
  list[idx] = next;
  writeJson(ENTRIES_KEY, list);
  mirror((companyId) => upsertFinanceEntryDb({ data: { companyId, ...entryToDb(next) } }));
}

export function deleteFinanceEntry(id: string): void {
  const list = listAllFinanceEntriesRaw().filter((e) => e.id !== id);
  writeJson(ENTRIES_KEY, list);
  mirror((companyId) => deleteFinanceEntryDb({ data: { companyId, id } }));
}

// ---------- Goals ----------
export function listFinanceGoals(): FinanceGoal[] {
  const arr = readJson<FinanceGoal[]>(GOALS_KEY, []);
  return scopedFilter(Array.isArray(arr) ? arr : []);
}

export function listAllFinanceGoalsRaw(): FinanceGoal[] {
  const arr = readJson<FinanceGoal[]>(GOALS_KEY, []);
  return Array.isArray(arr) ? arr : [];
}

export function saveFinanceGoal(g: Omit<FinanceGoal, "id" | "created_at" | "updated_at" | "reserved"> & { id?: string; reserved?: number }): FinanceGoal {
  const list = listAllFinanceGoalsRaw();
  const id = g.id ?? newFinanceId("goal");
  const activeId = getActiveCompanyId();
  const goal: FinanceGoal = {
    ...g,
    id,
    company_id: g.company_id ?? activeId ?? null,
    reserved: g.reserved ?? 0,
    created_at: nowIso(),
    updated_at: nowIso(),
  } as FinanceGoal;
  list.unshift(goal);
  writeJson(GOALS_KEY, list);
  mirror((companyId) => upsertFinanceGoalDb({ data: { companyId, ...goalToDb(goal) } }));
  return goal;
}

export function updateFinanceGoal(id: string, patch: Partial<FinanceGoal>): void {
  const list = listAllFinanceGoalsRaw();
  const idx = list.findIndex((g) => g.id === id);
  if (idx < 0) return;
  const next = { ...list[idx], ...patch, company_id: patch.company_id ?? list[idx].company_id, updated_at: nowIso() };
  list[idx] = next;
  writeJson(GOALS_KEY, list);
  mirror((companyId) => upsertFinanceGoalDb({ data: { companyId, ...goalToDb(next) } }));
}

export function deleteFinanceGoal(id: string): void {
  const list = listAllFinanceGoalsRaw().filter((g) => g.id !== id);
  writeJson(GOALS_KEY, list);
  mirror((companyId) => deleteFinanceGoalDb({ data: { companyId, id } }));
}

function addGoalReserve(goalId: string, amount: number): void {
  const list = listAllFinanceGoalsRaw();
  const idx = list.findIndex((g) => g.id === goalId);
  if (idx < 0) return;
  const reserved = (list[idx].reserved || 0) + amount;
  const status: GoalStatus = reserved >= list[idx].target ? "concluido" : list[idx].status;
  list[idx] = { ...list[idx], reserved, status, updated_at: nowIso() };
  writeJson(GOALS_KEY, list);
}

// ---------- Simulator / calculations ----------
export type SimulateInput = {
  amount: number;
  screens?: number;
  server_ids?: string[];
  app_key?: string;
  renew_app?: boolean;
  goal_id?: string;
  manual_reserve?: number | null;
};

export type SimulateResult = {
  amount: number;
  cost_screen: number;
  cost_server: number;
  cost_app: number;
  cost_fixed: number;
  reserve: number;
  net_profit: number;
  renewals_needed_for_goal?: number | null;
};

export function simulateRenewalFinance(input: SimulateInput): SimulateResult {
  const s = getFinanceSettings();
  const screens = Math.max(1, input.screens ?? 1);
  const cost_screen = s.default_screen_cost * screens;

  let cost_server = 0;
  for (const sid of input.server_ids ?? []) {
    const c = s.servers.find((x) => x.server_id === sid);
    if (!c) continue;
    cost_server += (c.per_screen ?? 0) * screens;
  }

  let cost_app = 0;
  if (input.renew_app && input.app_key) {
    const ac = s.apps.find((a) => a.app_key === input.app_key);
    if (ac?.license_cost) cost_app = ac.license_cost;
  }

  const cost_fixed = 0; // rateio fica em zero por padrão; usuário ajusta nas configurações

  let reserve = 0;
  if (input.manual_reserve != null) {
    reserve = Math.max(0, input.manual_reserve);
  } else if (s.reserve_mode === "percentual") {
    reserve = (input.amount * s.reserve_value) / 100;
  } else if (s.reserve_mode === "valor_fixo") {
    reserve = s.reserve_value;
  }

  const net_profit = input.amount - cost_screen - cost_server - cost_app - cost_fixed - reserve;

  let renewals_needed_for_goal: number | null = null;
  const goalId = input.goal_id ?? s.default_goal_id;
  if (goalId && net_profit > 0) {
    const goal = listFinanceGoals().find((g) => g.id === goalId);
    if (goal) {
      const missing = Math.max(0, goal.target - goal.reserved);
      renewals_needed_for_goal = reserve > 0
        ? Math.ceil(missing / reserve)
        : Math.ceil(missing / net_profit);
    }
  }

  return { amount: input.amount, cost_screen, cost_server, cost_app, cost_fixed, reserve, net_profit, renewals_needed_for_goal };
}

// ---------- Summary ----------
export type FinanceSummary = {
  revenue: number;
  costs: number;
  reserve: number;
  net_profit: number;
  margin_pct: number;
  count_total: number;
  count_renewals: number;
  count_apps: number;
  count_new_sales: number;
  by_cost: { screen: number; server: number; app: number; fixed: number };
  by_type: Record<EntryType, { count: number; amount: number }>;
};

export function calculateFinanceSummary(entries: FinanceEntry[]): FinanceSummary {
  const sum: FinanceSummary = {
    revenue: 0, costs: 0, reserve: 0, net_profit: 0, margin_pct: 0,
    count_total: entries.length, count_renewals: 0, count_apps: 0, count_new_sales: 0,
    by_cost: { screen: 0, server: 0, app: 0, fixed: 0 },
    by_type: {
      renovacao_lista: { count: 0, amount: 0 },
      renovacao_app: { count: 0, amount: 0 },
      venda_nova: { count: 0, amount: 0 },
      teste_convertido: { count: 0, amount: 0 },
      indicacao: { count: 0, amount: 0 },
      bonificacao: { count: 0, amount: 0 },
      outro: { count: 0, amount: 0 },
    },
  };
  for (const e of entries) {
    sum.revenue += e.amount_received;
    sum.by_cost.screen += e.cost_screen;
    sum.by_cost.server += e.cost_server;
    sum.by_cost.app += e.cost_app;
    sum.by_cost.fixed += e.cost_fixed;
    sum.reserve += e.reserve;
    sum.net_profit += e.net_profit;
    if (e.type === "renovacao_lista") sum.count_renewals += 1;
    if (e.type === "renovacao_app") sum.count_apps += 1;
    if (e.type === "venda_nova" || e.type === "teste_convertido") sum.count_new_sales += 1;
    sum.by_type[e.type].count += 1;
    sum.by_type[e.type].amount += e.amount_received;
  }
  sum.costs = sum.by_cost.screen + sum.by_cost.server + sum.by_cost.app + sum.by_cost.fixed;
  sum.margin_pct = sum.revenue > 0 ? (sum.net_profit / sum.revenue) * 100 : 0;
  return sum;
}

export function filterEntriesByMonth(entries: FinanceEntry[], date = new Date()): FinanceEntry[] {
  const y = date.getFullYear();
  const m = date.getMonth();
  return entries.filter((e) => {
    const d = new Date(e.date);
    return d.getFullYear() === y && d.getMonth() === m;
  });
}

export function filterEntriesToday(entries: FinanceEntry[]): FinanceEntry[] {
  const t = todayIso();
  return entries.filter((e) => e.date === t);
}

// ---------- Export / Import ----------
export type FinanceBackup = {
  version: 1;
  exported_at: string;
  settings: FinanceSettings;
  entries: FinanceEntry[];
  goals: FinanceGoal[];
};

export function exportFinanceData(): FinanceBackup {
  return {
    version: 1,
    exported_at: nowIso(),
    settings: getFinanceSettings(),
    entries: listFinanceEntries(),
    goals: listFinanceGoals(),
  };
}

export function importFinanceData(raw: string, mode: "merge" | "replace" = "merge"): { ok: boolean; error?: string; counts?: { entries: number; goals: number } } {
  try {
    const data = JSON.parse(raw) as Partial<FinanceBackup>;
    if (!data || data.version !== 1) return { ok: false, error: "Formato inválido (version != 1)" };
    if (data.settings) writeJson(SETTINGS_KEY, data.settings);
    if (mode === "replace") {
      writeJson(ENTRIES_KEY, Array.isArray(data.entries) ? data.entries : []);
      writeJson(GOALS_KEY, Array.isArray(data.goals) ? data.goals : []);
    } else {
      const curE = listFinanceEntries();
      const curG = listFinanceGoals();
      const incE = Array.isArray(data.entries) ? data.entries : [];
      const incG = Array.isArray(data.goals) ? data.goals : [];
      const mapE = new Map(curE.map((e) => [e.id, e] as const));
      for (const e of incE) mapE.set(e.id, e);
      const mapG = new Map(curG.map((g) => [g.id, g] as const));
      for (const g of incG) mapG.set(g.id, g);
      writeJson(ENTRIES_KEY, Array.from(mapE.values()));
      writeJson(GOALS_KEY, Array.from(mapG.values()));
    }
    return { ok: true, counts: { entries: (data.entries ?? []).length, goals: (data.goals ?? []).length } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function buildSummaryText(summary: FinanceSummary, mainGoal?: FinanceGoal): string {
  const lines = [
    "Resumo financeiro do período:",
    `Receita: ${formatBRL(summary.revenue)}`,
    `Custos: ${formatBRL(summary.costs)}`,
    `Reservado para objetivos: ${formatBRL(summary.reserve)}`,
    `Lucro líquido: ${formatBRL(summary.net_profit)}`,
    `Margem: ${summary.margin_pct.toFixed(1)}%`,
  ];
  if (mainGoal) {
    const missing = Math.max(0, mainGoal.target - mainGoal.reserved);
    lines.push("", `Meta principal: ${mainGoal.name}`, `Falta: ${formatBRL(missing)}`);
  }
  return lines.join("\n");
}

// ---------- Draft (integração com outras telas) ----------
export function setFinanceDraft(draft: FinanceDraft): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, _ts: Date.now() }));
    window.dispatchEvent(new CustomEvent(FINANCE_DRAFT_EVENT));
  } catch { /* noop */ }
}

export function consumeFinanceDraft(): FinanceDraft | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    window.localStorage.removeItem(DRAFT_KEY);
    return JSON.parse(raw) as FinanceDraft;
  } catch { return null; }
}

export function openFinanceWithDraft(draft: FinanceDraft, navigate?: (url: string) => void): void {
  setFinanceDraft(draft);
  if (navigate) navigate("/financeiro");
  else if (isBrowser()) window.location.assign("/financeiro");
}

export const ENTRY_TYPE_LABEL: Record<EntryType, string> = {
  renovacao_lista: "Renovação de lista",
  renovacao_app: "Renovação de app",
  venda_nova: "Venda nova",
  teste_convertido: "Teste convertido",
  indicacao: "Indicação",
  bonificacao: "Bonificação",
  outro: "Outro",
};

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: "Pix", dinheiro: "Dinheiro", cartao: "Cartão", outro: "Outro",
};

export function todayDate(): string { return todayIso(); }
