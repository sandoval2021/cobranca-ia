// Local-only model for Referrals (Indicações).

const STORAGE_KEY = "cobranca_ia_referrals_v1";
const RULES_KEY = "cobranca_ia_referral_rules_v1";

export const REFERRAL_STATUSES = [
  "Indicou",
  "Em teste",
  "Fechou",
  "Não fechou",
  "Bonificação pendente",
  "Bonificação aplicada",
] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

export type Referral = {
  id: string;
  company_id?: string | null;
  indicador_cliente_id?: string;
  indicador_nome: string;
  indicador_whatsapp: string;
  indicado_nome: string;
  indicado_whatsapp: string;
  lead_id?: string;
  status: ReferralStatus;
  data_indicacao: string;
  data_fechamento?: string;
  regra_bonificacao?: string;
  observacao?: string;
  bonificacao_aplicada_em?: string;
};

export type BonusType = "1mes" | "desconto" | "valor" | "outro";

export type ReferralRules = {
  meta: number; // indicações fechadas para liberar bonificação
  tipo: BonusType;
  descricao: string;
};

const DEFAULT_RULES: ReferralRules = {
  meta: 2,
  tipo: "1mes",
  descricao: "A cada 2 indicações que fecharem, ganha 1 mês grátis.",
};

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
  try {
    window.dispatchEvent(new CustomEvent("referrals:changed"));
  } catch {
    // ignore
  }
}

import { getCurrentRole } from "./local-auth";
import { getActiveCompanyId } from "./company-scope";

function scopedFilter<T extends { company_id?: string | null }>(list: T[]): T[] {
  const role = getCurrentRole();
  const activeId = getActiveCompanyId();
  if (role === "super_admin" && !activeId) return list;
  if (!activeId) return [];
  return list.filter((r) => r.company_id === activeId);
}

export function listReferrals(): Referral[] {
  return scopedFilter(read<Referral[]>(STORAGE_KEY, []));
}

export function listAllReferralsRaw(): Referral[] {
  return read<Referral[]>(STORAGE_KEY, []);
}

export function saveReferral(input: Partial<Referral> & {
  indicador_nome: string;
  indicador_whatsapp: string;
  indicado_nome: string;
  indicado_whatsapp: string;
}): Referral {
  const list = listAllReferralsRaw();
  const now = new Date().toISOString();
  const activeId = getActiveCompanyId();
  const ref: Referral = {
    id: uid(),
    company_id: input.company_id ?? activeId ?? null,
    indicador_cliente_id: input.indicador_cliente_id,
    indicador_nome: input.indicador_nome,
    indicador_whatsapp: input.indicador_whatsapp,
    indicado_nome: input.indicado_nome,
    indicado_whatsapp: input.indicado_whatsapp,
    lead_id: input.lead_id,
    status: (input.status as ReferralStatus) ?? "Em teste",
    data_indicacao: input.data_indicacao ?? now,
    data_fechamento: input.data_fechamento,
    regra_bonificacao: input.regra_bonificacao,
    observacao: input.observacao,
  };
  list.unshift(ref);
  write(STORAGE_KEY, list);
  return ref;
}

export function updateReferral(id: string, patch: Partial<Referral>): Referral | null {
  const list = listAllReferralsRaw();
  const idx = list.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], ...patch, company_id: patch.company_id ?? list[idx].company_id };
  write(STORAGE_KEY, list);
  return list[idx];
}

export function updateReferralByLead(leadId: string, patch: Partial<Referral>) {
  const list = listAllReferralsRaw();
  let changed = false;
  for (let i = 0; i < list.length; i++) {
    if (list[i].lead_id === leadId) {
      list[i] = { ...list[i], ...patch };
      changed = true;
    }
  }
  if (changed) write(STORAGE_KEY, list);
}

/**
 * Lista (mais antigos primeiro) os referrals de um indicador que já fecharam e
 * ainda não foram contabilizados como bonificação aplicada.
 */
export function listClosedUnappliedForIndicator(indicatorKey: string): Referral[] {
  return listReferrals()
    .filter((r) => {
      const key = r.indicador_cliente_id || r.indicador_whatsapp || r.indicador_nome;
      return key === indicatorKey && r.status === "Fechou";
    })
    .sort((a, b) => (a.data_fechamento || a.data_indicacao).localeCompare(b.data_fechamento || b.data_indicacao));
}

/**
 * Aplica a bonificação ao bater a meta: marca as `meta` indicações fechadas
 * mais antigas como "Bonificação aplicada", zerando efetivamente o contador
 * (que é cíclico em `summarizeByIndicador`). Retorna quantas foram marcadas.
 */
export function applyBonusForIndicator(indicatorKey: string, meta: number): number {
  const list = listAllReferralsRaw();
  // resolve no escopo da empresa: pega só fechadas elegíveis no escopo
  const elegiveis = listClosedUnappliedForIndicator(indicatorKey).slice(0, Math.max(1, meta));
  if (elegiveis.length < meta) return 0;
  const ids = new Set(elegiveis.map((r) => r.id));
  const now = new Date().toISOString();
  let changed = 0;
  for (let i = 0; i < list.length; i++) {
    if (ids.has(list[i].id)) {
      list[i] = { ...list[i], status: "Bonificação aplicada", bonificacao_aplicada_em: now };
      changed++;
    }
  }
  if (changed) write(STORAGE_KEY, list);
  return changed;
}

export function getReferralRules(): ReferralRules {
  return read<ReferralRules>(RULES_KEY, DEFAULT_RULES);
}

export function saveReferralRules(rules: ReferralRules) {
  write(RULES_KEY, rules);
}

export type IndicatorSummary = {
  key: string; // whatsapp or id
  nome: string;
  whatsapp: string;
  total: number;
  emTeste: number;
  fecharam: number;
  naoFecharam: number;
  bonificacaoPendente: number;
  bonificacaoAplicada: number;
  faltamParaMeta: number;
  bateuMeta: boolean;
};

export function summarizeByIndicador(): IndicatorSummary[] {
  const list = listReferrals();
  const rules = getReferralRules();
  const map = new Map<string, IndicatorSummary>();
  for (const r of list) {
    const key = r.indicador_cliente_id || r.indicador_whatsapp || r.indicador_nome;
    let s = map.get(key);
    if (!s) {
      s = {
        key,
        nome: r.indicador_nome,
        whatsapp: r.indicador_whatsapp,
        total: 0,
        emTeste: 0,
        fecharam: 0,
        naoFecharam: 0,
        bonificacaoPendente: 0,
        bonificacaoAplicada: 0,
        faltamParaMeta: 0,
        bateuMeta: false,
      };
      map.set(key, s);
    }
    s.total++;
    if (r.status === "Em teste" || r.status === "Indicou") s.emTeste++;
    if (r.status === "Fechou" || r.status === "Bonificação pendente" || r.status === "Bonificação aplicada") s.fecharam++;
    if (r.status === "Não fechou") s.naoFecharam++;
    if (r.status === "Bonificação pendente") s.bonificacaoPendente++;
    if (r.status === "Bonificação aplicada") s.bonificacaoAplicada++;
  }
  for (const s of map.values()) {
    const meta = Math.max(1, rules.meta);
    const restante = s.fecharam % meta;
    s.faltamParaMeta = restante === 0 && s.fecharam > 0 ? 0 : meta - restante;
    s.bateuMeta = s.fecharam >= meta && s.bonificacaoAplicada < Math.floor(s.fecharam / meta);
  }
  return Array.from(map.values()).sort((a, b) => b.fecharam - a.fecharam);
}

export function exportReferrals() {
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    referrals: listReferrals(),
    rules: getReferralRules(),
  };
}

export function importReferrals(payload: unknown, mode: "merge" | "replace" = "merge") {
  if (!payload || typeof payload !== "object") throw new Error("Formato inválido");
  const p = payload as { referrals?: unknown; rules?: unknown };
  if (!Array.isArray(p.referrals)) throw new Error("Sem campo referrals[]");
  const refs = p.referrals as Referral[];
  if (mode === "replace") {
    write(STORAGE_KEY, refs);
  } else {
    const existing = listReferrals();
    const ids = new Set(existing.map((r) => r.id));
    write(STORAGE_KEY, [...existing, ...refs.filter((r) => !ids.has(r.id))]);
  }
  if (p.rules && typeof p.rules === "object") {
    saveReferralRules(p.rules as ReferralRules);
  }
  return { imported: refs.length };
}

// ------- Message templates -------

export const REF_TEMPLATES = {
  fechou_falta:
    "Olá {indicador}, tudo bem? 😊\n\nA pessoa que você indicou fechou conosco. Obrigado pela indicação! 🙌\n\nVocê já tem {fechadas} indicação(ões) confirmada(s).\nFalta(m) {faltam} para liberar sua bonificação.",
  bateu_meta:
    "Parabéns, {indicador}! 🎉\n\nVocê completou {meta} indicações confirmadas.\nSua bonificação está liberada:\n\n{bonificacao}\n\nMe chama aqui para aplicarmos no seu acesso.",
  em_teste:
    "Olá {indicador}, tudo bem? 😊\n\nA pessoa que você indicou já está em teste.\nAssim que ela fechar, eu te aviso por aqui.",
};

import { applyRevendaVariables } from "./revenda-settings";

export function renderReferralMessage(
  type: keyof typeof REF_TEMPLATES,
  data: { indicador: string; fechadas: number; faltam: number; meta: number; bonificacao: string },
) {
  const base = REF_TEMPLATES[type]
    .replaceAll("{indicador}", data.indicador || "tudo bem")
    .replaceAll("{fechadas}", String(data.fechadas))
    .replaceAll("{faltam}", String(data.faltam))
    .replaceAll("{meta}", String(data.meta))
    .replaceAll("{bonificacao}", data.bonificacao);
  return applyRevendaVariables(base);
}

export function bonusDescription(rules: ReferralRules) {
  switch (rules.tipo) {
    case "1mes":
      return rules.descricao || "1 mês grátis";
    case "desconto":
      return rules.descricao || "Desconto na próxima renovação";
    case "valor":
      return rules.descricao || "Valor fixo de bonificação";
    default:
      return rules.descricao || "Bonificação";
  }
}

// ------------------- DB sync helpers (Phase 2E) -------------------
import { getActiveCompanyId } from "@/lib/company-scope";
import {
  bulkUpsertReferralsDb,
  type ReferralDto,
} from "@/lib/referrals/referrals.functions";

export const REFERRALS_SYNC_EVENT = "cobranca_ia_referrals_sync:changed";
type RefSyncState = { loaded: boolean; lastError: string | null; pendingLocal: number };
const referralsSyncState: RefSyncState = { loaded: false, lastError: null, pendingLocal: 0 };

function emitRefSync() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(REFERRALS_SYNC_EVENT, { detail: { ...referralsSyncState } }));
}

export function getReferralsSyncState(): RefSyncState {
  return { ...referralsSyncState };
}

export function markReferralsSyncError(message: string) {
  referralsSyncState.lastError = message;
  emitRefSync();
}

export function hydrateReferralsFromDb(companyId: string, rows: ReferralDto[]) {
  if (typeof window === "undefined") return;
  const all = read<Referral[]>(STORAGE_KEY, []);
  const others = all.filter((r) => r.company_id && r.company_id !== companyId);
  const localForCompany = all.filter((r) => r.company_id === companyId);

  if (rows.length === 0 && localForCompany.length > 0) {
    referralsSyncState.loaded = true;
    referralsSyncState.lastError = null;
    referralsSyncState.pendingLocal = localForCompany.length;
    emitRefSync();
    return;
  }

  const mapped: Referral[] = rows.map((r) => ({
    id: r.id,
    company_id: r.company_id,
    indicador_cliente_id: r.referrer_customer_id ?? undefined,
    indicador_nome: r.referrer_name ?? "",
    indicador_whatsapp: r.referrer_phone ?? "",
    indicado_nome: r.referred_name ?? "",
    indicado_whatsapp: r.referred_phone ?? "",
    status: (r.status as ReferralStatus) ?? "Em teste",
    data_indicacao: r.created_at,
    data_fechamento: r.closed_at ?? undefined,
    observacao: r.note ?? undefined,
    bonificacao_aplicada_em: r.reward_applied_at ?? undefined,
  }));

  write(STORAGE_KEY, [...others, ...mapped]);
  referralsSyncState.loaded = true;
  referralsSyncState.lastError = null;
  referralsSyncState.pendingLocal = 0;
  emitRefSync();
}

export async function uploadLocalReferralsToDb(): Promise<{ inserted: number; updated: number }> {
  const companyId = getActiveCompanyId();
  if (!companyId) return { inserted: 0, updated: 0 };
  const list = listAllReferralsRaw().filter((r) => !r.company_id || r.company_id === companyId);
  if (list.length === 0) return { inserted: 0, updated: 0 };
  const payload = list.map((r) => ({
    referrer_name: r.indicador_nome || null,
    referrer_phone: r.indicador_whatsapp || null,
    referrer_customer_id: r.indicador_cliente_id || null,
    referred_name: r.indicado_nome || null,
    referred_phone: r.indicado_whatsapp || null,
    status: r.status,
    reward_status: r.status === "Bonificação aplicada" ? "applied" : "none",
    closed_at: r.data_fechamento ?? null,
    reward_applied_at: r.bonificacao_aplicada_em ?? null,
    note: r.observacao ?? null,
    payload: {},
  }));
  return bulkUpsertReferralsDb({ data: { companyId, referrals: payload } });
}
