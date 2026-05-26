import { useState, useEffect } from "react";
import { Outlet, useRouterState, Link } from "@tanstack/react-router";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { StagingBanner } from "./StagingBanner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useLocalAuth } from "@/lib/use-local-auth";
import { ownerRouteDenial, describeDenial, type AccessDenialReason } from "@/lib/permissions";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  COMPANIES_EVENT,
  ensureLocalAccount,
  getCompanyForUser,
  getCurrentCompany,
  setCurrentCompany,
} from "@/lib/companies";

const titles: Record<string, string> = {
  "/": "Início",
  "/empresas": "Empresas",
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
  // Para owner: garantir/criar conta padrão automaticamente — usuário não precisa cadastrar empresa.
  if (isOwner) {
    const existing = getCompanyForUser(user?.email);
    if (existing) return existing;
    return ensureLocalAccount(user?.email, user?.nome, user?.whatsapp);
  }
  return getCurrentCompany();
}

export function AppShell() {
  const [openSheet, setOpenSheet] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = titles[pathname] ?? "Painel";
  const { isOwner, isSuperAdmin } = useLocalAuth();
  const company = useActiveCompany();
  const denial = isOwner ? ownerRouteDenial(pathname, company) : null;

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <StagingBanner />
      {isSuperAdmin && company && (
        <div className="flex items-center justify-between gap-2 border-b border-border bg-primary-soft/40 px-3 py-1.5 text-xs">
          <span className="truncate">
            <strong>Visualizando como:</strong> {company.nome}
          </span>
          <button
            type="button"
            onClick={() => setCurrentCompany(null)}
            className="shrink-0 text-primary underline-offset-2 hover:underline"
          >
            Voltar para visão Super Admin
          </button>
        </div>
      )}
      <div className="flex min-h-0 w-full flex-1">
        <div className="hidden md:block">
          <AppSidebar onNavigate={() => setOpenSheet(false)} />
        </div>

        <Sheet open={openSheet} onOpenChange={setOpenSheet}>
          <SheetContent side="left" className="w-[var(--sidebar-width)] p-0">
            <AppSidebar onNavigate={() => setOpenSheet(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader title={title} onMenu={() => setOpenSheet(true)} />
          <main className="min-w-0 flex-1">
            {denial ? <RestrictedView reason={denial} /> : <Outlet />}
          </main>
        </div>

        <MobileBottomNav />
      </div>
    </div>
  );
}
