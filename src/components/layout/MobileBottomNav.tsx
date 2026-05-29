import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
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

// Grupos do menu "Mais" — layout compacto em cards.
// Cada slot referencia a `to` de um item existente em `ownerMoreNav` (com
// fallback para `ownerNav`/`ownerBottomNav` quando aplicável). Mantém os
// mesmos labels/ícones/hints definidos na navegação principal.
const MORE_GROUPS: { title: string; routes: string[] }[] = [
  {
    title: "Minha conta",
    routes: ["/meus-dados", "/minha-assinatura", "/whatsapp", "/campanhas-manuais"],
  },
  {
    title: "Operação",
    routes: ["/clientes", "/cadastros-servicos", "/operacao-dia", "/renovacoes-paineis"],
  },
  {
    title: "Negócio",
    routes: ["/configuracoes-revenda", "/apps-portal", "/ia-config", "/configuracoes"],
  },
];

export function MobileBottomNav() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { role, user, isOwner } = useLocalAuth();
  const [openMore, setOpenMore] = useState(false);
  const preloadedMoreRef = useRef(false);

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

  // Indexa todos os itens disponíveis (com filtro de papel + plano) para que
  // os grupos consigam resolver `to` -> NavItem.
  const itemByRoute = useMemo<Record<string, NavItem>>(() => {
    const list = filterNavByRole(ownerMoreNav, role).filter((item) => {
      if (!isOwner) return true;
      if (!company) return true;
      const mod = ROUTE_TO_MODULE[item.to];
      if (!mod) return true;
      return canCompanyUseModule(company, mod);
    });
    const idx: Record<string, NavItem> = {};
    for (const it of list) idx[it.to] = it;
    return idx;
  }, [role, isOwner, company]);

  const groups = useMemo(() => {
    return MORE_GROUPS.map((g) => ({
      title: g.title,
      items: g.routes.map((to) => itemByRoute[to]).filter(Boolean) as NavItem[],
    })).filter((g) => g.items.length > 0);
  }, [itemByRoute]);

  const preloadRoute = useCallback(
    (to: string) => {
      void router.preloadRoute({ to: to as never }).catch(() => undefined);
    },
    [router],
  );

  const preloadMoreRoutes = useCallback(() => {
    if (preloadedMoreRef.current) return;
    preloadedMoreRef.current = true;
    const routes = Array.from(
      new Set(groups.flatMap((group) => group.items.map((item) => item.to))),
    );
    for (const route of routes) preloadRoute(route);
  }, [groups, preloadRoute]);

  useEffect(() => {
    if (openMore) preloadMoreRoutes();
  }, [openMore, preloadMoreRoutes]);

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
              item.to === "/"
                ? pathname === "/"
                : pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  preload="render"
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
              onPointerDown={() => {
                preloadMoreRoutes();
                setOpenMore(true);
              }}
              onMouseEnter={preloadMoreRoutes}
              onFocus={preloadMoreRoutes}
              onClick={() => {
                preloadMoreRoutes();
                setOpenMore(true);
              }}
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
          className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-0 data-[state=closed]:duration-100 data-[state=open]:duration-75"
        >
          <div className="px-4 pt-4 pb-3">
            <SheetHeader className="text-left">
              <SheetTitle className="text-lg">Mais opções</SheetTitle>
            </SheetHeader>
          </div>

          <div className="space-y-5 px-3 pb-6">
            {groups.map((group) => (
              <section key={group.title}>
                <h3 className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.title}
                </h3>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.to}>
                        <Link
                          to={item.to}
                          preload="intent"
                          onPointerDown={() => preloadRoute(item.to)}
                          onClick={(e) => {
                            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
                              return;
                            window.requestAnimationFrame(() => setOpenMore(false));
                          }}
                          className="flex h-full flex-col items-center gap-2 rounded-2xl border border-border bg-surface px-2 py-3 text-center transition-colors active:bg-surface-muted"
                        >
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                            <Icon className="h-5 w-5" />
                          </span>
                          <span className="line-clamp-2 text-[12px] font-semibold leading-tight text-foreground">
                            {item.label}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
