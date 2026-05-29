import { Link, useRouterState } from "@tanstack/react-router";
import { ownerNav, adminNav, filterNavByRole, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";
import {
  ShieldCheck,
  ChevronRight,
  Home,
  Activity,
  Users,
  Bot,
  BarChart3,
  Settings2,
  MoreHorizontal,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";

import type { LucideIcon } from "lucide-react";
import { AuthStatus } from "@/components/auth/AuthStatus";
import { LocalUserBadge } from "@/components/auth/LocalUserBadge";
import { useLocalAuth } from "@/lib/use-local-auth";
import { roleLabel } from "@/lib/permissions";
import { useEffect, useMemo, useState } from "react";
import {
  ROUTE_TO_MODULE,
  canCompanyUseModule,
  getCompanyForUser,
  getCurrentCompany,
  getCompanySupportId,
  COMPANIES_EVENT,
} from "@/lib/companies";
import { Copy } from "lucide-react";
import { toast } from "sonner";

type Props = {
  variant?: "owner" | "admin";
  onNavigate?: () => void;
};

type Group = {
  id: string;
  label: string;
  icon: LucideIcon;
  routes: string[];
};

// Grupos ordenados do mais usado (topo) para o menos usado (fundo).
// "Início" fica como link solto no topo, sem grupo.
const GROUPS: Group[] = [
  {
    id: "cadastros",
    label: "Cadastros",
    icon: Users,
    routes: [
      "/clientes",
      "/cadastros-servicos",
      "/gestao-servicos",
      "/catalogo-servidores",
      "/testes",
      "/importar-clientes",
      "/apps-portal",
      "/renovacoes-paineis",
    ],
  },
  {
    id: "operacao",
    label: "Operação",
    icon: Activity,
    routes: [
      "/operacao-dia",
      "/pendencias",
      "/cobrancas",
      "/campanhas-manuais",
      "/mensagens",
      "/agenda-disparo",
      "/fila-simulada",
      "/pagamentos/mercado-pago",
      "/pagamentos/historico",
      "/admin/marketplace",
    ],
  },
  {
    id: "ia",
    label: "IA",
    icon: Bot,
    routes: [
      "/ia",
      "/ia-config",
      "/treinar-ia",
      "/base-conhecimento",
      "/ajuda-ia",
    ],
  },
  {
    id: "relatorios",
    label: "Relatórios",
    icon: BarChart3,
    routes: ["/relatorio", "/financeiro", "/indicacoes"],
  },
  {
    id: "config",
    label: "Configuração",
    icon: Settings2,
    routes: [
      "/configuracao-inicial",
      "/empresas",
      "/meus-dados",
      "/minha-assinatura",
      "/saas-planos",
      "/configuracoes-revenda",
      "/configuracoes",
      "/regras-disparo",
      "/whatsapp",
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    icon: MoreHorizontal,
    routes: [
      "/backup-geral",
      "/seguranca-local",
      "/admin-dns-rotas",
      "/diagnostico",
      "/preparacao-backend",
      "/migracao-empresa",
      "/ajuda",
    ],
  },
];


const GROUPED = new Set(GROUPS.flatMap((g) => g.routes).concat(["/"]));

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

  const allowed = useMemo(() => {
    let list = filterNavByRole(baseItems, role);
    if (isOwner && company) {
      list = list.filter((item) => {
        const mod = ROUTE_TO_MODULE[item.to];
        if (!mod) return true;
        return canCompanyUseModule(company, mod);
      });
    }
    return list;
  }, [baseItems, role, isOwner, company]);

  const byRoute = useMemo(() => new Map(allowed.map((i) => [i.to, i] as const)), [allowed]);

  const home = byRoute.get("/");

  const visibleGroups = useMemo(() => {
    const built = GROUPS.map((g) => ({
      ...g,
      items: g.routes.map((r) => byRoute.get(r)).filter(Boolean) as NavItem[],
    })).filter((g) => g.items.length > 0);

    const leftovers = allowed.filter((it) => !GROUPED.has(it.to));
    if (leftovers.length > 0) {
      const sistema = built.find((g) => g.id === "sistema");
      if (sistema) sistema.items.push(...leftovers);
      else
        built.push({
          id: "sistema",
          label: "Sistema",
          icon: MoreHorizontal,
          routes: leftovers.map((i) => i.to),
          items: leftovers,
        });
    }
    return built;
  }, [allowed, byRoute]);

  const isItemActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");

  // Abre o grupo do item ativo automaticamente.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const g of visibleGroups) {
        if (g.items.some((i) => isItemActive(i.to))) next[g.id] = true;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, visibleGroups.length]);

  const toggle = (id: string) => setOpenGroups((s) => ({ ...s, [id]: !s[id] }));

  return (
    <aside className="flex h-full w-[var(--sidebar-width)] flex-col border-r border-border bg-surface">
      <div className="flex h-[var(--header-height)] items-center gap-2 border-b border-border px-4">
        <BrandLogo variant="mark" className="h-9 w-9" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">
            {role === "super_admin" ? "Painel Admin" : "CobraEasy"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {user ? roleLabel(role) : "Sem sessão local"}
          </p>
        </div>
      </div>


      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {home && (
            <li>
              <Link
                to="/"
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  pathname === "/"
                    ? "bg-primary-soft font-medium text-primary"
                    : "text-foreground/75 hover:bg-surface-muted hover:text-foreground"
                )}
              >
                <Home className={cn("h-4 w-4 shrink-0", pathname === "/" && "text-primary")} />
                <span className="truncate">Início</span>
              </Link>
            </li>
          )}

          {visibleGroups.map((group) => {
            const GroupIcon = group.icon;
            const hasActive = group.items.some((i) => isItemActive(i.to));
            const isOpen = openGroups[group.id] ?? hasActive;
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
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {group.items.length}
                  </span>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      isOpen && "rotate-90"
                    )}
                  />
                </button>
                {isOpen && (
                  <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-border/60 pl-3">
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
                            <Icon
                              className={cn("h-3.5 w-3.5 shrink-0", active && "text-primary")}
                            />
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
        <div className="rounded-lg bg-surface-muted p-2">
          <AuthStatus />
        </div>
      </div>
    </aside>
  );
}
