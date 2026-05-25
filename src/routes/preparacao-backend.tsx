import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Database,
  Download,
  RefreshCw,
  ShieldAlert,
  ListChecks,
  Layers,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Boxes,
  FileWarning,
  Info,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildReadinessReport,
  exportReadinessTxt,
  PRIORITY_LABEL,
  STATUS_LABEL,
  PRE_SUPABASE_CHECKLIST,
  type ReadinessReport,
  type Priority,
  type EntityStatus,
} from "@/lib/backend-readiness";

export const Route = createFileRoute("/preparacao-backend")({
  component: PreparacaoBackendPage,
});

const PRIORITY_TONE: Record<Priority, string> = {
  critica: "bg-danger-soft text-danger border-danger/30",
  alta: "bg-warning-soft text-warning border-warning/30",
  media: "bg-info-soft text-info border-info/30",
  baixa: "bg-surface-muted text-muted-foreground border-border",
};

const STATUS_TONE: Record<EntityStatus, string> = {
  pronto_para_modelar: "bg-success-soft text-success border-success/30",
  local_apenas: "bg-info-soft text-info border-info/30",
  precisa_revisar: "bg-warning-soft text-warning border-warning/30",
  futuro_backend: "bg-surface-muted text-muted-foreground border-border",
};

const CHECKLIST_KEY = "cobranca_ia_backend_readiness_checklist_v1";

function readChecklistState(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CHECKLIST_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeChecklistState(s: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHECKLIST_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

function PreparacaoBackendPage() {
  const [report, setReport] = useState<ReadinessReport | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<"modulos" | "entidades" | "ordem" | "riscos" | "checklist">(
    "modulos",
  );

  const refresh = () => setReport(buildReadinessReport());

  useEffect(() => {
    refresh();
    setChecked(readChecklistState());
    const onChange = () => refresh();
    window.addEventListener("storage", onChange);
    return () => window.removeEventListener("storage", onChange);
  }, []);

  const checklistDone = useMemo(
    () => PRE_SUPABASE_CHECKLIST.filter((c) => checked[c.id]).length,
    [checked],
  );

  const toggle = (id: string) => {
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    writeChecklistState(next);
  };

  if (!report) {
    return (
      <PageContainer>
        <SectionHeader title="Preparação Backend" subtitle="Carregando..." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* Header */}
      <div className="mb-4 rounded-2xl border border-border bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground shadow-pop md:p-6">
        <p className="text-xs font-medium uppercase tracking-wide opacity-80">
          Planejamento local
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">
          Preparação Backend
        </h1>
        <p className="mt-1 text-sm opacity-90">
          Mapeie dados locais e prepare a futura migração segura para banco de dados.
        </p>
        <div className="mt-3 inline-flex items-start gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-[11px] font-medium">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            Planejamento apenas: esta tela não cria backend, não altera Supabase e não envia
            dados para servidor.
          </span>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Summary label="Módulos locais" value={String(report.totals.modulosEncontrados)} icon={Boxes} />
        <Summary label="Registros estimados" value={String(report.totals.registrosEstimados)} icon={Database} />
        <Summary label="Entidades sugeridas" value={String(report.totals.entidades)} icon={Layers} />
        <Summary label="Prioridade crítica" value={String(report.totals.criticas)} tone="danger" icon={ShieldAlert} />
        <Summary label="Prioridade alta" value={String(report.totals.altas)} tone="warning" icon={AlertTriangle} />
        <Summary label="Riscos de perda local" value={String(report.totals.riscosPerda)} tone="danger" icon={FileWarning} />
        <Summary label="Pronto para modelar" value={String(report.totals.prontas)} tone="success" icon={CheckCircle2} />
        <Summary label="Não pronto p/ backend" value={String(report.totals.naoProntas)} tone="muted" icon={Circle} />
      </div>

      {/* Ações */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={refresh}>
          <RefreshCw className="mr-1.5 h-4 w-4" /> Atualizar
        </Button>
        <Button size="sm" onClick={() => exportReadinessTxt()}>
          <Download className="mr-1.5 h-4 w-4" /> Exportar plano
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link to="/backup-geral">Backup Geral</Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link to="/diagnostico">Ver diagnóstico</Link>
        </Button>
      </div>

      {/* Tabs */}
      <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {(
          [
            { k: "modulos", l: "Mapa de módulos" },
            { k: "entidades", l: "Entidades futuras" },
            { k: "ordem", l: "Ordem de migração" },
            { k: "riscos", l: "Riscos e bloqueios" },
            { k: "checklist", l: `Checklist (${checklistDone}/${PRE_SUPABASE_CHECKLIST.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              tab === t.k
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-surface-muted",
            )}
          >
            {t.l}
          </button>
        ))}
      </div>

      {tab === "modulos" && (
        <div className="space-y-2">
          <SectionHeader title="Mapa de módulos locais" subtitle="O que existe hoje em localStorage" />
          {report.modules.map((m) => (
            <div key={m.key} className="rounded-xl border border-border bg-card p-3 shadow-card">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-semibold tracking-tight">{m.label}</p>
                <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase", PRIORITY_TONE[m.priority])}>
                  {PRIORITY_LABEL[m.priority]}
                </span>
                <span
                  className={cn(
                    "rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                    m.present
                      ? "border-success/30 bg-success-soft text-success"
                      : "border-border bg-surface-muted text-muted-foreground",
                  )}
                >
                  {m.present ? `${m.count} item(ns)` : "vazio"}
                </span>
              </div>
              <p className="mt-1 break-all text-[11px] text-muted-foreground">chave: {m.key}</p>
              <p className="mt-1 text-xs">
                <span className="text-muted-foreground">Futura entidade: </span>
                <span className="font-medium">{m.futureEntity}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Risco: </span>
                {m.risk}
              </p>
              {m.dependencies.length > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Depende de: {m.dependencies.join(", ")}
                </p>
              )}
              {m.notes && (
                <p className="mt-1 text-[11px] italic text-muted-foreground">{m.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "entidades" && (
        <div className="space-y-2">
          <SectionHeader title="Entidades futuras sugeridas" subtitle="Apenas planejamento" />
          {report.entities.map((e) => (
            <div key={e.name} className="rounded-xl border border-border bg-card p-3 shadow-card">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-semibold tracking-tight">{e.name}</p>
                <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase", PRIORITY_TONE[e.priority])}>
                  {PRIORITY_LABEL[e.priority]}
                </span>
                <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-medium", STATUS_TONE[e.status])}>
                  {STATUS_LABEL[e.status]}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{e.description}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">Campos: </span>
                {e.mainFields.join(", ")}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">Origem: </span>
                {e.origin}
              </p>
            </div>
          ))}
        </div>
      )}

      {tab === "ordem" && (
        <div className="space-y-2">
          <SectionHeader title="Ordem recomendada para backend" subtitle="Por que essa sequência" />
          {report.migrationOrder.map((s) => (
            <div key={s.order} className="rounded-xl border border-border bg-card p-3 shadow-card">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                  {s.order}
                </div>
                <p className="text-sm font-semibold tracking-tight">{s.title}</p>
              </div>
              <p className="mt-1 text-xs">
                <ArrowRight className="mr-1 inline h-3 w-3 text-primary" />
                {s.why}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">Risco fora de ordem: </span>
                {s.riskIfSkipped}
              </p>
              {s.dependencies.length > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Depende de: {s.dependencies.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "riscos" && (
        <div className="space-y-4">
          <div>
            <SectionHeader title="Riscos se continuar só local" subtitle="O que pode dar errado sem backend" />
            <div className="space-y-2">
              {report.risks.map((r) => (
                <div key={r.title} className="rounded-xl border border-danger/30 bg-danger-soft p-3">
                  <p className="text-sm font-semibold text-danger">{r.title}</p>
                  <p className="mt-1 text-xs text-danger/90">{r.description}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionHeader title="Bloqueios para backend real" subtitle="O que precisa ser definido antes" />
            <div className="space-y-2">
              {report.blockers.map((r) => (
                <div key={r.title} className="rounded-xl border border-warning/30 bg-warning-soft p-3">
                  <p className="text-sm font-semibold text-warning">{r.title}</p>
                  <p className="mt-1 text-xs text-warning/90">{r.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "checklist" && (
        <div>
          <SectionHeader
            title="Checklist antes de mexer no Supabase"
            subtitle="Visual/local — não cria nada real"
          />
          <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
            <ul className="space-y-1">
              {report.checklist.map((c) => {
                const on = !!checked[c.id];
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => toggle(c.id)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-surface-muted"
                    >
                      {on ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className={cn("flex-1", on && "line-through text-muted-foreground")}>
                        {c.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-surface-muted px-3 py-2 text-[11px] text-muted-foreground">
            <ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            Marcar itens aqui é apenas um lembrete local. Nada é criado no Supabase.
          </p>
        </div>
      )}

      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        Backend real: ainda não configurado. Gerado em{" "}
        {new Date(report.generated_at).toLocaleString("pt-BR")}
      </p>
    </PageContainer>
  );
}

function Summary({
  label,
  value,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  icon: typeof Database;
  tone?: "primary" | "success" | "warning" | "danger" | "muted";
}) {
  const toneMap: Record<string, string> = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    muted: "bg-surface-muted text-muted-foreground",
  };
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-card">
      <div className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg", toneMap[tone])}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-2 truncate text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}
