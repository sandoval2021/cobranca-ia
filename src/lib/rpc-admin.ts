import { useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { flags } from "@/lib/flags";
import { toast } from "sonner";

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
          message: "Não foi possível identificar a empresa.",
          tech: stagingRpcDetail("get_current_company_admin", {}, error),
        });
        return;
      }
      if (!companyId) {
        setState({
          status: "error",
          message: "Nenhuma empresa autorizada encontrada.",
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
