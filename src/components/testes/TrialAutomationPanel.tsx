// Painel de automação dos testes — UI direto na tela /testes.
// Usa o storage existente de auto-templates (categoria "teste").
// Cada template pode ser vinculado a um Serviço/Plano (scope = service.id)
// para que {servico} e {valor} sejam substituídos na hora do envio.
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Zap, Clock, Pencil, ExternalLink, Eye, RotateCcw, Package } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import {
  listTemplates, upsertTemplate, restoreDefault, previewTemplate,
  VARIABLES_TESTE, type AutoTemplate,
} from "@/lib/auto-templates";
import { listActiveServices, type ServiceItem, SERVICES_EVENT } from "@/lib/services-catalog";

function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function serviceOverrides(s: ServiceItem | null): Record<string, string> {
  if (!s) return {};
  return { "{servico}": s.nome, "{valor}": brl(s.preco_cents) };
}

function formatOffset(hours?: number): string {
  if (hours == null) return "—";
  if (hours < 24) return `${hours}h após início`;
  const d = Math.round(hours / 24);
  return `${d} ${d === 1 ? "dia" : "dias"} após início`;
}

export function TrialAutomationPanel() {
  const [templates, setTemplates] = useState<AutoTemplate[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [editing, setEditing] = useState<AutoTemplate | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const refresh = () => {
    const all = listTemplates().filter((t) => t.category === "teste");
    all.sort((a, b) => (a.offsetHours ?? 0) - (b.offsetHours ?? 0));
    setTemplates(all);
  };

  const refreshServices = () => setServices(listActiveServices());

  useEffect(() => {
    refresh();
    refreshServices();
    const onChange = () => refresh();
    const onSvc = () => refreshServices();
    window.addEventListener("cobraeasy:auto-templates-changed", onChange);
    window.addEventListener(SERVICES_EVENT, onSvc);
    return () => {
      window.removeEventListener("cobraeasy:auto-templates-changed", onChange);
      window.removeEventListener(SERVICES_EVENT, onSvc);
    };
  }, []);

  const editingService = useMemo(
    () => services.find((s) => s.id === editing?.scope) ?? null,
    [services, editing],
  );

  const activeCount = useMemo(() => templates.filter((t) => t.active).length, [templates]);
  const allOn = templates.length > 0 && activeCount === templates.length;
  const allOff = activeCount === 0;

  const toggleActive = (t: AutoTemplate, next: boolean) => {
    upsertTemplate({ ...t, active: next });
    refresh();
  };

  const setAll = (next: boolean) => {
    for (const t of templates) {
      if (t.active !== next) upsertTemplate({ ...t, active: next });
    }
    refresh();
    toast.success(next ? "Automação ativada para todos os tempos" : "Automação desativada");
  };

  const setWindow = (t: AutoTemplate, field: "sendStart" | "sendEnd", value: string) => {
    upsertTemplate({ ...t, [field]: value });
    refresh();
  };

  const openEdit = (t: AutoTemplate) => {
    setEditing(t);
    setDraftBody(t.body ?? "");
  };

  const saveEdit = () => {
    if (!editing) return;
    upsertTemplate({ ...editing, body: draftBody });
    toast.success("Mensagem salva");
    setEditing(null);
    refresh();
  };

  const restoreEdit = () => {
    if (!editing) return;
    restoreDefault(editing.key);
    toast.success("Mensagem restaurada para o padrão");
    setEditing(null);
    refresh();
  };

  const statusLabel = allOn
    ? "Modo automático: ativo em todos os horários"
    : allOff
      ? "Automação desligada"
      : `Modo automático: ${activeCount} de ${templates.length} horários ativos`;

  return (
    <>
      <Card className="mb-4 overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex flex-col gap-2 border-b bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <div className={cn(
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              allOff ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
            )}>
              <Zap className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium">Automação dos testes</div>
              <div className="text-xs text-muted-foreground">{statusLabel}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:flex-shrink-0">
            <Button
              size="sm"
              variant={allOff ? "default" : "outline"}
              onClick={() => setAll(true)}
              disabled={allOn}
              className="h-8 text-xs"
            >
              Ativar tudo
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAll(false)}
              disabled={allOff}
              className="h-8 text-xs"
            >
              Desativar tudo
            </Button>
          </div>
        </div>

        {/* Grade compacta — um do lado do outro */}
        <div className="grid grid-cols-2 gap-2 p-2">
          {templates.length === 0 && (
            <div className="col-span-2 p-4 text-sm text-muted-foreground">
              Nenhum template de teste encontrado.
            </div>
          )}
          {templates.map((t) => (
            <div
              key={t.id}
              className={cn(
                "rounded-lg border bg-card p-2.5 transition-colors",
                t.active ? "border-primary/30 bg-primary/5" : "border-border",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold leading-tight">{t.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatOffset(t.offsetHours)}
                  </div>
                </div>
                <Switch
                  checked={t.active}
                  onCheckedChange={(v) => toggleActive(t, v)}
                  aria-label={`Ativar ${t.name}`}
                />
              </div>

              <div className="mt-2 flex items-center gap-1 text-[11px]">
                <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
                <Input
                  type="time"
                  value={t.sendStart ?? "09:00"}
                  onChange={(e) => setWindow(t, "sendStart", e.target.value)}
                  disabled={!t.active}
                  className="h-7 flex-1 min-w-0 px-1.5 text-[11px]"
                />
                <span className="text-muted-foreground">→</span>
                <Input
                  type="time"
                  value={t.sendEnd ?? "20:00"}
                  onChange={(e) => setWindow(t, "sendEnd", e.target.value)}
                  disabled={!t.active}
                  className="h-7 flex-1 min-w-0 px-1.5 text-[11px]"
                />
              </div>

              {/* Vincular serviço/plano usado em {servico} e {valor} */}
              <div className="mt-2 flex items-center gap-1 text-[11px]">
                <Package className="h-3 w-3 shrink-0 text-muted-foreground" />
                <Select
                  value={t.scope ?? "__none"}
                  onValueChange={(v) => {
                    upsertTemplate({ ...t, scope: v === "__none" ? undefined : v });
                    refresh();
                  }}
                >
                  <SelectTrigger className="h-7 flex-1 min-w-0 px-1.5 text-[11px]">
                    <SelectValue placeholder="Vincular serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sem serviço vinculado</SelectItem>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome} — R$ {brl(s.preco_cents)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => openEdit(t)}
                className="mt-2 h-7 w-full gap-1 px-2 text-[11px]"
              >
                <Pencil className="h-3 w-3" />
                Editar mensagem
              </Button>
            </div>
          ))}
        </div>


        {/* Rodapé */}
        <div className="flex items-center justify-between gap-2 border-t bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
          <span>As mensagens só são enviadas dentro da janela de horário definida.</span>
          <Button asChild size="sm" variant="ghost" className="h-7 gap-1 text-[11px]">
            <Link to="/templates-automaticos">
              Avançado <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </Card>

      {/* Dialog: editar mensagem */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar mensagem — {editing?.name}</DialogTitle>
            <DialogDescription>
              Disparada {editing ? formatOffset(editing.offsetHours).toLowerCase() : ""}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-xs">Mensagem</Label>
              <Textarea
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                rows={10}
                className="mt-1 font-mono text-sm"
              />
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">Variáveis disponíveis:</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {VARIABLES_TESTE.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setDraftBody((b) => b + v)}
                    className="rounded border bg-muted/40 px-1.5 py-0.5 text-[11px] hover:bg-muted"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setPreviewOpen(true)}
              className="h-8 gap-1 text-xs"
            >
              <Eye className="h-3.5 w-3.5" /> Pré-visualizar
            </Button>
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={restoreEdit}
              className="gap-1 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrão
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={saveEdit}>Salvar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pré-visualização</DialogTitle>
            <DialogDescription>Exemplo com dados fictícios.</DialogDescription>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-3 text-sm">
            {previewTemplate(draftBody, "teste", serviceOverrides(editingService))}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
}
