import { useState } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { StagingBanner } from "./StagingBanner";
import { Sheet, SheetContent } from "@/components/ui/sheet";

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

export function AppShell() {
  const [openSheet, setOpenSheet] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = titles[pathname] ?? "Painel";

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
            <Outlet />
          </main>
        </div>

        <MobileBottomNav />
      </div>
    </div>
  );
}
