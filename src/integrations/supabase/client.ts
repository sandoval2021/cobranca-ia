import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string | undefined;

export const supabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: "cobranca-ia-auth",
      },
    })
  : null;

export function getSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Conexão não configurada. Defina VITE_SUPABASE_URL e a chave pública.",
    );
  }
  return supabase;
}
