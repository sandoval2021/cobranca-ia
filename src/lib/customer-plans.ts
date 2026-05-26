// Mapa local: customer_id → service_id (plano). Escopo por company_id.
// 100% frontend (localStorage). Não toca Supabase.

import { getActiveCompanyId } from "./company-scope";
import { getServiceById, formatBRL, type ServiceItem } from "./services-catalog";

const STORAGE_KEY = "cobranca_ia_customer_plans_v1";
export const CUSTOMER_PLANS_EVENT = "cobranca_ia_customer_plans:changed";

type Entry = { company_id: string | null; customer_id: string; service_id: string };

function read(): Entry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw);
    return Array.isArray(p) ? (p as Entry[]) : [];
  } catch {
    return [];
  }
}

function write(items: Entry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  try {
    window.dispatchEvent(new CustomEvent(CUSTOMER_PLANS_EVENT));
  } catch {
    /* noop */
  }
}

export function getCustomerPlanId(customerId: string | null | undefined): string | null {
  if (!customerId) return null;
  const cid = getActiveCompanyId() ?? null;
  const e = read().find((x) => x.customer_id === customerId && x.company_id === cid);
  return e?.service_id ?? null;
}

export function getCustomerPlan(customerId: string | null | undefined): ServiceItem | null {
  return getServiceById(getCustomerPlanId(customerId));
}

export function setCustomerPlan(customerId: string, serviceId: string | null) {
  const cid = getActiveCompanyId() ?? null;
  const all = read().filter((x) => !(x.customer_id === customerId && x.company_id === cid));
  if (serviceId) all.push({ company_id: cid, customer_id: customerId, service_id: serviceId });
  write(all);
}

/** Aplica variáveis padrão a um template do plano. */
export function renderPlanTemplate(
  template: string,
  vars: {
    nome?: string | null;
    plano?: string | null;
    valor_cents?: number | null;
    telas?: number | null;
    meses?: number | null;
    vencimento?: string | null;
  },
): string {
  const map: Record<string, string> = {
    nome: vars.nome?.trim() || "cliente",
    plano: vars.plano?.trim() || "—",
    valor: vars.valor_cents != null ? formatBRL(vars.valor_cents) : "—",
    telas: vars.telas != null ? String(vars.telas) : "—",
    meses: vars.meses != null ? String(vars.meses) : "—",
    vencimento: vars.vencimento?.trim() || "—",
  };
  return template.replace(/\{(\w+)\}/g, (_m, k) => map[k] ?? `{${k}}`);
}
