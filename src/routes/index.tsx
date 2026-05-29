import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Users,
  CalendarClock,
  AlertCircle,
  Wallet,
  Beaker,
  Gift,
  AlertTriangle,
  ShieldCheck,
  TrendingUp,
  Info,
  Download,
  Plus,
  UserPlus,
  Receipt,
  RefreshCcw,
  MessageCircle,
  Sparkles,
  Bot,
  HelpCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  HandCoins,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { AiQuotaCard } from "@/components/billing-saas/AiQuotaCard";
import { getActiveCompanyId } from "@/lib/company-scope";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocalAuth } from "@/lib/use-local-auth";
import {
  getCompanyForUser,
  getPlanById,
  getCompanyStatus,
  daysUntilDue,
} from "@/lib/companies";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  listAllScreens,
  appDueDays,
  nextDueDays,
  paidAppAlerts,
  isPaidApp,
  type AppScreen,
} from "@/lib/app-screens";
import { listServers } from "@/lib/server-catalog";
import { listTrialLeads } from "@/lib/trial-leads";
import { listReferrals } from "@/lib/referrals";
import {
  listFinanceEntries,
  filterEntriesByMonth,
  calculateFinanceSummary,
  formatBRL,
} from "@/lib/financeiro-local";
import { getLocalDataHealth, getModuleSummaries } from "@/lib/backup-geral";
import { getSetupProgress, getNextRecommendation, SETUP_WIZARD_EVENT } from "@/lib/setup-wizard";
import { isProtectedModeActive, LOCAL_SECURITY_EVENT } from "@/lib/local-security";

export const Route = createFileRoute("/")({ component: Dashboard });

// ============================================================
// Owner / PWA helpers (mantidos)
// ============================================================

// Chips compactos: status do plano (owner) + dica de instalar PWA.
function HeaderChips() {
  const { isOwner, user, roleResolved } = useLocalAuth();
  const company = roleResolved && isOwner ? getCompanyForUser(user?.email) : null;
  const plan = company ? getPlanById(company.plano_id) : null;
  const status = company ? getCompanyStatus(company) : null;
  const days = company ? daysUntilDue(company) : null;

  const [pwaDismissed, setPwaDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.localStorage.getItem("cobranca_ia_pwa_dismissed") === "1";
    } catch {
      return false;
    }
  });
  const [isStandalone, setIsStandalone] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS specific
      window.navigator.standalone === true;
    setIsStandalone(standalone);
  }, []);
  const dismissPwa = () => {
    setPwaDismissed(true);
    try {
      window.localStorage.setItem("cobranca_ia_pwa_dismissed", "1");
    } catch {
      /* noop */
    }
  };

  const showPlanChip = roleResolved && isOwner && company;
  const isTrial = status === "teste";
  let planChipTone = "bg-muted text-muted-foreground border-border";
  let planLabel: string | null = null;
  if (showPlanChip) {
    const base = isTrial ? "Trial" : plan?.nome ?? "Plano";
    if (days != null) {
      if (days < 0) {
        planChipTone = "bg-danger-soft text-danger border-danger/30";
        planLabel = `${base} vencido`;
      } else if (days <= 3) {
        planChipTone = "bg-danger-soft text-danger border-danger/30";
        planLabel = `${base} · ${days}d`;
      } else if (days <= 7) {
        planChipTone = "bg-warning-soft text-warning border-warning/30";
        planLabel = `${base} · ${days}d`;
      } else {
        planChipTone = "bg-success-soft text-success border-success/30";
        planLabel = `${base} · ${days}d`;
      }
    } else {
      planLabel = base;
    }
  }

  const showPwaChip = !isStandalone && !pwaDismissed;
  if (!showPlanChip && !showPwaChip) return null;

  return (
    <div className="mb-3 flex flex-col items-start gap-1.5">
      <span className="text-base font-bold tracking-tight text-foreground leading-tight">
        Início
      </span>
      <div className="flex flex-wrap items-center gap-1.5">

      {showPlanChip && planLabel && (
        <Link
          to="/minha-assinatura"
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
            planChipTone,
          )}
          title="Status do seu plano"
        >
          <ShieldCheck className="h-3 w-3" />
          {planLabel}
        </Link>
      )}
      {showPwaChip && (
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
          <Download className="h-3 w-3" />
          Instalar app
          <button
            onClick={dismissPwa}
            className="ml-0.5 rounded-full px-1 text-primary/70 hover:text-primary"
            aria-label="Fechar dica de instalação"
          >
            ✕
          </button>
        </span>
      )}
      </div>
    </div>
  );
}


// ============================================================
// Data layer (mantido — só estende totalAtivos / totalClientes)
// ============================================================

const LAST_BACKUP_KEY = "cobranca_ia_last_backup_at_v1";

type Counters = {
  totalClientes: number;
  totalAtivos: number;
  clientesHoje: number;
  clientesAmanha: number;
  clientesVencidos: number;
  proximos7: number;
  testesAndamento: number;
  testesAcompanharHoje: number;
  indicacoesPendentes: number;
  bonificacoesPendentes: number;
  receitaMes: number;
  custosMes: number;
  lucroLiquido: number;
  margemPct: number;
  pendenciasCriticas: number;
  appsPagosVencendo: number;
};

type Health = ReturnType<typeof getLocalDataHealth>;

function computeCounters(): {
  counters: Counters;
  health: Health;
  totalModules: number;
} {
  const all = listAllScreens();
  const servers = listServers();
  const leads = listTrialLeads().filter((l) => !l.arquivado);
  const refs = listReferrals();
  const entries = listFinanceEntries();
  const monthEntries = filterEntriesByMonth(entries);
  const summary = calculateFinanceSummary(monthEntries);
  const health = getLocalDataHealth();

  let totalClientes = 0;
  let totalAtivos = 0;
  let clientesHoje = 0;
  let clientesAmanha = 0;
  let clientesVencidos = 0;
  let proximos7 = 0;
  let pendenciasCriticas = 0;
  let appsPagosVencendo = 0;

  const usedServerIds = new Set<string>();

  for (const [, list] of Object.entries(all)) {
    const screens = (list as AppScreen[]) ?? [];
    if (screens.length === 0) continue;
    const active = screens.filter((s) => s.status !== "arquivada");
    if (active.length === 0) continue;
    totalClientes += 1;

    const dueDays = nextDueDays(null, active);
    if (dueDays == null || dueDays >= 0) totalAtivos += 1;
    if (dueDays === 0) clientesHoje += 1;
    else if (dueDays === 1) clientesAmanha += 1;
    else if (dueDays != null && dueDays < 0) clientesVencidos += 1;
    else if (dueDays != null && dueDays > 0 && dueDays <= 7) proximos7 += 1;

    for (const s of active) {
      const ids = (s.server_ids ?? []) as string[];
      for (const id of ids) if (id) usedServerIds.add(id);
      if (isPaidApp(s)) {
        const alerts = paidAppAlerts(s);
        if (alerts.includes("vencido") || alerts.includes("vence_7d")) {
          appsPagosVencendo += 1;
        }
      }
      const d = appDueDays(s);
      if (d != null && d < 0) pendenciasCriticas += 1;
    }
  }

  const today = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  })();
  const testesAndamento = leads.filter(
    (l) => l.status === "Em teste" || l.status === "Teste enviado",
  ).length;
  const testesAcompanharHoje = leads.filter((l) => {
    if (l.data_fim && l.data_fim.slice(0, 10) === today) return true;
    if (l.proxima_acao && l.proxima_acao.slice(0, 10) <= today) return true;
    return false;
  }).length;

  const indicacoesPendentes = refs.filter(
    (r) => r.status === "Indicou" || r.status === "Em teste",
  ).length;
  const bonificacoesPendentes = refs.filter(
    (r) => r.status === "Bonificação pendente",
  ).length;

  pendenciasCriticas += appsPagosVencendo;
  // Garante referência usada (mantém comportamento prévio)
  void servers.length;

  return {
    counters: {
      totalClientes,
      totalAtivos,
      clientesHoje,
      clientesAmanha,
      clientesVencidos,
      proximos7,
      testesAndamento,
      testesAcompanharHoje,
      indicacoesPendentes,
      bonificacoesPendentes,
      receitaMes: summary.revenue,
      custosMes: summary.costs,
      lucroLiquido: summary.net_profit,
      margemPct: summary.margin_pct,
      pendenciasCriticas,
      appsPagosVencendo,
    },
    health,
    totalModules: getModuleSummaries().filter((m) => m.present).length,
  };
}

function useDashboardData() {
  const [tick, setTick] = useState(0);
  const data = useMemo(() => computeCounters(), [tick]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () => setTick((n) => n + 1);
    const events = [
      "app-screens:changed",
      "cobranca_ia_app_screens:changed",
      "cobranca_ia_import_schedule:changed",
      "cobranca_ia_manual_renewal:changed",
      "cobranca_ia_finance:changed",
      "cobranca_ia_server_catalog:changed",
      "trial-leads:changed",
      "cobranca_ia_trial_leads:changed",
      "referrals:changed",
      "cobranca_ia_referrals:changed",
      "cobranca_ia_revenda_settings:changed",
    ];
    for (const e of events) window.addEventListener(e, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      for (const e of events) window.removeEventListener(e, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return data;
}

// ============================================================
// UI primitives
// ============================================================

function HelpDot({ text }: { text: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Ajuda"
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-w-[240px] text-xs leading-relaxed">
        {text}
      </PopoverContent>
    </Popover>
  );
}

type Tone = "primary" | "success" | "danger" | "warning" | "info" | "neutral";

const toneSurface: Record<Tone, string> = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  neutral: "bg-muted text-muted-foreground",
};

function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  help,
  hint,
  to,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  help?: string;
  hint?: string;
  to?: string;
}) {
  const body = (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-3 shadow-card transition-shadow hover:shadow-pop">
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl",
            toneSurface[tone],
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        {help && <HelpDot text={help} />}
      </div>
      <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-2xl font-bold leading-tight tracking-tight text-foreground">
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
  if (to) {
    return (
      <Link to={to} className="block h-full">
        {body}
      </Link>
    );
  }
  return body;
}

function MoneyCard({
  label,
  value,
  tone,
  help,
  hint,
  to,
}: {
  label: string;
  value: string;
  tone: Tone;
  help?: string;
  hint?: string;
  to?: string;
}) {
  const stripe: Record<Tone, string> = {
    primary: "bg-primary",
    success: "bg-success",
    danger: "bg-danger",
    warning: "bg-warning",
    info: "bg-info",
    neutral: "bg-muted-foreground",
  };
  const body = (
    <div className="relative h-full overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-card transition-shadow hover:shadow-pop">
      <span
        className={cn("absolute left-0 top-0 h-full w-1", stripe[tone])}
        aria-hidden
      />
      <div className="pl-2">
        <div className="flex items-center justify-between gap-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {help && <HelpDot text={help} />}
        </div>
        <p className="mt-1 text-xl font-bold leading-tight tracking-tight text-foreground sm:text-2xl">
          {value}
        </p>
        {hint && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
        )}
      </div>
    </div>
  );
  if (to) {
    return (
      <Link to={to} className="block h-full">
        {body}
      </Link>
    );
  }
  return body;
}

function QuickAction({
  to,
  label,
  icon: Icon,
  tone = "primary",
  bold = false,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  bold?: boolean;
}) {
  const [path, qs] = to.split("?");
  const search = qs
    ? Object.fromEntries(new URLSearchParams(qs).entries())
    : undefined;

  if (bold) {
    const boldSurface: Record<Tone, string> = {
      primary:
        "bg-primary text-primary-foreground shadow-[0_6px_18px_-6px_color-mix(in_oklab,var(--primary)_60%,transparent)]",
      success:
        "bg-emerald-600 text-white shadow-[0_6px_18px_-6px_rgba(5,150,105,0.55)]",
      warning:
        "bg-amber-500 text-white shadow-[0_6px_18px_-6px_rgba(245,158,11,0.6)]",
      info:
        "bg-sky-500 text-white shadow-[0_6px_18px_-6px_rgba(14,165,233,0.55)]",
      danger:
        "bg-red-500 text-white shadow-[0_6px_18px_-6px_rgba(239,68,68,0.55)]",
      neutral:
        "bg-card text-foreground border border-border shadow-card",
    };
    return (
      <Link
        to={path}
        search={search as never}
        className={cn(
          "flex flex-col items-center justify-center gap-1.5 rounded-2xl p-3 text-center transition-all hover:-translate-y-0.5 active:scale-[0.98]",
          boldSurface[tone],
        )}
      >
        <Icon className="h-5 w-5" />
        <span className="text-xs font-bold leading-tight">{label}</span>
      </Link>
    );
  }

  return (
    <Link
      to={path}
      search={search as never}
      className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-3 text-center shadow-card transition-all hover:-translate-y-0.5 hover:shadow-pop"
    >
      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-2xl",
          toneSurface[tone],
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-xs font-semibold leading-tight text-foreground">
        {label}
      </span>
    </Link>
  );
}


function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-bold tracking-tight text-foreground">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

// ============================================================
// Dashboard
// ============================================================

function Dashboard() {
  const { counters } = useDashboardData();
  const { isSuperAdmin } = useLocalAuth();
  const [protectedMode, setProtectedMode] = useState(false);
  const [setup, setSetup] = useState(() => getSetupProgress());
  const [setupRec, setSetupRec] = useState(() => getNextRecommendation());

  useEffect(() => {
    const refresh = () => {
      setProtectedMode(isProtectedModeActive());
      setSetup(getSetupProgress());
      setSetupRec(getNextRecommendation());
    };
    refresh();
    window.addEventListener(LOCAL_SECURITY_EVENT, refresh);
    window.addEventListener(SETUP_WIZARD_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(LOCAL_SECURITY_EVENT, refresh);
      window.removeEventListener(SETUP_WIZARD_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const projecaoMes = counters.receitaMes + counters.custosMes;

  const aiCompanyId = (() => {
    const cid = getActiveCompanyId();
    return typeof cid === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        cid,
      )
      ? cid
      : null;
  })();

  return (
    <PageContainer>
      {protectedMode && (
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-warning px-2.5 py-1 text-[11px] font-semibold text-warning-foreground">
          <ShieldCheck className="h-3 w-3" />
          Modo protegido ativo
        </div>
      )}

      <HeaderChips />

      {/* 1 — O que precisa de você hoje */}
      <section className="mb-6">
        <SectionTitle
          title="Atenção hoje"
          subtitle="Comece por aqui"
        />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <MetricCard
            label="Vencidos"
            value={counters.clientesVencidos}
            icon={AlertTriangle}
            tone="danger"
            help="Clientes com lista vencida — precisam de cobrança."
            to="/operacao-dia"
          />
          <MetricCard
            label="Vence hoje"
            value={counters.clientesHoje}
            icon={Clock}
            tone="warning"
            help="Clientes com vencimento exatamente hoje."
            to="/operacao-dia"
          />
          <MetricCard
            label="Vence amanhã"
            value={counters.clientesAmanha}
            icon={CalendarClock}
            tone="info"
            help="Clientes que vencem amanhã — bom momento para lembrar."
            to="/operacao-dia"
          />
          <MetricCard
            label="Pendências"
            value={counters.pendenciasCriticas}
            icon={AlertCircle}
            tone="danger"
            help="Itens críticos: apps vencidos, telas em atraso e similares."
            to="/pendencias"
          />
        </div>
      </section>

      {/* 2 — Atalhos principais */}
      <section className="mb-6">
        <SectionTitle title="O que você quer fazer?" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <QuickAction to="/clientes?action=create" label="Novo cliente" icon={UserPlus} tone="primary" bold />
          <QuickAction to="/cobrancas?action=charge" label="Cobrar" icon={Receipt} tone="success" bold />
          <QuickAction to="/cobrancas?action=renew" label="Renovar" icon={RefreshCcw} tone="warning" bold />
          <QuickAction to="/cobrancas?action=message" label="Enviar mensagem" icon={MessageCircle} tone="info" bold />

        </div>
      </section>

      {/* 3 — Resumo da base */}
      <section className="mb-6">
        <SectionTitle title="Sua base" subtitle="Visão geral dos clientes" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <MetricCard
            label="Clientes"
            value={counters.totalClientes}
            icon={Users}
            tone="primary"
            help="Total de clientes cadastrados no seu painel."
            to="/clientes"
          />
          <MetricCard
            label="Ativos"
            value={counters.totalAtivos}
            icon={CheckCircle2}
            tone="success"
            help="Clientes com pelo menos uma tela ativa e em dia."
            to="/clientes"
          />
          <MetricCard
            label="Próximos 7 dias"
            value={counters.proximos7}
            icon={CalendarClock}
            tone="info"
            help="Clientes vencendo nos próximos 7 dias."
            to="/clientes"
          />
          <MetricCard
            label="Testes"
            value={counters.testesAndamento}
            icon={Beaker}
            tone="warning"
            help="Testes em andamento ou enviados."
            to="/testes"
          />
        </div>
      </section>

      {/* 4 — Financeiro */}
      <section className="mb-6">
        <SectionTitle
          title="Financeiro do mês"
          action={
            <Link to="/financeiro">
              <Button size="sm" variant="outline">
                Ver tudo
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </Link>
          }
        />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <MoneyCard
            label="Recebido"
            value={formatBRL(counters.receitaMes)}
            tone="success"
            help="Total recebido neste mês."
            to="/financeiro"
          />
          <MoneyCard
            label="Lucro"
            value={formatBRL(counters.lucroLiquido)}
            tone="info"
            hint={`Margem ${counters.margemPct.toFixed(1)}%`}
            help="Receita menos custos do mês."
            to="/financeiro"
          />
          <MoneyCard
            label="Em atraso"
            value={String(counters.clientesVencidos)}
            tone="danger"
            hint="cliente(s)"
            help="Clientes com lista vencida."
            to="/operacao-dia"
          />
          <MoneyCard
            label="Projeção"
            value={formatBRL(projecaoMes)}
            tone="primary"
            help="Estimativa do mês."
            to="/financeiro"
          />
        </div>
      </section>

      {/* 5 — IA */}
      {aiCompanyId && (
        <section className="mb-6">
          <SectionTitle
            title="IA Cobrança"
            subtitle="Seu atendente automático"
            action={
              <Link to="/treinar-ia">
                <Button size="sm" variant="outline">
                  <Bot className="mr-1 h-3.5 w-3.5" />
                  Treinar IA
                </Button>
              </Link>
            }
          />
          <div className="rounded-2xl border border-border bg-card shadow-card">
            <AiQuotaCard companyId={aiCompanyId} />
          </div>
        </section>
      )}

      {/* 6 — Indicações + (apenas super admin) Configuração inicial */}
      <section className="mb-2 grid gap-3 lg:grid-cols-2">
        <Link
          to="/indicacoes"
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card transition-shadow hover:shadow-pop"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <Gift className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">Indique e ganhe</p>
            <p className="text-xs text-muted-foreground">
              {counters.indicacoesPendentes} pendente(s) ·{" "}
              {counters.bonificacoesPendentes} bonificação(ões)
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>

        {isSuperAdmin && (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Configuração inicial
                </p>
                <p className="mt-0.5 text-sm font-bold text-foreground">
                  {setup.percent}% concluída
                </p>
                <p className="text-xs text-muted-foreground">
                  {setup.completed}/{setup.total} passos
                </p>
              </div>
              <Link to="/configuracao-inicial" className="shrink-0">
                <Button size="sm" variant="outline">
                  Continuar
                </Button>
              </Link>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${setup.percent}%` }}
              />
            </div>
            {setupRec && (
              <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <Info className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                <span>{setupRec.message}</span>
              </p>
            )}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
