import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/integrations/supabase/client";

export const AUTH_REFRESH_EVENT = "cobranca-auth-refresh";

async function getSessionWithTimeout(timeoutMs = 3500): Promise<Session | null> {
  if (!supabase) return null;
  const timeout = new Promise<Session | null>((resolve) => {
    window.setTimeout(() => resolve(null), timeoutMs);
  });
  const sessionRead = supabase.auth
    .getSession()
    .then(({ data }) => data.session)
    .catch(() => null);
  return Promise.race([sessionRead, timeout]);
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
    async function refreshSession() {
      const currentSession = await getSessionWithTimeout();
      if (!alive) return;
      setSession(currentSession);
      setLoading(false);
    }
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    refreshSession();
    window.addEventListener(AUTH_REFRESH_EVENT, refreshSession);
    return () => {
      alive = false;
      window.removeEventListener(AUTH_REFRESH_EVENT, refreshSession);
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
  return msg;
}
