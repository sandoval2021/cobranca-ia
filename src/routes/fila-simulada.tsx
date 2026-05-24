import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ListChecks,
  FlaskConical,
  Loader2,
  RefreshCcw,
  Sparkles,
  CalendarRange,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MessageSquarePlus,
  SkipForward,
  Ban,
  Inbox,
  Wand2,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { EmptyState } from "@/components/ui-premium/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { supabase, supabaseConfigured } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { flags } from "@/lib/flags";
import { toast } from "sonner";

const IS_STAGING = flags.appEnv !== "production";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string =>
  typeof v === "string" && UUID_RE.test(v.trim());

export const Route = createFileRoute("/fila-simulada")({ component: FilaSimuladaPage });

// ---------- types ----------
type Row = Record<string, unknown>;

type QueueStatus =
  | "planned"
  | "blocked"
  | "approved_simulation"
  | "skipped"
  | "cancelled"
  | "message_created";

type Tone = "amigavel" | "firme" | "curto" | "lembrete";

const STATUS_LABEL: Record<QueueStatus, string> = {
  planned: "Planejada",
  blocked: "Bloqueada",
  approved_simulation: "Aprovada para simulação",
  skipped: "Pulada",
  cancelled: "Cancelada",
  message_created: "Mensagem criada",
};

const STATUS_BADGE: Record<QueueStatus, string> = {
  planned: "bg-info-soft text-info",
  blocked: "bg-danger-soft text-danger",
  approved_simulation: "bg-primary-soft text-primary",
  skipped: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground line-through",
  message_created: "bg-success-soft text-success",
};

const TONE_LABEL: Record<Tone, string> = {
  amigavel: "Amigável",
  firme: "Firme",
  curto: "Curto",
  lembrete: "Lembrete",
};

const FILTERS: Array<{ value: "all" | QueueStatus; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "planned", label: "Planejados" },
  { value: "blocked", label: "Bloqueados" },
  { value: "approved_simulation", label: "Aprovados" },
  { value: "skipped", label: "Pulados" },
  { value: "cancelled", label: "Cancelados" },
  { value: "message_created", label: "Mensagem criada" },
];

// ---------- helpers ----------
function pickStr(r: Row, keys: string[]): string | null {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}
function pickNum(r: Row, keys: string[]): number | null {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && !isNaN(Number(v))) return Number(v);
  }
  return null;
}
function pickBool(r: Row, keys: string[]): boolean | null {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "boolean") return v;
  }
  return null;
}

const fmtDate = (s: string | null | undefined) => {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(+d)) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};
const fmtDateTime = (s: string | null | undefined) => {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(+d)) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};
const fmtBRL = (cents: number | null) => {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};
const fmtPhone = (s: string | null) => {
  if (!s) return null;
  const d = s.replace(/\D+/g, "");
  if (d.length >= 12) return `+${d.slice(0, d.length - 11)} (${d.slice(-11, -9)}) ${d.slice(-9, -4)}-${d.slice(-4)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return s;
};

function normalizeStatus(s: string | null): QueueStatus {
  const v = (s ?? "").toLowerCase();
  if (v === "planned" || v === "blocked" || v === "approved_simulation" ||
      v === "skipped" || v === "cancelled" || v === "message_created") return v;
  return "planned";
}
function normalizeTone(s: string | null): Tone {
  const v = (s ?? "").toLowerCase();
  if (v === "firme" || v === "curto" || v === "lembrete") return v;
  return "amigavel";
}

function relativeToDue(scheduledAt: string | null, dueDate: string | null): string | null {
  if (!scheduledAt || !dueDate) return null;
  const s = new Date(scheduledAt);
  const d = new Date(dueDate);
  if (isNaN(+s) || isNaN(+d)) return null;
  const days = Math.round((s.getTime() - d.getTime()) / 86400000);
  if (days === 0) return "no dia do vencimento";
  if (days < 0) return `${Math.abs(days)} ${Math.abs(days) === 1 ? "dia" : "dias"} antes`;
  return `${days} ${days === 1 ? "dia" : "dias"} depois`;
}

function friendly(message: string, ctx: "load" | "preview" | "rebuild" | "action" | "create"): string {
  const m = message.toLowerCase();
  if (m.includes("permission") || m.includes("denied") || m.includes("rls") || m.includes("not allowed"))
    return "Você não tem permissão para esta ação.";
  if (m.includes("auth") || m.includes("jwt"))
    return "Faça login novamente para continuar.";
  if (m.includes("network") || m.includes("fetch"))
    return "Falha de conexão. Tente novamente.";
  if (ctx === "preview") return "Não foi possível gerar a prévia agora.";
  if (ctx === "rebuild") return "Não foi possível reconstruir a fila agora.";
  if (ctx === "create") return "Não foi possível criar a mensagem simulada agora.";
  if (ctx === "action") return "Não foi possível atualizar este item agora.";
  return "Não foi possível carregar a fila agora.";
}

// ---------- normalized item shape ----------
type QueueItem = {
  id: string | null;
  customerName: string | null;
  whatsapp: string | null;
  amountCents: number | null;
  dueDate: string | null;
  scheduledAt: string | null;
  status: QueueStatus;
  tone: Tone;
  reason: string | null;
  blockedReason: string | null;
  attempt: number | null;
  allowed: boolean | null;
};

function asRow(v: unknown): Row | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : null;
}

function normalizeItem(r: Row): QueueItem {
  const customer = asRow(r.customer);
  const charge = asRow(r.charge);

  const rawId =
    pickStr(r, ["id", "queue_item_id", "item_id"]) ?? null;
  const id = isUuid(rawId) ? (rawId as string) : null;

  // customer name from many shapes (including string-valued "customer")
  let customerName =
    pickStr(r, ["customer_name", "nome_cliente"]) ??
    (customer ? pickStr(customer, ["name", "nome", "full_name"]) : null);
  if (!customerName) {
    const cVal = r.customer;
    if (typeof cVal === "string" && cVal.trim()) customerName = cVal;
  }
  if (!customerName) customerName = pickStr(r, ["name"]);

  const whatsapp =
    pickStr(r, ["whatsapp_e164", "customer_whatsapp", "whatsapp", "phone", "telefone"]) ??
    (customer ? pickStr(customer, ["whatsapp_e164", "whatsapp", "phone", "telefone"]) : null);

  const amountCentsDirect = pickNum(r, ["amount_cents", "charge_amount_cents", "valor_cents"]);
  const amountCents =
    amountCentsDirect ??
    (charge ? pickNum(charge, ["amount_cents"]) : null) ??
    (() => {
      const a = pickNum(r, ["amount", "valor"]) ?? (charge ? pickNum(charge, ["amount"]) : null);
      return a != null ? Math.round(a * 100) : null;
    })();

  const dueDate =
    pickStr(r, ["due_at", "due_date", "charge_due_at", "charge_due_date", "vencimento"]) ??
    (charge ? pickStr(charge, ["due_at", "due_date"]) : null);

  const scheduledAt = pickStr(r, [
    "scheduled_for", "scheduled_at", "planned_for", "planned_at",
    "schedule_date", "data_planejada",
  ]);

  const status = normalizeStatus(pickStr(r, ["status", "queue_status"]));
  const allowed = pickBool(r, ["allowed", "is_allowed"]);

  return {
    id,
    customerName: customerName ?? null,
    whatsapp,
    amountCents,
    dueDate,
    scheduledAt,
    status: allowed === false && status === "planned" ? "blocked" : status,
    tone: normalizeTone(pickStr(r, ["tone", "tom"])),
    reason: pickStr(r, ["reason", "motivo"]),
    blockedReason: pickStr(r, ["blocked_reason", "block_reason", "motivo_bloqueio"]),
    attempt: pickNum(r, ["attempt_number", "attempt", "tentativa"]),
    allowed,
  };
}

// Extract the actual array of items from RPC responses that may be:
//   - an array directly
//   - { items: [...] } or { queue_preview: [...] } or { queue: [...] } or { data: [...] }
//   - { success: true, items: [...] }
function extractRows(data: unknown): Row[] {
  if (Array.isArray(data)) return data as Row[];
  const o = asRow(data);
  if (!o) return [];
  const keys = ["items", "queue_preview", "queue", "data", "rows", "results"];
  for (const k of keys) {
    const v = o[k];
    if (Array.isArray(v)) return v as Row[];
  }
  return [o];
}

function stagingLog(label: string, data: unknown) {
  if (!IS_STAGING) return;
  try {
    const rows = extractRows(data);
    const first = rows[0] ?? null;
    // eslint-disable-next-line no-console
    console.info(`[fila-simulada] ${label}`, {
      success: asRow(data)?.success ?? null,
      keys: asRow(data) ? Object.keys(asRow(data) as Row) : null,
      count: rows.length,
      first_keys: first ? Object.keys(first) : null,
      first_sample: first
        ? {
            id: first.id ?? first.queue_item_id ?? null,
            customer_id: first.customer_id ?? null,
            charge_id: first.charge_id ?? null,
            customer_name: first.customer_name ?? null,
            whatsapp_e164: first.whatsapp_e164 ?? null,
            amount_cents: first.amount_cents ?? null,
            due_at: first.due_at ?? first.due_date ?? null,
            scheduled_for: first.scheduled_for ?? first.scheduled_at ?? null,
            status: first.status ?? null,
          }
        : null,
    });
  } catch {
    /* ignore */
  }
}

function techDetail(error: { message?: string; details?: string; hint?: string; code?: string } | null, payload: unknown): string {
  const safe = JSON.stringify(payload ?? {}, null, 2);
  return [
    `mensagem: ${error?.message ?? "-"}`,
    `detalhes: ${error?.details ?? "-"}`,
    `dica: ${error?.hint ?? "-"}`,
    `código: ${error?.code ?? "-"}`,
    `payload: ${safe}`,
  ].join("\n");
}

// ---------- page ----------
function FilaSimuladaPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyErr, setCompanyErr] = useState<string | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);

  // date range
  const today = new Date();
  const in30 = new Date();
  in30.setDate(today.getDate() + 30);
  const toISO = (d: Date) => d.toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState<string>(toISO(today));
  const [toDate, setToDate] = useState<string>(toISO(in30));

  // queue
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueErr, setQueueErr] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  // preview
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<QueueItem[] | null>(null);

  // rebuild
  const [rebuilding, setRebuilding] = useState(false);
  const [confirmRebuild, setConfirmRebuild] = useState(false);

  // per-item busy
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  // filters
  const [filter, setFilter] = useState<"all" | QueueStatus>("all");
  const [query, setQuery] = useState("");

  // resolve company
  useEffect(() => {
    if (authLoading) return;
    if (!supabaseConfigured || !supabase) {
      setCompanyErr("Conexão não configurada.");
      setLoadingCompany(false);
      return;
    }
    if (!isAuthenticated) {
      setLoadingCompany(false);
      return;
    }
    let alive = true;
    (async () => {
      const r = await supabase!.from("companies").select("id").limit(1);
      if (!alive) return;
      if (r.error) {
        setCompanyErr("Não foi possível identificar a empresa.");
        setLoadingCompany(false);
        return;
      }
      const id = (r.data?.[0] as Row | undefined)?.id;
      if (!id) {
        setCompanyErr("Nenhuma empresa autorizada encontrada.");
        setLoadingCompany(false);
        return;
      }
      setCompanyId(String(id));
      setLoadingCompany(false);
    })();
    return () => { alive = false; };
  }, [authLoading, isAuthenticated]);

  // load queue
  const loadQueue = async (statusFilter: "all" | QueueStatus = filter) => {
    if (!supabase || !companyId) return;
    setQueueLoading(true);
    setQueueErr(null);
    const payload = {
      p_company_id: companyId,
      p_status: statusFilter === "all" ? null : statusFilter,
      p_customer_id: null,
      p_charge_id: null,
      p_limit: 200,
      p_offset: 0,
    };
    const { data, error } = await supabase.rpc("get_collection_simulation_queue_admin", payload);
    setQueueLoading(false);
    if (error) {
      setQueueErr(friendly(error.message, "load"));
      if (IS_STAGING) console.warn("[fila-simulada] load error", techDetail(error, payload));
      return;
    }
    stagingLog("get_collection_simulation_queue_admin", data);
    setQueue(extractRows(data).map(normalizeItem));
  };

  useEffect(() => {
    if (companyId) loadQueue("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // run preview
  const runPreview = async () => {
    if (!supabase || !companyId) return;
    setPreviewLoading(true);
    setPreviewErr(null);
    setPreview(null);
    const payload = {
      p_company_id: companyId,
      p_from_date: fromDate,
      p_to_date: toDate,
      p_limit: 100,
    };
    const { data, error } = await supabase.rpc("preview_collection_simulation_queue_admin", payload);
    setPreviewLoading(false);
    if (error) {
      setPreviewErr(friendly(error.message, "preview"));
      if (IS_STAGING) console.warn("[fila-simulada] preview error", techDetail(error, payload));
      return;
    }
    stagingLog("preview_collection_simulation_queue_admin", data);
    setPreview(extractRows(data).map(normalizeItem));
  };

  // rebuild
  const doRebuild = async () => {
    if (!supabase || !companyId) return;
    setRebuilding(true);
    const payload = {
      p_company_id: companyId,
      p_from_date: fromDate,
      p_to_date: toDate,
      p_limit: 200,
    };
    const { data, error } = await supabase.rpc("rebuild_collection_simulation_queue_admin", payload);
    setRebuilding(false);
    setConfirmRebuild(false);
    if (error) {
      toast.error(friendly(error.message, "rebuild"), {
        description: IS_STAGING ? techDetail(error, payload) : undefined,
      });
      return;
    }
    stagingLog("rebuild_collection_simulation_queue_admin", data);
    toast.success("Fila simulada reconstruída com sucesso.");
    await loadQueue();
  };

  // per-item actions
  const callAction = async (
    id: string | null,
    action: "approve_simulation" | "skip" | "cancel",
  ) => {
    if (!supabase) return;
    if (!isUuid(id)) {
      toast.error("Este item da fila está sem identificação. Atualize a lista e tente novamente.");
      return;
    }
    const payload = { p_queue_item_id: id, p_action: action };
    setBusyId(id);
    const { error } = await supabase.rpc("update_collection_queue_item_admin", payload);
    setBusyId(null);
    if (error) {
      toast.error(friendly(error.message, "action"), {
        description: IS_STAGING ? techDetail(error, payload) : undefined,
      });
      return;
    }
    if (action === "approve_simulation") toast.success("Item aprovado para simulação.");
    if (action === "skip") toast.success("Item pulado com sucesso.");
    if (action === "cancel") toast.success("Item cancelado.");
    await loadQueue();
  };

  const createMessage = async (id: string | null) => {
    if (!supabase) return;
    if (!isUuid(id)) {
      toast.error("Este item da fila está sem identificação. Atualize a lista e tente novamente.");
      return;
    }
    const payload = { p_queue_item_id: id };
    setBusyId(id);
    const { error } = await supabase.rpc("create_simulated_message_from_queue_admin", payload);
    setBusyId(null);
    if (error) {
      toast.error(friendly(error.message, "create"), {
        description: IS_STAGING ? techDetail(error, payload) : undefined,
      });
      return;
    }
    toast.success("Mensagem simulada criada com sucesso.");
    await loadQueue();
  };

  // filtered list (frontend search + filter)
  const filteredQueue = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qd = q.replace(/\D+/g, "");
    return queue.filter((it) => {
      if (filter !== "all" && it.status !== filter) return false;
      if (!q) return true;
      const name = (it.customerName ?? "").toLowerCase();
      const phone = (it.whatsapp ?? "").replace(/\D+/g, "");
      return name.includes(q) || (qd && phone.includes(qd));
    });
  }, [queue, filter, query]);

  // counts
  const counts = useMemo(() => {
    const c: Record<string, number> = {
      total: queue.length, planned: 0, blocked: 0,
      approved_simulation: 0, skipped: 0, cancelled: 0, message_created: 0,
    };
    for (const it of queue) c[it.status] = (c[it.status] ?? 0) + 1;
    return c;
  }, [queue]);

  // ---------- render ----------
  if (loadingCompany) {
    return (
      <PageContainer>
        <SectionHeader title="Fila simulada" subtitle="Carregando…" />
        <div className="space-y-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </PageContainer>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageContainer>
        <SectionHeader title="Fila simulada" />
        <EmptyState icon={ListChecks} title="Acesso restrito" description="Faça login para visualizar a fila simulada." />
      </PageContainer>
    );
  }

  if (companyErr || !companyId) {
    return (
      <PageContainer>
        <SectionHeader title="Fila simulada" />
        <EmptyState icon={AlertTriangle} title="Não foi possível abrir" description={companyErr ?? "Empresa não localizada."} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <SectionHeader
        title="Fila simulada"
        subtitle="Veja as cobranças planejadas pelo sistema antes de qualquer envio real."
      />

      {/* staging notice */}
      <div className="mb-3 flex items-start gap-2 rounded-xl border border-info/30 bg-info-soft px-3 py-2 text-xs text-info">
        <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          <strong>Ambiente de testes:</strong> nada será enviado pelo WhatsApp,
          nenhuma IA real será chamada e nenhum pagamento será criado.
        </p>
      </div>

      {/* controls */}
      <section className="mb-4 rounded-xl border border-border bg-card p-3 shadow-card sm:p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <CalendarRange className="h-4 w-4" /> Período da fila
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <Label className="mb-1 text-xs">Data inicial</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-11" />
          </div>
          <div>
            <Label className="mb-1 text-xs">Data final</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-11" />
          </div>
          <div className="flex flex-col justify-end gap-2 sm:flex-row">
            <Button onClick={runPreview} disabled={previewLoading} className="h-11 gap-1.5 sm:h-9">
              {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Gerar prévia
            </Button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            onClick={() => setConfirmRebuild(true)}
            disabled={rebuilding}
            className="h-11 gap-1.5 sm:h-9"
          >
            {rebuilding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Reconstruir fila
          </Button>
          <Button
            variant="outline"
            onClick={() => loadQueue()}
            disabled={queueLoading}
            className="h-11 gap-1.5 sm:h-9"
          >
            {queueLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Atualizar lista
          </Button>
        </div>
      </section>

      {/* preview */}
      {(previewLoading || previewErr || preview) && (
        <section className="mb-4 rounded-xl border border-primary/30 bg-primary-soft/40 p-3 shadow-card sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
              <Sparkles className="h-4 w-4" /> Prévia da fila
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmRebuild(true)}
              disabled={rebuilding}
            >
              Reconstruir fila com esta regra
            </Button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Esta é apenas uma prévia. Nada foi salvo ainda.
          </p>
          {previewLoading && (
            <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando prévia…
            </div>
          )}
          {previewErr && (
            <div className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
              {previewErr}
            </div>
          )}
          {preview && preview.length === 0 && !previewLoading && (
            <EmptyState
              icon={Inbox}
              title="Sem itens previstos"
              description="Nenhuma cobrança encontrada para gerar fila neste período."
            />
          )}
          {preview && preview.length > 0 && (
            <ul className="space-y-2">
              {preview.map((it, i) => (
                <li key={i} className="rounded-lg border border-border bg-card p-3">
                  <PreviewCardRow item={it} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* filters */}
      <div className="mb-3 flex flex-col gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou WhatsApp…"
            className="h-11 pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {FILTERS.map((f) => {
            const active = filter === f.value;
            const count = f.value === "all" ? counts.total : counts[f.value] ?? 0;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-surface-muted",
                )}
              >
                {f.label} <span className="ml-1 opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* saved queue */}
      <section>
        {queueLoading && (
          <div className="space-y-2">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        )}

        {!queueLoading && queueErr && (
          <EmptyState icon={AlertTriangle} title="Erro" description={queueErr} />
        )}

        {!queueLoading && !queueErr && queue.length === 0 && (
          <EmptyState
            icon={Inbox}
            title="Fila vazia"
            description="Nenhum item na fila simulada ainda. Gere uma prévia e reconstrua a fila."
          />
        )}

        {!queueLoading && !queueErr && queue.length > 0 && filteredQueue.length === 0 && (
          <EmptyState
            icon={Search}
            title="Nada encontrado"
            description="Ajuste os filtros ou a busca para ver outros itens."
          />
        )}

        {!queueLoading && filteredQueue.length > 0 && (
          <ul className="space-y-2">
            {filteredQueue.map((it) => (
              <li key={it.id} className="rounded-xl border border-border bg-card p-3 shadow-card sm:p-4">
                <QueueCard
                  item={it}
                  busy={busyId === it.id}
                  onApprove={() => callAction(it.id, "approve_simulation")}
                  onSkip={() => callAction(it.id, "skip")}
                  onCancel={() => setConfirmCancelId(it.id)}
                  onCreate={() => createMessage(it.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* rebuild confirm */}
      <AlertDialog open={confirmRebuild} onOpenChange={(o) => !o && setConfirmRebuild(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reconstruir fila simulada?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai atualizar a fila simulada futura com base nas regras atuais. Nada será enviado. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rebuilding}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doRebuild} disabled={rebuilding}>
              {rebuilding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reconstruir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* cancel confirm */}
      <AlertDialog open={!!confirmCancelId} onOpenChange={(o) => !o && setConfirmCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar este item da fila?</AlertDialogTitle>
            <AlertDialogDescription>
              Cancelar este item da fila simulada? Nada será apagado do histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const id = confirmCancelId;
                setConfirmCancelId(null);
                if (id) callAction(id, "cancel");
              }}
            >
              Cancelar item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

// ---------- subcomponents ----------
function PreviewCardRow({ item }: { item: QueueItem }) {
  const rel = relativeToDue(item.scheduledAt, item.dueDate);
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{item.customerName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {fmtPhone(item.whatsapp) ?? "Sem WhatsApp"} · {fmtBRL(item.amountCents)} · venc. {fmtDate(item.dueDate)}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
            item.allowed === false ? "bg-danger-soft text-danger" : "bg-success-soft text-success",
          )}
        >
          {item.allowed === false ? <XCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
          {item.allowed === false ? "Bloqueado" : "Permitido"}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span><strong className="text-foreground">Planejada:</strong> {fmtDateTime(item.scheduledAt)}</span>
        {rel && <span>({rel})</span>}
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">
          {TONE_LABEL[item.tone]}
        </span>
      </div>
      {item.allowed === false && item.blockedReason && (
        <p className="mt-1 text-xs text-danger">
          <span className="font-medium">Bloqueio:</span> {item.blockedReason}
        </p>
      )}
    </>
  );
}

function QueueCard({
  item, busy, onApprove, onSkip, onCancel, onCreate,
}: {
  item: QueueItem;
  busy: boolean;
  onApprove: () => void;
  onSkip: () => void;
  onCancel: () => void;
  onCreate: () => void;
}) {
  const rel = relativeToDue(item.scheduledAt, item.dueDate);
  const isFinal = item.status === "skipped" || item.status === "cancelled" || item.status === "message_created";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{item.customerName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {fmtPhone(item.whatsapp) ?? "Sem WhatsApp"}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
            STATUS_BADGE[item.status],
          )}
        >
          {STATUS_LABEL[item.status]}
        </span>
      </div>

      <div className="mt-2 grid gap-x-3 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
        <span><strong className="text-foreground">Valor:</strong> {fmtBRL(item.amountCents)}</span>
        <span><strong className="text-foreground">Vencimento:</strong> {fmtDate(item.dueDate)}</span>
        <span><strong className="text-foreground">Planejada:</strong> {fmtDateTime(item.scheduledAt)}</span>
        <span>
          <strong className="text-foreground">Tom:</strong> {TONE_LABEL[item.tone]}
          {item.attempt != null && (
            <> · <strong className="text-foreground">Tentativa:</strong> {item.attempt}</>
          )}
        </span>
        {rel && <span className="sm:col-span-2"><strong className="text-foreground">Relação:</strong> {rel}</span>}
      </div>

      {item.reason && (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Motivo:</span> {item.reason}
        </p>
      )}
      {item.status === "blocked" && item.blockedReason && (
        <p className="mt-1 rounded-md bg-danger-soft px-2 py-1 text-xs text-danger">
          <span className="font-medium">Bloqueio:</span> {item.blockedReason}
        </p>
      )}

      {!isFinal && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {item.status === "planned" && (
            <Button size="sm" onClick={onApprove} disabled={busy} className="h-10 gap-1.5 sm:h-9">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Aprovar
            </Button>
          )}
          {(item.status === "planned" || item.status === "approved_simulation") && (
            <Button size="sm" variant="outline" onClick={onCreate} disabled={busy} className="h-10 gap-1.5 sm:h-9">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
              Criar mensagem
            </Button>
          )}
          {(item.status === "planned" || item.status === "approved_simulation") && (
            <Button size="sm" variant="ghost" onClick={onSkip} disabled={busy} className="h-10 gap-1.5 sm:h-9">
              <SkipForward className="h-4 w-4" />
              Pular
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy} className="h-10 gap-1.5 text-danger hover:bg-danger-soft hover:text-danger sm:h-9">
            <Ban className="h-4 w-4" />
            Cancelar
          </Button>
        </div>
      )}
    </>
  );
}
