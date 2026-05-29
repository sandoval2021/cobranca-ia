// Catálogo de Serviços/Planos do dono.
// Banco é a fonte da verdade (tabela public.service_plans + service_plan_messages).
// localStorage continua existindo como cache síncrono para resposta instantânea
// no boot — toda mutação é replicada em background para o banco.
// Sincronização: src/lib/services/useServicesSync.ts (montado no AppShell).

import { toast } from "sonner";
import { getActiveCompanyId } from "./company-scope";
import { getCurrentRole } from "./local-auth";
import {
  upsertServicePlanDb,
  deleteServicePlanDb,
  bulkUpsertServicePlansDb,
  type ServicePlanDto,
} from "@/lib/services/services.functions";

export type ServiceMessageKind = "cobranca" | "acompanhamento";

export type ServiceMessage = {
  id: string;
  kind: ServiceMessageKind;
  offset_days: number;
  label: string;
  template: string;
};

export type ServiceItem = {
  id: string;
  company_id: string | null;
  nome: string;
  preco_cents: number;
  telas: number;
  meses: number;
  messages: ServiceMessage[];
  ativo: boolean;
  created_at: string;
};

const STORAGE_KEY = "cobranca_ia_services_catalog_v1";
export const SERVICES_EVENT = "cobranca_ia_services:changed";
export const SERVICES_SYNC_EVENT = "cobranca_ia_services:sync";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const DEFAULT_COBRANCA =
  "Olá {nome}, tudo bem? Passando para lembrar do seu plano *{plano}* no valor de *{valor}*. Vencimento: {vencimento}. Posso te enviar o pagamento?";
export const DEFAULT_ACOMP =
  "Oi {nome}! Tudo certo com o seu plano *{plano}*? Qualquer coisa estou por aqui.";

type SyncState = { loaded: boolean; lastError: string | null; pendingLocal: number };
const syncState: SyncState = { loaded: false, lastError: null, pendingLocal: 0 };

function isValidCompanyUuid(id: string | null | undefined): id is string {
  return !!id && UUID_RE.test(id);
}

function genUuid(): string {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ (Math.random() * 16) & (15 >> (Number(c) / 4))).toString(16),
  );
}

function labelFor(kind: ServiceMessageKind, days: number): string {
  if (days === 0) return "No dia do vencimento";
  const abs = Math.abs(days);
  const plural = abs === 1 ? "" : "s";
  return days < 0 ? `${abs} dia${plural} antes do vencimento` : `${abs} dia${plural} depois do vencimento`;
}

function migrateMessages(s: Partial<ServiceItem> & { mensagem_cobranca?: string; mensagem_acompanhamento?: string }): ServiceMessage[] {
  if (Array.isArray(s.messages) && s.messages.length > 0) {
    return s.messages.map((m) => ({
      id: UUID_RE.test(String(m.id ?? "")) ? String(m.id) : genUuid(),
      kind: (m.kind === "acompanhamento" ? "acompanhamento" : "cobranca") as ServiceMessageKind,
      offset_days: Math.round(Number(m.offset_days ?? 0)),
      label: String(m.label ?? labelFor(m.kind ?? "cobranca", Number(m.offset_days ?? 0))),
      template: String(m.template ?? ""),
    }));
  }
  const out: ServiceMessage[] = [];
  if (s.mensagem_cobranca && s.mensagem_cobranca.trim()) {
    out.push({ id: genUuid(), kind: "cobranca", offset_days: 0, label: "Cobrança", template: s.mensagem_cobranca });
  }
  if (s.mensagem_acompanhamento && s.mensagem_acompanhamento.trim()) {
    out.push({ id: genUuid(), kind: "acompanhamento", offset_days: 30, label: "Acompanhamento 30 dias", template: s.mensagem_acompanhamento });
  }
  return out;
}

function read(): ServiceItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw);
    if (!Array.isArray(p)) return [];
    return (p as Partial<ServiceItem>[]).map((s) => ({
      id: UUID_RE.test(String(s.id ?? "")) ? String(s.id) : genUuid(),
      company_id: s.company_id ?? null,
      nome: String(s.nome ?? ""),
      preco_cents: Number(s.preco_cents ?? 0),
      telas: Number(s.telas ?? 1),
      meses: Number(s.meses ?? 1),
      messages: migrateMessages(s),
      ativo: s.ativo ?? true,
      created_at: String(s.created_at ?? new Date().toISOString()),
    }));
  } catch {
    return [];
  }
}

function write(items: ServiceItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  try {
    window.dispatchEvent(new CustomEvent(SERVICES_EVENT));
  } catch { /* noop */ }
}

function inScope(s: ServiceItem): boolean {
  const role = getCurrentRole();
  const activeId = getActiveCompanyId();
  if (role === "super_admin" && !activeId) return true;
  if (!activeId) return s.company_id == null;
  return s.company_id === activeId || s.company_id == null;
}

// ----- persistência em background -----

function persistInBackground(fn: () => Promise<unknown>, failureMessage: string) {
  void (async () => {
    try {
      await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "erro";
      console.error("[services-catalog]", failureMessage, err);
      toast.error(`${failureMessage}. ${msg}`);
      markServicesSyncError(msg);
    }
  })();
}

function itemToDbInput(s: ServiceItem, companyId: string) {
  return {
    id: UUID_RE.test(s.id) ? s.id : undefined,
    companyId,
    nome: s.nome,
    preco_cents: s.preco_cents,
    telas: s.telas,
    meses: s.meses,
    ativo: s.ativo,
    messages: s.messages.map((m) => ({
      id: UUID_RE.test(m.id) ? m.id : undefined,
      kind: m.kind,
      offset_days: m.offset_days,
      label: m.label,
      template: m.template,
    })),
  };
}

// ----- API pública -----

export function listServices(): ServiceItem[] {
  return read().filter(inScope).sort((a, b) => a.preco_cents - b.preco_cents || a.nome.localeCompare(b.nome, "pt-BR"));
}

export function listActiveServices(): ServiceItem[] {
  return listServices().filter((s) => s.ativo);
}

export function getServiceById(id: string | null | undefined): ServiceItem | null {
  if (!id) return null;
  return read().find((s) => s.id === id) ?? null;
}

export type ServiceInput = {
  nome: string;
  preco_cents: number;
  telas?: number;
  meses?: number;
  messages?: ServiceMessage[];
  ativo?: boolean;
};

export function saveService(input: ServiceInput): ServiceItem {
  const all = read();
  const cid = getActiveCompanyId() ?? null;
  const item: ServiceItem = {
    id: genUuid(),
    company_id: cid,
    nome: input.nome.trim(),
    preco_cents: Math.max(0, Math.round(input.preco_cents)),
    telas: Math.max(1, Math.round(input.telas ?? 1)),
    meses: Math.max(1, Math.round(input.meses ?? 1)),
    messages:
      input.messages && input.messages.length > 0
        ? input.messages.map((m) => ({ ...m, id: UUID_RE.test(m.id) ? m.id : genUuid() }))
        : [{ id: genUuid(), kind: "cobranca", offset_days: 0, label: "Cobrança", template: DEFAULT_COBRANCA }],
    ativo: input.ativo ?? true,
    created_at: new Date().toISOString(),
  };
  all.unshift(item);
  write(all);

  if (isValidCompanyUuid(cid)) {
    persistInBackground(
      () => upsertServicePlanDb({ data: itemToDbInput(item, cid) }),
      "Não foi possível salvar o plano na sua conta",
    );
  }
  return item;
}

export function updateService(
  id: string,
  patch: Partial<Omit<ServiceItem, "id" | "company_id" | "created_at">>,
): ServiceItem | null {
  const all = read();
  const idx = all.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], ...patch };
  if (Array.isArray(patch.messages)) {
    all[idx].messages = patch.messages.map((m) => ({
      ...m,
      id: UUID_RE.test(m.id) ? m.id : genUuid(),
    }));
  }
  write(all);

  const cid = all[idx].company_id ?? getActiveCompanyId();
  if (isValidCompanyUuid(cid) && UUID_RE.test(all[idx].id)) {
    persistInBackground(
      () => upsertServicePlanDb({ data: itemToDbInput(all[idx], cid) }),
      "Não foi possível atualizar o plano na sua conta",
    );
  }
  return all[idx];
}

export function deleteService(id: string) {
  const all = read();
  const found = all.find((s) => s.id === id);
  write(all.filter((s) => s.id !== id));

  const cid = found?.company_id ?? getActiveCompanyId();
  if (found && isValidCompanyUuid(cid) && UUID_RE.test(id)) {
    persistInBackground(
      () => deleteServicePlanDb({ data: { id, companyId: cid } }),
      "Não foi possível excluir o plano na sua conta",
    );
  }
}

// ----- Mensagens dentro de um plano -----

export function addServiceMessage(
  serviceId: string,
  input: { kind: ServiceMessageKind; offset_days?: number; template?: string; label?: string },
): ServiceMessage | null {
  const all = read();
  const idx = all.findIndex((s) => s.id === serviceId);
  if (idx < 0) return null;
  const days = Math.round(Number(input.offset_days ?? 0));
  const kind: ServiceMessageKind = days === 0 ? "cobranca" : "acompanhamento";
  const msg: ServiceMessage = {
    id: genUuid(),
    kind,
    offset_days: days,
    label: input.label?.trim() || labelFor(kind, days),
    template: input.template ?? (kind === "cobranca" ? DEFAULT_COBRANCA : DEFAULT_ACOMP),
  };
  all[idx] = { ...all[idx], messages: [...all[idx].messages, msg] };
  write(all);

  const cid = all[idx].company_id ?? getActiveCompanyId();
  if (isValidCompanyUuid(cid) && UUID_RE.test(all[idx].id)) {
    persistInBackground(
      () => upsertServicePlanDb({ data: itemToDbInput(all[idx], cid) }),
      "Não foi possível salvar a mensagem na sua conta",
    );
  }
  return msg;
}

export function updateServiceMessage(
  serviceId: string,
  messageId: string,
  patch: Partial<Omit<ServiceMessage, "id">>,
): ServiceMessage | null {
  const all = read();
  const sIdx = all.findIndex((s) => s.id === serviceId);
  if (sIdx < 0) return null;
  const mIdx = all[sIdx].messages.findIndex((m) => m.id === messageId);
  if (mIdx < 0) return null;
  const merged: ServiceMessage = { ...all[sIdx].messages[mIdx], ...patch };
  merged.offset_days = Math.round(Number(merged.offset_days ?? 0));
  merged.kind = merged.offset_days === 0 ? "cobranca" : "acompanhamento";
  if (!merged.label?.trim()) merged.label = labelFor(merged.kind, merged.offset_days);
  const messages = all[sIdx].messages.slice();
  messages[mIdx] = merged;
  all[sIdx] = { ...all[sIdx], messages };
  write(all);

  const cid = all[sIdx].company_id ?? getActiveCompanyId();
  if (isValidCompanyUuid(cid) && UUID_RE.test(all[sIdx].id)) {
    persistInBackground(
      () => upsertServicePlanDb({ data: itemToDbInput(all[sIdx], cid) }),
      "Não foi possível atualizar a mensagem na sua conta",
    );
  }
  return merged;
}

export function removeServiceMessage(serviceId: string, messageId: string) {
  const all = read();
  const sIdx = all.findIndex((s) => s.id === serviceId);
  if (sIdx < 0) return;
  all[sIdx] = { ...all[sIdx], messages: all[sIdx].messages.filter((m) => m.id !== messageId) };
  write(all);

  const cid = all[sIdx].company_id ?? getActiveCompanyId();
  if (isValidCompanyUuid(cid) && UUID_RE.test(all[sIdx].id)) {
    persistInBackground(
      () => upsertServicePlanDb({ data: itemToDbInput(all[sIdx], cid) }),
      "Não foi possível remover a mensagem na sua conta",
    );
  }
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function renderTemplate(
  template: string,
  vars: { nome?: string; plano?: string; valor?: string; telas?: number | string; meses?: number | string; vencimento?: string },
): string {
  const map: Record<string, string> = {
    nome: (vars.nome ?? "").trim() || "cliente",
    plano: (vars.plano ?? "").trim() || "—",
    valor: (vars.valor ?? "").trim() || "—",
    telas: vars.telas != null ? String(vars.telas) : "—",
    meses: vars.meses != null ? String(vars.meses) : "—",
    vencimento: (vars.vencimento ?? "").trim() || "—",
  };
  return template.replace(/\{(\w+)\}/g, (_m, k) => map[k] ?? `{${k}}`);
}

export function seedDefaultPlansIfEmpty() {
  if (listServices().length > 0) return 0;
  const planos: ServiceInput[] = [
    { nome: "Plano R$ 12 (por mês/tela)", telas: 1, meses: 1, preco_cents: 1200 },
    { nome: "Plano R$ 29,90 (Premium 1 tela)", telas: 1, meses: 1, preco_cents: 2990 },
    { nome: "Plano R$ 49,90 (Premium 2 telas)", telas: 2, meses: 1, preco_cents: 4990 },
  ];
  for (const p of planos) {
    saveService({
      ...p,
      messages: [
        { id: genUuid(), kind: "cobranca", offset_days: 0, label: "Cobrança", template: DEFAULT_COBRANCA },
        { id: genUuid(), kind: "acompanhamento", offset_days: 30, label: "Acompanhamento 30 dias", template: DEFAULT_ACOMP },
      ],
    });
  }
  return planos.length;
}

// ----- sincronização com o banco -----

function dtoToItem(d: ServicePlanDto): ServiceItem {
  return {
    id: d.id,
    company_id: d.company_id,
    nome: d.nome,
    preco_cents: d.preco_cents,
    telas: d.telas,
    meses: d.meses,
    ativo: d.ativo,
    created_at: d.created_at,
    messages: (d.messages ?? []).map((m) => ({
      id: m.id,
      kind: m.kind,
      offset_days: m.offset_days,
      label: m.label,
      template: m.template,
    })),
  };
}

/**
 * Hidrata o cache local com a lista de planos do banco.
 * Se o banco está vazio e há planos locais desta empresa, NÃO sobrescreve —
 * sinaliza migração pendente (banner "Enviar para a nuvem").
 */
export function hydrateServicesFromDb(companyId: string, rows: ServicePlanDto[]): void {
  if (typeof window === "undefined") return;
  if (!isValidCompanyUuid(companyId)) return;

  const all = read();
  const localCount = all.filter((s) => s.company_id === companyId).length;

  if (rows.length === 0 && localCount > 0) {
    syncState.loaded = true;
    syncState.lastError = null;
    syncState.pendingLocal = localCount;
    window.dispatchEvent(
      new CustomEvent(SERVICES_SYNC_EVENT, {
        detail: { loaded: true, pendingLocal: localCount, error: null },
      }),
    );
    return;
  }

  // Banco tem dados → substitui apenas os desta empresa pelas linhas do banco.
  const others = all.filter((s) => s.company_id !== companyId);
  const next = [...others, ...rows.map(dtoToItem)];
  write(next);
  syncState.loaded = true;
  syncState.lastError = null;
  syncState.pendingLocal = 0;
  window.dispatchEvent(
    new CustomEvent(SERVICES_SYNC_EVENT, {
      detail: { loaded: true, pendingLocal: 0, error: null },
    }),
  );
}

export function markServicesSyncError(message: string): void {
  syncState.lastError = message;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(SERVICES_SYNC_EVENT, {
        detail: { loaded: syncState.loaded, pendingLocal: syncState.pendingLocal, error: message },
      }),
    );
  }
}

export function getServicesSyncState(): SyncState {
  return { ...syncState };
}

/**
 * Envia para o banco os planos que estão apenas no cache local da empresa ativa.
 * Usado pelo banner "Enviar para a nuvem" quando a sync detecta banco vazio.
 */
export async function uploadLocalServicesToDb(): Promise<{ inserted: number; updated: number }> {
  const cid = getActiveCompanyId();
  if (!isValidCompanyUuid(cid)) throw new Error("Empresa inválida");
  const all = read();
  const plans = all
    .filter((s) => s.company_id === cid)
    .map((s) => ({
      id: UUID_RE.test(s.id) ? s.id : undefined,
      nome: s.nome,
      preco_cents: s.preco_cents,
      telas: s.telas,
      meses: s.meses,
      ativo: s.ativo,
      messages: s.messages.map((m) => ({
        id: UUID_RE.test(m.id) ? m.id : undefined,
        kind: m.kind,
        offset_days: m.offset_days,
        label: m.label,
        template: m.template,
      })),
    }));
  if (plans.length === 0) return { inserted: 0, updated: 0 };
  return bulkUpsertServicePlansDb({ data: { companyId: cid, plans } });
}
