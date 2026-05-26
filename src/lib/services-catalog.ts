// Catálogo local de Serviços/Planos do dono.
// Cada plano agora carrega múltiplas mensagens (cobrança e acompanhamentos
// em N dias, sem limite). A mensagem de renovação é única e global.
// Escopado por company_id via localStorage.

import { getActiveCompanyId } from "./company-scope";
import { getCurrentRole } from "./local-auth";

export type ServiceMessageKind = "cobranca" | "acompanhamento";

export type ServiceMessage = {
  id: string;
  kind: ServiceMessageKind;
  offset_days: number; // 0 para cobrança; N dias após vencimento para acompanhamento
  label: string;       // ex.: "Cobrança", "Acompanhamento 30 dias"
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

export const DEFAULT_COBRANCA =
  "Olá {nome}, tudo bem? Passando para lembrar do seu plano *{plano}* no valor de *{valor}*. Vencimento: {vencimento}. Posso te enviar o pagamento?";
export const DEFAULT_ACOMP =
  "Oi {nome}! Tudo certo com o seu plano *{plano}*? Qualquer coisa estou por aqui.";

function uid(prefix = "svc") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
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
      id: String(m.id ?? uid("msg")),
      kind: (m.kind === "acompanhamento" ? "acompanhamento" : "cobranca") as ServiceMessageKind,
      offset_days: Math.max(0, Math.round(Number(m.offset_days ?? 0))),
      label: String(m.label ?? labelFor(m.kind ?? "cobranca", Number(m.offset_days ?? 0))),
      template: String(m.template ?? ""),
    }));
  }
  const out: ServiceMessage[] = [];
  if (s.mensagem_cobranca && s.mensagem_cobranca.trim()) {
    out.push({ id: uid("msg"), kind: "cobranca", offset_days: 0, label: "Cobrança", template: s.mensagem_cobranca });
  }
  if (s.mensagem_acompanhamento && s.mensagem_acompanhamento.trim()) {
    out.push({ id: uid("msg"), kind: "acompanhamento", offset_days: 30, label: "Acompanhamento 30 dias", template: s.mensagem_acompanhamento });
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
      id: String(s.id ?? uid()),
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
  } catch {
    /* noop */
  }
}

function inScope(s: ServiceItem): boolean {
  const role = getCurrentRole();
  const activeId = getActiveCompanyId();
  if (role === "super_admin" && !activeId) return true;
  if (!activeId) return false;
  return s.company_id === activeId;
}

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
  const item: ServiceItem = {
    id: uid(),
    company_id: getActiveCompanyId() ?? null,
    nome: input.nome.trim(),
    preco_cents: Math.max(0, Math.round(input.preco_cents)),
    telas: Math.max(1, Math.round(input.telas ?? 1)),
    meses: Math.max(1, Math.round(input.meses ?? 1)),
    messages:
      input.messages && input.messages.length > 0
        ? input.messages
        : [{ id: uid("msg"), kind: "cobranca", offset_days: 0, label: "Cobrança", template: DEFAULT_COBRANCA }],
    ativo: input.ativo ?? true,
    created_at: new Date().toISOString(),
  };
  all.unshift(item);
  write(all);
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
  write(all);
  return all[idx];
}

export function deleteService(id: string) {
  write(read().filter((s) => s.id !== id));
}

// ----- Mensagens dentro de um plano -----

export function addServiceMessage(
  serviceId: string,
  input: { kind: ServiceMessageKind; offset_days?: number; template?: string; label?: string },
): ServiceMessage | null {
  const all = read();
  const idx = all.findIndex((s) => s.id === serviceId);
  if (idx < 0) return null;
  const days = input.kind === "cobranca" ? 0 : Math.max(1, Math.round(input.offset_days ?? 30));
  const msg: ServiceMessage = {
    id: uid("msg"),
    kind: input.kind,
    offset_days: days,
    label: input.label?.trim() || labelFor(input.kind, days),
    template: input.template ?? (input.kind === "cobranca" ? DEFAULT_COBRANCA : DEFAULT_ACOMP),
  };
  all[idx] = { ...all[idx], messages: [...all[idx].messages, msg] };
  write(all);
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
  if (merged.kind === "cobranca") merged.offset_days = 0;
  if (!merged.label?.trim()) merged.label = labelFor(merged.kind, merged.offset_days);
  const messages = all[sIdx].messages.slice();
  messages[mIdx] = merged;
  all[sIdx] = { ...all[sIdx], messages };
  write(all);
  return merged;
}

export function removeServiceMessage(serviceId: string, messageId: string) {
  const all = read();
  const sIdx = all.findIndex((s) => s.id === serviceId);
  if (sIdx < 0) return;
  all[sIdx] = { ...all[sIdx], messages: all[sIdx].messages.filter((m) => m.id !== messageId) };
  write(all);
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Aplica variáveis a um template do plano. */
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

/** Cria os planos sugeridos pelo dono se o catálogo estiver vazio. */
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
        { id: uid("msg"), kind: "cobranca", offset_days: 0, label: "Cobrança", template: DEFAULT_COBRANCA },
        { id: uid("msg"), kind: "acompanhamento", offset_days: 30, label: "Acompanhamento 30 dias", template: DEFAULT_ACOMP },
      ],
    });
  }
  return planos.length;
}
