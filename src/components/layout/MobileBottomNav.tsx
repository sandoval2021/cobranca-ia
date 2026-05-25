import { Link, useRouterState } from "@tanstack/react-router";
import { ownerBottomNav, filterNavByRole } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useLocalAuth } from "@/lib/use-local-auth";

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { role } = useLocalAuth();
  const items = filterNavByRole(ownerBottomNav, role);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur safe-bottom md:hidden">
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active =
            item.to === "/" ? pathname === "/" : pathname === item.to || pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={cn(
                  "flex h-[var(--bottomnav-height)] flex-col items-center justify-center gap-1 px-1 text-[11px] transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", active && "scale-110")} />
                <span className="truncate font-medium">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
