// Catálogo local de Serviços do dono (planos com valores).
// Escopado por company_id via localStorage.

import { getActiveCompanyId } from "./company-scope";
import { getCurrentRole } from "./local-auth";

export type ServiceItem = {
  id: string;
  company_id: string | null;
  nome: string;
  preco_cents: number;
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
    return Array.isArray(p) ? (p as ServiceItem[]) : [];
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
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function listActiveServices(): ServiceItem[] {
  return listServices().filter((s) => s.ativo);
}

export function saveService(input: { nome: string; preco_cents: number; ativo?: boolean }) {
  const all = read();
  const item: ServiceItem = {
    id: uid(),
    company_id: getActiveCompanyId() ?? null,
    nome: input.nome.trim(),
    preco_cents: Math.max(0, Math.round(input.preco_cents)),
    ativo: input.ativo ?? true,
    created_at: new Date().toISOString(),
  };
  all.unshift(item);
  write(all);
  return item;
}

export function updateService(id: string, patch: Partial<Omit<ServiceItem, "id" | "company_id" | "created_at">>) {
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
