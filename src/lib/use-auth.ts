import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/integrations/supabase/compat";

export const AUTH_REFRESH_EVENT = "cobranca-auth-refresh";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !supabaseConfigured) {
      setLoading(false);
      return;
    }
    let alive = true;

    // Listener fires SIGNED_IN/SIGNED_OUT/INITIAL_SESSION synchronously.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!alive) return;
      setSession(s);
      setLoading(false);
    });

    // Initial restore from storage — resolves quickly; INITIAL_SESSION
    // event also covers this, but keep as a safety net.
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
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
  return msg;
}
