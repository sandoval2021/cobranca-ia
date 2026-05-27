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

/**
 * Bridge entre sessão Supabase Auth (fonte da verdade do login) e o
 * usuário local (cache de papéis/perfis no navegador).
 *
 * Regras:
 * - Se houver usuário Supabase autenticado:
 *   - role = super_admin se o e-mail estiver na allowlist VITE_SUPER_ADMIN_EMAILS;
 *   - caso contrário role = owner (cadastro público nunca vira super_admin).
 *   - Reaproveita o `LocalUser` (nome/whatsapp) quando existir, mas força o role.
 * - Se não houver usuário Supabase: usa o local-auth puro (modo demo legado).
 */
export function useLocalAuth() {
  const { user: supaUser } = useAuth();
  const [localUser, setLocalUser] = useState<LocalUser | null>(() => getCurrentLocalUser());
  const [localRole, setLocalRole] = useState<LocalRole>(() => getCurrentRole());

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
      const resolvedRole: LocalRole = isSuperAdminEmail(supaUser.email)
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
  }, [supaUser, localUser, localRole]);

  return { user, role, isOwner: role === "owner", isSuperAdmin: role === "super_admin" };
}
