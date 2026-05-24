import { useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "@/integrations/supabase/client";

export type LoadState<T> =
  | { status: "loading" }
  | { status: "not_configured" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T[] };

export function useSupabaseList<T = Record<string, unknown>>(
  table: string,
  options?: {
    limit?: number;
    order?: { column: string; ascending?: boolean };
    deps?: ReadonlyArray<unknown>;
  },
) {
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    if (!supabaseConfigured || !supabase) {
      setState({ status: "not_configured" });
      return;
    }
    setState({ status: "loading" });
    (async () => {
      let q = supabase.from(table).select("*").limit(options?.limit ?? 100);
      if (options?.order) {
        q = q.order(options.order.column, {
          ascending: options.order.ascending ?? false,
        });
      }
      const { data, error } = await q;
      if (!alive) return;
      if (error) {
        setState({ status: "error", message: friendlyError(error.message) });
      } else {
        setState({ status: "ready", data: (data ?? []) as T[] });
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, ...(options?.deps ?? [])]);

  return state;
}

export function useSupabaseCount(table: string) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "not_configured" }
    | { status: "error"; message: string }
    | { status: "ready"; count: number }
  >({ status: "loading" });

  useEffect(() => {
    let alive = true;
    if (!supabaseConfigured || !supabase) {
      setState({ status: "not_configured" });
      return;
    }
    (async () => {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      if (!alive) return;
      if (error) {
        setState({ status: "error", message: friendlyError(error.message) });
      } else {
        setState({ status: "ready", count: count ?? 0 });
      }
    })();
    return () => {
      alive = false;
    };
  }, [table]);

  return state;
}

export function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("permission") || m.includes("rls") || m.includes("denied"))
    return "Permissão bloqueada";
  if (m.includes("does not exist") || m.includes("not find"))
    return "Tabela não encontrada";
  if (m.includes("fetch") || m.includes("network"))
    return "Falha de conexão";
  return msg;
}
