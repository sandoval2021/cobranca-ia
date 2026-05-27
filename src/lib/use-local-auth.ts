import { useEffect, useMemo, useState } from "react";
import {
  LOCAL_AUTH_EVENT,
  getCurrentLocalUser,
  getCurrentRole,
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
 *   1) RPC public.current_user_is_super_admin() — backend, autoritativa.
 *   2) Allowlist VITE_SUPER_ADMIN_EMAILS — fallback de UX enquanto a RPC
 *      ainda não está disponível (ex.: migration não aplicada).
 *   3) "owner" — padrão seguro. Cadastro público NUNCA vira super_admin.
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
  useEffect(() => {
    let cancelled = false;
    if (!supaUser?.id || !supabaseConfigured || !supabase) {
      setBackendSuperAdmin(null);
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase.rpc("current_user_is_super_admin");
        if (cancelled) return;
        if (error) {
          // RPC ainda não aplicada no backend (404/does not exist) ou erro de
          // permissão — caímos no fallback por allowlist. Não logamos como
          // erro porque é esperado até a migration ser aplicada.
          setBackendSuperAdmin(null);
          return;
        }
        setBackendSuperAdmin(Boolean(data));
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

      // 1) Backend é autoritativo quando responde.
      // 2) Senão, allowlist como fallback otimista.
      // 3) Senão, owner (default seguro).
      const resolvedRole: LocalRole =
        backendSuperAdmin === true
          ? "super_admin"
          : backendSuperAdmin === false
            ? "owner"
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
        updated_at: new Date().toISOString(),
      };
      return { user: bridged, role: resolvedRole };
    }
    return { user: localUser, role: localRole };
  }, [supaUser, localUser, localRole, backendSuperAdmin]);

  return { user, role, isOwner: role === "owner", isSuperAdmin: role === "super_admin" };
}
