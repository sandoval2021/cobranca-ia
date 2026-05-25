import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { applyRevendaVariables } from "@/lib/revenda-settings";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import {
  listImportScheduleItems,
  updateImportScheduleStatus,
  buildScheduleTxt,
  matchesChip,
  CHIP_LABEL,
  GROUP_LABEL,
  fmtBRLPublic,
  fmtDateBRPublic,
  IMPORT_SCHEDULE_EVENT,
  type ScheduleItem,
  type ChipKey,
  type DispatchGroup,
} from "@/lib/import-schedule";

type Props = {
  /** Texto do título da seção. */
  title?: string;
  /** Texto auxiliar. */
  subtitle?: string;
  /** Filtros pré-aplicados (apenas alguns chips). */
  restrictTo?: ChipKey[];
  /** Chip inicial selecionado. */
  initialChip?: ChipKey;
  /** Mostrar botão de exportar TXT. */
  showExport?: boolean;
  /** Quando vazio, mostrar mensagem amigável. Se false, esconde a seção inteira. */
  hideWhenEmpty?: boolean;
};

export function ImportAgendaSection({
  title = "Agenda da importação",
  subtitle = "Itens locais gerados pela última importação. Nada é enviado automaticamente.",
  restrictTo,
  initialChip = "todos",
  showExport = true,
  hideWhenEmpty = false,
}: Props) {
  const [items, setItems] = useState<ScheduleItem[]>(() => listImportScheduleItems());
  const [chip, setChip] = useState<ChipKey>(initialChip);
  const [revealId, setRevealId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setItems(listImportScheduleItems());
  }, []);

  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener(IMPORT_SCHEDULE_EVENT, onChange as EventListener);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(IMPORT_SCHEDULE_EVENT, onChange as EventListener);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  const chipKeys: ChipKey[] = useMemo(() => {
    const all = Object.keys(CHIP_LABEL) as ChipKey[];
    if (!restrictTo || restrictTo.length === 0) return all;
    return all.filter((k) => restrictTo.includes(k));
  }, [restrictTo]);

  const counts = useMemo(() => {
    const c: Record<ChipKey, number> = {
      todos: 0, hoje: 0, amanha: 0, prox7: 0, vencidos: 0, recuperar: 0,
      inativos: 0, bloqueados: 0, copiados: 0, pendentes: 0, ignorados: 0, revisados: 0,
    };
    for (const it of items) for (const k of chipKeys) if (matchesChip(it, k)) c[k]++;
    return c;
  }, [items, chipKeys]);

  const filtered = useMemo(
    () => items.filter((it) => matchesChip(it, chip)),
    [items, chip],
  );

  function updateStatus(it: ScheduleItem, status: ScheduleItem["status"]) {
    updateImportScheduleStatus(it, status);
    setItems((prev) =>
      prev.map((x) =>
        x.whatsapp === it.whatsapp && x.due_date === it.due_date && x.kind === it.kind
          ? { ...x, status }
          : x,
      ),
    );
  }

  async function copyMessage(it: ScheduleItem) {
    if (!it.message) {
      toast.error("Sem mensagem para copiar.");
      return;
    }
    try {
      await navigator.clipboard.writeText(applyRevendaVariables(it.message));
      updateStatus(it, "copiado");
      toast.success("Mensagem copiada");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  async function copyAllVisible() {
    const list = filtered.filter((i) => i.message);
    if (list.length === 0) {
      toast.error("Nada para copiar no filtro atual.");
      return;
    }
    const txt = list
      .map(
        (it) =>
          `# ${it.name} (${it.whatsapp ?? "sem whatsapp"})\n${applyRevendaVariables(it.message ?? "")}`,
      )
      .join("\n\n---\n\n");
    try {
      await navigator.clipboard.writeText(txt);
      toast.success(`Copiadas ${list.length} mensagens`);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  function exportTxt() {
    if (items.length === 0) {
      toast.error("Sem agenda importada para exportar.");
      return;
    }
    const txt = buildScheduleTxt(items);
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const d = new Date();
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    a.href = url;
    a.download = `agenda-do-dia-importados-cobranca-ia-${ymd}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Agenda exportada");
  }

  const groupsOrder: { key: DispatchGroup; title: string }[] = [
    { key: "hoje", title: GROUP_LABEL.hoje },
    { key: "amanha", title: GROUP_LABEL.amanha },
    { key: "prox7", title: GROUP_LABEL.prox7 },
    { key: "recuperacao", title: GROUP_LABEL.recuperacao },
    { key: "bloqueados", title: GROUP_LABEL.bloqueados },
  ];

  if (items.length === 0 && hideWhenEmpty) return null;

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Agenda usando regras locais de disparo.{" "}
            <Link to="/regras-disparo" className="underline underline-offset-2 hover:text-foreground">
              Editar regras
            </Link>
          </p>
          {items.length > 0 && (
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="rounded-full border border-dashed border-border bg-muted/40 px-2 py-0.5 text-[10px]">
                Sem servidor
              </span>
              <span>
                A agenda da importação não possui vínculo seguro com tela/servidor; mantido como “Sem servidor” para evitar erro.
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={copyAllVisible}>
            Copiar todas
          </Button>
          {showExport && (
            <Button size="sm" variant="outline" onClick={exportTxt}>
              Exportar agenda do dia
            </Button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Nenhuma agenda importada ainda. Vá em <span className="font-medium">Importar clientes</span> e gere uma agenda local.
        </p>
      ) : (
        <>
          <div className="mb-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {chipKeys.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setChip(k)}
                className={
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
                  (chip === k
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-accent")
                }
              >
                {CHIP_LABEL[k]}
                <span className="ml-1 opacity-70">({counts[k]})</span>
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {groupsOrder.map((g) => {
              const list = filtered.filter((i) => i.group === g.key);
              if (list.length === 0) return null;
              return (
                <div key={g.key}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.title} <span className="opacity-60">({list.length})</span>
                  </div>
                  <div className="space-y-2">
                    {list.map((it) => (
                      <AgendaCard
                        key={it.id}
                        item={it}
                        revealOpen={revealId === it.id}
                        onToggleReveal={() =>
                          setRevealId((c) => (c === it.id ? null : it.id))
                        }
                        onCopy={() => copyMessage(it)}
                        onMarkCopied={() => updateStatus(it, "copiado")}
                        onIgnore={() => updateStatus(it, "ignorado")}
                        onReview={() => updateStatus(it, "revisar")}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                Nenhum item no filtro selecionado.
              </p>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

function AgendaCard({
  item,
  revealOpen,
  onToggleReveal,
  onCopy,
  onMarkCopied,
  onIgnore,
  onReview,
}: {
  item: ScheduleItem;
  revealOpen: boolean;
  onToggleReveal: () => void;
  onCopy: () => void;
  onMarkCopied: () => void;
  onIgnore: () => void;
  onReview: () => void;
}) {
  const priorityCls =
    item.priority === "alta"
      ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
      : item.priority === "media"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"
      : item.priority === "baixa"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
      : "bg-muted text-muted-foreground";
  const statusCls =
    item.status === "copiado"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
      : item.status === "ignorado"
      ? "bg-muted text-muted-foreground"
      : item.status === "bloqueado"
      ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
      : item.status === "revisar"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"
      : "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300";

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{item.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {item.whatsapp ?? "Sem WhatsApp"} · Venc.{" "}
            {fmtDateBRPublic(item.due_date)} · {fmtBRLPublic(item.amount_cents)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <span className={"rounded-full px-2 py-0.5 text-[10px] font-medium " + priorityCls}>
            {item.priority}
          </span>
          <span className={"rounded-full px-2 py-0.5 text-[10px] font-medium " + statusCls}>
            {item.status}
          </span>
        </div>
      </div>
      <p className="mb-1 text-xs">
        <span className="font-medium">{item.kindLabel}</span>
        <span className="text-muted-foreground"> · {item.reason}</span>
      </p>
      {item.warning && (
        <p className="mb-2 rounded-md border border-amber-300/50 bg-amber-50 px-2 py-1 text-[11px] text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-100">
          ⚠ {item.warning}
        </p>
      )}
      {item.message ? (
        <>
          {revealOpen && (
            <pre className="mb-2 whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-2 text-[11px] text-foreground">
              {item.message}
            </pre>
          )}
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" onClick={onCopy}>Copiar mensagem</Button>
            <Button size="sm" variant="outline" onClick={onToggleReveal}>
              {revealOpen ? "Ocultar" : "Ver mensagem"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onMarkCopied}>Marcar copiado</Button>
            <Button size="sm" variant="ghost" onClick={onIgnore}>Ignorar</Button>
            <Button size="sm" variant="ghost" onClick={onReview}>Revisar</Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="ghost" onClick={onReview}>Marcar revisado</Button>
          <Button size="sm" variant="ghost" onClick={onIgnore}>Ignorar</Button>
        </div>
      )}
    </div>
  );
}
