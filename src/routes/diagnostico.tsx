import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  ShieldCheck,
  RefreshCw,
  Info,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  runSystemDiagnostics,
  exportDiagnosticsTxt,
  AREA_LABEL,
  type DiagnosticArea,
  type DiagnosticAlert,
  type DiagnosticLevel,
  type DiagnosticsReport,
} from "@/lib/system-diagnostics";
import { LOCAL_SECURITY_EVENT } from "@/lib/local-security";
import { getSetupProgress, SETUP_WIZARD_EVENT } from "@/lib/setup-wizard";

export const Route = createFileRoute("/diagnostico")({ component: DiagnosticoPage });

type ChipKey = "todos" | "criticos" | "atencao" | DiagnosticArea;

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "criticos", label: "Críticos" },
  { key: "atencao", label: "Atenção" },
  { key: "clientes", label: "Clientes" },
  { key: "dns", label: "DNS" },
  { key: "seguranca", label: "Segurança" },
  { key: "backup", label: "Backup" },
  { key: "financeiro", label: "Financeiro" },
  { key: "testes", label: "Testes" },
  { key: "indicacoes", label: "Indicações" },
];

function levelClasses(l: DiagnosticLevel) {
  if (l === "critico") return "bg-danger-soft text-danger border-danger/30";
  if (l === "atencao") return "bg-warning-soft text-warning border-warning/30";
  return "bg-success-soft text-success border-success/30";
}

function levelIcon(l: DiagnosticLevel) {
  if (l === "critico") return AlertCircle;
  if (l === "atencao") return AlertTriangle;
  return CheckCircle2;
}

function levelLabel(l: DiagnosticLevel) {
  if (l === "critico") return "Crítico";
  if (l === "atencao") return "Atenção";
  return "OK";
}

function DiagnosticoPage() {
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [chip, setChip] = useState<ChipKey>("todos");

  const refresh = () => setReport(runSystemDiagnostics());

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("storage", onChange);
    window.addEventListener(LOCAL_SECURITY_EVENT, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(LOCAL_SECURITY_EVENT, onChange);
    };
  }, []);

  const filteredAlerts = useMemo(() => {
    if (!report) return [];
    if (chip === "todos") return report.alerts;
    if (chip === "criticos") return report.alerts.filter((a) => a.level === "critico");
    if (chip === "atencao") return report.alerts.filter((a) => a.level === "atencao");
    return report.alerts.filter((a) => a.area === chip);
  }, [report, chip]);

  const counts = useMemo(() => {
    const c: Record<ChipKey, number> = {
      todos: 0,
      criticos: 0,
      atencao: 0,
      dados: 0,
      clientes: 0,
      servidores: 0,
      dns: 0,
      seguranca: 0,
      backup: 0,
      financeiro: 0,
      testes: 0,
      indicacoes: 0,
      operacao: 0,
    };
    if (!report) return c;
    c.todos = report.alerts.length;
    for (const a of report.alerts) {
      if (a.level === "critico") c.criticos++;
      if (a.level === "atencao") c.atencao++;
      c[a.area] = (c[a.area] || 0) + 1;
    }
    return c;
  }, [report]);

  if (!report) {
    return (
      <PageContainer>
        <SectionHeader title="Diagnóstico" subtitle="Carregando..." />
      </PageContainer>
    );
  }

  const overallTone =
    report.overall === "critico"
      ? "from-danger to-danger/80"
      : report.overall === "atencao"
        ? "from-warning to-warning/80"
        : "from-success to-success/80";

  const grouped = filteredAlerts.reduce<Record<string, DiagnosticAlert[]>>((acc, a) => {
    (acc[a.area] = acc[a.area] || []).push(a);
    return acc;
  }, {});

  return (
    <PageContainer>
      {/* Header */}
      <div
        className={cn(
          "mb-4 rounded-2xl border border-border p-5 text-primary-foreground shadow-pop md:p-6 bg-gradient-to-br",
          overallTone,
        )}
      >
        <p className="text-xs font-medium uppercase tracking-wide opacity-80">Diagnóstico</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">
          Saúde do sistema local
        </h1>
        <p className="mt-1 text-sm opacity-90">
          Verifique a saúde dos dados, segurança, rotas, financeiro e operação local.
        </p>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium">
          <ShieldCheck className="h-3 w-3" />
          Esta tela apenas analisa os dados locais. Nada será enviado ou alterado automaticamente.
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <SummaryCard label="Status geral" value={levelLabel(report.overall)} level={report.overall} />
        <SummaryCard label="Alertas críticos" value={String(report.totals.critico)} level={report.totals.critico ? "critico" : "ok"} />
        <SummaryCard label="Itens de atenção" value={String(report.totals.atencao)} level={report.totals.atencao ? "atencao" : "ok"} />
        <SummaryCard label="Módulos com dados" value={String(report.totals.modulos_com_dados)} level="ok" />
        <SummaryCard label="Clientes" value={String(report.stats.clientes)} level="ok" />
        <SummaryCard label="Telas" value={String(report.stats.screens)} level="ok" />
        <SummaryCard label="Servidores" value={String(report.stats.servidores)} level="ok" />
        <SummaryCard
          label="Rotas/Domínios"
          value={`${report.stats.rotas}/${report.stats.dominios}`}
          level="ok"
        />
      </div>

      {/* Ações */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={refresh}>
          <RefreshCw className="mr-1.5 h-4 w-4" /> Atualizar
        </Button>
        <Button size="sm" onClick={() => exportDiagnosticsTxt()}>
          <Download className="mr-1.5 h-4 w-4" /> Exportar diagnóstico
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link to="/preparacao-backend">Preparar Backend</Link>
        </Button>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs">
        <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1">Backend real: ainda não configurado.</span>
        <Link to="/preparacao-backend" className="font-medium text-primary hover:underline">
          Preparar
        </Link>
      </div>


      {/* Filtros */}
      <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {CHIPS.map((c) => {
          const n = counts[c.key];
          const active = chip === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setChip(c.key)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-surface-muted",
              )}
            >
              {c.label}
              <span
                className={cn(
                  "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]",
                  active ? "bg-white/20" : "bg-surface-muted",
                )}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {/* Alertas */}
      <SectionHeader title="Alertas" subtitle="Itens detectados na análise local" />
      {filteredAlerts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-card">
          <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-success" />
          Nenhum alerta neste filtro.
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([area, items]) => (
            <div key={area}>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {AREA_LABEL[area as DiagnosticArea]}
              </h3>
              <div className="space-y-2">
                {items.map((a) => (
                  <AlertCard key={a.id} alert={a} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Checklist */}
      <div className="mt-6">
        <SectionHeader
          title="Pronto para continuar?"
          subtitle="Checklist de prontidão do ambiente local"
        />
        <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-2 text-xs">
            <Info className="h-3.5 w-3.5 text-primary" />
            {report.overall === "ok"
              ? "Pronto para continuar local"
              : report.overall === "atencao"
                ? "Atenção antes de continuar"
                : "Não recomendado continuar sem revisar"}
          </div>
          <ul className="space-y-1.5">
            {report.checklist.map((c) => {
              const Icon =
                c.status === "ok" ? CheckCircle2 : c.status === "atencao" ? AlertTriangle : AlertCircle;
              const tone =
                c.status === "ok"
                  ? "text-success"
                  : c.status === "atencao"
                    ? "text-warning"
                    : "text-danger";
              return (
                <li key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm">
                  <Icon className={cn("h-4 w-4 shrink-0", tone)} />
                  <span className="flex-1 truncate">{c.label}</span>
                  <span className={cn("text-[11px] font-semibold uppercase", tone)}>{c.status}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Recomendações */}
      <div className="mt-6">
        <SectionHeader
          title="Próximas ações recomendadas"
          subtitle="Sugestões baseadas no diagnóstico"
        />
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <ul className="space-y-2">
            {report.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        Gerado em {new Date(report.generated_at).toLocaleString("pt-BR")}
      </p>
    </PageContainer>
  );
}

function SummaryCard({
  label,
  value,
  level,
}: {
  label: string;
  value: string;
  level: DiagnosticLevel;
}) {
  const tone =
    level === "critico"
      ? "text-danger"
      : level === "atencao"
        ? "text-warning"
        : "text-success";
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-card">
      <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold tracking-tight", tone)}>{value}</p>
    </div>
  );
}

function AlertCard({ alert }: { alert: DiagnosticAlert }) {
  const Icon = levelIcon(alert.level);
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-3 shadow-card",
        levelClasses(alert.level).replace("bg-", "border-l-4 border-l-").split(" ")[0],
      )}
    >
      <div className="flex items-start gap-2">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
            levelClasses(alert.level),
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                levelClasses(alert.level),
              )}
            >
              {levelLabel(alert.level)}
            </span>
            <p className="text-sm font-semibold tracking-tight">{alert.title}</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{alert.description}</p>
          {alert.action && (
            <p className="mt-1 flex items-start gap-1 text-xs">
              <ListChecks className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
              <span>{alert.action}</span>
            </p>
          )}
          {alert.to && (
            <div className="mt-2">
              <Button asChild size="sm" variant="outline">
                <Link to={alert.to}>{alert.ctaLabel || "Abrir"}</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
