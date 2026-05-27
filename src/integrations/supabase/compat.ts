// Compatibility shim so existing app code that imported
// `supabaseConfigured` (from the previous hand-written client) keeps working
// after Lovable Cloud regenerated `client.ts`.
//
// Also exposes the supabase client typed loosely so legacy code that calls
// `.rpc("name", ...)` / `.from("table")` against tables/functions not yet in
// the generated `types.ts` continues to typecheck.
import { supabase as typedSupabase } from "./client";
import type { SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
const EXPECTED_PROJECT_REF = "pkghjzbvmifmztqvpdeu";
const FORBIDDEN_PROJECT_REF = "ajeyimujgtukcbadyash";

export const supabaseProjectRef =
  SUPABASE_URL.match(/^https?:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "unknown";

export const supabaseUrl = SUPABASE_URL;
export const isCorrectSupabase = supabaseProjectRef === EXPECTED_PROJECT_REF;
export const isForbiddenSupabase = supabaseProjectRef === FORBIDDEN_PROJECT_REF;

if (typeof window !== "undefined") {
  if (isForbiddenSupabase) {
    // eslint-disable-next-line no-console
    console.error(
      `[Supabase] Ambiente incorreto: banco novo vazio (${FORBIDDEN_PROJECT_REF}) conectado. Use o Supabase antigo (${EXPECTED_PROJECT_REF}).`,
    );
  } else if (!isCorrectSupabase) {
    // eslint-disable-next-line no-console
    console.warn(
      `[Supabase] Projeto conectado: ${supabaseProjectRef} (esperado: ${EXPECTED_PROJECT_REF}).`,
    );
  }
}

export const supabaseConfigured = Boolean(
  SUPABASE_URL &&
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.VITE_SUPABASE_ANON_KEY) &&
    !isForbiddenSupabase,
);

// Cast to a generic SupabaseClient so legacy RPC/table names compile.
export const supabase = typedSupabase as unknown as SupabaseClient;

export function getSupabase(): SupabaseClient {
  return supabase;
}
