import { useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { flags } from "@/lib/flags";
import { toast } from "sonner";
import {
  getCurrentCompany,
  getCurrentCompanyId,
  listCompanies,
  ensureLocalAccount,
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

const ACCOUNT_CACHE_KEY = "cobranca_ia_active_account_id_v1";

/**
 * Helper único — obtém o id da conta ativa.
 * Prioridade:
 *  1) Conta selecionada em "Visualizando como" (local).
 *  2) Conta TESTANDO (ambiente staging/teste).
 *  3) Primeira conta local disponível.
 *  4) RPC backend get_current_company_admin.
 *  5) ensureLocalAccount cria "Minha conta" como fallback final.
 */
export async function getActiveAccountId(): Promise<{
  accountId: string | null;
  error: RpcErr | null;
}> {
  // Cache só vale se ainda bate com a seleção atual ("Visualizando como").
  if (typeof window !== "undefined") {
    try {
      const cached = window.sessionStorage.getItem(ACCOUNT_CACHE_KEY);
      const currentId = getCurrentCompanyId();
      if (cached && (!currentId || cached === currentId)) {
        return { accountId: cached, error: null };
      }
      if (cached && currentId && cached !== currentId) {
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

  // 1) "Visualizando como"
  try {
    const currentId = getCurrentCompanyId();
    const current = getCurrentCompany();
    if (currentId && current) {
      console.info("[account] usando conta selecionada:", current.nome);
      return cacheAndReturn(currentId);
    }
  } catch (e) {
    console.warn("[account] getCurrentCompany falhou:", e);
  }

  // 2) TESTANDO em staging/local
  try {
    const all = listCompanies();
    console.info("[account] contas locais encontradas:", all.length);
    const testando = all.find((c) => c.nome.trim().toUpperCase() === "TESTANDO");
    if (testando) {
      console.info("[account] usando conta TESTANDO");
      return cacheAndReturn(testando.id);
    }
    // 3) primeira conta disponível
    if (all.length > 0) {
      console.info("[account] usando primeira conta local:", all[0]!.nome);
      return cacheAndReturn(all[0]!.id);
    }
  } catch (e) {
    console.warn("[account] listCompanies falhou:", e);
  }

  // 4) backend
  const { companyId, error } = await getCurrentCompanyAdmin();
  if (companyId) return cacheAndReturn(companyId);
  if (error) console.warn("[account] get_current_company_admin erro:", error.code, error.message);

  // 5) ensureLocalAccount como último fallback
  try {
    const ensured = ensureLocalAccount(undefined, undefined, undefined);
    if (ensured) {
      console.info("[account] fallback ensureLocalAccount:", ensured.nome);
      return cacheAndReturn(ensured.id);
    }
  } catch (e) {
    console.warn("[account] ensureLocalAccount falhou:", e);
  }

  return { accountId: null, error };
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
      const { companyId, error } = await getCurrentCompanyAdmin();
      if (!alive) return;
      if (error) {
        setState({
          status: "error",
          message: "Não foi possível preparar sua conta. Tente entrar novamente.",
          tech: stagingRpcDetail("get_current_company_admin", {}, error),
        });
        return;
      }
      if (!companyId) {
        setState({
          status: "error",
          message: "Não foi possível preparar sua conta. Tente entrar novamente.",
        });
        return;
      }
      setState({ status: "ready", companyId });
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
