import { useEffect, useMemo, useState } from "react";
import {
  Sparkles,
  Loader2,
  FlaskConical,
  Copy,
  Save,
  X,
  RefreshCcw,
  Check,
  Brain,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Shield,
  MessageSquare,
  Wand2,
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
import { supabase } from "@/integrations/supabase/compat";
import { toast } from "sonner";
import { flags } from "@/lib/flags";

type RpcErr = { message?: string; details?: string | null; hint?: string | null; code?: string | null };
function stagingDetail(rpc: string, payload: unknown, err: RpcErr) {
  if (flags.appEnv === "production") return undefined;
  try {
    return `RPC: ${rpc}\nPayload: ${JSON.stringify(payload)}\nmessage: ${err.message ?? ""}\ndetails: ${err.details ?? ""}\nhint: ${err.hint ?? ""}\ncode: ${err.code ?? ""}`;
  } catch {
    return `RPC: ${rpc} — ${err.message ?? ""}`;
  }
}
function toastRpcError(friendlyMsg: string, rpc: string, payload: unknown, err: RpcErr) {
  const description = stagingDetail(rpc, payload, err);
  toast.error(friendlyMsg, description ? { description } : undefined);
}

type Row = Record<string, unknown>;

function pickStr(r: Row, keys: string[]): string | null {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

function friendly(msg: string, ctx: "generate" | "save" | "create" | "load"): string {
  const m = msg.toLowerCase();
  if (m.includes("permission") || m.includes("denied") || m.includes("rls") || m.includes("not allowed"))
    return "Você não tem permissão para esta ação.";
  if (m.includes("auth") || m.includes("jwt") || m.includes("login"))
    return "Faça login novamente para continuar.";
  if (m.includes("network") || m.includes("fetch"))
    return "Falha de conexão. Tente novamente.";
  if (ctx === "generate") return "Não foi possível gerar a análise simulada agora.";
  if (ctx === "save") return "Não foi possível salvar a sugestão agora.";
  if (ctx === "create") return "Não foi possível criar a mensagem simulada agora.";
  return "Não foi possível carregar as sugestões de IA.";
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

export const AI_GOALS = [
  { value: "cobrar", label: "Cobrar" },
  { value: "lembrar", label: "Lembrar" },
  { value: "recuperar", label: "Recuperar" },
  { value: "negociar", label: "Negociar" },
  { value: "suporte", label: "Suporte" },
] as const;

const goalLabel = (g: string | null | undefined) =>
  AI_GOALS.find((x) => x.value === (g ?? "").toLowerCase())?.label ?? (g ?? "—");

const toneLabel = (t: string | null | undefined) => {
  const v = (t ?? "").toLowerCase();
  if (v === "amigavel" || v === "amigável") return "Amigável";
  if (v === "firme") return "Firme";
  if (v === "curto") return "Curto";
  if (v === "lembrete") return "Lembrete";
  return t ?? "—";
};

const riskInfo = (r: string | null | undefined) => {
  const v = (r ?? "").toLowerCase();
  if (/(alt|high|elev)/.test(v))
    return { label: "Alto", icon: ShieldAlert, cls: "bg-destructive/10 text-destructive" };
  if (/(med|mid|moderad)/.test(v))
    return { label: "Médio", icon: Shield, cls: "bg-warning-soft text-warning" };
  if (/(baix|low)/.test(v))
    return { label: "Baixo", icon: ShieldCheck, cls: "bg-success-soft text-success" };
  return { label: r ?? "—", icon: Shield, cls: "bg-muted text-muted-foreground" };
};

// Extract analysis fields defensively from various RPC return shapes
type Analysis = {
  risk: string | null;
  tone: string | null;
  action: string | null;
  reason: string | null;
  message: string;
  aiMessageId: string | null;
  raw: Row;
};

function extractAnalysis(payload: unknown): Analysis | null {
  let p: Row | null = null;
  if (Array.isArray(payload)) p = (payload[0] as Row) ?? null;
  else if (payload && typeof payload === "object") p = payload as Row;
  if (!p) return null;
  // Nested under "analysis" or "data"
  const inner = (p.analysis as Row) ?? (p.data as Row) ?? p;
  const message =
    pickStr(inner, [
      "suggested_message",
      "message",
      "preview",
      "content",
      "body",
      "texto",
    ]) ?? "";
  return {
    risk: pickStr(inner, ["risk_level", "risk", "risco", "nivel_risco"]),
    tone: pickStr(inner, ["suggested_tone", "tone", "tom", "tom_sugerido"]),
    action: pickStr(inner, [
      "recommended_action",
      "next_action",
      "action",
      "acao",
      "proxima_acao",
    ]),
    reason: pickStr(inner, ["reason", "motivo", "recommendation_reason", "explanation"]),
    message,
    aiMessageId: pickStr(p, ["ai_message_id", "id"]) ?? pickStr(inner, ["ai_message_id", "id"]),
    raw: inner,
  };
}

// ---------- Analyze dialog ----------
export function AnalyzeWithAIDialog({
  open,
  onClose,
  chargeId,
  customerName,
  whatsappPretty,
  amountBRL,
  dueDatePretty,
  statusPretty,
  statusClassName,
  onSaved,
  onMessageCreated,
}: {
  open: boolean;
  onClose: () => void;
  chargeId: string | null;
  customerName: string;
  whatsappPretty: string | null;
  amountBRL: string | null;
  dueDatePretty: string | null;
  statusPretty: string;
  statusClassName: string;
  onSaved?: () => void;
  onMessageCreated?: () => void;
}) {
  const [goal, setGoal] = useState<string>("cobrar");
  const [stage, setStage] = useState<
    "idle" | "generating" | "ready" | "saving" | "saved" | "creating" | "created"
  >("idle");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [savedAiMessageId, setSavedAiMessageId] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);

  useEffect(() => {
    if (open) {
      setGoal("cobrar");
      setStage("idle");
      setAnalysis(null);
      setSavedAiMessageId(null);
      setCopyOk(false);
    }
  }, [open, chargeId]);

  const risk = useMemo(() => riskInfo(analysis?.risk), [analysis?.risk]);

  const handleGenerate = async () => {
    if (!supabase || !chargeId) return;
    setStage("generating");
    setSavedAiMessageId(null);
    const payload = { p_charge_id: chargeId, p_goal: goal };
    const { data, error } = await supabase.rpc("generate_ai_charge_analysis_admin", payload);
    if (error) {
      setStage("idle");
      toastRpcError(friendly(error.message, "generate"), "generate_ai_charge_analysis_admin", payload, error);
      return;
    }
    const a = extractAnalysis(data);
    if (!a || !a.message) {
      setStage("idle");
      toast.error("Não foi possível gerar a análise simulada agora.");
      return;
    }
    setAnalysis(a);
    setStage("ready");
  };

  const handleCopy = async () => {
    if (!analysis?.message) return;
    try {
      await navigator.clipboard.writeText(analysis.message);
      setCopyOk(true);
      toast.success("Mensagem copiada.");
      setTimeout(() => setCopyOk(false), 1500);
    } catch {
      toast.error("Não foi possível copiar a mensagem.");
    }
  };

  const handleSave = async () => {
    if (!supabase || !chargeId || !analysis) return;
    setStage("saving");
    // Spec: save_ai_simulated_suggestion_admin({ p_charge_id, p_analysis })
    const analysisPayload = {
      goal,
      risk_level: analysis.risk,
      suggested_tone: analysis.tone ?? "amigavel",
      recommended_action: analysis.action,
      suggested_message: analysis.message,
      reason: analysis.reason,
      source: "frontend_simulated",
      raw: analysis.raw,
    };
    const payload = { p_charge_id: chargeId, p_analysis: analysisPayload };
    const { data, error } = await supabase.rpc("save_ai_simulated_suggestion_admin", payload);
    if (error) {
      setStage("ready");
      toastRpcError(friendly(error.message, "save"), "save_ai_simulated_suggestion_admin", payload, error);
      return;
    }
    const ret = Array.isArray(data) ? (data[0] as Row) : (data as Row | null);
    const id =
      (ret && typeof ret === "object"
        ? pickStr(ret as Row, ["ai_message_id", "id"])
        : null) ?? analysis.aiMessageId;
    setSavedAiMessageId(id);
    const warning =
      ret && typeof ret === "object"
        ? pickStr(ret as Row, ["warning", "aviso"])
        : null;
    if (warning) {
      toast.success("Sugestão salva. O histórico pode demorar alguns instantes para atualizar.");
    } else {
      toast.success("Sugestão de IA simulada salva com sucesso.");
    }
    setStage("saved");
    onSaved?.();
  };

  const handleCreateMessage = async () => {
    if (!supabase || !savedAiMessageId) return;
    setStage("creating");
    // Spec: create_message_from_ai_suggestion_admin({ p_ai_message_id })
    const payload = { p_ai_message_id: savedAiMessageId };
    const { error } = await supabase.rpc("create_message_from_ai_suggestion_admin", payload);
    if (error) {
      setStage("saved");
      toastRpcError(friendly(error.message, "create"), "create_message_from_ai_suggestion_admin", payload, error);
      return;
    }
    toast.success("Mensagem simulada criada a partir da IA.");
    setStage("created");
    onMessageCreated?.();
  };

  const generating = stage === "generating";
  const saving = stage === "saving";
  const creating = stage === "creating";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          "flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none p-0",
          "sm:h-auto sm:max-h-[92vh] sm:max-w-lg sm:rounded-lg",
        )}
      >
        <DialogHeader className="border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-primary" /> Analisar com IA
          </DialogTitle>
          <DialogDescription className="text-xs">
            Análise simulada para testes. Nada é enviado pelo WhatsApp e nenhuma IA real é usada.
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

          {/* Aviso */}
          <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info-soft p-3 text-xs text-info">
            <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              <strong>Ambiente de testes:</strong> esta análise é simulada e não usa IA real.{" "}
              <span className="opacity-80">
                Nenhuma mensagem real será enviada e nenhum pagamento será processado.
              </span>
            </p>
          </div>

          {/* Objetivo */}
          <div>
            <Label className="mb-1 flex items-center gap-1.5 text-xs">
              Objetivo da IA
              <HelpTip text="O que você quer que a IA priorize: cobrar, lembrar, recuperar, negociar ou dar suporte." />
            </Label>
            <Select value={goal} onValueChange={setGoal} disabled={generating || saving || creating}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_GOALS.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {stage === "idle" && (
            <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Escolha um objetivo e clique em <strong>Gerar análise</strong>.
            </div>
          )}

          {generating && (
            <div className="flex items-center justify-center rounded-lg border border-border bg-card p-6 text-xs text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando análise simulada…
            </div>
          )}

          {analysis && stage !== "generating" && (
            <div className="space-y-3">
              {/* Risk + tone + action grid */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <AnalysisCard
                  label="Risco"
                  hint="Probabilidade de inadimplência ou ruído com esse cliente."
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                      risk.cls,
                    )}
                  >
                    <risk.icon className="h-3 w-3" />
                    {risk.label}
                  </span>
                </AnalysisCard>
                <AnalysisCard
                  label="Tom sugerido"
                  hint="Estilo recomendado para a mensagem."
                >
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize text-foreground">
                    {toneLabel(analysis.tone)}
                  </span>
                </AnalysisCard>
                <AnalysisCard
                  label="Próxima ação"
                  hint="O que fazer agora com esse cliente."
                >
                  <span className="text-xs font-medium text-foreground">
                    {analysis.action ?? "—"}
                  </span>
                </AnalysisCard>
              </div>

              {analysis.reason && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="mb-1 flex items-center gap-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Motivo da recomendação
                    </p>
                    <HelpTip text="Por que a IA simulada sugeriu essa ação e esse tom." />
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {analysis.reason}
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 shadow-sm">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-primary" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Mensagem sugerida
                    </p>
                    <HelpTip text="Texto sugerido pela IA simulada. Ainda não foi enviado." />
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-info-soft px-2 py-0.5 text-[10px] font-medium text-info">
                    <FlaskConical className="h-3 w-3" /> Simulada
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {analysis.message}
                </p>
              </div>

              {stage === "saved" && (
                <p className="flex items-center gap-1.5 text-xs text-success">
                  <Check className="h-3.5 w-3.5" /> Sugestão salva. Você já pode criar a mensagem
                  simulada.
                </p>
              )}
              {stage === "created" && (
                <p className="flex items-center gap-1.5 text-xs text-success">
                  <Check className="h-3.5 w-3.5" /> Mensagem simulada criada a partir da IA.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-border bg-background px-4 py-3 sm:flex-row sm:justify-between sm:px-6">
          {!analysis ? (
            <>
              <Button
                variant="outline"
                onClick={onClose}
                className="h-11 w-full sm:h-9 sm:w-auto"
                disabled={generating}
              >
                Fechar
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={generating || !chargeId}
                className="h-11 w-full gap-1.5 sm:h-9 sm:w-auto"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Gerar análise
              </Button>
            </>
          ) : (
            <>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-row">
                <Button
                  variant="outline"
                  onClick={handleCopy}
                  className="h-11 gap-1.5 sm:h-9"
                  disabled={!analysis.message}
                >
                  {copyOk ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  Copiar
                </Button>
                <Button
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={generating || saving || creating}
                  className="h-11 gap-1.5 sm:h-9"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Gerar de novo
                </Button>
              </div>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-row">
                {savedAiMessageId ? (
                  <Button
                    onClick={handleCreateMessage}
                    disabled={creating || stage === "created"}
                    className="h-11 gap-1.5 sm:h-9"
                  >
                    {creating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4" />
                    )}
                    Criar mensagem
                  </Button>
                ) : (
                  <Button
                    onClick={handleSave}
                    disabled={saving || !analysis.message}
                    className="h-11 gap-1.5 sm:h-9"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Salvar sugestão
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={onClose}
                  disabled={saving || creating}
                  className="h-11 gap-1.5 sm:h-9"
                >
                  <X className="h-4 w-4" /> Fechar
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AnalysisCard({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-1 flex items-center gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {hint && <HelpTip text={hint} />}
      </div>
      <div>{children}</div>
    </div>
  );
}

// ---------- AI suggestions list panel ----------
export function AISuggestionsPanel({
  customerId,
  chargeId,
  reloadKey = 0,
  title = "Sugestões de IA",
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
      const payload = { p_customer_id: customerId, p_charge_id: chargeId };
      const { data, error } = await supabase!.rpc("get_ai_simulated_suggestions_admin", payload);
      if (!alive) return;
      if (error) {
        const detail = stagingDetail("get_ai_simulated_suggestions_admin", payload, error);
        setState({
          status: "error",
          message: detail ? `${friendly(error.message, "load")}\n\n${detail}` : friendly(error.message, "load"),
        });
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
          <Brain className="h-3.5 w-3.5" /> {title}
        </h3>
        <span className="inline-flex items-center gap-1 rounded-full bg-info-soft px-2 py-0.5 text-[10px] font-medium text-info">
          <FlaskConical className="h-3 w-3" /> Não usa IA real
        </span>
      </div>

      {state.status === "loading" && (
        <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando sugestões…
        </div>
      )}

      {state.status === "error" && (
        <p className="whitespace-pre-wrap rounded-lg border border-dashed border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          {state.message}
        </p>
      )}

      {state.status === "ready" && state.data.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
          {emptyHint ?? "Nenhuma sugestão de IA simulada registrada ainda."}
        </p>
      )}

      {state.status === "ready" && state.data.length > 0 && (
        <ul className="space-y-2">
          {state.data.map((m, i) => {
            const goal = pickStr(m, ["goal", "objetivo"]);
            const tone = pickStr(m, ["suggested_tone", "tone", "tom"]);
            const action = pickStr(m, [
              "recommended_action",
              "next_action",
              "action",
              "acao",
            ]);
            const message =
              pickStr(m, [
                "suggested_message",
                "content",
                "message",
                "body",
                "texto",
              ]) ?? "—";
            const when = pickStr(m, ["created_at", "sent_at", "data"]);
            const chargeRef =
              pickStr(m, ["charge_external_ref", "external_ref", "charge_reference"]) ??
              (m.charge_id ? "Cobrança vinculada" : null);
            return (
              <li key={i} className="rounded-lg border border-border bg-surface p-3">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      <Brain className="h-3 w-3" /> IA simulada
                    </span>
                    {goal && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">
                        {goalLabel(goal)}
                      </span>
                    )}
                    {tone && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-foreground">
                        Tom: {toneLabel(tone)}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {fmtDateTime(when)}
                  </span>
                </div>
                {action && (
                  <p className="mb-1 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Próxima ação:</span>{" "}
                    {action}
                  </p>
                )}
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {message}
                </p>
                {chargeRef && customerId && !chargeId && (
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <AlertTriangle className="h-3 w-3" /> {chargeRef}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
