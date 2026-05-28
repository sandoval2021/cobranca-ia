import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/integrations/supabase/compat";

export const AUTH_REFRESH_EVENT = "cobranca-auth-refresh";

function isInvalidAuthToken(message: string): boolean {
  return /invalid.*token|invalid.*jwt|bad_jwt|jwt.*invalid|unauthorized/i.test(message);
}

async function clearStaleSession() {
  try {
    await supabase!.auth.signOut();
  } catch {
    // ignore
  }
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    // ignore
  }
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !supabaseConfigured) {
      setLoading(false);
      return;
    }
    let alive = true;

    // INITIAL_SESSION vem do storage local e pode conter JWT antigo após rotação
    // de chaves. Não confiar nele antes de revalidar com getUser().
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!alive) return;
      if (_e === "INITIAL_SESSION") return;
      setSession(s);
      setLoading(false);
    });

    // Initial restore from storage + revalidate token against Auth server.
    // If the stored JWT is stale (e.g. signing key rotated → unrecognized
    // kid), force sign-out so the user re-authenticates with a fresh token.
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      if (data.session) {
        const { error } = await supabase!.auth.getUser();
        if (error) {
          if (isInvalidAuthToken(error.message)) await clearStaleSession();
          else await supabase!.auth.signOut().catch(() => undefined);
          if (!alive) return;
          setSession(null);
          setLoading(false);
          return;
        }
      }
      setSession(data.session);
      setLoading(false);
    }).catch(() => {
      if (alive) setLoading(false);
    });

    const onRefresh = () => {
      supabase!.auth.getSession().then(({ data }) => {
        if (alive) setSession(data.session);
      }).catch(() => undefined);
    };
    window.addEventListener(AUTH_REFRESH_EVENT, onRefresh);

    return () => {
      alive = false;
      window.removeEventListener(AUTH_REFRESH_EVENT, onRefresh);
      sub.subscription.unsubscribe();
    };
  }, []);

  const user: User | null = session?.user ?? null;
  return { session, user, loading, isAuthenticated: !!user };
}

export function friendlyAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid_credentials"))
    return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed"))
    return "Confirme seu e-mail antes de entrar.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas. Aguarde um momento.";
  if (m.includes("network") || m.includes("fetch"))
    return "Falha de conexão. Tente novamente.";
  if (
    m.includes("weak") ||
    m.includes("pwned") ||
    m.includes("known to be") ||
    m.includes("easy to guess") ||
    m.includes("compromised")
  )
    return "Essa senha é muito comum ou já apareceu em vazamentos públicos. Escolha uma senha diferente, combinando letras, números e símbolos.";
  if (m.includes("password should be at least"))
    return "A senha precisa ter pelo menos 6 caracteres.";
  if (m.includes("user already registered") || m.includes("already exists"))
    return "Já existe uma conta com este e-mail. Faça login ou recupere sua senha.";
  if (m.includes("invalid email") || m.includes("email address") && m.includes("invalid"))
    return "E-mail inválido. Verifique e tente de novo.";
  return msg;
}
