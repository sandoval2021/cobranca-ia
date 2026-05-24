import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Receipt,
  Search,
  X,
  Plus,
  Eye,
  Pencil,
  Check,
  AlertTriangle,
  Ban,
  RefreshCw,
  Loader2,
  Save,
  Sparkles,
} from "lucide-react";
import {
  GenerateMessageDialog,
  SimulatedMessagesPanel,
} from "@/components/messages/simulated-messages";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { EmptyState } from "@/components/ui-premium/EmptyState";
import { ListCardSkeleton } from "@/components/ui-premium/Skeletons";
import { HelpTip } from "@/components/ui-premium/HelpTip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase, supabaseConfigured } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/cobrancas")({ component: CobrancasPage });

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
const toISODate = (s: string | null | undefined) => {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(+d)) return "";
  return d.toISOString().slice(0, 10);
};
const onlyDigits = (s: string) => s.replace(/\D+/g, "");
const prettyPhone = (s: string | null | undefined) => {
  if (!s) return null;
  const d = onlyDigits(s);
  if (d.length === 13 && d.startsWith("55"))
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 11)
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return s;
};
const parseBRLToCents = (s: string): number | null => {
  const t = s.trim().replace(/[R$\s.]/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
};

type ChargeKind = "pendente" | "paga" | "vencida" | "cancelada" | "outro";
const classifyCharge = (s: string | null | undefined): ChargeKind => {
  const v = (s ?? "").toLowerCase();
  if (!v) return "outro";
  if (/(pag|aprovad|paid|approved|success|confirm)/.test(v)) return "paga";
  if (/(vencid|expir|atras|overdue)/.test(v)) return "vencida";
  if (/(cancel|void|annulled)/.test(v)) return "cancelada";
  if (/(pend|aguard|aberta|open|created|new)/.test(v)) return "pendente";
  return "outro";
};
const chargeLabel = (s: string | null | undefined) => {
  const k = classifyCharge(s);
  if (k === "paga") return "Paga";
  if (k === "vencida") return "Vencida";
  if (k === "cancelada") return "Cancelada";
  if (k === "pendente") return "Pendente";
  return s ?? "—";
};
const chargeClass = (s: string | null | undefined) => {
  const k = classifyCharge(s);
  if (k === "paga") return "bg-success-soft text-success";
  if (k === "vencida") return "bg-destructive/10 text-destructive";
  if (k === "cancelada") return "bg-muted text-muted-foreground";
  if (k === "pendente") return "bg-warning-soft text-warning";
  return "bg-info-soft text-info";
};

function friendlyRpcError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("permission") || m.includes("not allowed") || m.includes("denied") || m.includes("rls"))
    return "Você não tem permissão para esta ação.";
  if (m.includes("amount") || m.includes("valor"))
    return "Informe um valor válido.";
  if (m.includes("due") || m.includes("vencimento") || m.includes("date"))
    return "Informe uma data de vencimento válida.";
  if (m.includes("network") || m.includes("fetch"))
    return "Falha de conexão. Tente novamente.";
  return msg;
}

// ---------- types ----------
type Charge = {
  id: string;
  customer_id: string | null;
  amount_cents: number | null;
  due_date: string | null;
  status: string | null;
  external_ref: string | null;
  raw: Row;
};

const normalizeCharge = (r: Row): Charge => {
  const amount =
    num(r, ["amount_cents"]) ??
    (num(r, ["amount", "valor", "value", "total"]) !== null
      ? Math.round((num(r, ["amount", "valor", "value", "total"]) as number) * 100)
      : null);
  return {
    id: String(r.id ?? ""),
    customer_id: (r.customer_id as string) ?? null,
    amount_cents: amount,
    due_date: str(r, ["due_date", "vencimento", "due_at", "expires_at"]),
    status: str(r, ["status", "situacao"]),
    external_ref: str(r, ["external_ref", "reference", "referencia", "ref"]),
    raw: r,
  };
};

type CustomerLite = { id: string; name: string; whatsapp: string | null };

type Filter = "todos" | "pendente" | "paga" | "vencida" | "cancelada";

// ---------- page ----------
function CobrancasPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Charge[] | null>(null);
  const [customers, setCustomers] = useState<Record<string, CustomerLite>>({});
  const [customerList, setCustomerList] = useState<CustomerLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showRenew, setShowRenew] = useState(false);
  const [reloadBump, setReloadBump] = useState(0);

  const reload = () => setReloadBump((n) => n + 1);

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
      const chargesRes = await supabase!
        .from("customer_charges")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!alive) return;
      if (chargesRes.error) {
        setErrorMsg(friendlyRpcError(chargesRes.error.message));
        setItems(null);
        setLoading(false);
        return;
      }
      const charges = ((chargesRes.data ?? []) as Row[]).map(normalizeCharge);
      setItems(charges);

      // Coleta customer_ids (como string) presentes nas cobranças
      const customerIds = Array.from(
        new Set(
          charges
            .map((c) => (c.customer_id != null ? String(c.customer_id) : null))
            .filter((v): v is string => !!v),
        ),
      );

      // Busca defensiva de customers com fallback de colunas
      const selectFallbacks = [
        "id,name,nome,full_name,whatsapp_e164,whatsapp,phone,telefone",
        "id,name,nome,full_name,whatsapp,phone,telefone",
        "*",
      ];
      let customersData: Row[] = [];
      for (const cols of selectFallbacks) {
        const res = await supabase!.from("customers").select(cols).limit(500);
        if (!res.error) {
          customersData = (res.data ?? []) as unknown as Row[];
          break;
        }
        console.warn("[cobrancas] customers select falhou:", cols, res.error.message);
      }

      // Garante que todo customer_id referenciado seja buscado, mesmo fora do limit
      const haveIds = new Set(customersData.map((c) => String(c.id ?? "")));
      const missing = customerIds.filter((id) => !haveIds.has(id));
      if (missing.length > 0) {
        for (const cols of selectFallbacks) {
          const res = await supabase!
            .from("customers")
            .select(cols)
            .in("id", missing);
          if (!res.error) {
            customersData = customersData.concat((res.data ?? []) as unknown as Row[]);
            break;
          }
          console.warn("[cobrancas] customers .in() falhou:", cols, res.error.message);
        }
      }

      if (!alive) return;
      const map: Record<string, CustomerLite> = {};
      const list: CustomerLite[] = [];
      for (const c of customersData) {
        const id = String(c.id ?? "");
        if (!id) continue;
        const lite: CustomerLite = {
          id,
          name: str(c, ["name", "nome", "full_name"]) ?? "Cliente",
          whatsapp: str(c, ["whatsapp_e164", "whatsapp", "phone", "telefone"]) ?? null,
        };
        if (!map[id]) list.push(lite);
        map[id] = lite;
      }
      setCustomers(map);
      setCustomerList(list.sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [isAuthenticated, authLoading, reloadBump]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    const qDigits = onlyDigits(q);
    return items.filter((c) => {
      const kind = classifyCharge(c.status);
      if (filter !== "todos" && kind !== filter) return false;
      if (!q) return true;
      const cust = c.customer_id ? customers[c.customer_id] : undefined;
      const name = (cust?.name ?? "").toLowerCase();
      const phone = onlyDigits(cust?.whatsapp ?? "");
      const status = (c.status ?? "").toLowerCase();
      const amount = c.amount_cents != null ? fmtBRL(c.amount_cents).toLowerCase() : "";
      const due = c.due_date ? fmtDate(c.due_date).toLowerCase() : "";
      return (
        name.includes(q) ||
        (qDigits && phone.includes(qDigits)) ||
        status.includes(q) ||
        amount.includes(q) ||
        due.includes(q)
      );
    });
  }, [items, query, filter, customers]);

  const counts = useMemo(() => {
    const c = { todos: 0, pendente: 0, paga: 0, vencida: 0, cancelada: 0 };
    if (items) {
      c.todos = items.length;
      for (const it of items) {
        const k = classifyCharge(it.status);
        if (k in c) (c as Record<string, number>)[k]++;
      }
    }
    return c;
  }, [items]);

  const opened = openId ? items?.find((c) => c.id === openId) ?? null : null;

  return (
    <PageContainer>
      <SectionHeader
        title="Cobranças"
        subtitle="Gerencie suas cobranças com segurança"
        hint="Crie, edite, marque como paga, vencida ou cancele cobranças via RPC."
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowRenew(true)} className="gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Renovar
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Nova
            </Button>
          </div>
        }
      />

      {/* Busca */}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por cliente, WhatsApp, status, valor ou vencimento"
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
        <FilterPill active={filter === "todos"} onClick={() => setFilter("todos")} label="Todas" count={counts.todos} />
        <FilterPill active={filter === "pendente"} onClick={() => setFilter("pendente")} label="Pendentes" count={counts.pendente} />
        <FilterPill active={filter === "paga"} onClick={() => setFilter("paga")} label="Pagas" count={counts.paga} />
        <FilterPill active={filter === "vencida"} onClick={() => setFilter("vencida")} label="Vencidas" count={counts.vencida} />
        <FilterPill active={filter === "cancelada"} onClick={() => setFilter("cancelada")} label="Canceladas" count={counts.cancelada} />
      </div>

      {/* Estados */}
      {!isAuthenticated && !authLoading && (
        <EmptyState icon={Receipt} title="Entre para ver suas cobranças" description="Faça login para gerenciar." />
      )}

      {isAuthenticated && loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <ListCardSkeleton key={i} />
          ))}
        </div>
      )}

      {isAuthenticated && !loading && errorMsg && (
        <EmptyState icon={Receipt} title="Não foi possível carregar" description={errorMsg} />
      )}

      {isAuthenticated && !loading && !errorMsg && filtered.length === 0 && (
        <EmptyState
          icon={Receipt}
          title="Nenhuma cobrança encontrada"
          description={query || filter !== "todos" ? "Tente outra busca ou filtro." : "Clique em Nova para criar a primeira."}
        />
      )}

      {isAuthenticated && !loading && !errorMsg && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((c) => (
            <ChargeCard
              key={c.id}
              charge={c}
              customer={c.customer_id ? customers[c.customer_id] : undefined}
              onOpen={() => setOpenId(c.id)}
              onChanged={reload}
            />
          ))}
        </div>
      )}

      <ChargeSheet
        charge={opened}
        customer={opened?.customer_id ? customers[opened.customer_id] : undefined}
        open={!!opened}
        onClose={() => setOpenId(null)}
        onChanged={reload}
      />

      <CreateChargeDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        customers={customerList}
        onCreated={reload}
      />

      <RenewCustomerDialog
        open={showRenew}
        onClose={() => setShowRenew(false)}
        customers={customerList}
        onDone={reload}
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

// ---------- charge card ----------
function ChargeCard({
  charge,
  customer,
  onOpen,
  onChanged,
}: {
  charge: Charge;
  customer: CustomerLite | undefined;
  onOpen: () => void;
  onChanged: () => void;
}) {
  const kind = classifyCharge(charge.status);
  const who = charge.customer_id
    ? customer?.name ?? "Cliente não encontrado"
    : "Cobrança sem cliente vinculado";
  const phone = prettyPhone(customer?.whatsapp);
  const [busy, setBusy] = useState<null | "paid" | "overdue" | "cancel">(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);

  const callRpc = async (fn: string, success: string, kindBusy: "paid" | "overdue" | "cancel") => {
    if (!supabase) return;
    setBusy(kindBusy);
    const { error } = await supabase.rpc(fn, { p_charge_id: charge.id });
    setBusy(null);
    if (error) {
      toast.error(friendlyRpcError(error.message));
      return;
    }
    toast.success(success);
    onChanged();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-card">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning">
          <Receipt className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{who}</p>
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", chargeClass(charge.status))}>
              {chargeLabel(charge.status)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {phone ?? (charge.customer_id ? (customer ? "Sem WhatsApp cadastrado" : "—") : "—")}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>
              {charge.amount_cents != null ? (
                <strong className="font-semibold text-foreground">{fmtBRL(charge.amount_cents)}</strong>
              ) : (
                "Sem valor"
              )}
            </span>
            <span>{charge.due_date ? `Vence ${fmtDate(charge.due_date)}` : "Sem data"}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onOpen} className="gap-1.5">
          <Eye className="h-3.5 w-3.5" /> Detalhes
        </Button>
        {kind !== "paga" && kind !== "cancelada" && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() => callRpc("mark_charge_paid_admin", "Cobrança marcada como paga.", "paid")}
            className="gap-1.5"
          >
            {busy === "paid" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Paga
          </Button>
        )}
        {kind !== "vencida" && kind !== "paga" && kind !== "cancelada" && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() => callRpc("mark_charge_overdue_admin", "Cobrança marcada como vencida.", "overdue")}
            className="gap-1.5"
          >
            {busy === "overdue" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            Vencida
          </Button>
        )}
        {kind !== "cancelada" && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() => setConfirmCancel(true)}
            className="gap-1.5 text-destructive hover:text-destructive"
          >
            <Ban className="h-3.5 w-3.5" /> Cancelar
          </Button>
        )}
      </div>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar cobrança?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta cobrança será cancelada, mas o histórico será mantido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setConfirmCancel(false);
                await callRpc("cancel_charge_admin", "Cobrança cancelada com sucesso.", "cancel");
              }}
            >
              Cancelar cobrança
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------- detail sheet ----------
type DetailsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: Row };

function ChargeSheet({
  charge,
  customer,
  open,
  onClose,
  onChanged,
}: {
  charge: Charge | null;
  customer: CustomerLite | undefined;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [details, setDetails] = useState<DetailsState>({ status: "loading" });
  const [edit, setEdit] = useState(false);
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !charge) return;
    setEdit(false);
    setDetails({ status: "loading" });
    setAmount(charge.amount_cents != null ? (charge.amount_cents / 100).toFixed(2).replace(".", ",") : "");
    setDue(toISODate(charge.due_date));
    setStatus(charge.status ?? "");
    if (!supabase) return;
    let alive = true;
    (async () => {
      const { data, error } = await supabase!.rpc("get_charge_details_admin", {
        p_charge_id: charge.id,
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
  }, [open, charge?.id]);

  if (!charge) return null;

  const data = details.status === "ready" ? details.data : null;
  const detailCharge = (data?.charge as Row) ?? (data ?? {});
  const detailCustomer = (data?.customer as Row) ?? null;
  const messages = (data?.messages as Row[]) ?? [];
  const transactions = (data?.transactions as Row[]) ?? [];

  const who = customer?.name ?? (detailCustomer ? str(detailCustomer, ["name", "nome", "full_name"]) : null) ?? "Cliente";
  const phone = prettyPhone(customer?.whatsapp ?? (detailCustomer ? str(detailCustomer, ["whatsapp_e164", "whatsapp", "phone"]) : null));

  const handleSave = async () => {
    if (!supabase) return;
    const cents = parseBRLToCents(amount);
    if (cents === null) {
      toast.error("Informe um valor válido.");
      return;
    }
    if (!due || isNaN(+new Date(due))) {
      toast.error("Informe uma data de vencimento válida.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("update_charge_admin", {
      p_charge_id: charge.id,
      p_amount_cents: cents,
      p_due_date: due,
      p_status: status || null,
    });
    setSaving(false);
    if (error) {
      toast.error(friendlyRpcError(error.message));
      return;
    }
    toast.success("Cobrança atualizada com sucesso.");
    setEdit(false);
    onChanged();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Detalhes da cobrança</SheetTitle>
          <SheetDescription>Consulte e edite com segurança via RPC.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Cliente */}
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Cliente</p>
            <p className="text-sm font-semibold">{who}</p>
            {phone && <p className="text-xs text-muted-foreground">{phone}</p>}
          </div>

          {/* Dados / Edição */}
          {!edit ? (
            <div className="space-y-2 rounded-lg border border-border bg-card p-3">
              <Field label="Valor" hint="Valor cobrado em reais.">
                {charge.amount_cents != null ? fmtBRL(charge.amount_cents) : "—"}
              </Field>
              <Field label="Vencimento" hint="Data limite para pagamento.">
                {fmtDate(charge.due_date)}
              </Field>
              <Field label="Status" hint="Situação atual da cobrança.">
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", chargeClass(charge.status))}>
                  {chargeLabel(charge.status)}
                </span>
              </Field>
              <Field label="Referência externa">
                {charge.external_ref ?? "—"}
              </Field>
              <div className="flex justify-end pt-2">
                <Button size="sm" variant="outline" onClick={() => setEdit(true)} className="gap-1.5">
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-border bg-card p-3">
              <div>
                <Label className="text-xs">Valor (R$)</Label>
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label className="text-xs">Vencimento</Label>
                <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={status || "pending"} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="paid">Paga</SelectItem>
                    <SelectItem value="overdue">Vencida</SelectItem>
                    <SelectItem value="canceled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => setEdit(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Salvar
                </Button>
              </div>
            </div>
          )}

          {/* Detalhes RPC */}
          {details.status === "loading" && (
            <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando histórico…
            </div>
          )}
          {details.status === "error" && (
            <p className="text-xs text-destructive">{details.message}</p>
          )}
          {details.status === "ready" && (
            <>
              {messages.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="mb-2 text-xs font-semibold">Mensagens ({messages.length})</p>
                  <ul className="space-y-1.5">
                    {messages.slice(0, 10).map((m, i) => (
                      <li key={i} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{str(m, ["status", "kind", "type"]) ?? "msg"}</span>
                        {" · "}
                        {fmtDate(str(m, ["created_at", "sent_at", "date"]))}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {transactions.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="mb-2 text-xs font-semibold">Transações ({transactions.length})</p>
                  <ul className="space-y-1.5">
                    {transactions.slice(0, 10).map((t, i) => {
                      const v = num(t, ["amount_cents", "amount", "value"]);
                      return (
                        <li key={i} className="flex justify-between text-xs text-muted-foreground">
                          <span>{str(t, ["status", "kind", "type"]) ?? "—"}</span>
                          <span>{v != null ? fmtBRL(v > 1000 ? v : v * 100) : "—"}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        {hint && <HelpTip text={hint} />}
      </div>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

// ---------- customer combobox ----------
function CustomerCombobox({
  customers,
  value,
  onChange,
}: {
  customers: CustomerLite[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = customers.find((c) => c.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="h-10 w-full justify-between font-normal"
        >
          <span className="truncate">
            {selected ? selected.name : "Selecionar cliente…"}
          </span>
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar cliente…" />
          <CommandList>
            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
            <CommandGroup>
              {customers.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.name} ${c.whatsapp ?? ""}`}
                  onSelect={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                >
                  <div className="flex flex-col">
                    <span className="text-sm">{c.name}</span>
                    {c.whatsapp && (
                      <span className="text-xs text-muted-foreground">{prettyPhone(c.whatsapp)}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ---------- create dialog ----------
function CreateChargeDialog({
  open,
  onClose,
  customers,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  customers: CustomerLite[];
  onCreated: () => void;
}) {
  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [status, setStatus] = useState("pending");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setCustomerId("");
      setAmount("");
      setDue("");
      setStatus("pending");
      setRef("");
    }
  }, [open]);

  const submit = async () => {
    if (!supabase) return;
    if (!customerId) {
      toast.error("Selecione um cliente.");
      return;
    }
    const cents = parseBRLToCents(amount);
    if (cents === null || cents <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    if (!due || isNaN(+new Date(due))) {
      toast.error("Informe uma data de vencimento válida.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("create_charge_admin", {
      p_customer_id: customerId,
      p_amount_cents: cents,
      p_due_date: due,
      p_status: status,
      p_external_ref: ref.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error(friendlyRpcError(error.message));
      return;
    }
    toast.success("Cobrança criada com sucesso.");
    onCreated();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova cobrança</DialogTitle>
          <DialogDescription>Cliente é selecionado por lista. Sem UUID manual.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1 flex items-center gap-1.5 text-xs">
              Cliente <HelpTip text="Busque pelo nome ou WhatsApp." />
            </Label>
            <CustomerCombobox customers={customers} value={customerId} onChange={setCustomerId} />
          </div>
          <div>
            <Label className="mb-1 flex items-center gap-1.5 text-xs">
              Valor (R$) <HelpTip text="Valor da cobrança em reais." />
            </Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" />
          </div>
          <div>
            <Label className="mb-1 flex items-center gap-1.5 text-xs">
              Vencimento <HelpTip text="Data limite para o cliente pagar." />
            </Label>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 flex items-center gap-1.5 text-xs">
              Status <HelpTip text="Situação inicial da cobrança." />
            </Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="paid">Paga</SelectItem>
                <SelectItem value="overdue">Vencida</SelectItem>
                <SelectItem value="canceled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 text-xs">Referência externa (opcional)</Label>
            <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="ID externo, número etc." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy} className="gap-1.5">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Criar cobrança
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- renew dialog ----------
function RenewCustomerDialog({
  open,
  onClose,
  customers,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  customers: CustomerLite[];
  onDone: () => void;
}) {
  const [customerId, setCustomerId] = useState("");
  const [months, setMonths] = useState("1");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setCustomerId("");
      setMonths("1");
      setAmount("");
    }
  }, [open]);

  const submit = async () => {
    if (!supabase) return;
    if (!customerId) {
      toast.error("Selecione um cliente.");
      return;
    }
    const m = Number(months);
    if (!Number.isInteger(m) || m < 1 || m > 12) {
      toast.error("Quantidade de meses deve ser entre 1 e 12.");
      return;
    }
    const cents = parseBRLToCents(amount);
    if (cents === null || cents <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("renew_customer_admin", {
      p_customer_id: customerId,
      p_months: m,
      p_amount_cents: cents,
    });
    setBusy(false);
    if (error) {
      toast.error(friendlyRpcError(error.message));
      return;
    }
    toast.success("Cliente renovado com sucesso.");
    onDone();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Renovar cliente</DialogTitle>
          <DialogDescription>Gera cobranças mensais com segurança via RPC.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1 flex items-center gap-1.5 text-xs">
              Cliente <HelpTip text="Selecione na lista." />
            </Label>
            <CustomerCombobox customers={customers} value={customerId} onChange={setCustomerId} />
          </div>
          <div>
            <Label className="mb-1 flex items-center gap-1.5 text-xs">
              Meses <HelpTip text="Quantos meses renovar (1 a 12)." />
            </Label>
            <Input type="number" min={1} max={12} value={months} onChange={(e) => setMonths(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 flex items-center gap-1.5 text-xs">
              Valor mensal (R$) <HelpTip text="Valor de cada cobrança gerada." />
            </Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy} className="gap-1.5">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Renovar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
