import { useState } from "react";
import { Outlet, useRouterState, Link } from "@tanstack/react-router";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { StagingBanner } from "./StagingBanner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useLocalAuth } from "@/lib/use-local-auth";
import { isSuperAdminOnlyRoute } from "@/lib/permissions";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

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

function RestrictedView() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-4 py-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
        <ShieldAlert className="h-7 w-7" />
      </div>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">Acesso restrito</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Esta área é exclusiva do Admin do sistema.
      </p>
      <div className="mt-6">
        <Link to="/">
          <Button>Voltar ao Painel</Button>
        </Link>
      </div>
    </div>
  );
}

export function AppShell() {
  const [openSheet, setOpenSheet] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = titles[pathname] ?? "Painel";
  const { isOwner } = useLocalAuth();
  const blocked = isOwner && isSuperAdminOnlyRoute(pathname);

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <StagingBanner />
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
            {blocked ? <RestrictedView /> : <Outlet />}
          </main>
        </div>

        <MobileBottomNav />
      </div>
    </div>
  );
}
