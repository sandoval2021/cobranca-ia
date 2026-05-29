import { useEffect, useMemo, useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { ownerBottomNav, ownerMoreNav, filterNavByRole, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useLocalAuth } from "@/lib/use-local-auth";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  COMPANIES_EVENT,
  ROUTE_TO_MODULE,
  canCompanyUseModule,
  getCompanyForUser,
  getCurrentCompany,
} from "@/lib/companies";

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { role, user, isOwner } = useLocalAuth();
  const navigate = useNavigate();
  const [openMore, setOpenMore] = useState(false);

  // Reage a mudanças locais de empresa para reavaliar permissões do plano.
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

  const company = isOwner ? getCompanyForUser(user?.email) : getCurrentCompany();

  const items = useMemo(() => filterNavByRole(ownerBottomNav, role), [role]);

  const moreItems = useMemo<NavItem[]>(() => {
    let list = filterNavByRole(ownerMoreNav, role);
    if (isOwner && company) {
      list = list.filter((item) => {
        const mod = ROUTE_TO_MODULE[item.to];
        if (!mod) return true;
        return canCompanyUseModule(company, mod);
      });
    }
    return list;
  }, [role, isOwner, company]);

  // 5 atalhos + 1 botão "Mais"
  const cols = items.length + 1;

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur safe-bottom md:hidden">
        <ul
          className="grid"
          style={{ gridTemplateColumns: `repeat(${Math.max(cols, 1)}, minmax(0, 1fr))` }}
        >
          {items.map((item) => {
            const active =
              item.to === "/" ? pathname === "/" : pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  preload="intent"
                  className={cn(
                    "flex h-[var(--bottomnav-height)] flex-col items-center justify-center gap-1 px-1 text-[11px] transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "scale-110")} />
                  <span className="truncate font-medium">{item.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpenMore(true)}
              className={cn(
                "flex h-[var(--bottomnav-height)] w-full flex-col items-center justify-center gap-1 px-1 text-[11px] transition-colors",
                openMore ? "text-primary" : "text-muted-foreground",
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="truncate font-medium">Mais</span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={openMore} onOpenChange={setOpenMore}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-0"
        >
          <div className="px-4 pt-4 pb-2">
            <SheetHeader className="text-left">
              <SheetTitle className="text-lg">Mais opções</SheetTitle>
            </SheetHeader>
            <p className="mt-1 text-xs text-muted-foreground">
              Acesse todas as funções do CobraEasy organizadas para você.
            </p>
          </div>

          <ul className="divide-y divide-border px-2 pb-6">
            {moreItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  {/* Navegação SPA via router. Anchor mantém href para
                      acessibilidade e cmd+click, mas o onClick faz pushState
                      sem reload — evita ChunkLoadError vindo de cache PWA
                      antigo e a falsa tela de "Acesso restrito"/erro. */}
                  <a
                    href={item.to}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                      e.preventDefault();
                      setOpenMore(false);
                      void navigate({ to: item.to as string });
                    }}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-left active:bg-surface-muted"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {item.label}
                      </span>
                      {item.hint ? (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {item.hint}
                        </span>
                      ) : null}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </a>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
