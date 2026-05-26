import { useEffect, useMemo, useState } from "react";
import {
  MessageSquare,
  Loader2,
  FlaskConical,
  Copy,
  Save,
  Sparkles,
  X,
  RefreshCcw,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { HelpTip } from "@/components/ui-premium/HelpTip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  listActiveServices,
  formatBRL as fmtBRLCents,
  type ServiceItem,
} from "@/lib/services-catalog";
import {
  getCustomerPlanId,
  setCustomerPlan,
  CUSTOMER_PLANS_EVENT,
} from "@/lib/customer-plans";

type Row = Record<string, unknown>;

// ---------- helpers ----------
function pickStr(r: Row, keys: string[]): string | null {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

function friendly(message: string, ctx: "load" | "preview" | "save"): string {
  const m = message.toLowerCase();
  if (m.includes("permission") || m.includes("denied") || m.includes("rls") || m.includes("not allowed"))
    return "Você não tem permissão para esta ação.";
  if (m.includes("auth") || m.includes("jwt") || m.includes("login"))
    return "Faça login novamente para continuar.";
  if (m.includes("network") || m.includes("fetch"))
    return "Falha de conexão. Tente novamente.";
  if (ctx === "preview") return "Não foi possível gerar a prévia agora. Tente novamente.";
  if (ctx === "save") return "Não foi possível salvar a mensagem simulada agora.";
  return "Não foi possível carregar as mensagens simuladas.";
}

const fmtDateTime = (s: string | null | undefined) => {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(+d)) return s ?? "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const TONES = [
  { value: "amigavel", label: "Amigável" },
  { value: "firme", label: "Firme" },
  { value: "curto", label: "Curto" },
  { value: "lembrete", label: "Lembrete" },
] as const;

// ---------- list panel ----------
export function SimulatedMessagesPanel({
  customerId,
  chargeId,
  reloadKey = 0,
  title = "Mensagens simuladas",
  emptyHint,
}: {
  customerId: string | null;
  chargeId: string | null;
  reloadKey?: number;
  title?: string;
  emptyHint?: string;
}) {
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; data: Row[] }
  >({ status: "idle" });

  useEffect(() => {
    if (!supabase) return;
    if (!customerId && !chargeId) return;
    let alive = true;
    setState({ status: "loading" });
    (async () => {
      const { data, error } = await supabase!.rpc("get_simulated_messages_admin", {
        p_customer_id: customerId,
        p_charge_id: chargeId,
      });
      if (!alive) return;
      if (error) {
        setState({ status: "error", message: friendly(error.message, "load") });
        return;
      }
      const list = (Array.isArray(data) ? (data as Row[]) : []).slice();
      list.sort((a, b) => {
        const da = String(a.created_at ?? a.sent_at ?? "");
        const db = String(b.created_at ?? b.sent_at ?? "");
        return db.localeCompare(da);
      });
      setState({ status: "ready", data: list });
    })();
    return () => {
      alive = false;
    };
  }, [customerId, chargeId, reloadKey]);

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" /> {title}
        </h3>
        <span className="inline-flex items-center gap-1 rounded-full bg-info-soft px-2 py-0.5 text-[10px] font-medium text-info">
          <FlaskConical className="h-3 w-3" /> Ambiente de testes
        </span>
      </div>

      {state.status === "loading" && (
        <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando mensagens…
        </div>
      )}

      {state.status === "error" && (
        <p className="rounded-lg border border-dashed border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          {state.message}
        </p>
      )}

      {state.status === "ready" && state.data.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
          {emptyHint ?? "Nenhuma mensagem simulada registrada ainda."}
        </p>
      )}

      {state.status === "ready" && state.data.length > 0 && (
        <ul className="space-y-2">
          {state.data.map((m, i) => {
            const content =
              pickStr(m, ["content", "body", "texto", "message", "preview"]) ?? "—";
            const tone = pickStr(m, ["tone", "tom"]);
            const direction = pickStr(m, ["direction", "tipo"]);
            const status = pickStr(m, ["status", "situacao"]);
            const when = pickStr(m, ["created_at", "sent_at", "data"]);
            return (
              <li key={i} className="rounded-lg border border-border bg-surface p-3">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-info-soft px-2 py-0.5 text-[10px] font-medium text-info">
                      <FlaskConical className="h-3 w-3" /> Simulada
                    </span>
                    {tone && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-foreground">
                        {tone}
                      </span>
                    )}
                    {direction && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                        {direction}
                      </span>
                    )}
                    {status && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                        {status}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{fmtDateTime(when)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {content}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------- generate dialog ----------
export function GenerateMessageDialog({
  open,
  onClose,
  chargeId,
  customerId = null,
  customerName,
  whatsappPretty,
  amountBRL,
  dueDatePretty,
  statusPretty,
  statusClassName,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  chargeId: string | null;
  customerId?: string | null;
  customerName: string;
  whatsappPretty: string | null;
  amountBRL: string | null;
  dueDatePretty: string | null;
  statusPretty: string;
  statusClassName: string;
  onSaved?: () => void;
}) {
  const [tone, setTone] = useState<string>("amigavel");
  const [stage, setStage] = useState<"idle" | "generating" | "preview" | "saving" | "saved">(
    "idle",
  );
  const [preview, setPreview] = useState<string>("");
  const [generatedTone, setGeneratedTone] = useState<string>("amigavel");
  const [copyOk, setCopyOk] = useState(false);

  // Plano do cliente (catálogo local) — escolhe qual mensagem usar.
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [planId, setPlanId] = useState<string | null>(null);
  const [planMsgId, setPlanMsgId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const reload = () => {
      setServices(listActiveServices());
      setPlanId(getCustomerPlanId(customerId));
    };
    reload();
    window.addEventListener(CUSTOMER_PLANS_EVENT, reload);
    return () => window.removeEventListener(CUSTOMER_PLANS_EVENT, reload);
  }, [open, customerId]);

  const selectedPlan = useMemo(
    () => services.find((s) => s.id === planId) ?? null,
    [services, planId],
  );

  // Reset da mensagem selecionada ao mudar de plano.
  useEffect(() => {
    setPlanMsgId(selectedPlan?.messages[0]?.id ?? null);
  }, [selectedPlan]);

  const selectedPlanMsg = useMemo(
    () => selectedPlan?.messages.find((m) => m.id === planMsgId) ?? selectedPlan?.messages[0] ?? null,
    [selectedPlan, planMsgId],
  );

  function applyPlanTemplate() {
    if (!selectedPlan || !selectedPlanMsg) {
      toast.error("Selecione um plano e uma mensagem cadastrada.");
      return;
    }
    const tpl = selectedPlanMsg.template?.trim()
      || "Olá {nome}, sua mensalidade do plano *{plano}* no valor de *{valor}* vence em {vencimento}.";
    const vars: Record<string, string> = {
      nome: customerName || "cliente",
      plano: selectedPlan.nome,
      valor: amountBRL || fmtBRLCents(selectedPlan.preco_cents),
      telas: String(selectedPlan.telas),
      meses: String(selectedPlan.meses),
      vencimento: dueDatePretty || "—",
    };
    const out = tpl.replace(/\{(\w+)\}/g, (_m: string, k: string) => vars[k] ?? `{${k}}`);
    setPreview(out);
    setGeneratedTone(tone);
    setStage("preview");
  }

  function handlePickPlan(id: string) {
    const v = id === "__none__" ? null : id;
    setPlanId(v);
    if (customerId) setCustomerPlan(customerId, v);
  }

  useEffect(() => {
    if (open) {
      setTone("amigavel");
      setStage("idle");
      setPreview("");
      setCopyOk(false);
    }
  }, [open, chargeId]);

  const toneLabel = useMemo(
    () => TONES.find((t) => t.value === generatedTone)?.label ?? generatedTone,
    [generatedTone],
  );

  const handleGenerate = async () => {
    if (!supabase || !chargeId) return;
    setStage("generating");
    const { data, error } = await supabase.rpc("generate_charge_message_preview_admin", {
      p_charge_id: chargeId,
      p_tone: tone,
    });
    if (error) {
      setStage("idle");
      toast.error(friendly(error.message, "preview"));
      return;
    }
    const payload = Array.isArray(data) ? (data[0] as Row) : (data as Row | string | null);
    let content = "";
    if (typeof payload === "string") {
      content = payload;
    } else if (payload && typeof payload === "object") {
      content =
        pickStr(payload as Row, ["content", "body", "message", "texto", "preview"]) ?? "";
    }
    if (!content) {
      setStage("idle");
      toast.error("Não foi possível gerar a prévia agora. Tente novamente.");
      return;
    }
    setPreview(content);
    setGeneratedTone(tone);
    setStage("preview");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(preview);
      setCopyOk(true);
      toast.success("Mensagem copiada.");
      setTimeout(() => setCopyOk(false), 1500);
    } catch {
      toast.error("Não foi possível copiar a mensagem.");
    }
  };

  const handleSave = async () => {
    if (!supabase || !chargeId || !preview) return;
    setStage("saving");
    const { data, error } = await supabase.rpc("save_simulated_charge_message_admin", {
      p_charge_id: chargeId,
      p_content: preview,
      p_tone: generatedTone,
    });
    if (error) {
      setStage("preview");
      toast.error(friendly(error.message, "save"));
      return;
    }
    setStage("saved");
    const payload = Array.isArray(data) ? (data[0] as Row) : (data as Row | null);
    const warning = payload && typeof payload === "object"
      ? pickStr(payload as Row, ["warning", "aviso"])
      : null;
    if (warning) {
      toast.success("Mensagem salva. O histórico pode demorar alguns instantes para atualizar.");
    } else {
      toast.success("Mensagem simulada salva com sucesso.");
    }
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          "flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none p-0",
          "sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-lg",
        )}
      >
        <DialogHeader className="border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> Gerar mensagem de cobrança
          </DialogTitle>
          <DialogDescription className="text-xs">
            Prévia segura para testes. Nada é enviado pelo WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
          {/* Cliente / cobrança */}
          <div className="space-y-1.5 rounded-lg border border-border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{customerName}</p>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  statusClassName,
                )}
              >
                {statusPretty}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {whatsappPretty ?? "Sem WhatsApp cadastrado"}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span>
                Valor:{" "}
                <strong className="font-semibold text-foreground">{amountBRL ?? "—"}</strong>
              </span>
              <span>Vence: {dueDatePretty ?? "—"}</span>
            </div>
          </div>

          {/* Aviso staging */}
          <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info-soft p-3 text-xs text-info">
            <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              <strong>Ambiente de testes:</strong> esta mensagem não será enviada pelo
              WhatsApp.{" "}
              <span className="opacity-80">
                Use para validar o texto antes de habilitar envio real.
              </span>
            </p>
          </div>

          {/* Tom */}
          <div>
            <Label className="mb-1 flex items-center gap-1.5 text-xs">
              Tom da mensagem
              <HelpTip text="Define o estilo do texto gerado (amigável, firme, curto ou lembrete)." />
            </Label>
            <Select
              value={tone}
              onValueChange={setTone}
              disabled={stage === "generating" || stage === "saving"}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Plano do cliente — usa o modelo de mensagem do plano */}
          <div className="rounded-lg border border-border bg-card p-3">
            <Label className="mb-1 flex items-center gap-1.5 text-xs">
              Plano do cliente
              <HelpTip text="Cada plano cadastrado em Cadastros · Serviços tem sua própria mensagem de cobrança. Escolha o plano deste cliente para usar o texto correto." />
            </Label>
            {services.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Nenhum plano cadastrado. Cadastre em <strong>Cadastros · Serviços</strong> para usar mensagens por plano.
              </p>
            ) : (
              <>
                <Select value={planId ?? "__none__"} onValueChange={handlePickPlan}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecione o plano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sem plano definido —</SelectItem>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome} · {fmtBRLCents(s.preco_cents)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedPlan && selectedPlan.messages.length > 0 && (
                  <div className="mt-2">
                    <Label className="text-[11px]">Mensagem do plano</Label>
                    <Select
                      value={selectedPlanMsg?.id ?? ""}
                      onValueChange={(v) => setPlanMsgId(v)}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Selecione a mensagem" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedPlan.messages.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">
                    {selectedPlan
                      ? `${selectedPlan.messages.length} mensagem(ns) cadastrada(s) neste plano`
                      : "Selecione um plano para usar a mensagem específica."}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={applyPlanTemplate}
                    disabled={!selectedPlan || !selectedPlanMsg}
                    className="h-8 gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Usar mensagem do plano
                  </Button>
                </div>
              </>
            )}
          </div>


          {/* Estado vazio antes da prévia */}
          {stage === "idle" && (
            <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Escolha um tom e clique em <strong>Gerar prévia</strong>.
            </div>
          )}

          {stage === "generating" && (
            <div className="flex items-center justify-center rounded-lg border border-border bg-card p-6 text-xs text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando prévia…
            </div>
          )}

          {(stage === "preview" || stage === "saving" || stage === "saved") && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-1.5 text-xs">
                  Prévia da mensagem
                  <HelpTip text="Esta é a mensagem que seria enviada. Ela ainda não foi enviada." />
                </Label>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-foreground">
                  {toneLabel}
                </span>
              </div>
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 shadow-sm">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {preview}
                </p>
              </div>
              {stage === "saved" && (
                <p className="flex items-center gap-1.5 text-xs text-success">
                  <Check className="h-3.5 w-3.5" /> Mensagem simulada salva.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-border bg-background px-4 py-3 sm:flex-row sm:px-6">
          {stage === "idle" || stage === "generating" ? (
            <>
              <Button
                variant="outline"
                onClick={onClose}
                className="h-11 w-full sm:h-9 sm:w-auto"
                disabled={stage === "generating"}
              >
                Fechar
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={stage === "generating" || !chargeId}
                className="h-11 w-full gap-1.5 sm:h-9 sm:w-auto"
              >
                {stage === "generating" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Gerar prévia
              </Button>
            </>
          ) : (
            <>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-row">
                <Button
                  variant="outline"
                  onClick={handleCopy}
                  className="h-11 gap-1.5 sm:h-9"
                  disabled={!preview}
                >
                  {copyOk ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  Copiar
                </Button>
                <Button
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={stage === "saving"}
                  className="h-11 gap-1.5 sm:h-9"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Gerar de novo
                </Button>
              </div>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-row">
                <Button
                  variant="ghost"
                  onClick={onClose}
                  disabled={stage === "saving"}
                  className="h-11 gap-1.5 sm:h-9"
                >
                  <X className="h-4 w-4" /> Fechar
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={stage === "saving" || stage === "saved" || !preview}
                  className="h-11 gap-1.5 sm:h-9"
                >
                  {stage === "saving" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar simulada
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
