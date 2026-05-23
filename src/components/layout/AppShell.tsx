import { useState } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const titles: Record<string, string> = {
  "/": "Início",
  "/clientes": "Clientes",
  "/vencimentos": "Vencimentos",
  "/cobrancas": "Cobranças",
  "/whatsapp": "WhatsApp",
  "/assistente": "Assistente",
  "/pagamentos": "Pagamentos",
  "/servidores": "Servidores",
  "/aplicativos": "Aplicativos",
  "/resultados": "Resultados",
  "/admin": "Visão geral",
  "/admin/empresas": "Empresas",
  "/admin/receita": "Receita",
  "/admin/filas": "Filas",
  "/admin/falhas": "Falhas",
};

export function AppShell() {
  const [openSheet, setOpenSheet] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = pathname.startsWith("/admin");
  const title = titles[pathname] ?? "Painel";

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <AppSidebar variant={isAdmin ? "admin" : "owner"} />
      </div>

      {/* Mobile sidebar */}
      <Sheet open={openSheet} onOpenChange={setOpenSheet}>
        <SheetContent side="left" className="w-[var(--sidebar-width)] p-0">
          <AppSidebar
            variant={isAdmin ? "admin" : "owner"}
            onNavigate={() => setOpenSheet(false)}
          />
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
  );
}
