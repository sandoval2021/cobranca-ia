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
 *   3) "owner"                                       — default seguro
 *
 * Fase A — A allowlist VITE_SUPER_ADMIN_EMAILS foi removida do bundle
 * público. `isSuperAdminEmail` continua importável mas sempre retorna
 * false. A decisão de privilégio crítico é responsabilidade do backend.
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
  // null = ainda não resolvido; "owner"|"admin"|"member"|"none" = decisão do backend.
  // "none" = não é dono nem membro de nenhuma empresa (usuário órfão).
  const [membership, setMembership] = useState<"owner" | "admin" | "member" | "none" | null>(null);

  useEffect(() => {
    function refresh() {
      const next = getCurrentLocalUser();
      const nextRole = getCurrentRole();
      // Só atualiza state se algo relevante mudou — evita re-renders em
      // cadeia que disparavam o loop "Maximum update depth exceeded".
      setLocalUser((prev) => {
        if (prev?.id === next?.id && prev?.role === next?.role) return prev;
        return next;
      });
      setLocalRole((prev) => (prev === nextRole ? prev : nextRole));
    }
    refresh();
    window.addEventListener(LOCAL_AUTH_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(LOCAL_AUTH_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // Consulta autoritativa de super_admin no backend (fail-soft).
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
        const r1 = await supabase.rpc("current_user_is_super_admin");
        if (cancelled) return;
        if (!r1.error) {
          setBackendSuperAdmin(Boolean(r1.data));
          return;
        }
        if (!isMissingFnError(r1.error)) {
          setBackendSuperAdmin(null);
          return;
        }
        const candidates: Array<Record<string, string>> = [
          { uid }, { user_id: uid }, { p_user_id: uid }, { _user_id: uid },
        ];
        for (const args of candidates) {
          const r2 = await supabase.rpc("is_super_admin", args);
          if (cancelled) return;
          if (!r2.error) { setBackendSuperAdmin(Boolean(r2.data)); return; }
          if (!isMissingFnError(r2.error)) { setBackendSuperAdmin(null); return; }
        }
        setBackendSuperAdmin(false);
      } catch {
        if (!cancelled) setBackendSuperAdmin(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supaUser?.id]);

  // Consulta de membership: distingue owner (companies.owner_id) de
  // admin/member (company_members.role). Não usa localStorage.
  // Importante: NÃO devolver "owner" como fallback enquanto a query não
  // termina — isso causava admin/member sendo rotulado como "Dono".
  useEffect(() => {
    let cancelled = false;
    if (!supaUser?.id || !supabaseConfigured || !supabase) {
      setMembership(null);
      return;
    }
    const uid = supaUser.id;
    (async () => {
      try {
        // 1) É dono de alguma empresa?
        const own = await supabase
          .from("companies")
          .select("id")
          .eq("owner_id", uid)
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (own.data) { setMembership("owner"); return; }
        // 2) É membro de alguma empresa?
        const mem = await supabase
          .from("company_members")
          .select("role")
          .eq("user_id", uid)
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        const r = mem.data?.role as string | undefined;
        if (r === "owner") { setMembership("owner"); return; }
        if (r === "admin") { setMembership("admin"); return; }
        if (r === "member") { setMembership("member"); return; }
        // 3) Sem nada — usuário sem empresa.
        setMembership("none");
      } catch {
        if (!cancelled) setMembership("none");
      }
    })();
    return () => { cancelled = true; };
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
      // 1) Backend confirmou super_admin → super_admin.
      // 2) Allowlist de e-mail (defensivo enquanto backend não respondeu).
      // 3) membership do backend (owner | admin | member | none).
      // 4) Enquanto membership === null, mantém última role local conhecida
      //    (sem forçar "owner") — UI usa roleResolved para gating.
      let resolvedRole: LocalRole;
      if (backendSuperAdmin === true || isSuperAdminEmail(supaUser.email)) {
        resolvedRole = "super_admin";
      } else if (membership === "owner" || membership === "none") {
        // "none" trata como owner (cadastro novo cria owner mais tarde),
        // mas só depois que sabemos que NÃO é admin/member — assim
        // admin/member nunca é exibido como Dono.
        resolvedRole = "owner";
      } else if (membership === "admin") {
        resolvedRole = "admin";
      } else if (membership === "member") {
        resolvedRole = "member";
      } else {
        // membership === null → ainda resolvendo; preserva localRole.
        resolvedRole = localRole;
      }

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
  }, [supaUser, localUser, localRole, backendSuperAdmin, membership]);

  useEffect(() => {
    if (supaUser?.email) {
      setBridgedLocalUser(user);
    } else if (!localUser) {
      setBridgedLocalUser(null);
    }
    // Deps só nas PRIMITIVAS que importam — `user` como objeto é uma nova
    // referência a cada recompute do useMemo (mesmo quando id/role/email
    // não mudaram), o que fazia o efeito disparar a cada render e, quando
    // role transicionava (owner fallback → super_admin resolvido), o
    // setBridgedLocalUser emitia LOCAL_AUTH_EVENT durante o commit ciclo
    // → refresh() chamava setState → "Maximum update depth exceeded".
    // setBridgedLocalUser já tem guard interno (só emite se id/role
    // mudaram); aqui só precisamos garantir que o efeito não rode
    // desnecessariamente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supaUser?.email, supaUser?.id, user?.id, user?.role, user?.nome, user?.whatsapp, localUser?.id]);

  // roleResolved = sabemos com segurança qual é a role do usuário.
  // - Sem usuário Supabase: depende do localUser (já resolvido).
  // - Com usuário Supabase: precisa de super_admin confirmado OU membership
  //   resolvida. Sem isso, AppHeader exibe "Verificando função…" em vez
  //   de assumir "Dono".
  const roleResolved = !supaUser
    ? true
    : backendSuperAdmin === true ||
      isSuperAdminEmail(supaUser.email) ||
      membership !== null;

  return {
    user,
    role,
    isOwner: role === "owner",
    isSuperAdmin: role === "super_admin",
    isAdmin: role === "admin" || role === "member",
    roleResolved,
  };
}

