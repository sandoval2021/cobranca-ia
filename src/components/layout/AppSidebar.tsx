import { Link, useRouterState } from "@tanstack/react-router";
import { ownerNav, adminNav, filterNavByRole, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Home,
  Settings2,
  Users,
  Activity,
  Bot,
  Server,
  BarChart3,
  MoreHorizontal,
} from "lucide-react";
import { AuthStatus } from "@/components/auth/AuthStatus";
import { LocalUserBadge } from "@/components/auth/LocalUserBadge";
import { useLocalAuth } from "@/lib/use-local-auth";
import { roleLabel } from "@/lib/permissions";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ROUTE_TO_MODULE,
  canCompanyUseModule,
  getCompanyForUser,
  getCurrentCompany,
  COMPANIES_EVENT,
} from "@/lib/companies";

type Props = {
  variant?: "owner" | "admin";
  onNavigate?: () => void;
};

type Group = {
  id: string;
  label: string;
  icon: LucideIcon;
  routes: string[]; // ordered list of route paths
};

// Estrutura de grupos solicitada pelo usuário.
// Itens não listados aqui caem em "Mais".
const GROUPS: Group[] = [
  { id: "inicio", label: "Início", icon: Home, routes: ["/"] },
  { id: "config", label: "Configuração", icon: Settings2, routes: ["/configuracao-inicial", "/empresas"] },
  { id: "cadastros", label: "Cadastros", icon: Users, routes: ["/clientes", "/importar-clientes", "/mensagens"] },
  {
    id: "operacao",
    label: "Operação",
    icon: Activity,
    routes: ["/operacao-dia", "/pendencias", "/cobrancas", "/campanhas-manuais", "/fila-simulada"],
  },
  { id: "ia", label: "IA", icon: Bot, routes: ["/ia", "/base-conhecimento"] },
  { id: "infra", label: "Streaming / Infra", icon: Server, routes: ["/catalogo-servidores", "/testes"] },
  { id: "relatorios", label: "Relatórios", icon: BarChart3, routes: ["/relatorio"] },
];

const GROUPED_ROUTES = new Set(GROUPS.flatMap((g) => g.routes));

export function AppSidebar({ variant = "owner", onNavigate }: Props) {
  const baseItems = variant === "admin" ? adminNav : ownerNav;
  const { role, user, isOwner } = useLocalAuth();
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Itens permitidos para o perfil/empresa atual.
  const allowedItems = useMemo(() => {
    let items = filterNavByRole(baseItems, role);
    if (isOwner && company) {
      items = items.filter((item) => {
        const mod = ROUTE_TO_MODULE[item.to];
        if (!mod) return true;
        return canCompanyUseModule(company, mod);
      });
    }
    return items;
  }, [baseItems, role, isOwner, company]);

  const byRoute = useMemo(() => {
    const map = new Map<string, NavItem>();
    for (const it of allowedItems) map.set(it.to, it);
    return map;
  }, [allowedItems]);

  // Constrói grupos com itens efetivamente permitidos.
  const visibleGroups = useMemo(() => {
    const built = GROUPS.map((g) => ({
      ...g,
      items: g.routes.map((r) => byRoute.get(r)).filter(Boolean) as NavItem[],
    })).filter((g) => g.items.length > 0);

    const leftovers = allowedItems.filter((it) => !GROUPED_ROUTES.has(it.to));
    if (leftovers.length > 0) {
      built.push({
        id: "mais",
        label: "Mais",
        icon: MoreHorizontal,
        routes: leftovers.map((i) => i.to),
        items: leftovers,
      });
    }
    return built;
  }, [allowedItems, byRoute]);

  const isItemActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");

  // Estado de abertura: por padrão, abre o grupo do item ativo.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const g of visibleGroups) {
        const hasActive = g.items.some((i) => isItemActive(i.to));
        if (hasActive) next[g.id] = true;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, visibleGroups.length]);

  const toggle = (id: string) => setOpenGroups((s) => ({ ...s, [id]: !s[id] }));

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
        <ul className="space-y-1">
          {visibleGroups.map((group) => {
            const GroupIcon = group.icon;
            const hasActive = group.items.some((i) => isItemActive(i.to));
            const isOpen = openGroups[group.id] ?? hasActive;
            const singleItem = group.items.length === 1 && group.id === "inicio";

            // Grupo com 1 item "/" renderiza como link direto (sem header colapsável)
            if (singleItem) {
              const item = group.items[0];
              const active = isItemActive(item.to);
              const Icon = item.icon;
              return (
                <li key={group.id}>
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
            }

            return (
              <li key={group.id}>
                <button
                  type="button"
                  onClick={() => toggle(group.id)}
                  aria-expanded={isOpen}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    hasActive
                      ? "text-foreground"
                      : "text-foreground/75 hover:bg-surface-muted hover:text-foreground"
                  )}
                >
                  <GroupIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-left font-medium">{group.label}</span>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      isOpen && "rotate-90"
                    )}
                  />
                </button>
                {isOpen && (
                  <ul className="mt-0.5 space-y-0.5 border-l border-border/60 pl-3 ml-4">
                    {group.items.map((item) => {
                      const active = isItemActive(item.to);
                      const Icon = item.icon;
                      return (
                        <li key={item.to}>
                          <Link
                            to={item.to}
                            onClick={onNavigate}
                            className={cn(
                              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                              active
                                ? "bg-primary-soft font-medium text-primary"
                                : "text-foreground/70 hover:bg-surface-muted hover:text-foreground"
                            )}
                          >
                            <Icon className={cn("h-3.5 w-3.5 shrink-0", active && "text-primary")} />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
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
