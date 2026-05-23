import { Link, useRouterState } from "@tanstack/react-router";
import { ownerBottomNav } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur safe-bottom md:hidden">
      <ul className="grid grid-cols-5">
        {ownerBottomNav.map((item) => {
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
