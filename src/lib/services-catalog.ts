// Catálogo local de Serviços/Planos do dono.
// Cada plano agora carrega: nº de telas, duração em meses, valor e
// mensagens próprias de cobrança e acompanhamento. A mensagem de
// renovação é única e global (não fica aqui).
// Escopado por company_id via localStorage.

import { getActiveCompanyId } from "./company-scope";
import { getCurrentRole } from "./local-auth";

export type ServiceItem = {
  id: string;
  company_id: string | null;
  nome: string;
  preco_cents: number;
  telas: number;            // novo
  meses: number;            // novo
  mensagem_cobranca: string;       // novo — usada nas cobranças desse plano
  mensagem_acompanhamento: string; // novo — usada no acompanhamento desse plano
  ativo: boolean;
  created_at: string;
};

const STORAGE_KEY = "cobranca_ia_services_catalog_v1";
export const SERVICES_EVENT = "cobranca_ia_services:changed";

function read(): ServiceItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw);
    if (!Array.isArray(p)) return [];
    // Migração leve: garante novos campos
    return (p as Partial<ServiceItem>[]).map((s) => ({
      id: String(s.id ?? `svc_${Math.random().toString(36).slice(2, 8)}`),
      company_id: s.company_id ?? null,
      nome: String(s.nome ?? ""),
      preco_cents: Number(s.preco_cents ?? 0),
      telas: Number(s.telas ?? 1),
      meses: Number(s.meses ?? 1),
      mensagem_cobranca: String(s.mensagem_cobranca ?? ""),
      mensagem_acompanhamento: String(s.mensagem_acompanhamento ?? ""),
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

function uid() {
  return `svc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function inScope(s: ServiceItem): boolean {
  const role = getCurrentRole();
  const activeId = getActiveCompanyId();
  if (role === "super_admin" && !activeId) return true;
  if (!activeId) return false;
  return s.company_id === activeId;
}

export function listServices(): ServiceItem[] {
  return read()
    .filter(inScope)
    .sort((a, b) =>
      a.telas - b.telas ||
      a.meses - b.meses ||
      a.nome.localeCompare(b.nome, "pt-BR"),
    );
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
  mensagem_cobranca?: string;
  mensagem_acompanhamento?: string;
  ativo?: boolean;
};

export function saveService(input: ServiceInput) {
  const all = read();
  const item: ServiceItem = {
    id: uid(),
    company_id: getActiveCompanyId() ?? null,
    nome: input.nome.trim(),
    preco_cents: Math.max(0, Math.round(input.preco_cents)),
    telas: Math.max(1, Math.round(input.telas ?? 1)),
    meses: Math.max(1, Math.round(input.meses ?? 1)),
    mensagem_cobranca: (input.mensagem_cobranca ?? "").trim(),
    mensagem_acompanhamento: (input.mensagem_acompanhamento ?? "").trim(),
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
) {
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

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Cria os planos sugeridos pelo dono (12/30/49,90 etc.) se o catálogo estiver vazio. */
export function seedDefaultPlansIfEmpty() {
  if (listServices().length > 0) return 0;
  const tplCobranca =
    "Olá {nome}, tudo bem? Passando para lembrar do seu plano *{plano}* ({telas} tela(s) · {meses} mês(es)) no valor de *{valor}*. Vencimento: {vencimento}. Posso te enviar o pagamento?";
  const tplAcomp =
    "Oi {nome}! Tudo certo com o seu plano *{plano}* ({telas} tela/s)? Qualquer coisa estou por aqui.";
  const planos: ServiceInput[] = [
    // Linha R$ 12 por tela/mês
    { nome: "1 Tela · 1 Mês", telas: 1, meses: 1, preco_cents: 1200 },
    { nome: "1 Tela · 2 Meses", telas: 1, meses: 2, preco_cents: 2400 },
    { nome: "2 Telas · 1 Mês", telas: 2, meses: 1, preco_cents: 2400 },
    // Linha premium 1 tela
    { nome: "Premium 1 Tela · 1 Mês", telas: 1, meses: 1, preco_cents: 2990 },
    { nome: "Premium 1 Tela · 3 Meses", telas: 1, meses: 3, preco_cents: 7990 },
    { nome: "Premium 1 Tela · 6 Meses", telas: 1, meses: 6, preco_cents: 13990 },
    { nome: "Premium 1 Tela · 12 Meses", telas: 1, meses: 12, preco_cents: 20000 },
    // Linha premium 2 telas
    { nome: "Premium 2 Telas · 1 Mês", telas: 2, meses: 1, preco_cents: 4990 },
    { nome: "Premium 2 Telas · 3 Meses", telas: 2, meses: 3, preco_cents: 11990 },
    { nome: "Premium 2 Telas · 6 Meses", telas: 2, meses: 6, preco_cents: 17990 },
    { nome: "Premium 2 Telas · 12 Meses", telas: 2, meses: 12, preco_cents: 30000 },
  ];
  for (const p of planos) {
    saveService({
      ...p,
      mensagem_cobranca: tplCobranca,
      mensagem_acompanhamento: tplAcomp,
    });
  }
  return planos.length;
}
