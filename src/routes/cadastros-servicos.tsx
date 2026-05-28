import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Plus, Trash2, Pencil, Sparkles, Save, MessageCircle, Check,
  Users, Clock, Eye, X,
} from "lucide-react";

import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { HelpTip } from "@/components/ui-premium/HelpTip";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

import {
  listServices, saveService, updateService, deleteService, formatBRL,
  seedDefaultPlansIfEmpty,
  addServiceMessage, updateServiceMessage, removeServiceMessage,
  renderTemplate, DEFAULT_COBRANCA,
  SERVICES_EVENT, type ServiceItem, type ServiceMessage,
} from "@/lib/services-catalog";
import { ensureCanEditService } from "@/lib/plan-gate";

export const Route = createFileRoute("/cadastros-servicos")({
  component: CadastrosServicosPage,
});

// ============================================================================
// PAGE
// ============================================================================

function CadastrosServicosPage() {
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planDialog, setPlanDialog] = useState<{ open: boolean; service: ServiceItem | null }>({
    open: false, service: null,
  });
  const [pendingDelete, setPendingDelete] = useState<ServiceItem | null>(null);

  // Message composer state (one "message" can be saved into many plans)
  const [editingMsg, setEditingMsg] = useState<{ planId: string; messageId: string } | null>(null);

  const reload = () => setItems(listServices());

  useEffect(() => {
    reload();
    const h = () => reload();
    window.addEventListener(SERVICES_EVENT, h);
    return () => window.removeEventListener(SERVICES_EVENT, h);
  }, []);

  useEffect(() => {
    // garante seleção válida
    if (selectedPlanId && !items.find((p) => p.id === selectedPlanId)) {
      setSelectedPlanId(null);
    }
  }, [items, selectedPlanId]);

  function openNewPlan() {
    if (!ensureCanEditService().allowed) return;
    setPlanDialog({ open: true, service: null });
  }
  function openEditPlan(s: ServiceItem) {
    setPlanDialog({ open: true, service: s });
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
    else toast.info("Catálogo já possui planos.");
    reload();
  }

  // Listagem unificada de mensagens (agrupadas por offset+template, mostrando quais planos cobrem)
  const groupedMessages = useMemo(() => groupMessages(items), [items]);

  return (
    <PageContainer>
      {/* =================== BLOCO 1 — PLANOS =================== */}
      <SectionHeader
        title="Planos de cobrança"
        subtitle="Cadastre os planos que você vende para seus clientes."
        hint="Cada plano tem nome, valor, quantidade de telas e duração. Você pode criar quantos planos quiser."
        action={
          <div className="flex flex-wrap gap-2">
            {items.length === 0 && (
              <Button variant="outline" size="sm" onClick={seed} className="gap-1.5">
                <Sparkles className="h-4 w-4" /> Usar sugeridos
              </Button>
            )}
            <Button size="sm" onClick={openNewPlan} className="gap-1.5">
              <Plus className="h-4 w-4" /> Novo plano
            </Button>
          </div>
        }
      />

      {items.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhum plano cadastrado ainda. Clique em <strong>Novo plano</strong> para começar.
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
          {items.map((s) => {
            const active = selectedPlanId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedPlanId(active ? null : s.id)}
                className={cn(
                  "group relative flex flex-col gap-1 rounded-2xl border-2 bg-card p-3 text-left shadow-sm transition-all",
                  "hover:border-primary/60 hover:shadow-md",
                  active
                    ? "border-primary ring-2 ring-primary/30 shadow-md"
                    : "border-border",
                )}
              >
                {active && (
                  <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                )}
                <p className="truncate pr-6 text-sm font-semibold leading-tight">{s.nome}</p>
                <p className="text-[11px] text-muted-foreground">
                  {s.telas} {s.telas === 1 ? "tela" : "telas"} · {s.meses * 30} dias
                </p>
                <p className="mt-0.5 text-base font-bold tracking-tight text-primary">
                  {formatBRL(s.preco_cents)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  <MessageCircle className="mr-0.5 inline h-2.5 w-2.5" />
                  {s.messages.length} {s.messages.length === 1 ? "mensagem" : "mensagens"}
                </p>
                <div className="mt-1.5 flex gap-1">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openEditPlan(s); }}
                    className="flex flex-1 items-center justify-center gap-1 rounded-md border border-border bg-background px-1.5 py-1 text-[11px] hover:bg-muted"
                  >
                    <Pencil className="h-3 w-3" /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPendingDelete(s); }}
                    className="flex items-center justify-center rounded-md border border-border bg-background px-1.5 py-1 text-[11px] text-destructive hover:bg-destructive/10"
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* =================== BLOCO 2 — MENSAGENS AUTOMÁTICAS =================== */}
      <div className="mt-8">
        <SectionHeader
          title="Mensagens automáticas"
          subtitle="Configure quando e para quais planos cada mensagem será enviada."
          hint="As mensagens são enviadas automaticamente pelo WhatsApp nos dias configurados em relação ao vencimento."
        />

        {items.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Cadastre pelo menos um plano para configurar mensagens.
          </Card>
        ) : (
          <MessageComposer
            plans={items}
            defaultPlanIds={selectedPlanId ? [selectedPlanId] : []}
            editing={editingMsg}
            onClearEditing={() => setEditingMsg(null)}
            onSaved={reload}
          />
        )}

        {/* Mensagens já configuradas */}
        {groupedMessages.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Mensagens configuradas
            </h3>
            <div className="space-y-2">
              {groupedMessages.map((g) => (
                <ConfiguredMessageRow
                  key={g.key}
                  group={g}
                  onEdit={(planId, messageId) => {
                    setEditingMsg({ planId, messageId });
                    document.getElementById("msg-composer")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  onDelete={(planId, messageId) => {
                    removeServiceMessage(planId, messageId);
                    toast.success("Mensagem removida");
                    reload();
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ====== Dialogs ====== */}
      <PlanFormDialog
        open={planDialog.open}
        service={planDialog.service}
        onClose={() => setPlanDialog({ open: false, service: null })}
        onSaved={() => { setPlanDialog({ open: false, service: null }); reload(); }}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong className="text-foreground">{pendingDelete?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

// ============================================================================
// MESSAGE COMPOSER (passo 1, 2, 3, 4)
// ============================================================================

const TIMING_CHIPS: Array<{ days: number; label: string; tone: "antes" | "no_dia" | "depois" }> = [
  { days: -7, label: "7 dias antes", tone: "antes" },
  { days: -3, label: "3 dias antes", tone: "antes" },
  { days: -1, label: "1 dia antes", tone: "antes" },
  { days: 0, label: "No vencimento", tone: "no_dia" },
  { days: 1, label: "1 dia depois", tone: "depois" },
  { days: 3, label: "3 dias depois", tone: "depois" },
  { days: 7, label: "7 dias depois", tone: "depois" },
  { days: 15, label: "15 dias depois", tone: "depois" },
];

const VARIABLES = [
  { key: "nome", label: "{nome}" },
  { key: "plano", label: "{plano}" },
  { key: "valor", label: "{valor}" },
  { key: "vencimento", label: "{vencimento}" },
  { key: "pix", label: "{pix}" },
  { key: "link_pagamento", label: "{link_pagamento}" },
];

function MessageComposer({
  plans, defaultPlanIds, editing, onClearEditing, onSaved,
}: {
  plans: ServiceItem[];
  defaultPlanIds: string[];
  editing: { planId: string; messageId: string } | null;
  onClearEditing: () => void;
  onSaved: () => void;
}) {
  const [selectedPlans, setSelectedPlans] = useState<string[]>(defaultPlanIds);
  const [offsetDays, setOffsetDays] = useState<number>(-3);
  const [template, setTemplate] = useState<string>(DEFAULT_COBRANCA);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  // ao mudar a seleção do card de plano, sincroniza
  useEffect(() => {
    if (!editing) setSelectedPlans(defaultPlanIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultPlanIds.join(",")]);

  // Modo edição: carrega a mensagem existente
  useEffect(() => {
    if (!editing) return;
    const plan = plans.find((p) => p.id === editing.planId);
    const msg = plan?.messages.find((m) => m.id === editing.messageId);
    if (msg) {
      setSelectedPlans([editing.planId]);
      setOffsetDays(msg.offset_days);
      setTemplate(msg.template || DEFAULT_COBRANCA);
    }
  }, [editing, plans]);

  const isEditing = !!editing;

  function togglePlan(id: string) {
    setSelectedPlans((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }
  function selectAll() { setSelectedPlans(plans.map((p) => p.id)); }
  function clearSel() { setSelectedPlans([]); }

  function insertVar(v: string) {
    const ta = textRef.current;
    const token = `{${v}}`;
    if (!ta) { setTemplate((t) => t + token); return; }
    const start = ta.selectionStart ?? template.length;
    const end = ta.selectionEnd ?? template.length;
    const next = template.slice(0, start) + token + template.slice(end);
    setTemplate(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  function reset() {
    setSelectedPlans(defaultPlanIds);
    setOffsetDays(-3);
    setTemplate(DEFAULT_COBRANCA);
    onClearEditing();
  }

  function save() {
    if (!ensureCanEditService().allowed) return;
    if (selectedPlans.length === 0) { toast.error("Selecione pelo menos um plano."); return; }
    if (!template.trim()) { toast.error("Escreva o texto da mensagem."); return; }

    if (isEditing && editing) {
      // editar uma mensagem específica de um plano
      updateServiceMessage(editing.planId, editing.messageId, {
        template,
        offset_days: offsetDays,
        label: "",
      });
      // se o usuário marcou outros planos, cria a mesma mensagem neles também
      const extras = selectedPlans.filter((id) => id !== editing.planId);
      extras.forEach((pid) => {
        addServiceMessage(pid, { offset_days: offsetDays, template });
      });
      toast.success("Mensagem salva");
    } else {
      // criar em cada plano selecionado
      selectedPlans.forEach((pid) => {
        addServiceMessage(pid, { offset_days: offsetDays, template });
      });
      toast.success(
        selectedPlans.length === 1
          ? "Mensagem adicionada"
          : `Mensagem adicionada em ${selectedPlans.length} planos`,
      );
    }
    onSaved();
    reset();
  }

  // Preview
  const previewPlan = plans.find((p) => selectedPlans.includes(p.id)) ?? plans[0];
  const preview = useMemo(() => renderTemplate(template, {
    nome: "João",
    plano: previewPlan?.nome ?? "—",
    valor: previewPlan ? formatBRL(previewPlan.preco_cents) : "—",
    telas: previewPlan?.telas ?? 1,
    meses: previewPlan?.meses ?? 1,
    vencimento: "15/12/2026",
  }).replace(/\{pix\}/g, "00020126...PIX").replace(/\{link_pagamento\}/g, "https://pag.to/exemplo"),
  [template, previewPlan]);

  const timingDescription = describeTiming(offsetDays);

  return (
    <Card id="msg-composer" className="overflow-hidden border-2 border-primary/30 shadow-md">
      {isEditing && (
        <div className="flex items-center justify-between gap-2 border-b border-primary/30 bg-primary-soft px-3 py-1.5 text-xs">
          <span className="font-medium text-primary">Editando mensagem existente</span>
          <button onClick={reset} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" /> Cancelar edição
          </button>
        </div>
      )}

      <div className="space-y-5 p-4">
        {/* PASSO 1 — Quem recebe */}
        <Step number={1} icon={Users} title="Quem vai receber" hint="Escolha um ou vários planos. A mesma mensagem será aplicada a cada plano selecionado.">
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            <button type="button" onClick={selectAll} className="text-[11px] text-primary hover:underline">
              Selecionar todos
            </button>
            <span className="text-[11px] text-muted-foreground">·</span>
            <button type="button" onClick={clearSel} className="text-[11px] text-muted-foreground hover:underline">
              Limpar
            </button>
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {plans.map((p) => {
              const checked = selectedPlans.includes(p.id);
              return (
                <label
                  key={p.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border-2 px-2.5 py-2 transition-colors",
                    checked
                      ? "border-primary bg-primary-soft"
                      : "border-border bg-background hover:border-primary/40",
                  )}
                >
                  <Checkbox checked={checked} onCheckedChange={() => togglePlan(p.id)} />
                  <span className="flex-1 truncate text-sm font-medium">{p.nome}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatBRL(p.preco_cents)}</span>
                </label>
              );
            })}
          </div>
        </Step>

        {/* PASSO 2 — Quando enviar */}
        <Step number={2} icon={Clock} title="Quando enviar" hint="Em quantos dias em relação ao vencimento esta mensagem deve sair.">
          <div className="flex flex-wrap gap-1.5">
            {TIMING_CHIPS.map((c) => {
              const active = offsetDays === c.days;
              return (
                <button
                  key={c.days}
                  type="button"
                  onClick={() => setOffsetDays(c.days)}
                  className={cn(
                    "rounded-full border-2 px-3 py-1 text-xs font-medium transition-all",
                    active
                      ? toneActiveClass(c.tone)
                      : "border-border bg-background text-foreground hover:border-foreground/30",
                  )}
                >
                  <span className={cn("mr-1 inline-block h-1.5 w-1.5 rounded-full", toneDotClass(c.tone))} />
                  {c.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{timingDescription}</p>
        </Step>

        {/* PASSO 3 — Mensagem */}
        <Step number={3} icon={MessageCircle} title="Mensagem" hint="Use as variáveis abaixo para personalizar com nome do cliente, valor, vencimento, etc.">
          <div className="mb-1.5 flex flex-wrap gap-1">
            {VARIABLES.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertVar(v.key)}
                className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground hover:bg-primary hover:text-primary-foreground"
              >
                {v.label}
              </button>
            ))}
          </div>
          <Textarea
            ref={textRef}
            rows={5}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="text-sm"
            placeholder="Olá {nome}, tudo bem? Passando para lembrar do seu plano {plano}..."
          />
        </Step>

        {/* PASSO 4 — Preview */}
        <Step number={4} icon={Eye} title="Pré-visualização" hint="Veja como a mensagem vai chegar no WhatsApp do cliente.">
          <WhatsAppBubble text={preview} />
        </Step>

        {/* Salvar */}
        <div className="flex flex-col-reverse gap-2 border-t border-border pt-3 sm:flex-row sm:justify-end">
          {isEditing && (
            <Button variant="ghost" size="sm" onClick={reset}>Cancelar</Button>
          )}
          <Button size="sm" onClick={save} className="gap-1.5">
            <Save className="h-4 w-4" />
            {isEditing ? "Salvar alterações" : `Salvar mensagem${selectedPlans.length > 1 ? ` (${selectedPlans.length} planos)` : ""}`}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ============================================================================
// HELPERS UI
// ============================================================================

function Step({
  number, icon: Icon, title, hint, children,
}: {
  number: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {number}
        </span>
        <Icon className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">{title}</h4>
        {hint && <HelpTip text={hint} />}
      </div>
      {children}
    </div>
  );
}

function WhatsAppBubble({ text }: { text: string }) {
  return (
    <div
      className="rounded-xl p-3"
      style={{ background: "oklch(0.94 0.03 145)" }}
    >
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-white px-3 py-2 shadow-sm">
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-900">
          {text}
        </p>
        <p className="mt-1 text-right text-[10px] text-neutral-500">12:34 ✓✓</p>
      </div>
    </div>
  );
}

function toneActiveClass(tone: "antes" | "no_dia" | "depois") {
  if (tone === "antes") return "border-success bg-success text-success-foreground";
  if (tone === "no_dia") return "border-warning bg-warning text-warning-foreground";
  return "border-destructive bg-destructive text-destructive-foreground";
}
function toneDotClass(tone: "antes" | "no_dia" | "depois") {
  if (tone === "antes") return "bg-success";
  if (tone === "no_dia") return "bg-warning";
  return "bg-destructive";
}
function describeTiming(days: number): string {
  if (days === 0) return "Esta mensagem será enviada no dia do vencimento.";
  const abs = Math.abs(days);
  const p = abs === 1 ? "" : "s";
  return days < 0
    ? `Esta mensagem será enviada ${abs} dia${p} ANTES do vencimento.`
    : `Esta mensagem será enviada ${abs} dia${p} DEPOIS do vencimento.`;
}

// ============================================================================
// MENSAGENS CONFIGURADAS — agrupamento
// ============================================================================

type MessageGroup = {
  key: string;
  offset_days: number;
  template: string;
  entries: Array<{ planId: string; planName: string; messageId: string }>;
};

function groupMessages(plans: ServiceItem[]): MessageGroup[] {
  const map = new Map<string, MessageGroup>();
  for (const p of plans) {
    for (const m of p.messages) {
      const key = `${m.offset_days}|${m.template}`;
      let g = map.get(key);
      if (!g) {
        g = { key, offset_days: m.offset_days, template: m.template, entries: [] };
        map.set(key, g);
      }
      g.entries.push({ planId: p.id, planName: p.nome, messageId: m.id });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.offset_days - b.offset_days);
}

function ConfiguredMessageRow({
  group, onEdit, onDelete,
}: {
  group: MessageGroup;
  onEdit: (planId: string, messageId: string) => void;
  onDelete: (planId: string, messageId: string) => void;
}) {
  const tone: "antes" | "no_dia" | "depois" =
    group.offset_days === 0 ? "no_dia" : group.offset_days < 0 ? "antes" : "depois";
  const dotColor = tone === "antes" ? "bg-success" : tone === "no_dia" ? "bg-warning" : "bg-destructive";
  const label =
    group.offset_days === 0 ? "No vencimento"
    : group.offset_days < 0 ? `${Math.abs(group.offset_days)} dia${Math.abs(group.offset_days) === 1 ? "" : "s"} antes`
    : `${group.offset_days} dia${group.offset_days === 1 ? "" : "s"} depois`;

  return (
    <Card className="p-3">
      <div className="flex items-start gap-2">
        <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", dotColor)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold">{label}</span>
            <span className="text-[11px] text-muted-foreground">
              · {group.entries.length} plano{group.entries.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {group.entries.map((e) => (
              <span key={e.messageId} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                {e.planName}
                <button
                  onClick={() => onDelete(e.planId, e.messageId)}
                  className="text-destructive hover:text-destructive/80"
                  aria-label={`Remover de ${e.planName}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
          <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
            {group.template}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onEdit(group.entries[0].planId, group.entries[0].messageId)}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] hover:bg-muted"
        >
          <Pencil className="h-3 w-3" /> Editar
        </button>
      </div>
    </Card>
  );
}

// ============================================================================
// PLAN FORM DIALOG
// ============================================================================

function PlanFormDialog({
  open, service, onClose, onSaved,
}: {
  open: boolean;
  service: ServiceItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [telas, setTelas] = useState("1");
  const [meses, setMeses] = useState("1");

  useEffect(() => {
    if (!open) return;
    if (service) {
      setNome(service.nome);
      setValor((service.preco_cents / 100).toFixed(2).replace(".", ","));
      setTelas(String(service.telas));
      setMeses(String(service.meses));
    } else {
      setNome(""); setValor(""); setTelas("1"); setMeses("1");
    }
  }, [open, service]);

  function submit() {
    const n = nome.trim();
    if (!n) { toast.error("Informe o nome do plano."); return; }
    const num = Number((valor || "").replace(/\./g, "").replace(",", "."));
    if (!isFinite(num) || num < 0) { toast.error("Valor inválido."); return; }
    if (!ensureCanEditService().allowed) return;

    if (service) {
      updateService(service.id, {
        nome: n,
        preco_cents: Math.round(num * 100),
        telas: Math.max(1, Math.round(Number(telas) || 1)),
        meses: Math.max(1, Math.round(Number(meses) || 1)),
      });
      toast.success("Plano atualizado");
    } else {
      saveService({
        nome: n,
        preco_cents: Math.round(num * 100),
        telas: Math.max(1, Math.round(Number(telas) || 1)),
        meses: Math.max(1, Math.round(Number(meses) || 1)),
      });
      toast.success("Plano criado");
    }
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="mx-3 max-w-[1100px] border-2 border-primary/40 shadow-xl sm:mx-6">
        <DialogHeader>
          <DialogTitle>{service ? "Editar plano" : "Novo plano"}</DialogTitle>
          <DialogDescription>
            Defina nome, valor, quantidade de telas e duração em meses.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 sm:col-span-6">
            <Label className="text-xs">Nome do plano *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Plano R$ 12" autoFocus />
          </div>
          <div className="col-span-6 sm:col-span-2">
            <Label className="text-xs">Telas</Label>
            <Input type="number" min={1} max={10} value={telas} onChange={(e) => setTelas(e.target.value)} />
          </div>
          <div className="col-span-6 sm:col-span-2">
            <Label className="text-xs">Meses</Label>
            <Input type="number" min={1} max={24} value={meses} onChange={(e) => setMeses(e.target.value)} />
          </div>
          <div className="col-span-12 sm:col-span-2">
            <Label className="text-xs">Valor (R$) *</Label>
            <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="12,00" />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={submit} className="gap-1.5">
            <Save className="h-4 w-4" /> Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
