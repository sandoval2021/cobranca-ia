import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/integrations/supabase/compat";

export const AUTH_REFRESH_EVENT = "cobranca-auth-refresh";

function isInvalidAuthToken(message: string): boolean {
  return /invalid.*token|invalid.*jwt|bad_jwt|jwt.*invalid/i.test(message);
}

// Desloga APENAS a sessão Supabase quando o token é comprovadamente inválido.
// NUNCA limpa localStorage/sessionStorage geral — fazer isso apaga dados
// offline do app (templates, leads, cache de empresas) e força re-login
// indevido em PWA/mobile quando a rede está lenta.
async function signOutInvalidSession() {
  try {
    await supabase!.auth.signOut();
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
    let settled = false;
    // Failsafe NÃO destrutivo: só destrava a UI se o getSession() travar.
    // NÃO mexe na sessão nem limpa storage — assim PWA/mobile não perde login
    // por rede lenta na abertura. 6s é suficiente: getSession() local é
    // síncrono ao storage; valores acima só atrasam a UI quando rede falha.
    const failSafe = window.setTimeout(() => {
      if (!alive || settled) return;
      settled = true;
      setLoading(false);
    }, 6_000);

    const finishLoading = (nextSession: Session | null) => {
      if (!alive) return;
      settled = true;
      window.clearTimeout(failSafe);
      setSession(nextSession);
      setLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!alive) return;
      if (_e === "INITIAL_SESSION") return;
      finishLoading(s);
    });

    // 1) Render IMEDIATO a partir da sessão em storage.
    // 2) Em background, revalida com getUser(); só desloga em token
    //    comprovadamente inválido (assinatura/expiração). Erros de rede
    //    são ignorados — a sessão local continua.
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      finishLoading(data.session);

      if (!data.session) return;
      supabase!.auth.getUser().then(async ({ error }) => {
        if (!alive || !error) return;
        if (isInvalidAuthToken(error.message)) {
          await signOutInvalidSession();
          if (alive) setSession(null);
        }
        // Erro genérico (rede, 5xx) → mantém a sessão local; refresh automático cuida.
      }).catch(() => undefined);
    }).catch(() => {
      if (alive) finishLoading(null);
    });

    const onRefresh = () => {
      supabase!.auth.getSession().then(({ data }) => {
        if (alive) setSession(data.session);
      }).catch(() => undefined);
    };
    window.addEventListener(AUTH_REFRESH_EVENT, onRefresh);

    return () => {
      alive = false;
      window.clearTimeout(failSafe);
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
