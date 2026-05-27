import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  SkipForward,
  ExternalLink,
  Download,
  RotateCcw,
  Info,
  StickyNote,
  ArrowRight,

} from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  SETUP_STEPS,
  SETUP_WIZARD_EVENT,
  exportSetupChecklist,
  getSetupProgress,
  getSetupRecommendations,
  markSetupStepDone,
  markSetupStepSkipped,
  resetSetupProgress,
  setSetupStepNote,
  clearSetupStep,
  type SetupStepId,
  type SetupStepProgress,
} from "@/lib/setup-wizard";

export const Route = createFileRoute("/configuracao-inicial")({
  component: ConfiguracaoInicialPage,
  head: () => ({
    meta: [
      { title: "Configuração Inicial — CobraEasy" },
      {
        name: "description",
        content:
          "Assistente local para configurar os passos essenciais antes de usar o sistema.",
      },
    ],
  }),
});

type ChipKey = "todos" | "pendente" | "concluido" | "pulado";

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "pendente", label: "Pendentes" },
  { key: "concluido", label: "Concluídos" },
  { key: "pulado", label: "Pulados" },
];

function StatusPill({ status }: { status: SetupStepProgress["status"] }) {
  const cfg = {
    concluido: {
      label: "Concluído",
      cls: "border-success/40 bg-success-soft text-success",
    },
    pulado: {
      label: "Pulado",
      cls: "border-warning/40 bg-warning-soft text-warning",
    },
    pendente: {
      label: "Pendente",
      cls: "border-border bg-surface-muted text-muted-foreground",
    },
  }[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        cfg.cls,
      )}
    >
      {cfg.label}
    </span>
  );
}

function StepCard({
  item,
  recommended,
  onRefresh,
}: {
  item: SetupStepProgress;
  recommended: boolean;
  onRefresh: () => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(item.state.notes ?? "");

  useEffect(() => {
    setNote(item.state.notes ?? "");
  }, [item.state.notes]);

  const saveNote = () => {
    setSetupStepNote(item.step.id, note.trim());
    toast.success("Observação salva.");
    setNoteOpen(false);
    onRefresh();
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border p-4 shadow-card",
        item.status === "concluido"
          ? "border-success/30 bg-success-soft/30"
          : item.status === "pulado"
            ? "border-warning/30 bg-warning-soft/30"
            : recommended
              ? "border-primary/40 bg-primary-soft/40"
              : "border-border bg-card",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={item.status} />
            {recommended && item.status === "pendente" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                <Sparkles className="h-3 w-3" /> Recomendado agora
              </span>
            )}
            {item.detected && !item.state.completed && (
              <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                Detectado automaticamente
              </span>
            )}
          </div>
          <h3 className="mt-1.5 text-sm font-semibold leading-tight">
            {item.step.title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.step.description}
          </p>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            <Info className="mr-1 inline h-3 w-3" />
            {item.step.detectLabel}
          </p>
          {item.state.notes && !noteOpen && (
            <div className="mt-2 rounded-lg border border-border bg-surface-muted p-2 text-xs">
              <p className="font-medium">Observação:</p>
              <p className="text-muted-foreground">{item.state.notes}</p>
            </div>
          )}
        </div>
      </div>

      {noteOpen ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anotação (somente local)"
            rows={2}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={saveNote}>
              Salvar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setNoteOpen(false);
                setNote(item.state.notes ?? "");
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to={item.step.link}>
            Abrir módulo <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
        {item.status !== "concluido" ? (
          <Button
            size="sm"
            onClick={() => {
              markSetupStepDone(item.step.id);
              toast.success("Passo marcado como concluído.");
              onRefresh();
            }}
          >
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            Concluir
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              clearSetupStep(item.step.id);
              toast.message("Passo reaberto.");
              onRefresh();
            }}
          >
            Reabrir
          </Button>
        )}
        {item.status !== "pulado" && item.status !== "concluido" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              markSetupStepSkipped(item.step.id);
              toast.message("Passo pulado por enquanto.");
              onRefresh();
            }}
          >
            <SkipForward className="mr-1.5 h-3.5 w-3.5" />
            Pular
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setNoteOpen((v) => !v)}
        >
          <StickyNote className="mr-1.5 h-3.5 w-3.5" />
          {item.state.notes ? "Editar observação" : "Adicionar observação"}
        </Button>
      </div>
    </div>
  );
}

function ConfiguracaoInicialPage() {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  const progress = useMemo(() => getSetupProgress(), [tick]);
  const recommendations = useMemo(() => getSetupRecommendations(), [tick]);
  const [chip, setChip] = useState<ChipKey>("todos");

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener(SETUP_WIZARD_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(SETUP_WIZARD_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const recommendedId = recommendations[0]?.step_id ?? null;

  const filtered = progress.steps.filter((s) => {
    if (chip === "todos") return true;
    return s.status === chip;
  });

  const counts: Record<ChipKey, number> = {
    todos: progress.steps.length,
    pendente: progress.pending,
    concluido: progress.completed,
    pulado: progress.skipped,
  };

  return (
    <PageContainer>
      <SectionHeader
        title="Configuração Inicial"
        subtitle="Configure os passos essenciais antes de usar o sistema."
      />

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-surface-muted p-3 text-xs">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <p className="flex-1">
          <span className="font-semibold">Modo local:</span> este assistente apenas
          orienta a configuração. Nada será enviado automaticamente.
        </p>
        <Link
          to="/ajuda"
          className="shrink-0 whitespace-nowrap text-xs font-medium text-primary hover:underline"
        >
          Ver manual de ajuda
        </Link>
      </div>


      {/* Progresso */}
      <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Progresso geral
            </p>
            <p className="text-2xl font-semibold tracking-tight">
              {progress.percent}%
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">
                {progress.completed}
              </span>{" "}
              concluídos · {progress.pending} pendentes · {progress.skipped} pulados
            </p>
            <p className="mt-0.5">{progress.total} passos no total</p>
          </div>
        </div>
        <Progress value={progress.percent} className="mt-3 h-2" />
      </div>

      {/* Recomendações */}
      {recommendations.length > 0 && (
        <div className="mb-4 rounded-2xl border border-primary/30 bg-primary-soft/40 p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Próximo passo recomendado
          </p>
          <ul className="mt-2 space-y-1.5">
            {recommendations.map((r) => (
              <li key={r.step_id} className="flex items-start gap-2 text-sm">
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{r.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ações */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => exportSetupChecklist()}>
          <Download className="mr-1.5 h-4 w-4" /> Exportar checklist
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (window.confirm("Resetar todo o progresso da configuração inicial?")) {
              resetSetupProgress();
              toast.success("Progresso resetado.");
              refresh();
            }
          }}
        >
          <RotateCcw className="mr-1.5 h-4 w-4" /> Resetar progresso
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link to="/diagnostico">Ver Diagnóstico</Link>
        </Button>
      </div>

      {/* Filtros */}
      <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {CHIPS.map((c) => {
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
                {counts[c.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Lista de passos */}
      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((item) => (
          <StepCard
            key={item.step.id}
            item={item}
            recommended={recommendedId === item.step.id}
            onRefresh={refresh}
          />
        ))}
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-surface-muted p-6 text-center text-sm text-muted-foreground md:col-span-2">
            Nenhum passo nesta categoria.
          </div>
        )}
      </div>
    </PageContainer>
  );
}

// Avoid unused-warning if SETUP_STEPS export changes upstream.
void SETUP_STEPS;
void (null as SetupStepId | null);
