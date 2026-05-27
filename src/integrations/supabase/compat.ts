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
const ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  "";
const EXPECTED_PROJECT_REF = "pkghjzbvmifmztqvpdeu";
const FORBIDDEN_PROJECT_REF = "ajeyimujgtukcbadyash";

export const supabaseProjectRef =
  SUPABASE_URL.match(/^https?:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? "unknown";

export const supabaseUrl = SUPABASE_URL;
export const isCorrectSupabase = supabaseProjectRef === EXPECTED_PROJECT_REF;
export const isForbiddenSupabase = supabaseProjectRef === FORBIDDEN_PROJECT_REF;

// Decode a JWT anon key (best-effort, no validation) and return its `ref`/`role`.
// Safe to expose — does NOT return the key itself.
function decodeAnonKey(k: string): { ref: string | null; role: string | null; format: string } {
  if (!k) return { ref: null, role: null, format: "missing" };
  if (k.startsWith("sb_publishable_")) return { ref: null, role: "publishable", format: "sb_publishable" };
  const parts = k.split(".");
  if (parts.length !== 3) return { ref: null, role: null, format: "unknown" };
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    const json = JSON.parse(
      typeof atob === "function" ? atob(b64 + pad) : Buffer.from(b64 + pad, "base64").toString("utf-8"),
    );
    return { ref: json.ref ?? null, role: json.role ?? null, format: "jwt" };
  } catch {
    return { ref: null, role: null, format: "jwt-undecodable" };
  }
}

const anonInfo = decodeAnonKey(ANON_KEY);
export const supabaseAnonKeyPresent = Boolean(ANON_KEY);
export const supabaseAnonKeyRef = anonInfo.ref;
export const supabaseAnonKeyRole = anonInfo.role;
export const supabaseAnonKeyFormat = anonInfo.format;
export const isAnonKeyForExpectedProject =
  anonInfo.format === "jwt" ? anonInfo.ref === EXPECTED_PROJECT_REF : supabaseAnonKeyPresent;
export const isAnonKeyForbidden =
  anonInfo.format === "jwt" && anonInfo.ref === FORBIDDEN_PROJECT_REF;

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
  // eslint-disable-next-line no-console
  console.info("[Supabase] Anon key diagnostic:", {
    present: supabaseAnonKeyPresent,
    format: supabaseAnonKeyFormat,
    ref: supabaseAnonKeyRef,
    role: supabaseAnonKeyRole,
    matchesExpectedProject: isAnonKeyForExpectedProject,
  });
}

export const supabaseConfigured = Boolean(
  SUPABASE_URL && supabaseAnonKeyPresent && !isForbiddenSupabase && !isAnonKeyForbidden,
);


// Cast to a generic SupabaseClient so legacy RPC/table names compile.
export const supabase = typedSupabase as unknown as SupabaseClient;

export function getSupabase(): SupabaseClient {
  return supabase;
}
