import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  MoreHorizontal,
  ListChecks,
  Beaker,
  UserCog,
  Wallet,
  Smartphone,
  MessageCircle,
  Users,
  Tv,
  CalendarClock,
  RefreshCcw,
  Store,
  Bot,
  Settings,
  Sparkles,
  Server,
  Upload,
  BarChart3,
  Gift,
  HardDrive,
  ShieldCheck,
  Network,
  Activity,
  Database,
} from "lucide-react";
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

// Item extra para o drawer "Mais" — pode sobrescrever label/hint/icon e
// adicionar `search` (query string aplicada no Link), permitindo atalhos
// como "Cadastrar teste" -> /testes?action=create sem criar rota nova.
type MoreItem = {
  key: string;
  to: string;
  label: string;
  hint?: string;
  icon: NavItem["icon"];
  search?: Record<string, string>;
};

// Grupos do menu "Mais" — todas as funções disponíveis ao usuário (filtradas
// por papel + módulo do plano). Layout em cards 2 colunas no mobile.
const MORE_GROUPS: { title: string; items: MoreItem[] }[] = [
  {
    title: "Minha conta",
    items: [
      { key: "/meus-dados", to: "/meus-dados", label: "Minha conta", hint: "Seus dados pessoais e contato", icon: UserCog },
      { key: "/minha-assinatura", to: "/minha-assinatura", label: "Minha assinatura", hint: "Plano, uso de IA e pacotes", icon: Wallet },
      { key: "/whatsapp", to: "/whatsapp", label: "WhatsApp", hint: "Conecte seu WhatsApp", icon: Smartphone },
      { key: "/campanhas-manuais", to: "/campanhas-manuais", label: "Mensagens", hint: "Monte listas e copie mensagens", icon: MessageCircle },
    ],
  },
  {
    title: "Cadastros",
    items: [
      { key: "/clientes", to: "/clientes", label: "Clientes", hint: "Sua base de clientes", icon: Users },
      { key: "/cadastros-servicos", to: "/cadastros-servicos", label: "Cadastros · Serviços", hint: "Planos e valores", icon: Tv },
      { key: "/gestao-servicos", to: "/gestao-servicos", label: "Gestão de serviços", hint: "Renove e edite serviços", icon: Tv },
      { key: "/catalogo-servidores", to: "/catalogo-servidores", label: "Meus servidores", hint: "Servidores vinculados", icon: Server },
      { key: "/testes", to: "/testes", label: "Testes", hint: "Pessoas em teste/leads", icon: Beaker },
      { key: "/importar-clientes", to: "/importar-clientes", label: "Importar clientes", hint: "Importar de PDF ou planilha", icon: Upload },
      { key: "/apps-portal", to: "/apps-portal", label: "Aplicativos pagos", hint: "Apps que seus clientes usam", icon: Smartphone },
    ],
  },
  {
    title: "Operação",
    items: [
      { key: "/operacao-dia", to: "/operacao-dia", label: "Operação do dia", hint: "Quem precisa de atenção hoje", icon: CalendarClock },
      { key: "/operacao-filas", to: "/operacao-filas", label: "Operação · Filas", hint: "Envios, falhas e renovações", icon: ListChecks },
      { key: "/renovacoes-paineis", to: "/renovacoes-paineis", label: "Renovações de painéis", hint: "Fila de renovações IPTV", icon: RefreshCcw },
      { key: "/testes?action=create", to: "/testes", search: { action: "create" }, label: "Cadastrar teste", hint: "Novo teste para cliente interessado", icon: Beaker },
    ],
  },
  {
    title: "IA",
    items: [
      { key: "/ia-config", to: "/ia-config", label: "Configurar IA", hint: "Preços e instruções da IA", icon: Bot },
      { key: "/treinar-ia", to: "/treinar-ia", label: "Treinar IA", hint: "Ensine sua IA com conhecimento", icon: Sparkles },
      { key: "/ia", to: "/ia", label: "IA Cobrança", hint: "Mensagens geradas pela IA", icon: Sparkles },
    ],
  },
  {
    title: "Relatórios",
    items: [
      { key: "/relatorio", to: "/relatorio", label: "Relatórios", hint: "Visão geral e simulação", icon: BarChart3 },
      { key: "/financeiro", to: "/financeiro", label: "Financeiro", hint: "Receitas, custos e lucro", icon: Wallet },
      { key: "/indicacoes", to: "/indicacoes", label: "Indicações", hint: "Indicações e bonificações", icon: Gift },
    ],
  },
  {
    title: "Configuração",
    items: [
      { key: "/configuracoes-revenda", to: "/configuracoes-revenda", label: "Minha revenda", hint: "Dados e regras da sua revenda", icon: Store },
      { key: "/configuracoes", to: "/configuracoes", label: "Configurações", hint: "Ajustes do ambiente", icon: Settings },
      { key: "/seguranca-local", to: "/seguranca-local", label: "Segurança", hint: "PIN e modo protegido", icon: ShieldCheck },
      { key: "/admin-dns-rotas", to: "/admin-dns-rotas", label: "DNS e Rotas", hint: "Domínios e rotas", icon: Network },
      { key: "/backup-geral", to: "/backup-geral", label: "Backup Geral", hint: "Exportar/importar tudo", icon: HardDrive },
      { key: "/diagnostico", to: "/diagnostico", label: "Diagnóstico", hint: "Saúde do sistema", icon: Activity },
      { key: "/preparacao-backend", to: "/preparacao-backend", label: "Preparação Backend", hint: "Preparar migração", icon: Database },
      { key: "/migracao-empresa", to: "/migracao-empresa", label: "Migração Empresa", hint: "Vincular dados antigos", icon: Database },
    ],
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

  // Conjunto de rotas marcadas como super_admin (vindas de ownerNav + ownerMoreNav).
  const superAdminRoutes = useMemo<Set<string>>(() => {
    const set = new Set<string>();
    for (const it of ownerMoreNav) if (it.superAdminOnly) set.add(it.to);
    return set;
  }, []);

  // Filtro de papel + plano para cada item do MORE_GROUPS. Avalia diretamente
  // a rota em vez de exigir presença em ownerMoreNav.
  const isRouteAllowed = useCallback(
    (to: string) => {
      if (role !== "super_admin" && superAdminRoutes.has(to)) return false;
      if (!isOwner || !company) return true;
      const mod = ROUTE_TO_MODULE[to];
      if (!mod) return true;
      return canCompanyUseModule(company, mod);
    },
    [role, isOwner, company, superAdminRoutes],
  );

  const groups = useMemo(() => {
    return MORE_GROUPS.map((g) => ({
      title: g.title,
      items: g.items.filter((it) => isRouteAllowed(it.to)),
    })).filter((g) => g.items.length > 0);
  }, [isRouteAllowed]);

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
              <li key={item.to + (item.search ? "?" + new URLSearchParams(item.search).toString() : "")}>
                <Link
                  to={item.to}
                  search={(item.search ?? undefined) as never}
                  preload="render"
                  className={cn(
                    "flex h-[var(--bottomnav-height)] flex-col items-center justify-center gap-1 px-1 text-[11px] transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "scale-110")} />
                  <span className="font-medium leading-tight text-center">{item.label}</span>
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
                      <li key={item.key}>
                        <Link
                          to={item.to as never}
                          search={(item.search ?? undefined) as never}
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
