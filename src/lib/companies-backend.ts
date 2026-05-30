/**
 * H1.7 — Camada backend-first para /empresas.
 *
 * Fonte oficial = RPCs Supabase (ajeyimujgtukcbadyash):
 *   - list_companies_for_user()
 *   - get_active_company()
 *   - set_active_company(uuid)
 *   - get_company_entitlements(uuid)
 *   - create_company_admin(text, uuid)
 *   - update_company_admin(uuid, text, uuid)
 *   - archive_company_admin(uuid)
 *
 * NÃO usar localStorage como fonte oficial.
 * Cache local existe apenas como espelho descartável de UI.
 */
import { supabase } from "@/integrations/supabase/client";

export type BackendCompany = {
  id: string;
  name: string;
  owner_id: string | null;
  archived_at: string | null;
  archived_by: string | null;
  created_at: string;
};

export type BackendEntitlement = {
  feature_key: string;
  enabled: boolean;
  limit_value: number | null;
};

export type BackendEntitlementsResult = {
  plan_id: string | null;
  entitlements: BackendEntitlement[];
};

export const BACKEND_ACTIVE_COMPANY_CACHE_KEY = "cobraeasy:active_company_id_cache";
export const BACKEND_ACTIVE_COMPANY_EVENT = "cobraeasy:active_company_changed";

function friendly(err: { message?: string } | null, fallback: string): string {
  if (!err) return fallback;
  const m = (err.message ?? "").toLowerCase();
  if (m.includes("forbidden_super_admin_only"))
    return "Apenas o Admin do sistema pode executar esta ação.";
  if (m.includes("forbidden_company"))
    return "Você não tem acesso a esta empresa.";
  if (m.includes("not_authenticated"))
    return "Sessão expirada. Faça login novamente.";
  if (m.includes("name_required")) return "Informe o nome da empresa.";
  if (m.includes("owner_required")) return "Informe o dono da empresa.";
  if (m.includes("company_required")) return "Empresa inválida.";
  return fallback;
}

export async function listBackendCompanies(): Promise<BackendCompany[]> {
  const { data, error } = await supabase.rpc("list_companies_for_user");
  if (error) throw new Error(friendly(error, "Não foi possível carregar empresas. Tente novamente."));
  return (data ?? []) as BackendCompany[];
}

export async function getBackendActiveCompany(): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_active_company");
  if (error) throw new Error(friendly(error, "Não foi possível identificar a empresa ativa."));
  const id = (data as string | null) ?? null;
  if (typeof window !== "undefined") {
    if (id) localStorage.setItem(BACKEND_ACTIVE_COMPANY_CACHE_KEY, id);
    else localStorage.removeItem(BACKEND_ACTIVE_COMPANY_CACHE_KEY);
  }
  return id;
}

export async function setBackendActiveCompany(companyId: string): Promise<void> {
  const { error } = await supabase.rpc("set_active_company", { p_company_id: companyId });
  if (error) throw new Error(friendly(error, "Não foi possível selecionar esta empresa."));
  if (typeof window !== "undefined") {
    localStorage.setItem(BACKEND_ACTIVE_COMPANY_CACHE_KEY, companyId);
    window.dispatchEvent(new CustomEvent(BACKEND_ACTIVE_COMPANY_EVENT, { detail: { companyId } }));
  }
}

export async function getBackendCompanyEntitlements(
  companyId: string,
): Promise<BackendEntitlementsResult> {
  const { data, error } = await supabase.rpc("get_company_entitlements", {
    p_company_id: companyId,
  });
  if (error) throw new Error(friendly(error, "Não foi possível ler o plano da empresa."));
  const res = (data ?? { plan_id: null, entitlements: [] }) as BackendEntitlementsResult;
  return {
    plan_id: res.plan_id ?? null,
    entitlements: Array.isArray(res.entitlements) ? res.entitlements : [],
  };
}

export async function createBackendCompanyAdmin(
  name: string,
  ownerUserId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("create_company_admin", {
    p_name: name,
    p_owner_id: ownerUserId,
  });
  if (error) throw new Error(friendly(error, "Não foi possível criar a empresa."));
  return data as string;
}

export async function updateBackendCompany(
  companyId: string,
  name: string,
): Promise<void> {
  const { error } = await supabase.rpc("update_company_admin", {
    p_company_id: companyId,
    p_name: name,
    p_owner_id: null as unknown as string,
  });
  if (error) throw new Error(friendly(error, "Não foi possível salvar a empresa. Tente novamente."));
}

export async function archiveBackendCompany(companyId: string): Promise<void> {
  const { error } = await supabase.rpc("archive_company_admin", {
    p_company_id: companyId,
  });
  if (error) throw new Error(friendly(error, "Não foi possível arquivar a empresa."));
}

export function entitlementByKey(
  ents: BackendEntitlement[],
  key: string,
): BackendEntitlement | null {
  return ents.find((e) => e.feature_key === key) ?? null;
}

export function isEntitlementEnabled(
  ents: BackendEntitlement[],
  key: string,
): boolean {
  const e = entitlementByKey(ents, key);
  return !!e?.enabled;
}
