import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Valores públicos do Supabase (anon key e URL podem ficar no código).
const FALLBACK_URL = "https://pkghjzbvmifmztqvpdeu.supabase.co";
const FALLBACK_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrZ2hqemJ2bWlmbXp0cXZwZGV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NzgyODAsImV4cCI6MjA5NTE1NDI4MH0.3knFO0vkJ8uMolrcosHYx3kGB1O6rblroV1aJiRKzko";

const url =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || FALLBACK_URL;
const anonKey =
  ((import.meta.env.VITE_SUPABASE_ANON_KEY ??
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string | undefined) ||
  FALLBACK_ANON;

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
