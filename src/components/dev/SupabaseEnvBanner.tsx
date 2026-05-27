import {
  isCorrectSupabase,
  isForbiddenSupabase,
  supabaseProjectRef,
  supabaseUrl,
} from "@/integrations/supabase/compat";

/**
 * Banner de diagnóstico de ambiente.
 * Mostra a qual projeto Supabase o app está conectado.
 * NUNCA exibe anon key, service role ou tokens.
 */
export function SupabaseEnvBanner() {
  const env = (import.meta.env.VITE_APP_ENV as string | undefined) ?? "dev";
  if (env === "production" && isCorrectSupabase) return null;

  const bg = isForbiddenSupabase
    ? "bg-red-600 text-white"
    : isCorrectSupabase
      ? "bg-emerald-700 text-white"
      : "bg-amber-600 text-white";

  const label = isForbiddenSupabase
    ? "AMBIENTE INCORRETO — banco novo vazio conectado. Use o Supabase antigo."
    : isCorrectSupabase
      ? `Supabase: ${supabaseProjectRef}`
      : `Supabase inesperado: ${supabaseProjectRef}`;

  return (
    <div
      className={`${bg} text-[11px] px-3 py-1 text-center font-mono leading-tight`}
      role="status"
      aria-live="polite"
    >
      {label} · {supabaseUrl || "(sem URL)"}
    </div>
  );
}
