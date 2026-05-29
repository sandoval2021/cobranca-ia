import { useEffect, useMemo, useState } from "react";
import {
  LOCAL_AUTH_EVENT,
  getCurrentLocalUser,
  getCurrentRole,
  setBridgedLocalUser,
  type LocalRole,
  type LocalUser,
} from "@/lib/local-auth";
import { useAuth } from "@/lib/use-auth";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { supabase, supabaseConfigured } from "@/integrations/supabase/compat";

/**
 * Bridge entre sessão Supabase Auth e a role no frontend.
 *
 * Fonte da verdade da role (em ordem de prioridade):
 *   1) RPC public.current_user_is_super_admin()      — backend, autoritativa
 *   2) RPC public.is_super_admin(uuid) com nomes de  — fallback direto
 *      argumento testados: uid, user_id, p_user_id, _user_id
 *   3) Allowlist VITE_SUPER_ADMIN_EMAILS             — fallback de UX
 *   4) "owner"                                       — default seguro
 *
 * Cadastro público NUNCA vira super_admin (ver local-auth.ts:signUp).
 *
 * IMPORTANTE: o frontend só esconde/mostra telas. A segurança real está
 * nas RPCs *_admin que chamam is_super_admin(auth.uid()) no backend e
 * negam acesso com permission denied se a role não bater. Mesmo que
 * alguém adultere o frontend, as RPCs continuam rejeitando.
 */
export function useLocalAuth() {
  const { user: supaUser } = useAuth();
  const [localUser, setLocalUser] = useState<LocalUser | null>(() => getCurrentLocalUser());
  const [localRole, setLocalRole] = useState<LocalRole>(() => getCurrentRole());
  // null = ainda não respondeu / RPC indisponível; true/false = resposta do backend.
  const [backendSuperAdmin, setBackendSuperAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    function refresh() {
      setLocalUser(getCurrentLocalUser());
      setLocalRole(getCurrentRole());
    }
    refresh();
    window.addEventListener(LOCAL_AUTH_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(LOCAL_AUTH_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // Consulta autoritativa do backend.
  // Ordem de tentativa (fail-soft, nunca quebra o login):
  //   1) RPC public.current_user_is_super_admin()           — preferida
  //   2) RPC public.is_super_admin(uid|user_id|p_user_id)   — fallback direto
  //   3) null → cai para allowlist VITE_SUPER_ADMIN_EMAILS  — opcional
  //   4) sem nada → "owner" (default seguro)
  useEffect(() => {
    let cancelled = false;
    if (!supaUser?.id || !supabaseConfigured || !supabase) {
      setBackendSuperAdmin(null);
      return;
    }
    const uid = supaUser.id;

    function isMissingFnError(err: { message?: string; code?: string } | null) {
      if (!err) return false;
      const m = (err.message ?? "").toLowerCase();
      return (
        err.code === "PGRST202" ||
        err.code === "42883" ||
        m.includes("could not find") ||
        m.includes("does not exist") ||
        m.includes("not find function") ||
        m.includes("schema cache")
      );
    }

    (async () => {
      try {
        // 1) Tentativa preferida.
        const r1 = await supabase.rpc("current_user_is_super_admin");
        if (cancelled) return;
        if (!r1.error) {
          setBackendSuperAdmin(Boolean(r1.data));
          return;
        }
        if (!isMissingFnError(r1.error)) {
          // Erro real (permissão/etc.) — não conseguimos confirmar.
          setBackendSuperAdmin(null);
          return;
        }

        // 2) Fallback: chamar is_super_admin(uuid) diretamente.
        // PostgREST exige argumento nomeado. Não sabemos o nome exato do
        // parâmetro declarado no banco — tentamos as convenções mais
        // comuns na ordem: uid, user_id, p_user_id, _user_id.
        const candidates: Array<Record<string, string>> = [
          { uid },
          { user_id: uid },
          { p_user_id: uid },
          { _user_id: uid },
        ];
        for (const args of candidates) {
          const r2 = await supabase.rpc("is_super_admin", args);
          if (cancelled) return;
          if (!r2.error) {
            setBackendSuperAdmin(Boolean(r2.data));
            return;
          }
          // Se foi erro de "parâmetro errado", tenta o próximo nome.
          // Qualquer outro erro real → para e cai para allowlist.
          if (!isMissingFnError(r2.error)) {
            setBackendSuperAdmin(null);
            return;
          }
        }

        // Nenhuma das duas RPCs existe no backend.
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.info(
            "[auth] Super Admin não confirmado pelo backend (nenhuma RPC disponível). Usuário tratado como Dono por segurança até a migration ser aplicada ou VITE_SUPER_ADMIN_EMAILS ser configurado.",
          );
        }
        setBackendSuperAdmin(null);
      } catch {
        if (!cancelled) setBackendSuperAdmin(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supaUser?.id]);

  const { user, role } = useMemo(() => {
    if (supaUser?.email) {
      const meta = (supaUser.user_metadata ?? {}) as Record<string, unknown>;
      const nome =
        (typeof meta.nome === "string" && meta.nome) ||
        (typeof meta.full_name === "string" && meta.full_name) ||
        localUser?.nome ||
        supaUser.email.split("@")[0];
      const whatsapp =
        (typeof meta.whatsapp === "string" && meta.whatsapp) || localUser?.whatsapp || "";

      // Prioridade da role:
      // 1) Backend confirmou super_admin → super_admin (autoritativo positivo).
      // 2) Allowlist de e-mail confirma super_admin → super_admin
      //    (UX: evita "rebaixar" alguém da allowlist enquanto o backend
      //     ainda não respondeu ou retorna false em janela transitória).
      // 3) Caso contrário → owner.
      const resolvedRole: LocalRole =
        backendSuperAdmin === true
          ? "super_admin"
          : isSuperAdminEmail(supaUser.email)
            ? "super_admin"
            : "owner";

      const bridged: LocalUser = {
        id: supaUser.id,
        nome,
        email: supaUser.email,
        whatsapp,
        senha_hash: "",
        role: resolvedRole,
        status: "ativo",
        email_confirmed: true,
        created_at: supaUser.created_at ?? new Date().toISOString(),
        updated_at: supaUser.updated_at ?? supaUser.created_at ?? "",
      };
      return { user: bridged, role: resolvedRole };
    }
    return { user: localUser, role: localRole };
  }, [supaUser, localUser, localRole, backendSuperAdmin]);

  // Sincroniza cache global para que chamadas estáticas (getCurrentRole/isSuperAdmin)
  // e helpers como getActiveCompany enxerguem a role bridged.
  // IMPORTANTE: dentro de useEffect — chamar setBridgedLocalUser durante o
  // render dispara LOCAL_AUTH_EVENT, que volta como setState nos listeners e
  // gera "Maximum update depth exceeded" / "Página sem resposta".
  useEffect(() => {
    if (supaUser?.email) {
      setBridgedLocalUser(user);
    } else if (!localUser) {
      setBridgedLocalUser(null);
    }
  }, [supaUser?.email, user, localUser]);

  // roleResolved = sabemos com segurança qual é a role do usuário.
  // - Sem usuário Supabase: depende apenas do localUser (já resolvido).
  // - Com usuário Supabase: precisa do backend OU da allowlist confirmar
  //   antes de assumir "owner" (senão flasha banner de trial para Super Admin).
  const roleResolved = !supaUser
    ? true
    : backendSuperAdmin !== null || isSuperAdminEmail(supaUser.email);

  return {
    user,
    role,
    isOwner: role === "owner",
    isSuperAdmin: role === "super_admin",
    roleResolved,
  };
}
