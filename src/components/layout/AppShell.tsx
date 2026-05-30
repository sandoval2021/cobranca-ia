import { useState, useEffect } from "react";
import { Outlet, useRouterState, Link } from "@tanstack/react-router";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { StagingBanner } from "./StagingBanner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useLocalAuth } from "@/lib/use-local-auth";
import { useAuth } from "@/lib/use-auth";
import { syncDefaultCompanyForUser } from "@/lib/rpc-admin";
import { ownerRouteDenial, describeDenial, type AccessDenialReason } from "@/lib/permissions";
import { AccountStatusBanner } from "@/components/companies/AccountStatusBanner";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  COMPANIES_EVENT,
  ensureLocalAccount,
  getCompanyForUser,
} from "@/lib/companies";

const titles: Record<string, string> = {
  "/": "Início",
  "/empresas": "Contas de donos",
  "/meus-dados": "Meus dados",
  "/clientes": "Clientes",
  "/cobrancas": "Cobranças",
  "/mensagens": "Mensagens",
  "/ia": "IA Cobrança",
  "/configuracoes": "Configurações",
  "/diagnostico": "Diagnóstico",
};

function RestrictedView({ reason }: { reason: AccessDenialReason }) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-4 py-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
        <ShieldAlert className="h-7 w-7" />
      </div>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">Acesso restrito</h1>
      <p className="mt-2 text-sm text-muted-foreground">{describeDenial(reason)}</p>
      <div className="mt-6">
        <Link to="/">
          <Button>Voltar ao Painel</Button>
        </Link>
      </div>
    </div>
  );
}

function useActiveCompany() {
  const { user, isOwner } = useLocalAuth();
  const [, setTick] = useState(0);
  useEffect(() => {
    const r = () => setTick((n) => n + 1);
    window.addEventListener(COMPANIES_EVENT, r);
    window.addEventListener("storage", r);
    return () => {
      window.removeEventListener(COMPANIES_EVENT, r);
      window.removeEventListener("storage", r);
    };
  }, []);
  // ensureLocalAccount escreve em localStorage e emite COMPANIES_EVENT —
  // NÃO pode rodar durante render (gera "setState during render" no listener
  // de AppSidebar/AppShell). Move para efeito; primeiro paint usa só lookup.
  useEffect(() => {
    if (!isOwner || !user?.email) return;
    const existing = getCompanyForUser(user.email);
    if (existing) return;
    ensureLocalAccount(user.email, user.nome, user.whatsapp);
  }, [isOwner, user?.email, user?.nome, user?.whatsapp]);
  if (isOwner) {
    return getCompanyForUser(user?.email);
  }
  return null;
}

export function AppShell() {
  const [openSheet, setOpenSheet] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = titles[pathname] ?? "Painel";
  const { user, isOwner, roleResolved } = useLocalAuth();
  const { isAuthenticated } = useAuth();
  const company = useActiveCompany();
  // Só calcula denial quando role foi resolvido E a empresa já foi
  // carregada/criada. Sem isso, dava falso "Acesso restrito — Sua conta
  // ainda não está vinculada a uma empresa" no primeiro render de cada
  // rota (especialmente após navegação via menu mobile).
  const denial =
    roleResolved && isOwner && company ? ownerRouteDenial(pathname, company) : null;

  // Garante base real (UUID Supabase) automaticamente após login.
  useEffect(() => {
    if (!isAuthenticated) return;
    syncDefaultCompanyForUser({
      email: user?.email,
      nome: user?.nome,
      whatsapp: user?.whatsapp,
    }).catch(() => {
      /* silencioso — getActiveAccountId trata erro no momento do uso */
    });
  }, [isAuthenticated, user?.email, user?.nome, user?.whatsapp]);

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <StagingBanner />
      <div className="flex min-h-0 w-full flex-1">
        <div className="hidden md:block">
          <AppSidebar onNavigate={() => setOpenSheet(false)} />
        </div>

        {/* Sheet do sidebar mantida só para uso futuro/desktop avançado.
            No mobile o header NÃO mostra mais o botão de 3 risquinhos —
            todas as funções extras vivem na aba "Mais" da barra inferior. */}
        <Sheet open={openSheet} onOpenChange={setOpenSheet}>
          <SheetContent side="left" className="w-[var(--sidebar-width)] p-0">
            <AppSidebar onNavigate={() => setOpenSheet(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader title={title} />
          <main className="min-w-0 flex-1">
            {roleResolved && isOwner && <AccountStatusBanner company={company} />}
            {denial ? <RestrictedView reason={denial} /> : <Outlet />}
          </main>
        </div>

        <MobileBottomNav />
      </div>
    </div>
  );
}
