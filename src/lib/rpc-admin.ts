import { useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "@/integrations/supabase/compat";
import { useAuth } from "@/lib/use-auth";
import { flags } from "@/lib/flags";
import { toast } from "sonner";
import {
  getCurrentCompany,
  getCurrentCompanyId,
  listCompanies,
  ensureLocalAccount,
  upsertRealCompany,
  ensureOwnerMember,
  setCurrentCompany,
} from "@/lib/companies";


export type RpcErr = {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

/** Detalhe técnico mostrado apenas fora de produção. Nunca inclui chave/segredo. */
export function stagingRpcDetail(rpc: string, payload: unknown, err: RpcErr) {
  if (flags.appEnv === "production") return undefined;
  try {
    return [
      `RPC: ${rpc}`,
      `Payload: ${JSON.stringify(payload)}`,
      `message: ${err.message ?? ""}`,
      `details: ${err.details ?? ""}`,
      `hint: ${err.hint ?? ""}`,
      `code: ${err.code ?? ""}`,
    ].join("\n");
  } catch {
    return `RPC: ${rpc} — ${err.message ?? ""}`;
  }
}

export function toastRpcError(
  friendlyMsg: string,
  rpc: string,
  payload: unknown,
  err: RpcErr,
) {
  const description = stagingRpcDetail(rpc, payload, err);
  toast.error(
    friendlyMsg,
    description ? { description, duration: 12000 } : undefined,
  );
}

type RpcResult<T> = { data: T | null; error: RpcErr | null };

async function callRpc<T>(name: string, payload: object): Promise<RpcResult<T>> {
  if (!supabaseConfigured || !supabase) {
    return {
      data: null,
      error: { message: "Conexão não configurada.", code: "no_client" },
    };
  }
  const { data, error } = await supabase.rpc(name, payload as never);
  if (error) {
    return {
      data: null,
      error: {
        message: error.message,
        details: (error as { details?: string }).details ?? null,
        hint: (error as { hint?: string }).hint ?? null,
        code: (error as { code?: string }).code ?? null,
      },
    };
  }
  return { data: (data ?? null) as T | null, error: null };
}

/* ---------------- Empresa atual ---------------- */

export async function getCurrentCompanyAdmin() {
  const res = await callRpc<unknown>("get_current_company_admin", {});
  if (res.error) return { companyId: null as string | null, error: res.error };
  // Aceita objeto único, array com 1 item, ou shape { id }.
  const raw = Array.isArray(res.data) ? res.data[0] : res.data;
  const id =
    raw && typeof raw === "object"
      ? ((raw as Record<string, unknown>).id as string | undefined) ??
        ((raw as Record<string, unknown>).company_id as string | undefined)
      : typeof raw === "string"
        ? raw
        : undefined;
  return { companyId: id ? String(id) : null, error: null as RpcErr | null };
}

/**
 * Chama RPC `ensure_user_default_company` (Supabase) que retorna
 * o UUID real da base do usuário autenticado, criando-a se necessário.
 */
export async function ensureUserDefaultCompany(): Promise<{
  companyId: string | null;
  error: RpcErr | null;
}> {
  const res = await callRpc<unknown>("ensure_user_default_company", {});
  if (res.error) return { companyId: null, error: res.error };
  const raw = Array.isArray(res.data) ? res.data[0] : res.data;
  let id: string | undefined;
  if (typeof raw === "string") id = raw;
  else if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    id =
      (r.id as string | undefined) ??
      (r.company_id as string | undefined) ??
      (r.ensure_user_default_company as string | undefined);
  }
  return { companyId: id ? String(id) : null, error: null };
}

/**
 * Sincroniza a base padrão real do usuário: chama RPC, faz upsert/relink
 * da entrada local com o UUID, vincula owner e define como conta corrente.
 * Idempotente — pode ser chamada várias vezes.
 */
export async function syncDefaultCompanyForUser(user?: {
  email?: string | null;
  nome?: string | null;
  whatsapp?: string | null;
} | null): Promise<string | null> {
  const { companyId, error } = await ensureUserDefaultCompany();
  if (!companyId || !isUuid(companyId)) {
    if (error) console.warn("[account] ensure_user_default_company falhou:", error.code, error.message);
    return null;
  }
  try {
    upsertRealCompany(companyId, {
      dono_email: user?.email ?? "",
      dono_nome: user?.nome ?? "",
      dono_whatsapp: user?.whatsapp ?? "",
    });
    if (user?.email) ensureOwnerMember(companyId, user.email, user.nome, user.whatsapp);
    const cur = getCurrentCompanyId();
    if (!cur || !isUuid(cur)) setCurrentCompany(companyId);
  } catch (e) {
    console.warn("[account] sync local company falhou:", e);
  }
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(ACCOUNT_CACHE_KEY, companyId);
    } catch {
      /* ignore */
    }
  }
  return companyId;
}

const ACCOUNT_CACHE_KEY = "cobranca_ia_active_account_id_v1";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True se for UUID válido. Bloqueia IDs locais ("co_", "local_", "tmp_"). */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

/**
 * Obtém o UUID real da conta ativa para RPCs Supabase.
 * NUNCA retorna ID local começando com "co_", "local_", "tmp_".
 */
export async function getActiveAccountId(): Promise<{
  accountId: string | null;
  error: RpcErr | null;
}> {
  // Cache — invalida se não for UUID válido ou se não bater com seleção atual.
  if (typeof window !== "undefined") {
    try {
      const cached = window.sessionStorage.getItem(ACCOUNT_CACHE_KEY);
      const currentId = getCurrentCompanyId();
      if (cached && isUuid(cached) && (!currentId || cached === currentId)) {
        return { accountId: cached, error: null };
      }
      if (cached && (!isUuid(cached) || (currentId && cached !== currentId))) {
        window.sessionStorage.removeItem(ACCOUNT_CACHE_KEY);
      }
    } catch {
      /* ignore */
    }
  }

  const cacheAndReturn = (id: string) => {
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(ACCOUNT_CACHE_KEY, id);
      } catch {
        /* ignore */
      }
    }
    return { accountId: id, error: null as RpcErr | null };
  };

  // 1) Seleção manual de conta — só se UUID real
  try {
    const currentId = getCurrentCompanyId();
    if (currentId && isUuid(currentId)) {
      console.info("[account] resolved company uuid (selected)");
      return cacheAndReturn(currentId);
    }
    if (currentId) console.warn("[account] blocked non-uuid id (selected):", currentId);
  } catch (e) {
    console.warn("[account] getCurrentCompany falhou:", e);
  }

  // 2) RPC ensure_user_default_company — fonte de verdade da base do usuário
  const ensured = await ensureUserDefaultCompany();
  if (ensured.companyId && isUuid(ensured.companyId)) {
    try {
      upsertRealCompany(ensured.companyId, {});
      const cur = getCurrentCompanyId();
      if (!cur || !isUuid(cur)) setCurrentCompany(ensured.companyId);
    } catch (e) {
      console.warn("[account] upsert real company falhou:", e);
    }
    console.info("[account] resolved company uuid (ensure_user_default_company)");
    return cacheAndReturn(ensured.companyId);
  }
  if (ensured.error) {
    console.warn("[account] ensure_user_default_company erro:", ensured.error.code, ensured.error.message);
  }

  // 3) Fallback: primeira Company local com UUID real
  try {
    const firstReal = listCompanies().find((c) => isUuid(c.id));
    if (firstReal) {
      console.info("[account] resolved company uuid (fallback list):", firstReal.nome);
      return cacheAndReturn(firstReal.id);
    }
  } catch (e) {
    console.warn("[account] listCompanies falhou:", e);
  }

  // 4) Fallback legacy: get_current_company_admin
  const { companyId, error } = await getCurrentCompanyAdmin();
  if (companyId && isUuid(companyId)) return cacheAndReturn(companyId);
  if (error) console.warn("[account] get_current_company_admin erro:", error.code, error.message);

  // 5) ensureLocalAccount — só aceita UUID real (improvável retornar UUID, mas mantido)
  try {
    const local = ensureLocalAccount(undefined, undefined, undefined);
    if (local && isUuid(local.id)) return cacheAndReturn(local.id);
  } catch (e) {
    console.warn("[account] ensureLocalAccount falhou:", e);
  }

  return { accountId: null, error: ensured.error ?? error };
}


export function clearActiveAccountCache() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(ACCOUNT_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

export type CurrentCompanyState =
  | { status: "loading" }
  | { status: "not_configured" }
  | { status: "unauthenticated" }
  | { status: "error"; message: string; tech?: string }
  | { status: "ready"; companyId: string };

export function useCurrentCompany(): CurrentCompanyState {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [state, setState] = useState<CurrentCompanyState>({ status: "loading" });

  useEffect(() => {
    if (authLoading) return;
    if (!supabaseConfigured || !supabase) {
      setState({ status: "not_configured" });
      return;
    }
    if (!isAuthenticated) {
      setState({ status: "unauthenticated" });
      return;
    }
    let alive = true;
    setState({ status: "loading" });
    (async () => {
      const { accountId, error } = await getActiveAccountId();
      if (!alive) return;
      if (accountId) {
        setState({ status: "ready", companyId: accountId });
        return;
      }
      setState({
        status: "error",
        message: "Não foi possível preparar sua conta. Tente entrar novamente.",
        tech: error
          ? stagingRpcDetail("get_current_company_admin", {}, error)
          : undefined,
      });
    })();
    return () => {
      alive = false;
    };
  }, [authLoading, isAuthenticated]);

  return state;
}

/* ---------------- Clientes ---------------- */

export type ListCustomersArgs = {
  p_company_id: string;
  p_status?: string | null;
  p_search?: string | null;
  p_limit?: number;
  p_offset?: number;
};

export function listCustomersAdmin(args: ListCustomersArgs) {
  const payload = {
    p_company_id: args.p_company_id,
    p_status: args.p_status ?? null,
    p_search: args.p_search ?? null,
    p_limit: args.p_limit ?? 100,
    p_offset: args.p_offset ?? 0,
  };
  return callRpc<Array<Record<string, unknown>>>("list_customers_admin", payload).then(
    (r) => ({ ...r, payload }),
  );
}

export type ListCustomersForSelectArgs = {
  p_company_id: string;
  p_search?: string | null;
  p_limit?: number;
};

export function listCustomersForSelectAdmin(args: ListCustomersForSelectArgs) {
  const payload = {
    p_company_id: args.p_company_id,
    p_search: args.p_search ?? null,
    p_limit: args.p_limit ?? 50,
  };
  return callRpc<Array<Record<string, unknown>>>(
    "list_customers_for_select_admin",
    payload,
  ).then((r) => ({ ...r, payload }));
}

/* ---------------- Cobranças ---------------- */

export type ListChargesArgs = {
  p_company_id: string;
  p_status?: string | null;
  p_search?: string | null;
  p_limit?: number;
  p_offset?: number;
};

export function listChargesAdmin(args: ListChargesArgs) {
  const payload = {
    p_company_id: args.p_company_id,
    p_status: args.p_status ?? null,
    p_search: args.p_search ?? null,
    p_limit: args.p_limit ?? 100,
    p_offset: args.p_offset ?? 0,
  };
  return callRpc<Array<Record<string, unknown>>>("list_charges_admin", payload).then(
    (r) => ({ ...r, payload }),
  );
}

export type ListChargesForSelectArgs = {
  p_company_id: string;
  p_status?: string | null;
  p_limit?: number;
};

export function listChargesForSelectAdmin(args: ListChargesForSelectArgs) {
  const payload = {
    p_company_id: args.p_company_id,
    p_status: args.p_status ?? null,
    p_limit: args.p_limit ?? 100,
  };
  return callRpc<Array<Record<string, unknown>>>(
    "list_charges_for_select_admin",
    payload,
  ).then((r) => ({ ...r, payload }));
}

/* ---------------- Importação ---------------- */

export type ImportDedupArgs = {
  p_company_id: string;
  p_whatsapp_e164_values: string[];
};

export function getImportCustomerDedupAdmin(args: ImportDedupArgs) {
  const payload = {
    p_company_id: args.p_company_id,
    p_whatsapp_e164_values: args.p_whatsapp_e164_values,
  };
  return callRpc<Array<Record<string, unknown>>>(
    "get_import_customer_dedup_admin",
    payload,
  ).then((r) => ({ ...r, payload }));
}
