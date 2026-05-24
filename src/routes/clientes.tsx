import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Search,
  Eye,
  Pencil,
  Archive,
  RotateCcw,
  Loader2,
  X,
  MessageSquare,
  Receipt,
  Save,
  History,
  UserCog,
  UserCheck,
  UserX,
  FilePlus2,
  FileEdit,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Clock,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { EmptyState } from "@/components/ui-premium/EmptyState";
import { ListCardSkeleton } from "@/components/ui-premium/Skeletons";
import { HelpTip } from "@/components/ui-premium/HelpTip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import { SimulatedMessagesPanel } from "@/components/messages/simulated-messages";
import { supabase, supabaseConfigured } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/clientes")({ component: ClientesPage });

// ---------- helpers ----------
type Row = Record<string, unknown>;

const str = (r: Row, keys: string[]) => {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "number") return String(v);
  }
  return null;
};
const num = (r: Row, keys: string[]) => {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.trim() && !isNaN(Number(v))) return Number(v);
  }
  return null;
};
const fmtBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
const fmtDate = (s: string | null | undefined) => {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(+d) ? s : d.toLocaleDateString("pt-BR");
};
const onlyDigits = (s: string) => s.replace(/\D+/g, "");
const toE164 = (s: string) => {
  const d = onlyDigits(s);
  if (!d) return "";
  return d.startsWith("55") ? `+${d}` : `+55${d}`;
};
const prettyPhone = (s: string | null | undefined) => {
  if (!s) return null;
  const d = onlyDigits(s);
  if (d.length === 13 && d.startsWith("55"))
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 11)
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return s;
};

type StatusKind = "ativo" | "expirado" | "arquivado" | "outro";
const classifyStatus = (s: string | null | undefined): StatusKind => {
  const v = (s ?? "").toLowerCase();
  if (!v) return "outro";
  if (/arquiv|inativ|cancel|deleted|removed/.test(v)) return "arquivado";
  if (/expir|vencido|atras/.test(v)) return "expirado";
  if (/ativ|active/.test(v)) return "ativo";
  return "outro";
};
const statusLabel = (s: string | null | undefined) => {
  const k = classifyStatus(s);
  if (k === "ativo") return "Ativo";
  if (k === "expirado") return "Expirado";
  if (k === "arquivado") return "Arquivado";
  return s ?? "—";
};
const statusClass = (s: string | null | undefined) => {
  const k = classifyStatus(s);
  if (k === "ativo") return "bg-success-soft text-success";
  if (k === "expirado") return "bg-warning-soft text-warning";
  if (k === "arquivado") return "bg-muted text-muted-foreground";
  return "bg-info-soft text-info";
};

type Customer = {
  id: string;
  name: string;
  whatsapp: string | null;
  amount_cents: number | null;
  due_day: number | null;
  status: string | null;
  notes: string | null;
  raw: Row;
};

const normalize = (r: Row): Customer => ({
  id: String(r.id ?? ""),
  name: str(r, ["name", "nome", "full_name"]) ?? "Cliente",
  whatsapp:
    str(r, ["whatsapp_e164", "whatsapp", "phone", "telefone"]) ?? null,
  amount_cents:
    num(r, ["amount_cents"]) ??
    (num(r, ["amount", "valor", "value", "monthly_amount"]) !== null
      ? Math.round((num(r, ["amount", "valor", "value", "monthly_amount"]) as number) * 100)
      : null),
  due_day: num(r, ["due_day", "dia_vencimento", "vencimento_dia"]),
  status: str(r, ["status", "situacao"]),
  notes: str(r, ["notes", "observacoes", "observacao"]),
  raw: r,
});

function friendlyRpcError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("permission") || m.includes("not allowed") || m.includes("denied") || m.includes("rls"))
    return "Você não tem permissão para esta ação.";
  if (m.includes("phone") || m.includes("whatsapp"))
    return "Revise o WhatsApp informado.";
  if (m.includes("amount") || m.includes("valor"))
    return "Informe um valor válido.";
  if (m.includes("due_day") || m.includes("vencimento"))
    return "O dia de vencimento deve ser entre 1 e 31.";
  if (m.includes("network") || m.includes("fetch"))
    return "Falha de conexão. Tente novamente.";
  return msg;
}

// ---------- page ----------
type Filter = "todos" | "ativo" | "expirado" | "arquivado";

function ClientesPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Customer[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [openId, setOpenId] = useState<string | null>(null);
  const [reloadBump, setReloadBump] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!supabaseConfigured || !supabase) {
      setLoading(false);
      setErrorMsg("Conexão não configurada");
      return;
    }
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setErrorMsg(null);
    (async () => {
      const { data, error } = await supabase!
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!alive) return;
      if (error) {
        setErrorMsg(friendlyRpcError(error.message));
        setItems(null);
      } else {
        setItems(((data ?? []) as Row[]).map(normalize));
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [isAuthenticated, authLoading, reloadBump]);

  const reload = () => setReloadBump((n) => n + 1);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    return items.filter((c) => {
      const kind = classifyStatus(c.status);
      if (filter !== "todos" && kind !== filter) return false;
      if (!q) return true;
      const phone = onlyDigits(c.whatsapp ?? "");
      return (
        c.name.toLowerCase().includes(q) ||
        phone.includes(onlyDigits(q)) ||
        (c.whatsapp ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, query, filter]);

  const counts = useMemo(() => {
    const c = { todos: 0, ativo: 0, expirado: 0, arquivado: 0 };
    if (items) {
      c.todos = items.length;
      for (const it of items) {
        const k = classifyStatus(it.status);
        if (k === "ativo") c.ativo++;
        else if (k === "expirado") c.expirado++;
        else if (k === "arquivado") c.arquivado++;
      }
    }
    return c;
  }, [items]);

  const opened = openId ? items?.find((c) => c.id === openId) ?? null : null;

  return (
    <PageContainer>
      <SectionHeader
        title="Clientes"
        subtitle="Gerencie sua base de clientes"
        hint="Edite, arquive e consulte o histórico de cada cliente com segurança."
      />

      {/* Busca */}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome ou WhatsApp"
          className="h-11 pl-9 pr-9"
          inputMode="search"
        />
        {query && (
          <button
            type="button"
            aria-label="Limpar busca"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="mb-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <FilterPill active={filter === "todos"} onClick={() => setFilter("todos")} label="Todos" count={counts.todos} />
        <FilterPill active={filter === "ativo"} onClick={() => setFilter("ativo")} label="Ativos" count={counts.ativo} />
        <FilterPill active={filter === "expirado"} onClick={() => setFilter("expirado")} label="Expirados" count={counts.expirado} />
        <FilterPill active={filter === "arquivado"} onClick={() => setFilter("arquivado")} label="Arquivados" count={counts.arquivado} />
      </div>

      {/* Estados */}
      {!isAuthenticated && !authLoading && (
        <EmptyState icon={Users} title="Entre para ver seus clientes" description="Faça login para gerenciar sua base." />
      )}

      {isAuthenticated && loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <ListCardSkeleton key={i} />
          ))}
        </div>
      )}

      {isAuthenticated && !loading && errorMsg && (
        <EmptyState icon={Users} title="Não foi possível carregar" description={errorMsg} />
      )}

      {isAuthenticated && !loading && !errorMsg && filtered.length === 0 && (
        <EmptyState
          icon={Users}
          title="Nenhum cliente encontrado"
          description={query ? "Tente outra busca." : "Importe clientes para começar."}
        />
      )}

      {isAuthenticated && !loading && !errorMsg && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((c) => (
            <ClientCard key={c.id} customer={c} onOpen={() => setOpenId(c.id)} />
          ))}
        </div>
      )}

      <CustomerSheet
        customer={opened}
        open={!!opened}
        onClose={() => setOpenId(null)}
        onChanged={reload}
      />
    </PageContainer>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-muted",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
          active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function ClientCard({ customer, onOpen }: { customer: Customer; onOpen: () => void }) {
  const phone = prettyPhone(customer.whatsapp);
  const initial = customer.name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-card">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-info-soft text-info text-sm font-semibold">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{customer.name}</p>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                statusClass(customer.status),
              )}
            >
              {statusLabel(customer.status)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {phone ?? "Sem contato cadastrado"}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>
              {customer.amount_cents != null
                ? <strong className="font-semibold text-foreground">{fmtBRL(customer.amount_cents)}</strong>
                : "Sem valor"}{" "}
              / mês
            </span>
            {customer.due_day != null && (
              <span>Vence dia {customer.due_day}</span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button size="sm" variant="outline" onClick={onOpen} className="gap-1.5">
          <Eye className="h-3.5 w-3.5" /> Ver detalhes
        </Button>
      </div>
    </div>
  );
}

// ---------- detail sheet ----------
type DetailsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: Row };

type Mode = "view" | "edit";

function CustomerSheet({
  customer,
  open,
  onClose,
  onChanged,
}: {
  customer: Customer | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [details, setDetails] = useState<DetailsState>({ status: "loading" });
  const [mode, setMode] = useState<Mode>("view");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [busy, setBusy] = useState<null | "save" | "archive" | "reactivate">(null);
  const [timelineBump, setTimelineBump] = useState(0);
  const reloadTimeline = () => setTimelineBump((n) => n + 1);

  useEffect(() => {
    if (!open || !customer) return;
    setMode("view");
    setDetails({ status: "loading" });
    if (!supabase) return;
    let alive = true;
    (async () => {
      const { data, error } = await supabase!.rpc("get_customer_details_admin", {
        p_customer_id: customer.id,
      });
      if (!alive) return;
      if (error) {
        setDetails({ status: "error", message: friendlyRpcError(error.message) });
      } else {
        const payload = Array.isArray(data) ? data[0] : data;
        setDetails({ status: "ready", data: (payload as Row) ?? {} });
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, customer?.id]);

  if (!customer) return null;

  const detailRow = details.status === "ready" ? details.data : null;
  const merged: Customer = detailRow
    ? { ...customer, ...normalize({ ...customer.raw, ...detailRow }) }
    : customer;

  const kind = classifyStatus(merged.status);
  const canReactivate = kind === "arquivado" || kind === "expirado" || /cancel/i.test(merged.status ?? "");

  const handleArchive = async () => {
    if (!supabase) return;
    setBusy("archive");
    const { error } = await supabase.rpc("archive_customer_admin", {
      p_customer_id: customer.id,
    });
    setBusy(null);
    setConfirmArchive(false);
    if (error) {
      toast.error(friendlyRpcError(error.message));
      return;
    }
    toast.success("Cliente arquivado com sucesso.");
    onChanged();
    reloadTimeline();
    onClose();
  };

  const handleReactivate = async () => {
    if (!supabase) return;
    setBusy("reactivate");
    const { error } = await supabase.rpc("reactivate_customer_admin", {
      p_customer_id: customer.id,
    });
    setBusy(null);
    if (error) {
      toast.error(friendlyRpcError(error.message));
      return;
    }
    toast.success("Cliente reativado com sucesso.");
    onChanged();
    reloadTimeline();
    // refresh details inline
    setDetails({ status: "loading" });
    const { data } = await supabase.rpc("get_customer_details_admin", {
      p_customer_id: customer.id,
    });
    const payload = Array.isArray(data) ? data[0] : data;
    setDetails({ status: "ready", data: (payload as Row) ?? {} });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="text-base">{merged.name}</SheetTitle>
          <SheetDescription className="text-xs">
            {prettyPhone(merged.whatsapp) ?? "Sem WhatsApp cadastrado"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 px-4 py-4">
          {details.status === "loading" && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {details.status === "error" && (
            <EmptyState icon={Users} title="Não foi possível carregar" description={details.message} />
          )}
          {details.status === "ready" && mode === "view" && (
            <DetailView customer={merged} raw={details.data} timelineBump={timelineBump} />
          )}
          {details.status === "ready" && mode === "edit" && (
            <EditForm
              customer={merged}
              busy={busy === "save"}
              onCancel={() => setMode("view")}
              onSaved={async () => {
                setMode("view");
                onChanged();
                reloadTimeline();
                // refresh
                if (!supabase) return;
                setDetails({ status: "loading" });
                const { data } = await supabase.rpc("get_customer_details_admin", {
                  p_customer_id: customer.id,
                });
                const payload = Array.isArray(data) ? data[0] : data;
                setDetails({ status: "ready", data: (payload as Row) ?? {} });
              }}
              setBusy={(b) => setBusy(b ? "save" : null)}
            />
          )}
        </div>

        {details.status === "ready" && mode === "view" && (
          <div className="sticky bottom-0 flex flex-col gap-2 border-t border-border bg-card p-3">
            <Button onClick={() => setMode("edit")} className="w-full gap-1.5">
              <Pencil className="h-4 w-4" /> Editar cliente
            </Button>
            <div className="flex gap-2">
              {canReactivate && (
                <Button
                  variant="outline"
                  className="flex-1 gap-1.5"
                  disabled={busy === "reactivate"}
                  onClick={handleReactivate}
                >
                  {busy === "reactivate" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  Reativar cliente
                </Button>
              )}
              {kind !== "arquivado" && (
                <Button
                  variant="outline"
                  className="flex-1 gap-1.5 text-danger hover:text-danger"
                  onClick={() => setConfirmArchive(true)}
                >
                  <Archive className="h-4 w-4" /> Arquivar
                </Button>
              )}
            </div>
          </div>
        )}

        <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Arquivar cliente?</AlertDialogTitle>
              <AlertDialogDescription>
                Este cliente será arquivado, mas o histórico será mantido. Você pode reativar a qualquer momento.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy === "archive"}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleArchive();
                }}
                disabled={busy === "archive"}
              >
                {busy === "archive" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Arquivar"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}

function DetailField({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>{label}</span>
        {hint && <HelpTip text={hint} />}
      </div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}

function DetailView({
  customer,
  raw,
  timelineBump,
}: {
  customer: Customer;
  raw: Row;
  timelineBump: number;
}) {
  const charges = extractList(raw, ["charges", "ultimas_cobrancas", "recent_charges"]);
  const messages = extractList(raw, ["messages", "ultimas_mensagens", "recent_messages"]);

  return (
    <Tabs defaultValue="dados" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="dados" className="text-xs">Dados</TabsTrigger>
        <TabsTrigger value="cobrancas" className="text-xs">Cobranças</TabsTrigger>
        <TabsTrigger value="mensagens" className="text-xs">Mensagens</TabsTrigger>
        <TabsTrigger value="historico" className="text-xs">Histórico</TabsTrigger>
      </TabsList>

      <TabsContent value="dados" className="mt-4 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <DetailField label="Nome" value={customer.name} />
          <DetailField
            label="WhatsApp"
            value={prettyPhone(customer.whatsapp) ?? <span className="text-muted-foreground">—</span>}
          />
          <DetailField
            label="Valor mensal"
            hint="Cobrança recorrente do cliente."
            value={customer.amount_cents != null ? fmtBRL(customer.amount_cents) : <span className="text-muted-foreground">—</span>}
          />
          <DetailField
            label="Dia de vencimento"
            hint="Dia do mês em que a cobrança vence."
            value={customer.due_day != null ? `Dia ${customer.due_day}` : <span className="text-muted-foreground">—</span>}
          />
          <DetailField
            label="Status"
            hint="Ativo, expirado ou arquivado."
            value={
              <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", statusClass(customer.status))}>
                {statusLabel(customer.status)}
              </span>
            }
          />
        </div>
        <div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Observações</span>
            <HelpTip text="Notas internas sobre o cliente." />
          </div>
          <p className="mt-1 whitespace-pre-wrap rounded-lg border border-border bg-surface p-3 text-sm">
            {customer.notes?.trim() ? customer.notes : <span className="text-muted-foreground">Sem observações.</span>}
          </p>
        </div>
      </TabsContent>

      <TabsContent value="cobrancas" className="mt-4">
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Receipt className="h-3.5 w-3.5" /> Últimas cobranças
        </h3>
        {charges.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            Nenhuma cobrança registrada.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {charges.slice(0, 10).map((c, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {fmtDate(str(c, ["due_date", "vencimento", "due_at", "created_at"]))}
                  </p>
                  <p className="truncate text-muted-foreground">
                    {str(c, ["status", "situacao"]) ?? "—"}
                  </p>
                </div>
                <span className="shrink-0 font-semibold">
                  {(() => {
                    const a = num(c, ["amount_cents"]);
                    if (a != null) return fmtBRL(a);
                    const v = num(c, ["amount", "valor", "value"]);
                    return v != null ? fmtBRL(Math.round(v * 100)) : "—";
                  })()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="mensagens" className="mt-4">
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" /> Últimas mensagens
        </h3>
        {messages.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            Nenhuma mensagem registrada.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {messages.slice(0, 10).map((m, i) => (
              <li key={i} className="rounded-lg border border-border bg-card px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {str(m, ["direction", "tipo"]) ?? "Mensagem"}
                  </span>
                  <span className="text-muted-foreground">
                    {fmtDate(str(m, ["sent_at", "created_at", "data"]))}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-muted-foreground">
                  {str(m, ["body", "content", "texto", "message"]) ?? "—"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="historico" className="mt-4">
        <HistoryTab customerId={customer.id} reloadKey={timelineBump} />
      </TabsContent>
    </Tabs>
  );
}

function extractList(raw: Row, keys: string[]): Row[] {
  for (const k of keys) {
    const v = raw[k];
    if (Array.isArray(v)) return v as Row[];
  }
  return [];
}

// ---------- edit form ----------
function EditForm({
  customer,
  busy,
  onCancel,
  onSaved,
  setBusy,
}: {
  customer: Customer;
  busy: boolean;
  onCancel: () => void;
  onSaved: () => void;
  setBusy: (b: boolean) => void;
}) {
  const [name, setName] = useState(customer.name);
  const [whatsapp, setWhatsapp] = useState(customer.whatsapp ?? "");
  const [amount, setAmount] = useState(
    customer.amount_cents != null ? (customer.amount_cents / 100).toFixed(2).replace(".", ",") : "",
  );
  const [dueDay, setDueDay] = useState(customer.due_day != null ? String(customer.due_day) : "");
  const [status, setStatus] = useState(customer.status ?? "ativo");
  const [notes, setNotes] = useState(customer.notes ?? "");

  const validate = (): string | null => {
    if (!name.trim()) return "Informe o nome do cliente.";
    const d = onlyDigits(whatsapp);
    if (d && d.length < 10) return "Revise o WhatsApp informado.";
    const amt = Number(amount.replace(/\./g, "").replace(",", "."));
    if (amount && (isNaN(amt) || amt < 0)) return "Informe um valor válido.";
    const dd = Number(dueDay);
    if (dueDay && (isNaN(dd) || dd < 1 || dd > 31))
      return "O dia de vencimento deve ser entre 1 e 31.";
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    if (!supabase) return;
    setBusy(true);
    const amt = amount.trim()
      ? Math.round(Number(amount.replace(/\./g, "").replace(",", ".")) * 100)
      : null;
    const { error } = await supabase.rpc("update_customer_admin", {
      p_customer_id: customer.id,
      p_name: name.trim(),
      p_whatsapp_e164: whatsapp.trim() ? toE164(whatsapp) : null,
      p_amount_cents: amt,
      p_due_day: dueDay.trim() ? Number(dueDay) : null,
      p_status: status.trim() || null,
      p_notes: notes.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error(friendlyRpcError(error.message));
      return;
    }
    toast.success("Cliente atualizado com sucesso.");
    onSaved();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nome">
        <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
      </Field>
      <Field label="WhatsApp" hint="Inclua o DDD. Será salvo no formato internacional.">
        <Input
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="(11) 99999-9999"
          inputMode="tel"
          maxLength={20}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor mensal" hint="Cobrança recorrente em reais.">
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            inputMode="decimal"
          />
        </Field>
        <Field label="Dia de vencimento" hint="Entre 1 e 31.">
          <Input
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value.replace(/\D/g, "").slice(0, 2))}
            placeholder="10"
            inputMode="numeric"
          />
        </Field>
      </div>
      <Field label="Status" hint="Use ativo, expirado ou arquivado.">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="ativo">Ativo</option>
          <option value="expirado">Expirado</option>
          <option value="arquivado">Arquivado</option>
        </select>
      </Field>
      <Field label="Observações" hint="Notas internas, não enviadas ao cliente.">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={1000}
        />
      </Field>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" disabled={busy} className="flex-1 gap-1.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <Label className="text-xs">{label}</Label>
        {hint && <HelpTip text={hint} />}
      </div>
      {children}
    </div>
  );
}

// ---------- history tab ----------
type TimelineEvent = {
  id: string;
  event_type: string;
  created_at: string | null;
  metadata: Row | null;
  raw: Row;
};

type TimelineState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error"; kind: "permission" | "network" | "unknown"; message: string }
  | { status: "ready"; events: TimelineEvent[] };

const EVENT_META: Record<
  string,
  { title: string; text: string; icon: typeof History; tone: string }
> = {
  customer_updated: {
    title: "Cliente atualizado",
    text: "Dados do cliente foram atualizados.",
    icon: UserCog,
    tone: "bg-info-soft text-info",
  },
  customer_archived: {
    title: "Cliente arquivado",
    text: "Cliente foi arquivado, mas o histórico foi mantido.",
    icon: UserX,
    tone: "bg-muted text-muted-foreground",
  },
  customer_reactivated: {
    title: "Cliente reativado",
    text: "Cliente voltou a ficar ativo.",
    icon: UserCheck,
    tone: "bg-success-soft text-success",
  },
  charge_created: {
    title: "Cobrança criada",
    text: "Nova cobrança registrada para este cliente.",
    icon: FilePlus2,
    tone: "bg-info-soft text-info",
  },
  charge_updated: {
    title: "Cobrança atualizada",
    text: "Dados da cobrança foram atualizados.",
    icon: FileEdit,
    tone: "bg-info-soft text-info",
  },
  charge_paid: {
    title: "Cobrança paga",
    text: "Cobrança marcada como paga.",
    icon: CheckCircle2,
    tone: "bg-success-soft text-success",
  },
  charge_overdue: {
    title: "Cobrança vencida",
    text: "Cobrança marcada como vencida.",
    icon: AlertTriangle,
    tone: "bg-warning-soft text-warning",
  },
  charge_cancelled: {
    title: "Cobrança cancelada",
    text: "Cobrança cancelada sem apagar histórico.",
    icon: Ban,
    tone: "bg-muted text-muted-foreground",
  },
};

function eventMeta(type: string) {
  return (
    EVENT_META[type] ?? {
      title: type.replace(/_/g, " "),
      text: "Evento registrado.",
      icon: History,
      tone: "bg-muted text-muted-foreground",
    }
  );
}

function fmtDateTime(s: string | null | undefined) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(+d)) return s;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function classifyTimelineError(msg: string): "permission" | "network" | "unknown" {
  const m = msg.toLowerCase();
  if (m.includes("permission") || m.includes("denied") || m.includes("rls") || m.includes("not allowed"))
    return "permission";
  if (m.includes("network") || m.includes("fetch") || m.includes("timeout"))
    return "network";
  return "unknown";
}

function HistoryTab({ customerId, reloadKey }: { customerId: string; reloadKey: number }) {
  const [state, setState] = useState<TimelineState>({ status: "loading" });

  useEffect(() => {
    if (!supabase) {
      setState({ status: "error", kind: "unknown", message: "Conexão não configurada." });
      return;
    }
    let alive = true;
    setState({ status: "loading" });
    (async () => {
      const { data, error } = await supabase!.rpc("get_customer_timeline_admin", {
        p_customer_id: customerId,
      });
      if (!alive) return;
      if (error) {
        setState({
          status: "error",
          kind: classifyTimelineError(error.message),
          message: error.message,
        });
        return;
      }
      const rows = (Array.isArray(data) ? data : []) as Row[];
      if (rows.length === 0) {
        setState({ status: "empty" });
        return;
      }
      const events: TimelineEvent[] = rows.map((r) => ({
        id: String(r.id ?? `${r.event_type ?? "evt"}-${r.created_at ?? Math.random()}`),
        event_type: String(r.event_type ?? "evento"),
        created_at: (r.created_at as string | null) ?? null,
        metadata:
          r.metadata && typeof r.metadata === "object" ? (r.metadata as Row) : null,
        raw: r,
      }));
      events.sort((a, b) => {
        const ta = a.created_at ? +new Date(a.created_at) : 0;
        const tb = b.created_at ? +new Date(b.created_at) : 0;
        return tb - ta;
      });
      setState({ status: "ready", events });
    })();
    return () => {
      alive = false;
    };
  }, [customerId, reloadKey]);

  if (state.status === "loading") {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (state.status === "empty") {
    return (
      <EmptyState
        icon={History}
        title="Sem histórico ainda"
        description="Este cliente ainda não tem histórico registrado."
      />
    );
  }
  if (state.status === "error") {
    const title =
      state.kind === "permission" ? "Histórico indisponível" : "Não foi possível carregar o histórico";
    const desc =
      state.kind === "permission"
        ? "Verifique sua sessão ou permissão."
        : "Não foi possível carregar o histórico agora. Tente novamente.";
    return <EmptyState icon={History} title={title} description={desc} />;
  }

  return (
    <ol className="relative space-y-3 border-l border-border pl-4">
      {state.events.map((ev) => {
        const meta = eventMeta(ev.event_type);
        const Icon = meta.icon;
        const extras = ev.metadata ? extractExtras(ev.event_type, ev.metadata) : [];
        return (
          <li key={ev.id} className="relative">
            <span
              className={cn(
                "absolute -left-[26px] top-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-background",
                meta.tone,
              )}
            >
              <Icon className="h-3 w-3" />
            </span>
            <div className="rounded-xl border border-border bg-card p-3 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{meta.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{meta.text}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                    meta.tone,
                  )}
                >
                  {ev.event_type.replace(/_/g, " ")}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {fmtDateTime(ev.created_at)}
              </div>
              {extras.length > 0 && (
                <ul className="mt-2 space-y-0.5 rounded-lg bg-surface p-2 text-[11px]">
                  {extras.map((e, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{e.label}</span>
                      <span className="font-medium text-foreground">{e.value}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function extractExtras(eventType: string, meta: Row): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const push = (label: string, v: unknown) => {
    if (v == null || v === "") return;
    out.push({ label, value: String(v) });
  };

  if (eventType.startsWith("charge_")) {
    const cents = num(meta, ["amount_cents", "new_amount_cents"]);
    if (cents != null) push("Valor", fmtBRL(cents));
    const due = str(meta, ["due_date", "new_due_date", "vencimento"]);
    if (due) push("Vencimento", fmtDate(due));
    const status = str(meta, ["status", "new_status"]);
    if (status) push("Status", status);
    const ref = str(meta, ["external_ref", "reference"]);
    if (ref) push("Referência", ref);
  }
  if (eventType === "customer_updated") {
    push("Nome", str(meta, ["new_name", "name"]));
    const cents = num(meta, ["new_amount_cents", "amount_cents"]);
    if (cents != null) push("Valor", fmtBRL(cents));
    push("Vencimento", num(meta, ["new_due_day", "due_day"]));
    push("Status", str(meta, ["new_status", "status"]));
  }
  return out.slice(0, 6);
}
