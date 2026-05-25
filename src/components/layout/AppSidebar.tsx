import { Link, useRouterState } from "@tanstack/react-router";
import { ownerNav, adminNav, filterNavByRole } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Sparkles, ShieldCheck } from "lucide-react";
import { AuthStatus } from "@/components/auth/AuthStatus";
import { LocalUserBadge } from "@/components/auth/LocalUserBadge";
import { useLocalAuth } from "@/lib/use-local-auth";
import { roleLabel } from "@/lib/permissions";

type Props = {
  variant?: "owner" | "admin";
  onNavigate?: () => void;
};

export function AppSidebar({ variant = "owner", onNavigate }: Props) {
  const baseItems = variant === "admin" ? adminNav : ownerNav;
  const { role, user } = useLocalAuth();
  const items = filterNavByRole(baseItems, role);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="flex h-full w-[var(--sidebar-width)] flex-col border-r border-border bg-surface">
      <div className="flex h-[var(--header-height)] items-center gap-2 border-b border-border px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          {role === "super_admin" ? (
            <ShieldCheck className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">
            {role === "super_admin" ? "Painel Admin" : "Meu Painel"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {user ? roleLabel(role) : "Sem sessão local"}
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-0.5">
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
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary-soft font-medium text-primary"
                      : "text-foreground/75 hover:bg-surface-muted hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-2 border-t border-border p-3">
        {user && (
          <div className="rounded-lg bg-surface-muted p-2">
            <LocalUserBadge />
          </div>
        )}
        <div className="rounded-lg bg-surface-muted p-2">
          <AuthStatus />
        </div>
      </div>
    </aside>
  );
}
