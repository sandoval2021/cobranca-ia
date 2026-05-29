import { useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { ownerBottomNav, ownerMoreNav, filterNavByRole } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useLocalAuth } from "@/lib/use-local-auth";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";


export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { role } = useLocalAuth();
  const items = filterNavByRole(ownerBottomNav, role);
  const more = filterNavByRole(ownerMoreNav, role);
  const [openMore, setOpenMore] = useState(false);

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
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl p-4">
          <SheetHeader className="text-left">
            <SheetTitle>Mais opções</SheetTitle>
          </SheetHeader>
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {more.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  {/* anchor simples: evita preload especulativo do TanStack que
                      pode disparar loader de rota quebrada e cair no
                      errorComponent global ("Não foi possível carregar"). */}
                  <a
                    href={item.to}
                    onClick={(e) => {
                      e.preventDefault();
                      setOpenMore(false);
                      // pequeno delay para o sheet fechar antes de navegar
                      setTimeout(() => {
                        window.location.assign(item.to);
                      }, 50);
                    }}
                    className="flex h-20 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-card p-2 text-center text-[11px] font-medium leading-tight text-foreground active:scale-[0.98]"
                  >
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="line-clamp-2">{item.label}</span>
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
