// Compatibility shim so existing app code that imported
// `supabaseConfigured` (from the previous hand-written client) keeps working
// after Lovable Cloud regenerated `client.ts`.
//
// Also exposes the supabase client typed loosely so legacy code that calls
// `.rpc("name", ...)` / `.from("table")` against tables/functions not yet in
// the generated `types.ts` continues to typecheck.
import { supabase as typedSupabase } from "./client";
import type { SupabaseClient } from "@supabase/supabase-js";

export const supabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.VITE_SUPABASE_ANON_KEY),
);

// Cast to a generic SupabaseClient so legacy RPC/table names compile.
export const supabase = typedSupabase as unknown as SupabaseClient;

export function getSupabase(): SupabaseClient {
  return supabase;
}
