import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, X, Sparkles, MessageSquare, Save } from "lucide-react";

import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  listServices, saveService, updateService, deleteService, formatBRL,
  seedDefaultPlansIfEmpty,
  addServiceMessage, updateServiceMessage, removeServiceMessage,
  renderTemplate, DEFAULT_COBRANCA, DEFAULT_ACOMP,
  SERVICES_EVENT, type ServiceItem, type ServiceMessage, type ServiceMessageKind,
} from "@/lib/services-catalog";

export const Route = createFileRoute("/cadastros-servicos")({
  component: CadastrosServicosPage,
});

function CadastrosServicosPage() {
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ServiceItem | null>(null);

  const reload = () => setItems(listServices());

  useEffect(() => {
    reload();
    const h = () => reload();
    window.addEventListener(SERVICES_EVENT, h);
    return () => window.removeEventListener(SERVICES_EVENT, h);
  }, []);

  function openNew() {
    const created = saveService({
      nome: "Novo plano",
      preco_cents: 0,
      telas: 1,
      meses: 1,
    });
    setEditingId(created.id);
    setOpen(true);
  }

  function openEdit(s: ServiceItem) {
    setEditingId(s.id);
    setOpen(true);
  }

  function toggleAtivo(s: ServiceItem) {
    updateService(s.id, { ativo: !s.ativo });
    reload();
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    deleteService(pendingDelete.id);
    toast.success("Plano excluído");
    setPendingDelete(null);
    reload();
  }

  function seed() {
    const n = seedDefaultPlansIfEmpty();
    if (n > 0) toast.success(`${n} planos criados`);
    else toast.info("Catálogo já possui planos. Apague-os primeiro para semear.");
    reload();
  }

  return (
    <PageContainer>
      <SectionHeader
        title="Cadastros · Serviços / Planos"
        subtitle="Cada plano tem seu valor e mensagens próprias. Você pode criar quantos acompanhamentos quiser (30, 60, 90 dias…). A renovação é única e global."
        action={
          <div className="flex gap-2">
            {items.length === 0 && (
              <Button variant="outline" onClick={seed} className="gap-2">
                <Sparkles className="h-4 w-4" /> Usar planos sugeridos
              </Button>
            )}
            <Button onClick={openNew} className="gap-2">
              <Plus className="h-4 w-4" /> Novo plano
            </Button>
          </div>
        }
      />

      <div className="space-y-2">
        {items.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Nenhum plano cadastrado.
          </Card>
        )}
        {items.map((s) => (
          <Card key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="font-medium">{s.nome}</p>
              <p className="text-sm text-muted-foreground">
                {formatBRL(s.preco_cents)} ·{" "}
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> {s.messages.length} mensagem{s.messages.length === 1 ? "" : "s"}
                </span>{" "}·{" "}
                <span className={s.ativo ? "text-success" : "text-muted-foreground"}>
                  {s.ativo ? "Ativo" : "Inativo"}
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => toggleAtivo(s)} className="gap-1">
                {s.ativo ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                {s.ativo ? "Inativar" : "Ativar"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => openEdit(s)} className="gap-1">
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPendingDelete(s)} className="gap-1 text-destructive">
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <PlanEditorDialog
        open={open}
        serviceId={editingId}
        onClose={() => {
          setOpen(false);
          setEditingId(null);
          reload();
        }}
      />
    </PageContainer>
  );
}

// ============================================================================
// Editor de plano (dialog com lista de mensagens + editor com prévia)
// ============================================================================

function PlanEditorDialog({
  open, serviceId, onClose,
}: { open: boolean; serviceId: string | null; onClose: () => void }) {
  const [service, setService] = useState<ServiceItem | null>(null);
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !serviceId) return;
    const s = listServices().find((x) => x.id === serviceId) ?? null;
    setService(s);
    setSelectedMsgId(s?.messages[0]?.id ?? null);
    const h = () => {
      const fresh = listServices().find((x) => x.id === serviceId) ?? null;
      setService(fresh);
    };
    window.addEventListener(SERVICES_EVENT, h);
    return () => window.removeEventListener(SERVICES_EVENT, h);
  }, [open, serviceId]);

  if (!service) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Carregando…</DialogTitle></DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const selectedMsg = service.messages.find((m) => m.id === selectedMsgId) ?? null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader className="space-y-0.5">
          <DialogTitle className="text-base">Editar plano</DialogTitle>
          <DialogDescription className="text-[11px]">
            Variáveis: <code>{"{nome}"}</code>, <code>{"{plano}"}</code>, <code>{"{valor}"}</code>, <code>{"{telas}"}</code>, <code>{"{meses}"}</code>, <code>{"{vencimento}"}</code>.
          </DialogDescription>
        </DialogHeader>

        <PlanInfoEditor service={service} onSaved={onClose} />

        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mensagens do plano</h3>
          <MessagesList
            service={service}
            selectedId={selectedMsgId}
            onSelect={setSelectedMsgId}
          />
        </div>

        {selectedMsg && (
          <MessageEditor
            key={selectedMsg.id}
            service={service}
            message={selectedMsg}
          />
        )}

        <DialogFooter className="pt-1">
          <Button size="sm" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlanInfoEditor({ service, onSaved }: { service: ServiceItem; onSaved: () => void }) {
  const [nome, setNome] = useState(service.nome);
  const [valor, setValor] = useState((service.preco_cents / 100).toFixed(2).replace(".", ","));
  const [telas, setTelas] = useState(String(service.telas));
  const [meses, setMeses] = useState(String(service.meses));

  function submit() {
    const n = nome.trim();
    if (!n) { toast.error("Informe o nome do plano."); return; }
    const num = Number((valor || "").replace(/\./g, "").replace(",", "."));
    if (!isFinite(num) || num < 0) { toast.error("Valor inválido."); return; }
    updateService(service.id, {
      nome: n,
      preco_cents: Math.round(num * 100),
      telas: Math.max(1, Math.round(Number(telas) || 1)),
      meses: Math.max(1, Math.round(Number(meses) || 1)),
    });
    toast.success("Plano salvo");
  }

  return (
    <div className="rounded-lg border border-border bg-card p-2.5">
      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-12 sm:col-span-5">
          <Label className="text-[11px]">Nome do plano</Label>
          <Input className="h-8" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Plano R$ 12" />
        </div>
        <div className="col-span-3 sm:col-span-2">
          <Label className="text-[11px]">Telas</Label>
          <Input className="h-8" type="number" min={1} max={10} value={telas} onChange={(e) => setTelas(e.target.value)} />
        </div>
        <div className="col-span-3 sm:col-span-2">
          <Label className="text-[11px]">Meses</Label>
          <Input className="h-8" type="number" min={1} max={24} value={meses} onChange={(e) => setMeses(e.target.value)} />
        </div>
        <div className="col-span-3 sm:col-span-2">
          <Label className="text-[11px]">Valor (R$)</Label>
          <Input className="h-8" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="12,00" />
        </div>
        <div className="col-span-3 sm:col-span-1 flex justify-end">
          <Button size="sm" onClick={submit} className="h-8 gap-1 px-2" title="Salvar dados do plano">
            <Save className="h-3.5 w-3.5" /> Salvar
          </Button>
        </div>
      </div>
      <p className="mt-1.5 text-[10px] leading-tight text-muted-foreground">
        Coloque tudo dentro da mensagem (1/3/6/12 meses, 1 e 2 telas, valores) — todos os clientes desse plano receberão o mesmo texto.
      </p>
    </div>
  );
}

type Direction = "antes" | "no_dia" | "depois";

function describeOffset(days: number): string {
  if (days === 0) return "No dia do vencimento";
  const abs = Math.abs(days);
  const p = abs === 1 ? "" : "s";
  return days < 0 ? `${abs} dia${p} ANTES do vencimento` : `${abs} dia${p} DEPOIS do vencimento`;
}

function MessagesList({
  service, selectedId, onSelect,
}: { service: ServiceItem; selectedId: string | null; onSelect: (id: string) => void }) {
  const [direction, setDirection] = useState<Direction>("depois");
  const [newDays, setNewDays] = useState("3");

  function add() {
    let days = 0;
    if (direction === "no_dia") days = 0;
    else {
      const n = Math.max(1, Math.round(Number(newDays) || 1));
      days = direction === "antes" ? -n : n;
    }
    const kind: ServiceMessageKind = days === 0 ? "cobranca" : "acompanhamento";
    const created = addServiceMessage(service.id, { kind, offset_days: days });
    if (created) {
      onSelect(created.id);
      toast.success("Mensagem adicionada");
    }
  }

  function del(m: ServiceMessage) {
    if (service.messages.length <= 1) {
      toast.error("Um plano precisa ter pelo menos uma mensagem.");
      return;
    }
    if (!confirm(`Excluir "${m.label}"?`)) return;
    removeServiceMessage(service.id, m.id);
    const remaining = service.messages.filter((x) => x.id !== m.id);
    onSelect(remaining[0]?.id ?? "");
  }

  const sorted = [...service.messages].sort((a, b) => a.offset_days - b.offset_days);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {sorted.map((m) => (
          <div key={m.id} className="flex items-center">
            <button
              type="button"
              onClick={() => onSelect(m.id)}
              title={describeOffset(m.offset_days)}
              className={`rounded-l-full border border-r-0 px-3 py-1 text-xs transition ${
                selectedId === m.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-muted"
              }`}
            >
              {m.offset_days === 0 ? "No dia" : m.offset_days < 0 ? `${Math.abs(m.offset_days)}d antes` : `${m.offset_days}d depois`}
            </button>
            <button
              type="button"
              onClick={() => del(m)}
              className="rounded-r-full border border-l-0 border-border bg-card px-2 py-1 text-xs text-destructive hover:bg-muted"
              title="Remover"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-2">
        <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Adicionar nova mensagem — quando enviar?</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[160px]">
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={direction}
              onChange={(e) => setDirection(e.target.value as Direction)}
            >
              <option value="antes">Antes do vencimento</option>
              <option value="no_dia">No dia do vencimento (0)</option>
              <option value="depois">Depois do vencimento</option>
            </select>
          </div>
          {direction !== "no_dia" && (
            <div className="w-20">
              <Input
                type="number"
                min={1}
                value={newDays}
                onChange={(e) => setNewDays(e.target.value)}
                className="h-9"
                aria-label="Quantos dias"
              />
            </div>
          )}
          <span className="text-[11px] text-muted-foreground">
            {direction === "no_dia" ? "= 0 dias" : direction === "antes" ? "dias antes" : "dias depois"}
          </span>
          <Button size="sm" onClick={add} className="gap-1.5 h-9 ml-auto">
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>
      </div>
    </div>
  );
}


function MessageEditor({ service, message }: { service: ServiceItem; message: ServiceMessage }) {
  const [template, setTemplate] = useState(
    message.template || (message.kind === "cobranca" ? DEFAULT_COBRANCA : DEFAULT_ACOMP),
  );
  const initialDir: Direction = message.offset_days === 0 ? "no_dia" : message.offset_days < 0 ? "antes" : "depois";
  const [direction, setDirection] = useState<Direction>(initialDir);
  const [days, setDays] = useState(String(Math.abs(message.offset_days) || 1));

  const currentOffset = direction === "no_dia" ? 0 : (direction === "antes" ? -1 : 1) * Math.max(1, Math.round(Number(days) || 1));

  const preview = useMemo(
    () =>
      renderTemplate(template, {
        nome: "Cliente Exemplo",
        plano: service.nome,
        valor: formatBRL(service.preco_cents),
        telas: service.telas,
        meses: service.meses,
        vencimento: "15/12/2025",
      }),
    [template, service],
  );

  function save() {
    updateServiceMessage(service.id, message.id, {
      template,
      offset_days: currentOffset,
      label: "",
    });
    toast.success("Mensagem salva");
  }

  return (
    <div className="space-y-2.5 rounded-lg border-2 border-primary/40 bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <div className="text-sm">
          <span className="text-muted-foreground">Editando: </span>
          <strong>{describeOffset(currentOffset)}</strong>
        </div>
        <div className="flex items-center gap-1.5">
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={direction}
            onChange={(e) => setDirection(e.target.value as Direction)}
          >
            <option value="antes">Antes</option>
            <option value="no_dia">No dia (0)</option>
            <option value="depois">Depois</option>
          </select>
          {direction !== "no_dia" && (
            <Input
              type="number"
              min={1}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="h-8 w-16"
              aria-label="Dias"
            />
          )}
          <span className="text-[11px] text-muted-foreground">dias</span>
        </div>
      </div>

      <div>
        <Label className="text-xs">Texto da mensagem (use variáveis: {"{nome}"}, {"{valor}"}, {"{vencimento}"}…)</Label>
        <Textarea
          rows={5}
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          className="font-mono text-xs"
        />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Pré-visualização (como vai chegar no WhatsApp)</Label>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-2.5">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{preview}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={save} className="gap-1.5">
          <Save className="h-3.5 w-3.5" /> Salvar mensagem
        </Button>
      </div>
    </div>
  );
}
