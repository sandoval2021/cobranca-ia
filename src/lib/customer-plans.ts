// Vínculo cliente↔plano. Banco é a fonte da verdade
// (tabela public.customer_service_plan). localStorage segue como cache síncrono.
// Sincronização: src/lib/services/useServicesSync.ts.

import { toast } from "sonner";
import { getActiveCompanyId } from "./company-scope";
import { getServiceById, formatBRL, type ServiceItem } from "./services-catalog";
import {
  setCustomerPlanDb,
  bulkUpsertCustomerPlanLinksDb,
  type CustomerPlanLinkDto,
} from "@/lib/services/services.functions";

const STORAGE_KEY = "cobranca_ia_customer_plans_v1";
export const CUSTOMER_PLANS_EVENT = "cobranca_ia_customer_plans:changed";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Entry = { company_id: string | null; customer_id: string; service_id: string };

function isValidCompanyUuid(id: string | null | undefined): id is string {
  return !!id && UUID_RE.test(id);
}

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
  } catch { /* noop */ }
}

function persistInBackground(fn: () => Promise<unknown>, failureMessage: string) {
  void (async () => {
    try {
      await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "erro";
      console.error("[customer-plans]", failureMessage, err);
      toast.error(`${failureMessage}. ${msg}`);
    }
  })();
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

  if (isValidCompanyUuid(cid) && UUID_RE.test(customerId)) {
    const validServiceId = serviceId && UUID_RE.test(serviceId) ? serviceId : null;
    // Se foi pedido um plano mas o id não é UUID (legado), apenas não persiste no banco.
    if (serviceId && !validServiceId) return;
    persistInBackground(
      () => setCustomerPlanDb({ data: { companyId: cid, customerId, servicePlanId: validServiceId } }),
      "Não foi possível salvar o plano do cliente na sua conta",
    );
  }
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

// ----- sincronização com o banco -----

/**
 * Hidrata o cache local com os vínculos cliente↔plano vindos do banco.
 * Se o banco está vazio e há vínculos locais desta empresa, NÃO sobrescreve —
 * eles serão enviados junto com os planos no upload em massa.
 */
export function hydrateCustomerPlansFromDb(companyId: string, links: CustomerPlanLinkDto[]): void {
  if (typeof window === "undefined") return;
  if (!isValidCompanyUuid(companyId)) return;

  const all = read();
  const localOfCompany = all.filter((x) => x.company_id === companyId);

  if (links.length === 0 && localOfCompany.length > 0) {
    // Preserva cache local até upload.
    return;
  }

  const others = all.filter((x) => x.company_id !== companyId);
  const next: Entry[] = [
    ...others,
    ...links.map((l) => ({
      company_id: companyId,
      customer_id: l.customer_id,
      service_id: l.service_plan_id,
    })),
  ];
  write(next);
}

/**
 * Envia para o banco os vínculos cliente↔plano da empresa ativa que tenham UUID válido.
 */
export async function uploadLocalCustomerPlansToDb(): Promise<{ upserted: number }> {
  const cid = getActiveCompanyId();
  if (!isValidCompanyUuid(cid)) throw new Error("Empresa inválida");
  const all = read();
  const links = all
    .filter((x) => x.company_id === cid)
    .filter((x) => UUID_RE.test(x.customer_id) && UUID_RE.test(x.service_id))
    .map((x) => ({ customerId: x.customer_id, servicePlanId: x.service_id }));
  if (links.length === 0) return { upserted: 0 };
  return bulkUpsertCustomerPlanLinksDb({ data: { companyId: cid, links } });
}
