import {
  isAnonKeyForExpectedProject,
  isAnonKeyForbidden,
  isCorrectSupabase,
  isForbiddenSupabase,
  supabaseAnonKeyPresent,
  supabaseAnonKeyRef,
  supabaseProjectRef,
  supabaseUrl,
} from "@/integrations/supabase/compat";

/**
 * Banner de diagnóstico de ambiente.
 * Mostra a qual projeto Supabase o app está conectado e se a anon key bate.
 * NUNCA exibe anon key, service role ou tokens — apenas metadados.
 */
export function SupabaseEnvBanner() {
  const env = (import.meta.env.VITE_APP_ENV as string | undefined) ?? "dev";
  const allGood = isCorrectSupabase && supabaseAnonKeyPresent && isAnonKeyForExpectedProject;
  if (env === "production" && allGood) return null;

  let bg = "bg-emerald-700 text-white";
  let label = `Supabase: ${supabaseProjectRef}`;

  if (isForbiddenSupabase) {
    bg = "bg-red-600 text-white";
    label = "AMBIENTE INCORRETO — banco novo vazio conectado. Use o Supabase antigo.";
  } else if (!isCorrectSupabase) {
    bg = "bg-amber-600 text-white";
    label = `Supabase inesperado: ${supabaseProjectRef}`;
  } else if (!supabaseAnonKeyPresent) {
    bg = "bg-red-600 text-white";
    label = "Anon key AUSENTE no bundle — configure ANON_KEY_SUPABASE e republique.";
  } else if (isAnonKeyForbidden) {
    bg = "bg-red-600 text-white";
    label = "Anon key embutida é do projeto ERRADO (ajeyimujgtukcbadyash).";
  } else if (!isAnonKeyForExpectedProject) {
    bg = "bg-amber-600 text-white";
    label = `Anon key de projeto inesperado: ${supabaseAnonKeyRef ?? "?"}`;
  }

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
