import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  FlaskConical,
  RefreshCcw,
  CalendarRange,
  AlertTriangle,
  Info,
  CheckCircle2,
  Users,
  Receipt,
  ListChecks,
  Inbox,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { EmptyState } from "@/components/ui-premium/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase, supabaseConfigured } from "@/integrations/supabase/compat";
import { useAuth } from "@/lib/use-auth";
import { flags } from "@/lib/flags";
import { toast } from "sonner";
import { getCurrentCompanyAdmin } from "@/lib/rpc-admin";

const IS_STAGING = flags.appEnv !== "production";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string =>
  typeof v === "string" && UUID_RE.test(v.trim());

export const Route = createFileRoute("/relatorio")({ component: RelatorioPage });

type Row = Record<string, unknown>;
type QueueStatus =
  | "planned"
  | "blocked"
  | "approved_simulation"
  | "skipped"
  | "cancelled"
  | "message_created";
type Tone = "amigavel" | "firme" | "curto" | "lembrete";

const STATUS_LABEL: Record<string, string> = {
  planned: "Planejada",
  blocked: "Bloqueada",
  approved_simulation: "Aprovada",
  skipped: "Pulada",
  cancelled: "Cancelada",
  message_created: "Mensagem criada",
};
const STATUS_BADGE: Record<string, string> = {
  planned: "bg-info-soft text-info",
  blocked: "bg-danger-soft text-danger",
  approved_simulation: "bg-primary-soft text-primary",
  skipped: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
  message_created: "bg-success-soft text-success",
};
const TONE_LABEL: Record<string, string> = {
  amigavel: "Amigável",
  firme: "Firme",
  curto: "Curto",
  lembrete: "Lembrete",
};

// helpers
function asRow(v: unknown): Row | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : null;
}
function pickStr(r: Row | null, keys: string[]): string | null {
  if (!r) return null;
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}
function pickNum(r: Row | null, keys: string[]): number | null {
  if (!r) return null;
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && !isNaN(Number(v))) return Number(v);
  }
  return null;
}
const n = (v: unknown): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && !isNaN(Number(v))) return Number(v);
  return 0;
};
const fmtDate = (s: string | null | undefined) => {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(+d)) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};
const fmtBRL = (cents: number | null) => {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};
const fmtInt = (v: number) => v.toLocaleString("pt-BR");
const fmtPhone = (s: string | null) => {
  if (!s) return null;
  const d = s.replace(/\D+/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length >= 12) return `+${d.slice(0, d.length - 11)} (${d.slice(-11, -9)}) ${d.slice(-9, -4)}-${d.slice(-4)}`;
  return s;
};
function friendly(message: string): string {
  const m = (message || "").toLowerCase();
  if (m.includes("permission") || m.includes("denied") || m.includes("rls") || m.includes("not allowed"))
    return "Você não tem permissão para esta consulta.";
  if (m.includes("auth") || m.includes("jwt")) return "Faça login novamente para continuar.";
  if (m.includes("network") || m.includes("fetch")) return "Falha de conexão. Tente novamente.";
  return "Não foi possível concluir esta operação agora.";
}
function techDetail(
  error: { message?: string; details?: string; hint?: string; code?: string } | null,
  payload: unknown,
): string {
  return [
    `mensagem: ${error?.message ?? "-"}`,
    `detalhes: ${error?.details ?? "-"}`,
    `dica: ${error?.hint ?? "-"}`,
    `código: ${error?.code ?? "-"}`,
    `payload: ${JSON.stringify(payload ?? {}, null, 2)}`,
  ].join("\n");
}

type Summary = {
  total_queue_items: number;
  planned: number;
  blocked: number;
  approved_simulation: number;
  skipped: number;
  cancelled: number;
  message_created: number;
  unique_customers: number;
  total_amount_cents: number;
  pending_charges: number;
  overdue_charges: number;
  paid_charges: number;
  cancelled_charges: number;
  by_status: Array<{ key: string; count: number }>;
  by_tone: Array<{ key: string; count: number }>;
  by_blocked_reason: Array<{ key: string; count: number }>;
  by_day: Array<{ key: string; count: number }>;
  recent_items: Row[];
};

function extractObject(data: unknown): Row {
  if (Array.isArray(data) && data.length) {
    const r = asRow(data[0]);
    if (r) return r;
  }
  const o = asRow(data);
  if (o) {
    // sometimes wrapped under .data or .summary
    if (asRow(o.summary)) return asRow(o.summary)!;
    if (asRow(o.data)) return asRow(o.data)!;
    return o;
  }
  return {};
}

function toGroup(v: unknown): Array<{ key: string; count: number }> {
  // accept array of {key,count} | {status/tone/reason/day, count} or object map
  if (Array.isArray(v)) {
    return v
      .map((it) => {
        const r = asRow(it) ?? {};
        const key =
          pickStr(r, ["key", "status", "tone", "reason", "blocked_reason", "day", "date", "label"]) ?? "—";
        const count = pickNum(r, ["count", "qty", "quantity", "total"]) ?? 0;
        return { key, count };
      })
      .filter((x) => x.key);
  }
  const o = asRow(v);
  if (o) {
    return Object.entries(o).map(([key, val]) => ({ key, count: n(val) }));
  }
  return [];
}

function normalizeSummary(data: unknown): Summary {
  const o = extractObject(data);
  return {
    total_queue_items: n(o.total_queue_items ?? o.total),
    planned: n(o.planned),
    blocked: n(o.blocked),
    approved_simulation: n(o.approved_simulation ?? o.approved),
    skipped: n(o.skipped),
    cancelled: n(o.cancelled),
    message_created: n(o.message_created ?? o.messages_created),
    unique_customers: n(o.unique_customers ?? o.customers),
    total_amount_cents: n(o.total_amount_cents ?? o.amount_cents),
    pending_charges: n(o.pending_charges),
    overdue_charges: n(o.overdue_charges),
    paid_charges: n(o.paid_charges),
    cancelled_charges: n(o.cancelled_charges),
    by_status: toGroup(o.by_status),
    by_tone: toGroup(o.by_tone),
    by_blocked_reason: toGroup(o.by_blocked_reason ?? o.by_block_reason),
    by_day: toGroup(o.by_day ?? o.by_date),
    recent_items: Array.isArray(o.recent_items) ? (o.recent_items as Row[]) : [],
  };
}

type Alert = {
  type: "warning" | "info" | "success";
  title: string;
  description: string | null;
  count: number | null;
};
function normalizeAlerts(data: unknown): Alert[] {
  let arr: unknown[] = [];
  if (Array.isArray(data)) arr = data;
  else {
    const o = asRow(data);
    if (o) {
      if (Array.isArray(o.alerts)) arr = o.alerts;
      else if (Array.isArray(o.data)) arr = o.data;
    }
  }
  return arr
    .map((it) => {
      const r = asRow(it) ?? {};
      const rawType = (pickStr(r, ["type", "level", "severity"]) ?? "info").toLowerCase();
      const type: Alert["type"] =
        rawType === "warning" || rawType === "warn" || rawType === "danger" || rawType === "error"
          ? "warning"
          : rawType === "success" || rawType === "ok"
            ? "success"
            : "info";
      return {
        type,
        title: pickStr(r, ["title", "name", "label"]) ?? "Aviso",
        description: pickStr(r, ["description", "message", "detail"]),
        count: pickNum(r, ["count", "qty", "quantity", "total"]),
      };
    })
    .filter((a) => a.title);
}

type RecentItem = {
  customerId: string | null;
  customerName: string | null;
  whatsapp: string | null;
  amountCents: number | null;
  dueDate: string | null;
  scheduledAt: string | null;
  status: string;
  tone: string;
  reason: string | null;
  blockedReason: string | null;
};
function normalizeRecent(r: Row): RecentItem {
  const customer = asRow(r.customer);
  const charge = asRow(r.charge);
  const rawCid = pickStr(r, ["customer_id", "cliente_id"]) ?? (customer ? pickStr(customer, ["id"]) : null);
  const name =
    pickStr(r, ["customer_name", "nome_cliente"]) ??
    pickStr(customer, ["name", "nome", "full_name"]);
  const whatsapp =
    pickStr(r, ["whatsapp_e164", "customer_whatsapp", "whatsapp", "phone"]) ??
    pickStr(customer, ["whatsapp_e164", "whatsapp", "phone"]);
  const amountDirect = pickNum(r, ["amount_cents", "charge_amount_cents"]);
  const amount =
    amountDirect ??
    pickNum(charge, ["amount_cents"]) ??
    (() => {
      const a = pickNum(r, ["amount"]) ?? pickNum(charge, ["amount"]);
      return a != null ? Math.round(a * 100) : null;
    })();
  const dueDate =
    pickStr(r, ["due_at", "due_date", "charge_due_at"]) ?? pickStr(charge, ["due_at", "due_date"]);
  const scheduledAt = pickStr(r, ["scheduled_for", "scheduled_at", "planned_for"]);
  return {
    customerId: isUuid(rawCid) ? (rawCid as string) : null,
    customerName: name ?? null,
    whatsapp,
    amountCents: amount,
    dueDate,
    scheduledAt,
    status: (pickStr(r, ["status"]) ?? "planned").toLowerCase(),
    tone: (pickStr(r, ["tone", "tom"]) ?? "amigavel").toLowerCase(),
    reason: pickStr(r, ["reason", "motivo"]),
    blockedReason: pickStr(r, ["blocked_reason", "block_reason"]),
  };
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function RelatorioPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyErr, setCompanyErr] = useState<string | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);

  const today = new Date();
  const in30 = new Date();
  in30.setDate(today.getDate() + 30);
  const [fromDate, setFromDate] = useState<string>(toISO(today));
  const [toDate, setToDate] = useState<string>(toISO(in30));

  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryErr, setSummaryErr] = useState<string | null>(null);
  const [summaryTech, setSummaryTech] = useState<string | null>(null);

  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsErr, setAlertsErr] = useState<string | null>(null);
  const [alertsTech, setAlertsTech] = useState<string | null>(null);

  const [showSummaryTech, setShowSummaryTech] = useState(false);
  const [showAlertsTech, setShowAlertsTech] = useState(false);

  // customer modal
  const [openCustomer, setOpenCustomer] = useState<{ id: string; name: string | null } | null>(null);
  const [customerData, setCustomerData] = useState<Row | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerErr, setCustomerErr] = useState<string | null>(null);
  const [customerTech, setCustomerTech] = useState<string | null>(null);
  const [showCustomerTech, setShowCustomerTech] = useState(false);

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
      const { companyId: id, error } = await getCurrentCompanyAdmin();
      if (!alive) return;
      if (error) {
        setCompanyErr("Não foi possível identificar a empresa.");
        setLoadingCompany(false);
        return;
      }
      if (!id) {
        setCompanyErr("Nenhuma empresa autorizada encontrada.");
        setLoadingCompany(false);
        return;
      }
      setCompanyId(id);
      setLoadingCompany(false);
    })();
    return () => {
      alive = false;
    };
  }, [authLoading, isAuthenticated]);

  const loadAll = async () => {
    if (!supabase || !companyId) return;
    setSummaryLoading(true);
    setAlertsLoading(true);
    setSummaryErr(null);
    setAlertsErr(null);
    setSummaryTech(null);
    setAlertsTech(null);

    const payload = { p_company_id: companyId, p_from_date: fromDate, p_to_date: toDate };

    const [resSum, resAlerts] = await Promise.all([
      supabase.rpc("get_collection_simulation_summary_admin", payload),
      supabase.rpc("get_collection_simulation_alerts_admin", payload),
    ]);

    setSummaryLoading(false);
    if (resSum.error) {
      setSummaryErr(friendly(resSum.error.message));
      if (IS_STAGING) setSummaryTech(techDetail(resSum.error, payload));
    } else {
      setSummary(normalizeSummary(resSum.data));
    }

    setAlertsLoading(false);
    if (resAlerts.error) {
      setAlertsErr(friendly(resAlerts.error.message));
      if (IS_STAGING) setAlertsTech(techDetail(resAlerts.error, payload));
    } else {
      setAlerts(normalizeAlerts(resAlerts.data));
    }
  };

  useEffect(() => {
    if (companyId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const loadCustomer = async (customerId: string) => {
    if (!supabase || !companyId) return;
    setCustomerLoading(true);
    setCustomerErr(null);
    setCustomerData(null);
    setCustomerTech(null);
    const payload = {
      p_company_id: companyId,
      p_customer_id: customerId,
      p_from_date: fromDate,
      p_to_date: toDate,
    };
    const { data, error } = await supabase.rpc(
      "get_collection_simulation_customer_summary_admin",
      payload,
    );
    setCustomerLoading(false);
    if (error) {
      const m = error.message?.toLowerCase() ?? "";
      setCustomerErr(
        m.includes("permission") || m.includes("denied") || m.includes("rls")
          ? "Você não tem permissão para ver este cliente."
          : "Não foi possível carregar o resumo deste cliente.",
      );
      if (IS_STAGING) setCustomerTech(techDetail(error, payload));
      return;
    }
    setCustomerData(extractObject(data));
  };

  const openCustomerModal = (it: RecentItem) => {
    if (!it.customerId) {
      toast.error("Este item não está vinculado a um cliente identificado.");
      return;
    }
    setOpenCustomer({ id: it.customerId, name: it.customerName });
    setShowCustomerTech(false);
    loadCustomer(it.customerId);
  };

  const recentItems = useMemo<RecentItem[]>(
    () => (summary?.recent_items ?? []).map(normalizeRecent),
    [summary],
  );

  // ---------- render ----------
  if (loadingCompany) {
    return (
      <PageContainer>
        <SectionHeader title="Relatório da simulação" subtitle="Carregando…" />
        <Skeleton className="h-24 w-full" />
      </PageContainer>
    );
  }
  if (!isAuthenticated) {
    return (
      <PageContainer>
        <SectionHeader title="Relatório da simulação" />
        <EmptyState
          icon={BarChart3}
          title="Acesso restrito"
          description="Faça login para visualizar o relatório."
        />
      </PageContainer>
    );
  }
  if (companyErr || !companyId) {
    return (
      <PageContainer>
        <SectionHeader title="Relatório da simulação" />
        <EmptyState
          icon={AlertTriangle}
          title="Não foi possível abrir"
          description={companyErr ?? "Empresa não localizada."}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <SectionHeader
        title="Relatório da simulação"
        subtitle="Acompanhe o resultado da fila simulada antes de qualquer envio real."
      />

      {/* staging notice */}
      <div className="mb-3 flex items-start gap-2 rounded-xl border border-info/30 bg-info-soft px-3 py-2 text-xs text-info">
        <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          <strong>Ambiente de testes:</strong> nenhum WhatsApp real, pagamento real ou IA real será
          executado.
        </p>
      </div>

      {/* filters */}
      <section className="mb-4 rounded-xl border border-border bg-card p-3 shadow-card sm:p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <CalendarRange className="h-4 w-4" /> Período do relatório
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <Label className="mb-1 text-xs">Data inicial</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-11"
            />
          </div>
          <div>
            <Label className="mb-1 text-xs">Data final</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={loadAll}
              disabled={summaryLoading || alertsLoading}
              className="h-11 w-full sm:w-auto"
            >
              <RefreshCcw
                className={cn("h-4 w-4", (summaryLoading || alertsLoading) && "animate-spin")}
              />
              {summaryLoading || alertsLoading ? "Atualizando…" : "Atualizar relatório"}
            </Button>
          </div>
        </div>
      </section>

      {/* shortcut links */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/fila-simulada">
            <ListChecks className="h-4 w-4" /> Abrir fila simulada
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/cobrancas">
            <Receipt className="h-4 w-4" /> Cobranças
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/clientes">
            <Users className="h-4 w-4" /> Clientes
          </Link>
        </Button>
      </div>

      {/* summary */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">Resumo da fila</h2>
        {summaryLoading && !summary ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : summaryErr ? (
          <div className="rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
            <p className="font-medium">Não foi possível carregar o relatório agora.</p>
            <p className="mt-0.5 text-xs opacity-80">{summaryErr}</p>
            {IS_STAGING && summaryTech && (
              <TechBlock
                open={showSummaryTech}
                onToggle={() => setShowSummaryTech((v) => !v)}
                content={summaryTech}
              />
            )}
          </div>
        ) : !summary || summary.total_queue_items === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Nenhum dado encontrado para este período"
            description="Ajuste as datas e clique em Atualizar relatório."
          />
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Total na fila" value={fmtInt(summary.total_queue_items)} />
              <Stat label="Planejadas" value={fmtInt(summary.planned)} tone="info" />
              <Stat label="Bloqueadas" value={fmtInt(summary.blocked)} tone="danger" />
              <Stat
                label="Aprovadas"
                value={fmtInt(summary.approved_simulation)}
                tone="primary"
              />
              <Stat label="Puladas" value={fmtInt(summary.skipped)} />
              <Stat label="Canceladas" value={fmtInt(summary.cancelled)} />
              <Stat
                label="Mensagens criadas"
                value={fmtInt(summary.message_created)}
                tone="success"
              />
              <Stat label="Clientes impactados" value={fmtInt(summary.unique_customers)} />
              <Stat label="Valor total envolvido" value={fmtBRL(summary.total_amount_cents)} />
              <Stat label="Cobranças pendentes" value={fmtInt(summary.pending_charges)} />
              <Stat
                label="Cobranças vencidas"
                value={fmtInt(summary.overdue_charges)}
                tone="danger"
              />
              <Stat label="Cobranças pagas" value={fmtInt(summary.paid_charges)} tone="success" />
              <Stat label="Cobranças canceladas" value={fmtInt(summary.cancelled_charges)} />
            </div>
          </>
        )}
      </section>

      {/* alerts */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">Alertas da simulação</h2>
        {alertsLoading && !alerts ? (
          <Skeleton className="h-20 w-full" />
        ) : alertsErr ? (
          <div className="rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
            <p className="font-medium">Não foi possível carregar os alertas agora.</p>
            <p className="mt-0.5 text-xs opacity-80">{alertsErr}</p>
            {IS_STAGING && alertsTech && (
              <TechBlock
                open={showAlertsTech}
                onToggle={() => setShowAlertsTech((v) => !v)}
                content={alertsTech}
              />
            )}
          </div>
        ) : !alerts || alerts.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface px-3 py-4 text-sm text-muted-foreground">
            Sem alertas importantes neste período.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {alerts.map((a, i) => (
              <AlertCard key={i} alert={a} />
            ))}
          </div>
        )}
      </section>

      {/* groupings */}
      {summary && (
        <section className="mb-6 grid gap-4 lg:grid-cols-2">
          <GroupCard
            title="Por status da fila"
            items={summary.by_status.map((it) => ({
              label: STATUS_LABEL[it.key] ?? it.key,
              count: it.count,
            }))}
          />
          <GroupCard
            title="Por tom"
            items={summary.by_tone.map((it) => ({
              label: TONE_LABEL[it.key] ?? it.key,
              count: it.count,
            }))}
          />
          <GroupCard
            title="Por motivo de bloqueio"
            items={summary.by_blocked_reason.map((it) => ({ label: it.key, count: it.count }))}
          />
          <GroupCard
            title="Por dia"
            items={summary.by_day.map((it) => ({ label: fmtDate(it.key), count: it.count }))}
          />
        </section>
      )}

      {/* recent items */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">Itens recentes da fila</h2>
        {recentItems.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface px-3 py-4 text-sm text-muted-foreground">
            Sem itens recentes neste período.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {recentItems.map((it, i) => (
              <button
                key={i}
                onClick={() => openCustomerModal(it)}
                className="rounded-xl border border-border bg-card p-3 text-left shadow-card transition hover:shadow-pop"
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-semibold">
                    {it.customerName ?? "Cliente não identificado"}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                      STATUS_BADGE[it.status] ?? "bg-muted text-muted-foreground",
                    )}
                  >
                    {STATUS_LABEL[it.status] ?? it.status}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {fmtPhone(it.whatsapp) ?? "Sem WhatsApp"}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  <span>
                    <span className="text-muted-foreground">Valor:</span>{" "}
                    <strong>{fmtBRL(it.amountCents)}</strong>
                  </span>
                  <span>
                    <span className="text-muted-foreground">Venc.:</span> {fmtDate(it.dueDate)}
                  </span>
                  <span>
                    <span className="text-muted-foreground">Planejada:</span>{" "}
                    {fmtDate(it.scheduledAt)}
                  </span>
                  <span>
                    <span className="text-muted-foreground">Tom:</span>{" "}
                    {TONE_LABEL[it.tone] ?? it.tone}
                  </span>
                </div>
                {(it.reason || it.blockedReason) && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {it.blockedReason
                      ? `Motivo de bloqueio: ${it.blockedReason}`
                      : `Motivo: ${it.reason}`}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* customer modal */}
      <Dialog open={!!openCustomer} onOpenChange={(o) => !o && setOpenCustomer(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Resumo do cliente</DialogTitle>
            <DialogDescription>
              {openCustomer?.name ?? "Cliente"} — período {fmtDate(fromDate)} a {fmtDate(toDate)}
            </DialogDescription>
          </DialogHeader>
          {customerLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : customerErr ? (
            <div className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
              <p className="font-medium">{customerErr}</p>
              {IS_STAGING && customerTech && (
                <TechBlock
                  open={showCustomerTech}
                  onToggle={() => setShowCustomerTech((v) => !v)}
                  content={customerTech}
                />
              )}
            </div>
          ) : (
            <CustomerSummaryView data={customerData} />
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "info" | "danger" | "primary" | "success";
}) {
  const map: Record<string, string> = {
    default: "text-foreground",
    info: "text-info",
    danger: "text-danger",
    primary: "text-primary",
    success: "text-success",
  };
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-card">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold tracking-tight", map[tone])}>{value}</p>
    </div>
  );
}

function AlertCard({ alert }: { alert: Alert }) {
  const iconMap = {
    warning: AlertTriangle,
    info: Info,
    success: CheckCircle2,
  };
  const styleMap: Record<Alert["type"], string> = {
    warning: "border-warning/30 bg-warning-soft text-warning",
    info: "border-info/30 bg-info-soft text-info",
    success: "border-success/30 bg-success-soft text-success",
  };
  const labelMap: Record<Alert["type"], string> = {
    warning: "Atenção",
    info: "Informação",
    success: "Tudo certo",
  };
  const Icon = iconMap[alert.type];
  return (
    <div className={cn("rounded-xl border p-3", styleMap[alert.type])}>
      <div className="mb-1 flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] font-semibold uppercase tracking-wide">
          {labelMap[alert.type]}
        </span>
        {alert.count != null && (
          <span className="ml-auto rounded-full bg-background/40 px-2 py-0.5 text-xs font-medium">
            {fmtInt(alert.count)}
          </span>
        )}
      </div>
      <p className="text-sm font-semibold text-foreground">{alert.title}</p>
      {alert.description && (
        <p className="mt-0.5 text-xs text-foreground/80">{alert.description}</p>
      )}
    </div>
  );
}

function GroupCard({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; count: number }>;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-card">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem dados neste período.</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((it, i) => (
            <li key={i} className="flex items-center justify-between py-1.5 text-sm">
              <span className="truncate pr-2">{it.label}</span>
              <strong className="tabular-nums">{fmtInt(it.count)}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CustomerSummaryView({ data }: { data: Row | null }) {
  if (!data) {
    return <p className="text-sm text-muted-foreground">Sem dados do cliente.</p>;
  }
  const customer = asRow(data.customer);
  const name =
    pickStr(data, ["customer_name", "name"]) ??
    pickStr(customer, ["name", "nome", "full_name"]) ??
    "Cliente";
  const whatsapp =
    pickStr(data, ["whatsapp_e164", "whatsapp", "phone"]) ??
    pickStr(customer, ["whatsapp_e164", "whatsapp", "phone"]);
  const total = n(data.total_queue_items ?? data.total);
  const stats = [
    { label: "Total de itens", value: fmtInt(total) },
    { label: "Planejadas", value: fmtInt(n(data.planned)) },
    { label: "Bloqueadas", value: fmtInt(n(data.blocked)) },
    { label: "Aprovadas", value: fmtInt(n(data.approved_simulation ?? data.approved)) },
    { label: "Puladas", value: fmtInt(n(data.skipped)) },
    { label: "Canceladas", value: fmtInt(n(data.cancelled)) },
    {
      label: "Mensagens criadas",
      value: fmtInt(n(data.message_created ?? data.messages_created)),
    },
    {
      label: "Valor total",
      value: fmtBRL(n(data.total_amount_cents ?? data.amount_cents)),
    },
  ];
  const items: Row[] = Array.isArray(data.items)
    ? (data.items as Row[])
    : Array.isArray(data.queue_items)
      ? (data.queue_items as Row[])
      : [];

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="text-sm font-semibold">{name}</p>
        <p className="text-xs text-muted-foreground">{fmtPhone(whatsapp) ?? "Sem WhatsApp"}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {stats.map((s, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="text-sm font-semibold">{s.value}</p>
          </div>
        ))}
      </div>
      {items.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold">Itens deste cliente</h4>
          <ul className="space-y-1.5">
            {items.map((r, i) => {
              const it = normalizeRecent(r);
              return (
                <li key={i} className="rounded-lg border border-border bg-card p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      <strong>{fmtBRL(it.amountCents)}</strong> · venc. {fmtDate(it.dueDate)}
                    </span>
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                        STATUS_BADGE[it.status] ?? "bg-muted text-muted-foreground",
                      )}
                    >
                      {STATUS_LABEL[it.status] ?? it.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-muted-foreground">
                    Planejada: {fmtDate(it.scheduledAt)} · Tom: {TONE_LABEL[it.tone] ?? it.tone}
                  </p>
                  {it.blockedReason && (
                    <p className="mt-0.5 text-[11px] text-danger">
                      Motivo de bloqueio: {it.blockedReason}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function TechBlock({
  open,
  onToggle,
  content,
}: {
  open: boolean;
  onToggle: () => void;
  content: string;
}) {
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 text-[11px] font-medium opacity-80 hover:opacity-100"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Detalhe técnico (staging)
      </button>
      {open && (
        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-background/60 p-2 text-[10px] leading-snug text-foreground/80">
          {content}
        </pre>
      )}
    </div>
  );
}
