import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  X,
  RefreshCw,
  Bell,
  Pencil,
  Trash2,
  History,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Play,
  Server,
  Copy,
  Receipt,
  CheckCircle2,
  CopyPlus,
  Tv,
  PackageSearch,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { EmptyState } from "@/components/ui-premium/EmptyState";
import { ListCardSkeleton } from "@/components/ui-premium/Skeletons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { toast } from "sonner";
import { getCurrentCompanyAdmin, listCustomersAdmin } from "@/lib/rpc-admin";
import {
  APP_CATALOG,
  AppScreen,
  listAllScreens,
  archiveScreen,
  appDueDays,
} from "@/lib/app-screens";

export const Route = createFileRoute("/gestao-servicos")({
  component: GestaoServicosPage,
});

type Row = Record<string, unknown>;
type Customer = {
  id: string;
  name: string;
  whatsapp: string | null;
  amount_cents: number | null;
  status: string | null;
};

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
const onlyDigits = (s: string) => s.replace(/\D+/g, "");
const fmtBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
const fmtDate = (s?: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(+d) ? s : d.toLocaleDateString("pt-BR");
};
const prettyPhone = (s: string | null | undefined) => {
  if (!s) return null;
  const d = onlyDigits(s);
  if (d.length === 13 && d.startsWith("55"))
    return `(${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return s;
};
const waLink = (s: string | null | undefined) => {
  if (!s) return null;
  const d = onlyDigits(s);
  if (!d) return null;
  const full = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${full}`;
};
const shortCode = (id: string) => id.replace(/-/g, "").slice(0, 6).toUpperCase();

const normalize = (r: Row): Customer => ({
  id: String(r.id ?? ""),
  name: str(r, ["name", "nome", "full_name"]) ?? "Cliente",
  whatsapp: str(r, ["whatsapp_e164", "whatsapp", "phone", "telefone"]) ?? null,
  amount_cents:
    num(r, ["amount_cents"]) ??
    (num(r, ["amount", "valor", "value", "monthly_amount"]) !== null
      ? Math.round(
          (num(r, ["amount", "valor", "value", "monthly_amount"]) as number) *
            100,
        )
      : null),
  status: str(r, ["status", "situacao"]),
});

type ServiceRow = {
  screen: AppScreen;
  customer: Customer;
  days: number | null; // dias até vencimento da tela/licença
  kind: "ativa" | "vencendo" | "vencida" | "pausada" | "arquivada";
};

type Filter =
  | "todos"
  | "ativos"
  | "em_dia"
  | "vencendo_hoje"
  | "vencendo_7d"
  | "expirados"
  | "pausados"
  | "inativos";

function statusBadge(kind: ServiceRow["kind"]) {
  switch (kind) {
    case "ativa":
      return { label: "Ativo", cls: "bg-success-soft text-success" };
    case "vencendo":
      return { label: "Vencendo", cls: "bg-warning-soft text-warning" };
    case "vencida":
      return { label: "Expirado", cls: "bg-danger-soft text-danger" };
    case "pausada":
      return { label: "Pausado", cls: "bg-info-soft text-info" };
    case "arquivada":
      return { label: "Inativo", cls: "bg-muted text-muted-foreground" };
  }
}

function GestaoServicosPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [screensVersion, setScreensVersion] = useState(0);
  const [reloadBump, setReloadBump] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<ServiceRow | null>(null);

  useEffect(() => {
    const bump = () => setScreensVersion((v) => v + 1);
    window.addEventListener("app-screens:changed", bump);
    return () => window.removeEventListener("app-screens:changed", bump);
  }, []);

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
      const { companyId, error: companyErr } = await getCurrentCompanyAdmin();
      if (!alive) return;
      if (companyErr || !companyId) {
        setErrorMsg("Não foi possível identificar a empresa.");
        setCustomers(null);
        setLoading(false);
        return;
      }
      const res = await listCustomersAdmin({
        p_company_id: companyId,
        p_status: null,
        p_search: null,
        p_limit: 200,
        p_offset: 0,
      });
      if (!alive) return;
      if (res.error) {
        setErrorMsg(res.error.message ?? "Erro ao carregar.");
        setCustomers(null);
      } else {
        setCustomers(((res.data ?? []) as Row[]).map(normalize));
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [isAuthenticated, authLoading, reloadBump]);

  const rows: ServiceRow[] = useMemo(() => {
    if (!customers) return [];
    const all = listAllScreens();
    const byId = new Map(customers.map((c) => [c.id, c]));
    const out: ServiceRow[] = [];
    for (const [cid, scrs] of Object.entries(all)) {
      const c = byId.get(cid);
      if (!c) continue;
      for (const s of scrs) {
        const days = appDueDays(s) ?? daysUntilStr(s.due_date);
        let kind: ServiceRow["kind"] = "ativa";
        if (s.status === "arquivada") kind = "arquivada";
        else if (s.status === "pausada") kind = "pausada";
        else if (s.status === "vencida" || (days != null && days < 0)) kind = "vencida";
        else if (s.status === "vencendo" || (days != null && days <= 7)) kind = "vencendo";
        else kind = "ativa";
        out.push({ screen: s, customer: c, days, kind });
      }
    }
    return out;
  }, [customers, screensVersion]);

  const counts = useMemo(() => {
    const c = {
      todos: rows.length,
      ativos: 0,
      em_dia: 0,
      vencendo_hoje: 0,
      vencendo_7d: 0,
      expirados: 0,
      pausados: 0,
      inativos: 0,
    };
    for (const r of rows) {
      if (r.kind === "arquivada") c.inativos++;
      if (r.kind === "pausada") c.pausados++;
      if (r.kind === "vencida") c.expirados++;
      if (r.kind === "ativa" || r.kind === "vencendo") c.ativos++;
      if (r.kind === "ativa" && (r.days == null || r.days > 7)) c.em_dia++;
      if (r.days === 0) c.vencendo_hoje++;
      if (r.days != null && r.days >= 0 && r.days <= 7) c.vencendo_7d++;
    }
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "ativos" && !(r.kind === "ativa" || r.kind === "vencendo")) return false;
      if (filter === "em_dia" && !(r.kind === "ativa" && (r.days == null || r.days > 7))) return false;
      if (filter === "vencendo_hoje" && r.days !== 0) return false;
      if (filter === "vencendo_7d" && !(r.days != null && r.days >= 0 && r.days <= 7)) return false;
      if (filter === "expirados" && r.kind !== "vencida") return false;
      if (filter === "pausados" && r.kind !== "pausada") return false;
      if (filter === "inativos" && r.kind !== "arquivada") return false;
      if (!q) return true;
      const app = APP_CATALOG[r.screen.app]?.label ?? "";
      const hay = [
        r.customer.name,
        r.customer.whatsapp ?? "",
        r.screen.name,
        app,
        r.screen.username ?? "",
        r.screen.mac ?? "",
        shortCode(r.screen.id),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, filter, query]);

  const openInClientes = (customerId: string) => {
    try {
      window.sessionStorage.setItem("cobranca_ia_open_customer_id", customerId);
    } catch {
      /* ignore */
    }
    navigate({ to: "/clientes" });
  };

  const soon = (label: string) => toast.message(`${label}`, { description: "Em breve nesta tela." });

  return (
    <PageContainer>
      <SectionHeader
        title="Gestão Serviços"
        subtitle="Renove, edite e acompanhe cada serviço do cliente."
        hint="Use a busca, os filtros rápidos e os botões de ação por linha."
      />

      {/* Busca */}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar cliente, WhatsApp ou serviço"
          className="h-11 pl-9 pr-9 text-sm"
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

      {/* Filtros rápidos */}
      <div className="mb-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <Pill active={filter === "todos"} onClick={() => setFilter("todos")} label="Todos" count={counts.todos} />
        <Pill active={filter === "ativos"} onClick={() => setFilter("ativos")} label="Ativos" count={counts.ativos} />
        <Pill active={filter === "em_dia"} onClick={() => setFilter("em_dia")} label="Em dia" count={counts.em_dia} />
        <Pill active={filter === "vencendo_hoje"} onClick={() => setFilter("vencendo_hoje")} label="Vencendo hoje" count={counts.vencendo_hoje} tone="warning" />
        <Pill active={filter === "vencendo_7d"} onClick={() => setFilter("vencendo_7d")} label="Próx. 7 dias" count={counts.vencendo_7d} tone="warning" />
        <Pill active={filter === "expirados"} onClick={() => setFilter("expirados")} label="Expirados" count={counts.expirados} tone="danger" />
        <Pill active={filter === "pausados"} onClick={() => setFilter("pausados")} label="Pausados" count={counts.pausados} />
        <Pill active={filter === "inativos"} onClick={() => setFilter("inativos")} label="Inativos" count={counts.inativos} />
      </div>

      {/* Estados */}
      {!isAuthenticated && !authLoading && (
        <EmptyState icon={PackageSearch} title="Entre para ver os serviços" description="Faça login para gerenciar." />
      )}
      {isAuthenticated && loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <ListCardSkeleton key={i} />)}
        </div>
      )}
      {isAuthenticated && !loading && errorMsg && (
        <EmptyState icon={PackageSearch} title="Não foi possível carregar" description={errorMsg} />
      )}
      {isAuthenticated && !loading && !errorMsg && visible.length === 0 && (
        <EmptyState
          icon={Tv}
          title="Nenhum serviço encontrado"
          description={query ? "Tente outra busca ou troque os filtros." : "Cadastre telas/serviços na ficha do cliente para vê-las aqui."}
        />
      )}

      {/* Lista (cards no mobile / tabela no desktop) */}
      {isAuthenticated && !loading && !errorMsg && visible.length > 0 && (
        <TooltipProvider delayDuration={200}>
          {/* Desktop: tabela */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-card shadow-card">
            <div className="grid grid-cols-[88px_minmax(160px,1.4fr)_140px_minmax(160px,1.2fr)_110px_120px_110px_minmax(280px,auto)] items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <div>Código</div>
              <div>Cliente</div>
              <div>WhatsApp</div>
              <div>Serviço</div>
              <div className="text-right">Valor</div>
              <div>Expira em</div>
              <div>Situação</div>
              <div className="text-right">Ações</div>
            </div>
            <div className="divide-y divide-border">
              {visible.map((r) => (
                <ServiceTableRow
                  key={r.screen.id}
                  row={r}
                  onEdit={() => openInClientes(r.customer.id)}
                  onHistory={() => openInClientes(r.customer.id)}
                  onDelete={() => setConfirmDelete(r)}
                  onSoon={soon}
                />
              ))}
            </div>
          </div>

          {/* Mobile: cards */}
          <div className="md:hidden space-y-2">
            {visible.map((r) => (
              <ServiceCard
                key={r.screen.id}
                row={r}
                onEdit={() => openInClientes(r.customer.id)}
                onHistory={() => openInClientes(r.customer.id)}
                onDelete={() => setConfirmDelete(r)}
                onSoon={soon}
              />
            ))}
          </div>
        </TooltipProvider>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete && (
                <>
                  O serviço <strong>{confirmDelete.screen.name}</strong> do cliente{" "}
                  <strong>{confirmDelete.customer.name}</strong> será movido para inativos.
                  Você pode reativar depois na ficha do cliente.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmDelete) return;
                archiveScreen(confirmDelete.customer.id, confirmDelete.screen.id);
                window.dispatchEvent(new Event("app-screens:changed"));
                toast.success("Serviço excluído");
                setConfirmDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

function daysUntilStr(s?: string | null): number | null {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(+d)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  return Math.round((day.getTime() - today.getTime()) / 86400000);
}

function Pill({
  active,
  onClick,
  label,
  count,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone?: "warning" | "danger";
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
          active
            ? "bg-primary-foreground/20"
            : tone === "warning"
              ? "bg-warning-soft text-warning"
              : tone === "danger"
                ? "bg-danger-soft text-danger"
                : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function expireLabel(days: number | null) {
  if (days == null) return "—";
  if (days < 0) return `${Math.abs(days)}d atrás`;
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  return `${days}d`;
}

function ActionBtn({
  label,
  onClick,
  icon: Icon,
  tone = "default",
  href,
}: {
  label: string;
  onClick?: () => void;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "success" | "info" | "warning" | "danger" | "primary";
  href?: string;
}) {
  const toneCls: Record<string, string> = {
    default: "text-foreground hover:bg-muted",
    success: "text-success hover:bg-success-soft",
    info: "text-info hover:bg-info-soft",
    warning: "text-warning hover:bg-warning-soft",
    danger: "text-danger hover:bg-danger-soft",
    primary: "text-primary hover:bg-primary-soft",
  };
  const cls = cn(
    "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card transition-colors",
    toneCls[tone],
  );
  const inner = <Icon className="h-4 w-4" />;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" aria-label={label} className={cls}>
            {inner}
          </a>
        ) : (
          <button type="button" aria-label={label} onClick={onClick} className={cls}>
            {inner}
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}

function RowActions({
  row,
  onEdit,
  onHistory,
  onDelete,
  onSoon,
  compact,
}: {
  row: ServiceRow;
  onEdit: () => void;
  onHistory: () => void;
  onDelete: () => void;
  onSoon: (label: string) => void;
  compact?: boolean;
}) {
  const wa = waLink(row.customer.whatsapp);
  return (
    <div className="flex items-center justify-end gap-1.5">
      <ActionBtn label="Renovar" icon={RefreshCw} tone="success" onClick={() => onSoon("Renovar")} />
      <ActionBtn label="Notificar cliente" icon={Bell} tone="warning" onClick={() => onSoon("Notificar")} />
      {wa ? (
        <ActionBtn label="Abrir WhatsApp" icon={MessageCircle} tone="success" href={wa} />
      ) : (
        <ActionBtn label="Sem WhatsApp cadastrado" icon={MessageCircle} onClick={() => onSoon("WhatsApp")} />
      )}
      {!compact && <ActionBtn label="Editar serviço" icon={Pencil} tone="info" onClick={onEdit} />}
      {!compact && <ActionBtn label="Ver histórico" icon={History} onClick={onHistory} />}
      {!compact && <ActionBtn label="Excluir serviço" icon={Trash2} tone="danger" onClick={onDelete} />}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Mais ações"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-muted"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {compact && (
            <>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4" /> Editar serviço
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onHistory}>
                <History className="h-4 w-4" /> Histórico
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-danger focus:text-danger">
                <Trash2 className="h-4 w-4" /> Excluir
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuLabel>Mais ações</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onSoon("Pausar serviço")}>
            <Pause className="h-4 w-4" /> Pausar serviço
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSoon("Reativar serviço")}>
            <Play className="h-4 w-4" /> Reativar serviço
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSoon("Migrar servidor")}>
            <Server className="h-4 w-4" /> Migrar servidor
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSoon("Alterar app/tela/MAC/Key")}>
            <Tv className="h-4 w-4" /> Alterar app/tela/MAC
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              const txt = `${row.customer.name} · ${row.screen.name} · ${APP_CATALOG[row.screen.app]?.label ?? ""}`;
              try {
                navigator.clipboard.writeText(txt);
                toast.success("Dados copiados");
              } catch {
                onSoon("Copiar dados");
              }
            }}
          >
            <Copy className="h-4 w-4" /> Copiar dados
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onSoon("Gerar cobrança")}>
            <Receipt className="h-4 w-4" /> Gerar cobrança
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSoon("Marcar como pago")}>
            <CheckCircle2 className="h-4 w-4" /> Marcar como pago
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSoon("Duplicar serviço")}>
            <CopyPlus className="h-4 w-4" /> Duplicar serviço
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ServiceTableRow({
  row,
  onEdit,
  onHistory,
  onDelete,
  onSoon,
}: {
  row: ServiceRow;
  onEdit: () => void;
  onHistory: () => void;
  onDelete: () => void;
  onSoon: (l: string) => void;
}) {
  const app = APP_CATALOG[row.screen.app];
  const sb = statusBadge(row.kind);
  const phone = prettyPhone(row.customer.whatsapp);
  const value = row.customer.amount_cents != null ? fmtBRL(row.customer.amount_cents) : "—";
  return (
    <div className="grid grid-cols-[88px_minmax(160px,1.4fr)_140px_minmax(160px,1.2fr)_110px_120px_110px_minmax(280px,auto)] items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-muted/40">
      <div className="font-mono text-xs text-muted-foreground">{shortCode(row.screen.id)}</div>
      <div className="min-w-0">
        <p className="truncate font-medium">{row.customer.name}</p>
      </div>
      <div className="truncate text-xs text-muted-foreground">{phone ?? "—"}</div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", app?.badgeClass)}>
            {app?.label}
          </span>
          <span className="truncate text-xs text-muted-foreground">{row.screen.name}</span>
        </div>
      </div>
      <div className="text-right font-medium">{value}</div>
      <div className="text-xs">
        <div>{fmtDate(row.screen.due_date)}</div>
        <div className="text-muted-foreground">{expireLabel(row.days)}</div>
      </div>
      <div>
        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", sb.cls)}>
          {sb.label}
        </span>
      </div>
      <RowActions row={row} onEdit={onEdit} onHistory={onHistory} onDelete={onDelete} onSoon={onSoon} />
    </div>
  );
}

function ServiceCard({
  row,
  onEdit,
  onHistory,
  onDelete,
  onSoon,
}: {
  row: ServiceRow;
  onEdit: () => void;
  onHistory: () => void;
  onDelete: () => void;
  onSoon: (l: string) => void;
}) {
  const app = APP_CATALOG[row.screen.app];
  const sb = statusBadge(row.kind);
  const phone = prettyPhone(row.customer.whatsapp);
  const value = row.customer.amount_cents != null ? fmtBRL(row.customer.amount_cents) : "—";
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{row.customer.name}</p>
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", sb.cls)}>
              {sb.label}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", app?.badgeClass)}>
              {app?.label}
            </span>
            <span className="truncate text-xs text-muted-foreground">{row.screen.name}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="font-mono">{shortCode(row.screen.id)}</span>
            {phone && <span>{phone}</span>}
            <span>
              <strong className="font-semibold text-foreground">{value}</strong>/mês
            </span>
            <span>Expira: {fmtDate(row.screen.due_date)} · {expireLabel(row.days)}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 -mr-1">
        <RowActions
          row={row}
          onEdit={onEdit}
          onHistory={onHistory}
          onDelete={onDelete}
          onSoon={onSoon}
          compact
        />
      </div>
    </div>
  );
}
