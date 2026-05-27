import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Users,
  CalendarClock,
  AlertCircle,
  Megaphone,
  Wallet,
  HardDrive,
  Beaker,
  Gift,
  Server,
  Store,
  SlidersHorizontal,
  Copy,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Target,
  Info,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { StatCard } from "@/components/ui-premium/StatCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocalAuth } from "@/lib/use-local-auth";
import {
  getCompanyForUser,
  getPlanById,
  getCompanyStatus,
  daysUntilDue,
} from "@/lib/companies";
import { getCompanyUsage } from "@/lib/plan-limits";

function OwnerRoleNotice() {
  const { isOwner, user } = useLocalAuth();
  if (!isOwner) return null;
  const company = getCompanyForUser(user?.email);
  const plan = company ? getPlanById(company.plano_id) : null;
  const status = company ? getCompanyStatus(company) : "sem_empresa";
  const days = company ? daysUntilDue(company) : null;
  return (
    <div className="mb-4 space-y-2">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
        Painel do Dono: algumas áreas administrativas foram ocultadas conforme seu plano.
      </div>
      {company ? (
        <div className="rounded-xl border bg-card p-3 text-sm shadow-sm">
          <p className="font-semibold">{company.nome}</p>
          <p className="text-xs text-muted-foreground">
            Plano: {plan?.nome ?? "—"} · Status: {status}
            {company.data_vencimento ? ` · Vence em ${company.data_vencimento}` : ""}
          </p>
          {plan && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Módulos liberados: {plan.modulos.length}
            </p>
          )}
          {(() => {
            const u = company ? getCompanyUsage(company.id) : null;
            if (!u || !plan) return null;
            const Row = ({ k, used, lim }: { k: string; used: number; lim: number }) => (
              <div className="flex items-center justify-between rounded border bg-card px-2 py-1 text-[11px]">
                <span className="text-muted-foreground">{k}</span>
                <span className={used >= lim ? "font-semibold text-rose-600" : "font-medium"}>{used}/{lim}</span>
              </div>
            );
            return (
              <div className="mt-2 grid grid-cols-2 gap-1">
                <Row k="Clientes" used={u.clientes} lim={plan.limite_clientes} />
                <Row k="Telas" used={u.telas} lim={plan.limite_telas} />
                <Row k="Testes" used={u.testes} lim={plan.limite_testes} />
                <Row k="Servidores" used={u.servidores} lim={plan.limite_servidores} />
              </div>
            );
          })()}
          {days != null && days >= 0 && days <= 7 && (
            <p className="mt-1 rounded bg-amber-100 px-2 py-1 text-[11px] text-amber-900">
              Seu painel vence em {days} dia(s). Fale com o suporte para renovar.
            </p>
          )}
          <p className="mt-1 text-[10px] text-muted-foreground">
            Dados locais atuais ainda não estão isolados por empresa. Isolamento real será feito no backend.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Sua conta ainda não está vinculada a uma empresa. Peça ao admin para vincular seu e-mail.
        </div>
      )}
    </div>
  );
}

function PwaInstallPrompt() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("cobranca_ia_pwa_dismissed") === "1";
    } catch {
      return false;
    }
  });

  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS specific
      window.navigator.standalone === true;
    setIsStandalone(standalone);
  }, []);

  if (isStandalone || dismissed) return null;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem("cobranca_ia_pwa_dismissed", "1");
    } catch {
      /* noop */
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
      <div className="flex items-start gap-2">
        <Download className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Instale este painel no seu celular</p>
          <p className="mt-0.5 text-xs text-blue-800">
            Acesse mais rápido como um aplicativo.
          </p>
          <div className="mt-2 rounded-lg bg-white/70 p-2 text-xs text-blue-900">
            {isIOS ? (
              <p>
                Toque no botão <strong>Compartilhar</strong> do Safari e escolha{" "}
                <strong>Adicionar à Tela de Início</strong>.
              </p>
            ) : (
              <p>
                Toque nos <strong>três pontos</strong> do Chrome e escolha{" "}
                <strong>Adicionar à tela inicial</strong>.
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded p-1 text-blue-700 hover:bg-blue-100"
          aria-label="Fechar"
        >
          <span className="text-xs font-semibold">✕</span>
        </button>
      </div>
    </div>
  );
}

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
  listFinanceGoals,
  filterEntriesByMonth,
  calculateFinanceSummary,
  buildSummaryText,
  formatBRL,
} from "@/lib/financeiro-local";
import { getLocalDataHealth, getModuleSummaries } from "@/lib/backup-geral";
import { getDiagnosticsSummary } from "@/lib/system-diagnostics";
import { getSetupProgress, getNextRecommendation, SETUP_WIZARD_EVENT } from "@/lib/setup-wizard";
import { isProtectedModeActive, LOCAL_SECURITY_EVENT } from "@/lib/local-security";

export const Route = createFileRoute("/")({ component: Dashboard });

const LAST_BACKUP_KEY = "cobranca_ia_last_backup_at_v1";

type Counters = {
  clientesHoje: number;
  clientesVencidos: number;
  proximos7: number;
  testesAndamento: number;
  testesAcompanharHoje: number;
  indicacoesPendentes: number;
  bonificacoesPendentes: number;
  receitaMes: number;
  lucroLiquido: number;
  pendenciasCriticas: number;
  appsPagosVencendo: number;
  servidoresSemVinculo: number;
};

type Health = ReturnType<typeof getLocalDataHealth>;

function todayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

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

  let clientesHoje = 0;
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

    const dueDays = nextDueDays(null, active);
    if (dueDays === 0) clientesHoje += 1;
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

  const today = todayIso();
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

  const servidoresSemVinculo = servers.filter(
    (s) => s.status === "ativo" && !usedServerIds.has(s.id),
  ).length;

  // Adiciona pendências críticas extras
  pendenciasCriticas += appsPagosVencendo;

  const counters: Counters = {
    clientesHoje,
    clientesVencidos,
    proximos7,
    testesAndamento,
    testesAcompanharHoje,
    indicacoesPendentes,
    bonificacoesPendentes,
    receitaMes: summary.revenue,
    lucroLiquido: summary.net_profit,
    pendenciasCriticas,
    appsPagosVencendo,
    servidoresSemVinculo,
  };

  const totalModules = getModuleSummaries().filter((m) => m.present).length;

  return { counters, health, totalModules };
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

function formatRelativeDate(iso?: string | null): string {
  if (!iso) return "informação não disponível";
  try {
    const d = new Date(iso);
    if (isNaN(+d)) return "informação não disponível";
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "informação não disponível";
  }
}

function ActionRow({
  title,
  desc,
  to,
  btn,
  tone = "default",
}: {
  title: string;
  desc: string;
  to: string;
  btn: string;
  tone?: "default" | "danger" | "warning" | "success";
}) {
  const toneClass =
    tone === "danger"
      ? "border-danger/30 bg-danger-soft/40"
      : tone === "warning"
        ? "border-warning/30 bg-warning-soft/40"
        : tone === "success"
          ? "border-success/30 bg-success-soft/40"
          : "border-border bg-card";
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border p-3 shadow-card md:flex-row md:items-center md:justify-between md:gap-4",
        toneClass,
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
      <Link to={to} className="shrink-0">
        <Button size="sm" variant="outline" className="w-full md:w-auto">
          {btn}
          <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </Link>
    </div>
  );
}

function AlertItem({
  level,
  text,
  to,
}: {
  level: "critical" | "warning" | "info";
  text: string;
  to?: string;
}) {
  const cfg = {
    critical: {
      icon: AlertTriangle,
      label: "Crítico",
      cls: "border-danger/40 bg-danger-soft/50 text-danger",
      badge: "bg-danger text-danger-foreground",
    },
    warning: {
      icon: AlertCircle,
      label: "Atenção",
      cls: "border-warning/40 bg-warning-soft/50 text-warning",
      badge: "bg-warning text-warning-foreground",
    },
    info: {
      icon: Info,
      label: "Normal",
      cls: "border-border bg-muted/40 text-foreground",
      badge: "bg-muted text-muted-foreground",
    },
  }[level];
  const Icon = cfg.icon;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border p-2.5 text-sm",
        cfg.cls,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase",
              cfg.badge,
            )}
          >
            {cfg.label}
          </span>
          <span className="text-xs text-foreground">{text}</span>
        </div>
        {to && (
          <Link
            to={to}
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
          >
            Abrir <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

function ShortcutTile({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: typeof Users;
}) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-card p-3 text-center shadow-card transition-all hover:-translate-y-0.5 hover:shadow-pop"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-xs font-medium leading-tight">{label}</span>
    </Link>
  );
}

function Dashboard() {
  const { counters, health, totalModules } = useDashboardData();
  const [protectedMode, setProtectedMode] = useState(false);
  const [diag, setDiag] = useState(() => getDiagnosticsSummary());
  const [setup, setSetup] = useState(() => getSetupProgress());
  const [setupRec, setSetupRec] = useState(() => getNextRecommendation());

  useEffect(() => {
    const refresh = () => {
      setProtectedMode(isProtectedModeActive());
      setDiag(getDiagnosticsSummary());
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


  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(LAST_BACKUP_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const onStorage = () => {
      try {
        setLastBackupAt(window.localStorage.getItem(LAST_BACKUP_KEY));
      } catch {
        /* noop */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const monthEntries = useMemo(
    () => filterEntriesByMonth(listFinanceEntries()),
    // recompute whenever counters change (events trigger re-render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [counters.receitaMes, counters.lucroLiquido],
  );
  const financeSummary = useMemo(
    () => calculateFinanceSummary(monthEntries),
    [monthEntries],
  );
  const goals = useMemo(() => listFinanceGoals(), [counters.receitaMes]);
  const mainGoal =
    goals.find((g) => g.status === "ativo") ?? goals[0] ?? undefined;

  const goalMissing = mainGoal
    ? Math.max(0, mainGoal.target - mainGoal.reserved)
    : 0;

  // Alertas críticos
  const alerts: { level: "critical" | "warning" | "info"; text: string; to?: string }[] = [];
  if (counters.clientesVencidos > 0)
    alerts.push({
      level: "critical",
      text: `${counters.clientesVencidos} cliente(s) com lista vencida.`,
      to: "/operacao-dia",
    });
  if (counters.appsPagosVencendo > 0)
    alerts.push({
      level: "critical",
      text: `${counters.appsPagosVencendo} app(s) pago(s) vencido(s) ou vencendo em 7 dias.`,
      to: "/clientes",
    });
  if (counters.servidoresSemVinculo > 0)
    alerts.push({
      level: "warning",
      text: `${counters.servidoresSemVinculo} servidor(es) ativo(s) sem tela vinculada.`,
      to: "/catalogo-servidores",
    });
  if (counters.bonificacoesPendentes > 0)
    alerts.push({
      level: "warning",
      text: `${counters.bonificacoesPendentes} bonificação(ões) pendente(s).`,
      to: "/indicacoes",
    });
  if (counters.testesAcompanharHoje > 0)
    alerts.push({
      level: "warning",
      text: `${counters.testesAcompanharHoje} teste(s) para acompanhar hoje.`,
      to: "/testes",
    });
  if (!lastBackupAt)
    alerts.push({
      level: "warning",
      text: "Nenhum backup geral registrado neste navegador.",
      to: "/backup-geral",
    });
  if (health.status === "review")
    alerts.push({
      level: "critical",
      text: "Saúde dos dados locais precisa de revisão.",
      to: "/backup-geral",
    });
  else if (health.status === "warning")
    alerts.push({
      level: "warning",
      text: "Dados locais com pontos de atenção.",
      to: "/backup-geral",
    });

  // Mostrar alguns issues do health, limitados
  for (const issue of health.issues.slice(0, 3)) {
    alerts.push({
      level: issue.level === "review" ? "critical" : issue.level === "warning" ? "warning" : "info",
      text: issue.message,
      to: "/backup-geral",
    });
  }

  if (alerts.length === 0)
    alerts.push({
      level: "info",
      text: "Sem alertas críticos no momento.",
    });

  const copyFinance = async () => {
    try {
      const txt = buildSummaryText(financeSummary, mainGoal);
      await navigator.clipboard.writeText(txt);
      toast.success("Resumo financeiro copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const healthStatusLabel =
    health.status === "ok"
      ? "Tudo certo"
      : health.status === "warning"
        ? "Atenção"
        : "Precisa revisar";
  const healthStatusCls =
    health.status === "ok"
      ? "bg-success-soft text-success"
      : health.status === "warning"
        ? "bg-warning-soft text-warning"
        : "bg-danger-soft text-danger";

  return (
    <PageContainer>
      {/* Header */}
      <div className="mb-5 rounded-2xl border border-border bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground shadow-pop md:p-6">
        <p className="text-xs font-medium uppercase tracking-wide opacity-80">
          Painel Geral
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">
          Resumo da operação
        </h1>
        <p className="mt-1 text-sm opacity-90">
          Resumo da sua operação de cobrança, suporte, testes e financeiro.
        </p>
        {protectedMode && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-500/90 px-2.5 py-1 text-[11px] font-semibold text-white ml-2">
            <ShieldCheck className="h-3 w-3" />
            Modo protegido ativo
          </div>
        )}
      </div>

      <OwnerRoleNotice />

      {/* Próximo passo recomendado — linguagem simples para o Dono */}
      {(() => {
        const totalClientes =
          counters.clientesHoje + counters.clientesVencidos + counters.proximos7;
        let titulo = "Acompanhe seus próximos vencimentos.";
        let descricao = "Está tudo em dia — confira a aba Clientes regularmente.";
        let cta = "Abrir Clientes";
        let para = "/clientes";
        let tom = "success" as "success" | "warning" | "danger" | "default";

        if (totalClientes === 0 && counters.testesAndamento === 0) {
          titulo = "Cadastre ou importe seus clientes.";
          descricao = "Comece adicionando seu primeiro cliente ou importando uma lista.";
          cta = "Importar clientes";
          para = "/importar-clientes";
          tom = "default";
        } else if (counters.clientesVencidos > 0) {
          titulo = "Revise as cobranças pendentes.";
          descricao = `${counters.clientesVencidos} cliente(s) com lista vencida aguardando contato.`;
          cta = "Abrir Cobranças";
          para = "/operacao-dia";
          tom = "danger";
        } else if (counters.clientesHoje > 0) {
          titulo = "Você tem clientes vencendo hoje.";
          descricao = `${counters.clientesHoje} cliente(s) vencem hoje — envie a mensagem de cobrança.`;
          cta = "Abrir Cobranças";
          para = "/operacao-dia";
          tom = "warning";
        } else if (counters.testesAcompanharHoje > 0) {
          titulo = "Acompanhe seus testes.";
          descricao = `${counters.testesAcompanharHoje} teste(s) precisam de retorno hoje.`;
          cta = "Abrir Testes";
          para = "/testes";
          tom = "warning";
        }

        const toneCls =
          tom === "danger"
            ? "border-danger/30 bg-danger-soft/40"
            : tom === "warning"
              ? "border-warning/30 bg-warning-soft/40"
              : tom === "success"
                ? "border-success/30 bg-success-soft/40"
                : "border-primary/30 bg-primary-soft/40";

        return (
          <div
            className={cn(
              "mb-4 flex flex-col gap-2 rounded-2xl border p-4 shadow-card sm:flex-row sm:items-center sm:justify-between",
              toneCls,
            )}
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Próximo passo recomendado
              </p>
              <p className="mt-0.5 text-sm font-semibold leading-snug">{titulo}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>
            </div>
            <Link to={para} className="shrink-0">
              <Button size="sm" className="w-full sm:w-auto">
                {cta}
              </Button>
            </Link>
          </div>
        );
      })()}





      {/* Cards principais */}
      <SectionHeader
        title="Resumo geral"
        subtitle="Indicadores rápidos do seu dia"
      />
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Vencem hoje" value={String(counters.clientesHoje)} icon={CalendarClock} accent="warning" />
        <StatCard label="Vencidos" value={String(counters.clientesVencidos)} icon={AlertTriangle} accent="danger" />
        <StatCard label="Próximos 7 dias" value={String(counters.proximos7)} icon={Users} accent="info" />
        <StatCard label="Testes em andamento" value={String(counters.testesAndamento)} icon={Beaker} accent="primary" />
        <StatCard label="Acompanhar hoje" value={String(counters.testesAcompanharHoje)} icon={Beaker} accent="warning" />
        <StatCard label="Indicações pendentes" value={String(counters.indicacoesPendentes)} icon={Gift} accent="info" />
        <StatCard label="Bonificações pendentes" value={String(counters.bonificacoesPendentes)} icon={Gift} accent="warning" />
        <StatCard label="Receita do mês" value={formatBRL(counters.receitaMes)} icon={Wallet} accent="success" />
        <StatCard label="Lucro líquido" value={formatBRL(counters.lucroLiquido)} icon={TrendingUp} accent="success" />
        <StatCard label="Pendências críticas" value={String(counters.pendenciasCriticas)} icon={AlertCircle} accent="danger" />
        <StatCard label="Apps pagos vencendo" value={String(counters.appsPagosVencendo)} icon={Smartphone} accent="warning" />
        <StatCard label="Servidores sem vínculo" value={String(counters.servidoresSemVinculo)} icon={Server} accent="info" />
      </div>

      {/* Diagnóstico */}
      <div className="mt-4">
        <Link
          to="/diagnostico"
          className={cn(
            "flex items-center gap-3 rounded-2xl border p-3 shadow-card transition-colors",
            diag.overall === "critico"
              ? "border-danger/30 bg-danger-soft hover:bg-danger-soft/80"
              : diag.overall === "atencao"
                ? "border-warning/30 bg-warning-soft hover:bg-warning-soft/80"
                : "border-success/30 bg-success-soft hover:bg-success-soft/80",
          )}
        >
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              diag.overall === "critico"
                ? "bg-danger text-white"
                : diag.overall === "atencao"
                  ? "bg-warning text-white"
                  : "bg-success text-white",
            )}
          >
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tracking-tight">
              Diagnóstico:{" "}
              {diag.overall === "ok"
                ? "tudo certo"
                : diag.overall === "atencao"
                  ? "itens de atenção"
                  : "alertas críticos"}
            </p>
            <p className="text-xs text-muted-foreground">
              {diag.critico} crítico(s) · {diag.atencao} atenção · {diag.modulos} módulos com dados
            </p>
          </div>
          <span className="shrink-0 text-xs font-medium text-primary">Abrir</span>
        </Link>
      </div>

      {/* Configuração Inicial */}
      <div className="mt-4 rounded-2xl border border-border bg-card p-3 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Configuração inicial
            </p>
            <p className="mt-0.5 text-sm font-semibold">
              {setup.percent}% concluída
            </p>
            <p className="text-xs text-muted-foreground">
              {setup.completed}/{setup.total} passos · {setup.pending} pendente(s)
            </p>
          </div>
          <Link to="/configuracao-inicial" className="shrink-0">
            <Button size="sm" variant="outline">
              Abrir Configuração Inicial
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${setup.percent}%` }}
          />
        </div>
        {setupRec && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
            <span>
              <span className="font-medium text-foreground">Próximo passo:</span>{" "}
              {setupRec.message}
            </span>
          </p>
        )}
      </div>




      {/* Ações de hoje */}
      <div className="mt-6">
        <SectionHeader
          title="Ações de hoje"
          subtitle="O que merece sua atenção agora"
        />
        <div className="grid gap-2.5 md:grid-cols-2">
          <ActionRow
            title="Cobrar clientes que vencem hoje"
            desc={`${counters.clientesHoje} cliente(s) com vencimento hoje.`}
            to="/operacao-dia"
            btn="Abrir Operação do dia"
            tone={counters.clientesHoje > 0 ? "warning" : "default"}
          />
          <ActionRow
            title="Acompanhar testes terminando hoje"
            desc={`${counters.testesAcompanharHoje} teste(s) precisam de retorno.`}
            to="/testes"
            btn="Abrir Testes"
            tone={counters.testesAcompanharHoje > 0 ? "warning" : "default"}
          />
          <ActionRow
            title="Recuperar clientes vencidos"
            desc={`${counters.clientesVencidos} cliente(s) com lista vencida.`}
            to="/operacao-dia"
            btn="Abrir Operação do dia"
            tone={counters.clientesVencidos > 0 ? "danger" : "default"}
          />
          <ActionRow
            title="Ver pendências críticas"
            desc={`${counters.pendenciasCriticas} ponto(s) precisam de atenção.`}
            to="/pendencias"
            btn="Abrir Pendências"
            tone={counters.pendenciasCriticas > 0 ? "danger" : "default"}
          />
          <ActionRow
            title="Conferir campanhas manuais"
            desc="Monte listas e copie mensagens prontas."
            to="/campanhas-manuais"
            btn="Abrir Campanhas"
          />
          <ActionRow
            title="Registrar financeiro das renovações"
            desc="Confirme valores recebidos e custos do dia."
            to="/financeiro"
            btn="Abrir Financeiro"
          />
          <ActionRow
            title="Fazer backup geral"
            desc={
              lastBackupAt
                ? `Último registrado: ${formatRelativeDate(lastBackupAt)}.`
                : "Nenhum backup registrado neste navegador."
            }
            to="/backup-geral"
            btn="Abrir Backup Geral"
            tone={!lastBackupAt ? "warning" : "default"}
          />
        </div>
      </div>

      {/* Alertas críticos */}
      <div className="mt-6">
        <SectionHeader
          title="Alertas críticos"
          subtitle="Itens classificados por prioridade"
        />
        <div className="grid gap-2 md:grid-cols-2">
          {alerts.map((a, i) => (
            <AlertItem key={i} level={a.level} text={a.text} to={a.to} />
          ))}
        </div>
      </div>

      {/* Financeiro rápido + Testes/Indicações */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Financeiro */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Financeiro do mês</h3>
              <p className="text-xs text-muted-foreground">
                Resumo local — nenhum pagamento é processado.
              </p>
            </div>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-muted/40 p-2">
              <p className="text-[11px] text-muted-foreground">Receita</p>
              <p className="font-semibold">{formatBRL(financeSummary.revenue)}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-2">
              <p className="text-[11px] text-muted-foreground">Custos</p>
              <p className="font-semibold">{formatBRL(financeSummary.costs)}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-2">
              <p className="text-[11px] text-muted-foreground">Reservado</p>
              <p className="font-semibold">{formatBRL(financeSummary.reserve)}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-2">
              <p className="text-[11px] text-muted-foreground">Lucro líquido</p>
              <p className="font-semibold">{formatBRL(financeSummary.net_profit)}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-2">
              <p className="text-[11px] text-muted-foreground">Margem</p>
              <p className="font-semibold">{financeSummary.margin_pct.toFixed(1)}%</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-2">
              <p className="text-[11px] text-muted-foreground">Objetivo</p>
              <p className="truncate font-semibold" title={mainGoal?.name ?? ""}>
                {mainGoal?.name ?? "—"}
              </p>
              {mainGoal && (
                <p className="text-[11px] text-muted-foreground">
                  Falta {formatBRL(goalMissing)}
                </p>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/financeiro">
              <Button size="sm" variant="outline">
                <Wallet className="mr-1.5 h-3.5 w-3.5" /> Abrir Financeiro
              </Button>
            </Link>
            <Link to="/financeiro">
              <Button size="sm" variant="outline">
                <Target className="mr-1.5 h-3.5 w-3.5" /> Nova entrada
              </Button>
            </Link>
            <Button size="sm" variant="outline" onClick={copyFinance}>
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar resumo
            </Button>
          </div>
        </div>

        {/* Testes & Indicações */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Testes e Indicações</h3>
              <p className="text-xs text-muted-foreground">
                Acompanhe leads e bonificações locais.
              </p>
            </div>
            <Beaker className="h-4 w-4 text-muted-foreground" />
          </div>
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-center justify-between rounded-lg bg-muted/40 px-2.5 py-1.5">
              <span>Testes em andamento</span>
              <span className="font-semibold">{counters.testesAndamento}</span>
            </li>
            <li className="flex items-center justify-between rounded-lg bg-muted/40 px-2.5 py-1.5">
              <span>Vencendo / acompanhar hoje</span>
              <span className="font-semibold">{counters.testesAcompanharHoje}</span>
            </li>
            <li className="flex items-center justify-between rounded-lg bg-muted/40 px-2.5 py-1.5">
              <span>Indicações pendentes</span>
              <span className="font-semibold">{counters.indicacoesPendentes}</span>
            </li>
            <li className="flex items-center justify-between rounded-lg bg-muted/40 px-2.5 py-1.5">
              <span>Bonificações pendentes</span>
              <span className="font-semibold">{counters.bonificacoesPendentes}</span>
            </li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/testes">
              <Button size="sm" variant="outline">
                <Beaker className="mr-1.5 h-3.5 w-3.5" /> Novo teste
              </Button>
            </Link>
            <Link to="/testes">
              <Button size="sm" variant="outline">
                Abrir Testes
              </Button>
            </Link>
            <Link to="/indicacoes">
              <Button size="sm" variant="outline">
                <Gift className="mr-1.5 h-3.5 w-3.5" /> Abrir Indicações
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Backup e segurança */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Backup e segurança</h3>
            <p className="text-xs text-muted-foreground">
              Tudo armazenado localmente neste navegador.
            </p>
          </div>
          <HardDrive className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <div className="rounded-lg bg-muted/40 p-2.5">
            <p className="text-[11px] text-muted-foreground">Último backup geral</p>
            <p className="text-sm font-medium">{formatRelativeDate(lastBackupAt)}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2.5">
            <p className="text-[11px] text-muted-foreground">Módulos com dados</p>
            <p className="text-sm font-medium">{totalModules}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2.5">
            <p className="text-[11px] text-muted-foreground">Saúde dos dados</p>
            <span
              className={cn(
                "mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                healthStatusCls,
              )}
            >
              <CheckCircle2 className="h-3 w-3" />
              {healthStatusLabel}
            </span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to="/backup-geral">
            <Button size="sm" variant="outline">
              <HardDrive className="mr-1.5 h-3.5 w-3.5" /> Exportar Backup Geral
            </Button>
          </Link>
          <Link to="/backup-geral">
            <Button size="sm" variant="outline">
              Abrir Backup Geral
            </Button>
          </Link>
        </div>
      </div>

      {/* Atalhos rápidos */}
      <div className="mt-6">
        <SectionHeader title="Atalhos rápidos" subtitle="Acesso direto aos módulos" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          <ShortcutTile to="/clientes" label="Clientes" icon={Users} />
          <ShortcutTile to="/operacao-dia" label="Operação do dia" icon={CalendarClock} />
          <ShortcutTile to="/campanhas-manuais" label="Campanhas" icon={Megaphone} />
          <ShortcutTile to="/pendencias" label="Pendências" icon={AlertCircle} />
          <ShortcutTile to="/testes" label="Testes" icon={Beaker} />
          <ShortcutTile to="/indicacoes" label="Indicações" icon={Gift} />
          <ShortcutTile to="/financeiro" label="Financeiro" icon={Wallet} />
          <ShortcutTile to="/configuracoes-revenda" label="Minha Revenda" icon={Store} />
          <ShortcutTile to="/backup-geral" label="Backup Geral" icon={HardDrive} />
          <ShortcutTile to="/regras-disparo" label="Regras de disparo" icon={SlidersHorizontal} />
          <ShortcutTile to="/catalogo-servidores" label="Servidores" icon={Server} />
        </div>
      </div>
    </PageContainer>
  );
}
