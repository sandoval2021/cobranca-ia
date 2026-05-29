import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Plus, Trash2, Pencil, Sparkles, Save, MessageCircle, Check, ChevronRight,
  CloudUpload, Loader2,
} from "lucide-react";

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
import { cn } from "@/lib/utils";

import {
  listServices, saveService, updateService, deleteService, formatBRL,
  seedDefaultPlansIfEmpty,
  addServiceMessage, updateServiceMessage, removeServiceMessage,
  renderTemplate, DEFAULT_COBRANCA,
  SERVICES_EVENT, type ServiceItem, type ServiceMessage,
  uploadLocalServicesToDb, hydrateServicesFromDb, getServicesSyncState,
  SERVICES_SYNC_EVENT,
} from "@/lib/services-catalog";
import { uploadLocalCustomerPlansToDb } from "@/lib/customer-plans";
import { listServicePlansDb, type ServicePlanDto } from "@/lib/services/services.functions";
import { useServerFn } from "@tanstack/react-start";
import { getActiveCompanyId } from "@/lib/company-scope";
import { ensureCanEditService } from "@/lib/plan-gate";

export const Route = createFileRoute("/cadastros-servicos")({
  component: CadastrosServicosPage,
});

// Prazos fixos disponíveis para cada plano
const TIMING_SLOTS: number[] = [-3, 0, 3, 15, 30, 60, 90, 120, 180, 250, 365];

type Tone = "antes" | "no_dia" | "depois";

function toneOf(days: number): Tone {
  if (days === 0) return "no_dia";
  return days < 0 ? "antes" : "depois";
}
function toneDotClass(t: Tone) {
  if (t === "antes") return "bg-success";
  if (t === "no_dia") return "bg-warning";
  return "bg-destructive";
}
function slotLabel(days: number): string {
  if (days === 0) return "No dia do vencimento";
  const abs = Math.abs(days);
  const p = abs === 1 ? "" : "s";
  return days < 0 ? `${abs} dia${p} antes` : `${abs} dia${p} depois`;
}
function slotSubtitle(days: number): string {
  if (days === 0) return "Essa mensagem será enviada no dia do vencimento.";
  const abs = Math.abs(days);
  const p = abs === 1 ? "" : "s";
  return days < 0
    ? `Essa mensagem será enviada ${abs} dia${p} antes do vencimento.`
    : `Essa mensagem será enviada ${abs} dia${p} depois do vencimento.`;
}

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
  const [editor, setEditor] = useState<{ planId: string; offsetDays: number } | null>(null);

  // --- banner: enviar planos/mensagens locais para a nuvem ---
  const CLOUD_BANNER_DISMISS_KEY = "cobranca_ia_services_cloud_banner_dismissed_v1";
  const [pendingLocal, setPendingLocal] = useState<number>(() =>
    typeof window === "undefined" ? 0 : getServicesSyncState().pendingLocal,
  );
  const [cloudBannerDismissed, setCloudBannerDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(CLOUD_BANNER_DISMISS_KEY) === "1";
  });
  const [uploadingLocal, setUploadingLocal] = useState(false);
  const listPlansFn = useServerFn(listServicePlansDb);

  useEffect(() => {
    const onSync = (e: Event) => {
      const detail = (e as CustomEvent).detail as { pendingLocal?: number } | undefined;
      if (detail && typeof detail.pendingLocal === "number") {
        setPendingLocal(detail.pendingLocal);
      } else {
        setPendingLocal(getServicesSyncState().pendingLocal);
      }
    };
    window.addEventListener(SERVICES_SYNC_EVENT, onSync);
    return () => window.removeEventListener(SERVICES_SYNC_EVENT, onSync);
  }, []);

  const handleUploadLocal = async () => {
    if (uploadingLocal) return;
    setUploadingLocal(true);
    try {
      const [resPlans, resLinks] = await Promise.all([
        uploadLocalServicesToDb(),
        uploadLocalCustomerPlansToDb(),
      ]);
      const totalPlans = (resPlans?.inserted ?? 0) + (resPlans?.updated ?? 0);
      const totalLinks = resLinks?.upserted ?? 0;
      // re-hidrata do banco para evitar duplicidade e refletir tudo
      const companyId = getActiveCompanyId();
      if (companyId) {
        try {
          const rows = await listPlansFn({ data: { companyId } });
          hydrateServicesFromDb(companyId, rows as ServicePlanDto[]);
        } catch {
          /* hidratação falhou — useServicesSync vai tentar novamente */
        }
      }
      reload();
      toast.success(
        totalPlans > 0 || totalLinks > 0
          ? "Planos enviados para sua conta com sucesso."
          : "Planos já estavam sincronizados.",
      );
    } catch {
      toast.error("Não foi possível enviar agora. Verifique sua conexão e tente novamente.");
    } finally {
      setUploadingLocal(false);
    }
  };

  const dismissCloudBanner = () => {
    setCloudBannerDismissed(true);
    try { window.localStorage.setItem(CLOUD_BANNER_DISMISS_KEY, "1"); } catch { /* noop */ }
  };

  const reload = () => setItems(listServices());

  useEffect(() => {
    reload();
    const h = () => reload();
    window.addEventListener(SERVICES_EVENT, h);
    return () => window.removeEventListener(SERVICES_EVENT, h);
  }, []);

  // Auto-seleciona o primeiro plano se nenhum estiver selecionado
  useEffect(() => {
    if (items.length > 0 && (!selectedPlanId || !items.find((p) => p.id === selectedPlanId))) {
      setSelectedPlanId(items[0].id);
    }
    if (items.length === 0 && selectedPlanId) setSelectedPlanId(null);
  }, [items, selectedPlanId]);

  const selectedPlan = useMemo(
    () => items.find((p) => p.id === selectedPlanId) ?? null,
    [items, selectedPlanId],
  );

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

  return (
    <PageContainer>
      {pendingLocal > 0 && !cloudBannerDismissed && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-3">
          <div className="flex items-start gap-2">
            <CloudUpload className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground">
                Encontramos planos salvos apenas neste aparelho.
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Envie esses planos para sua conta para acessar em qualquer celular, computador ou PWA.
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={handleUploadLocal}
                  disabled={uploadingLocal}
                  className="h-9"
                >
                  {uploadingLocal ? (
                    <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Enviando…</>
                  ) : (
                    <><CloudUpload className="mr-1.5 h-3.5 w-3.5" /> Enviar para minha conta</>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={dismissCloudBanner}
                  disabled={uploadingLocal}
                  className="h-9"
                >
                  Agora não
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================== BLOCO 1 — PLANOS =================== */}
      <SectionHeader
        title="Escolha o plano"
        subtitle="Cada plano tem suas próprias mensagens. Toque em um plano para configurar."
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
          Nenhum plano cadastrado ainda. Toque em <strong>Novo plano</strong> para começar.
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
          {items.map((s) => {
            const active = selectedPlanId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedPlanId(s.id)}
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

      {/* =================== BLOCO 2 — MENSAGENS DO PLANO =================== */}
      {selectedPlan && (
        <div className="mt-8">
          <SectionHeader
            title={`Mensagens do ${selectedPlan.nome}`}
            subtitle="Toque em um prazo para escrever ou alterar o texto que será enviado."
          />

          <div className="space-y-2">
            {TIMING_SLOTS.map((days) => {
              const msg = selectedPlan.messages.find((m) => m.offset_days === days);
              const configured = !!(msg && msg.template.trim());
              const tone = toneOf(days);
              return (
                <button
                  key={days}
                  type="button"
                  onClick={() => setEditor({ planId: selectedPlan.id, offsetDays: days })}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border-2 bg-card p-3 text-left shadow-sm transition-all",
                    "hover:border-primary/60 hover:shadow-md active:scale-[0.99]",
                    "border-border",
                  )}
                >
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", toneDotClass(tone))} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight">{slotLabel(days)}</p>
                    <p className={cn(
                      "mt-0.5 truncate text-xs",
                      configured ? "text-muted-foreground" : "text-destructive/80 font-medium",
                    )}>
                      {configured ? msg!.template : "Não configurado"}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px]">
                    <Pencil className="h-3 w-3" />
                    <span className="hidden sm:inline">Editar texto</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ====== Dialogs ====== */}
      <PlanFormDialog
        open={planDialog.open}
        service={planDialog.service}
        onClose={() => setPlanDialog({ open: false, service: null })}
        onSaved={() => { setPlanDialog({ open: false, service: null }); reload(); }}
      />

      <MessageEditorDialog
        open={!!editor}
        plan={editor ? items.find((p) => p.id === editor.planId) ?? null : null}
        offsetDays={editor?.offsetDays ?? 0}
        onClose={() => setEditor(null)}
        onSaved={() => { setEditor(null); reload(); }}
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
// EDITOR DE MENSAGEM (modal — 1 plano + 1 prazo por vez)
// ============================================================================

const VARIABLES = [
  { key: "nome", label: "{nome}" },
  { key: "plano", label: "{plano}" },
  { key: "valor", label: "{valor}" },
  { key: "vencimento", label: "{vencimento}" },
  { key: "pix", label: "{pix}" },
  { key: "link_pagamento", label: "{link_pagamento}" },
];

function MessageEditorDialog({
  open, plan, offsetDays, onClose, onSaved,
}: {
  open: boolean;
  plan: ServiceItem | null;
  offsetDays: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [template, setTemplate] = useState<string>("");
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  const existing: ServiceMessage | undefined = plan?.messages.find((m) => m.offset_days === offsetDays);

  useEffect(() => {
    if (!open) return;
    setTemplate(existing?.template ?? DEFAULT_COBRANCA);
  }, [open, existing?.id, existing?.template]);

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

  function save() {
    if (!plan) return;
    if (!ensureCanEditService().allowed) return;
    if (!template.trim()) { toast.error("Escreva o texto da mensagem."); return; }

    if (existing) {
      updateServiceMessage(plan.id, existing.id, {
        template,
        offset_days: offsetDays,
        label: "",
      });
    } else {
      addServiceMessage(plan.id, {
        kind: offsetDays === 0 ? "cobranca" : "acompanhamento",
        offset_days: offsetDays,
        template,
      });
    }
    toast.success("Mensagem salva");
    onSaved();
  }

  function clearMessage() {
    if (!plan || !existing) return;
    removeServiceMessage(plan.id, existing.id);
    toast.success("Mensagem removida");
    onSaved();
  }

  const preview = useMemo(() => {
    if (!plan) return "";
    return renderTemplate(template, {
      nome: "João",
      plano: plan.nome,
      valor: formatBRL(plan.preco_cents),
      telas: plan.telas,
      meses: plan.meses,
      vencimento: "15/12/2026",
    })
      .replace(/\{pix\}/g, "00020126...PIX")
      .replace(/\{link_pagamento\}/g, "https://pag.to/exemplo");
  }, [template, plan]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="mx-3 max-w-[640px] sm:mx-6">
        <DialogHeader>
          <DialogTitle className="pr-6 text-base sm:text-lg">
            Editar mensagem — {plan?.nome ?? ""}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {slotSubtitle(offsetDays)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Texto */}
          <div>
            <Label className="text-xs font-semibold">Texto da mensagem</Label>
            <Textarea
              ref={textRef}
              rows={6}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="mt-1 text-sm"
              placeholder="Olá {nome}, tudo bem? Passando para lembrar do seu plano {plano}..."
            />
          </div>

          {/* Variáveis */}
          <div>
            <Label className="text-xs font-semibold">Informações automáticas</Label>
            <p className="text-[11px] text-muted-foreground">Toque para inserir no texto.</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {VARIABLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVar(v.key)}
                  className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-[11px] text-foreground hover:bg-primary hover:text-primary-foreground"
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <Label className="text-xs font-semibold">Como vai chegar no WhatsApp</Label>
            <div className="mt-1">
              <WhatsAppBubble text={preview} />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <div>
            {existing && (
              <Button variant="ghost" size="sm" onClick={clearMessage} className="text-destructive hover:text-destructive">
                <Trash2 className="mr-1 h-4 w-4" /> Remover
              </Button>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" size="sm" onClick={onClose} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button size="sm" onClick={save} className="w-full gap-1.5 sm:w-auto">
              <Save className="h-4 w-4" /> Salvar texto
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
          {text || "—"}
        </p>
        <p className="mt-1 text-right text-[10px] text-neutral-500">12:34 ✓✓</p>
      </div>
    </div>
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
      <DialogContent className="mx-3 max-w-[640px] sm:mx-6">
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
