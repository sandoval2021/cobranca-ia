import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Search,
  Eye,
  EyeOff,
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
  Plus,
  UserPlus,
  Trash2,
  Settings2,
  Send,
  ChevronRight,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { AISuggestionsPanel } from "@/components/ai/ai-analysis";
import { supabase, supabaseConfigured } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { toast } from "sonner";
import { getActiveAccountId, listCustomersAdmin } from "@/lib/rpc-admin";
import {
  APP_CATALOG, AppKey, AppScreen, APP_OPTIONS, listAllScreens, listScreens,
  nextDueDays, urgencyFromDays, urgencyClass, urgencyLabel,
  paidAppAlerts, paidAlertClass, PAID_ALERT_LABEL, appDueDays, isPaidApp,
  APP_WEBSITE, ACCESS_LABEL, mask, upsertScreen, newId,
} from "@/lib/app-screens";
import { AppScreensSection } from "@/components/clientes/AppScreensSection";
import { QuickSupportSection } from "@/components/clientes/QuickSupportSection";
import { QuickRenewDialog } from "@/components/clientes/QuickRenewDialog";
import { AutoDispatchTodayPanel } from "@/components/clientes/AutoDispatchTodayPanel";
import { computeAutoDispatchQueue, type AutoDispatchQueueItem } from "@/lib/auto-dispatch-queue";
import { AUTO_DISPATCH_EVENT, fmtHHMM, setCancelled, markSent } from "@/lib/auto-dispatch";
import { MANUAL_RULES_EVENT } from "@/lib/manual-dispatch-rules";
import { getCustomerDueOverride, daysFromOverride, fmtDateBRFromISO } from "@/lib/customer-due-override";
import { getCustomerExtras, setCustomerExtras } from "@/lib/customer-extras";
import { ServerBadge, SemServidorBadge } from "@/components/servers/ServerBadge";
import { getServerById, listActiveServers, screensHaveServer } from "@/lib/server-catalog";
import { getPrimaryRouteForServer } from "@/lib/dns-routes";
import { Tv, ExternalLink, Copy, Check } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

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

// Países suportados no seletor de WhatsApp (DDI + limites locais).
type CountryOpt = {
  code: string; // ISO-ish key
  label: string;
  dial: string; // sem o "+"
  localMin: number;
  localMax: number;
  example?: string;
};
const COUNTRY_LIST: CountryOpt[] = [
  { code: "BR", label: "Brasil", dial: "55", localMin: 11, localMax: 11, example: "82988936713" },
  { code: "US", label: "Estados Unidos", dial: "1", localMin: 10, localMax: 10, example: "4155552671" },
  { code: "PT", label: "Portugal", dial: "351", localMin: 9, localMax: 9, example: "912345678" },
  { code: "AO", label: "Angola", dial: "244", localMin: 9, localMax: 9 },
  { code: "MZ", label: "Moçambique", dial: "258", localMin: 9, localMax: 9 },
  { code: "PY", label: "Paraguai", dial: "595", localMin: 9, localMax: 9 },
  { code: "AR", label: "Argentina", dial: "54", localMin: 10, localMax: 11 },
  { code: "OTHER", label: "Outro", dial: "", localMin: 6, localMax: 14 },
];
const findCountry = (code: string) => COUNTRY_LIST.find((c) => c.code === code) ?? COUNTRY_LIST[0];
const buildE164 = (countryCode: string, customDdi: string, local: string) => {
  const c = findCountry(countryCode);
  const dial = c.code === "OTHER" ? onlyDigits(customDdi) : c.dial;
  return `+${dial}${onlyDigits(local)}`;
};
const validateWhatsApp = (
  countryCode: string,
  customDdi: string,
  local: string,
): string | null => {
  const c = findCountry(countryCode);
  const localD = onlyDigits(local);
  if (!localD) return "Informe o número do WhatsApp.";
  if (c.code === "BR") {
    if (localD.length !== 11)
      return "Informe o WhatsApp com DDD e 11 números. Exemplo: 82988936713.";
    return null;
  }
  if (c.code === "OTHER") {
    const ddi = onlyDigits(customDdi);
    if (!ddi || ddi.length < 1 || ddi.length > 4) return "Informe o DDI do país (1 a 4 dígitos).";
    if (localD.length < 6 || localD.length > 14) return "Informe um número válido (6 a 14 dígitos).";
    if (ddi.length + localD.length > 15) return "Número muito longo para o padrão internacional.";
    return null;
  }
  if (localD.length < c.localMin || localD.length > c.localMax) {
    return `Informe um número válido para ${c.label} (${c.localMin === c.localMax ? c.localMin : `${c.localMin}-${c.localMax}`} dígitos).`;
  }
  return null;
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
  return (s ?? "—").replace(/_/g, " ");
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
  due_date: string | null;
  status: string | null;
  notes: string | null;
  raw: Row;
};

// Normaliza qualquer string de data ("2023-02-19", "2023-02-19T00:00:00",
// "19/02/2023") para ISO "YYYY-MM-DD". Retorna null se inválida.
const toIsoDate = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
  const m2 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
  const d = new Date(s);
  if (!isNaN(+d)) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  return null;
};

const pickDueDateFromRow = (r: Row): string | null => {
  const candidates = [
    "due_date", "expires_at", "vencimento", "next_due_date",
    "data_vencimento", "expiration_date",
  ];
  for (const k of candidates) {
    const iso = toIsoDate(r[k]);
    if (iso) return iso;
  }
  // Importação: raw_row pode conter expires_at original
  const raw = r.raw_row;
  if (raw && typeof raw === "object") {
    for (const k of candidates) {
      const iso = toIsoDate((raw as Row)[k]);
      if (iso) return iso;
    }
  }
  return null;
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
  due_date: pickDueDateFromRow(r),
  status: str(r, ["status", "situacao"]),
  notes: str(r, ["notes", "observacoes", "observacao"]),
  raw: r,
});

// Prioridade do vencimento do cliente:
// 1) due_date/expires_at importado (data completa) — exibe data real;
// 2) due_day como recorrência mensal.
// Telas (app screens) sempre podem antecipar o vencimento mais próximo.
const getCustomerDueIso = (c: Customer): string | null => c.due_date;

const customerDueDays = (c: Customer, screens: AppScreen[]): number | null => {
  const iso = getCustomerDueIso(c);
  if (iso) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(iso + "T00:00:00");
    if (isNaN(+d)) return nextDueDays(c.due_day, screens);
    const base = Math.floor((+d - +today) / (1000 * 60 * 60 * 24));
    // Telas podem antecipar (vencer antes); se positivo menor, usa.
    let best = base;
    for (const s of screens) {
      if (s.status === "arquivada" || s.status === "pausada") continue;
      const sd = s.due_date ? Math.floor((+new Date(s.due_date + "T00:00:00") - +today) / 86400000) : null;
      if (sd == null) continue;
      if (best < 0 && sd < 0) best = Math.max(best, sd);
      else if (sd >= 0 && (best < 0 || sd < best)) best = sd;
    }
    return best;
  }
  return nextDueDays(c.due_day, screens);
};

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
type Filter =
  | "todos" | "ativo" | "expirado" | "arquivado"
  | "hoje" | "7d" | "vencidos"
  | "app_bob" | "app_xciptv" | "app_ibo"
  | "acc_mac_key" | "acc_user_pass"
  | "needs_update"
  | "disparo_hoje";

function ClientesPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Customer[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [serverFilter, setServerFilter] = useState<string>("__all__");
  const [screensVersion, setScreensVersion] = useState(0);
  useEffect(() => {
    const bump = () => setScreensVersion((v) => v + 1);
    window.addEventListener("app-screens:changed", bump);
    return () => window.removeEventListener("app-screens:changed", bump);
  }, []);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openMode, setOpenMode] = useState<"view" | "edit">("view");
  const [openNew, setOpenNew] = useState(false);
  const [renewId, setRenewId] = useState<string | null>(null);
  const [appsId, setAppsId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
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
      const { accountId: companyId, error: companyErr } = await getActiveAccountId();
      if (!alive) return;
      if (companyErr || !companyId) {
        setErrorMsg("Não foi possível preparar sua conta. Tente entrar novamente.");
        setItems(null);
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
        setErrorMsg(friendlyRpcError(res.error.message ?? ""));
        setItems(null);
      } else {
        const raw = res.data as unknown;
        const arr: Row[] = Array.isArray(raw)
          ? (raw as Row[])
          : Array.isArray((raw as { customers?: Row[] } | null)?.customers)
            ? ((raw as { customers: Row[] }).customers)
            : [];
        setItems(arr.map(normalize));
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [isAuthenticated, authLoading, reloadBump]);

  // Deep-link via sessionStorage (vindo de /operacao-dia)
  useEffect(() => {
    if (!items) return;
    if (typeof window === "undefined") return;
    try {
      const id = window.sessionStorage.getItem("cobranca_ia_open_customer_id");
      if (id && items.some((c) => c.id === id)) {
        setOpenMode("view");
        setOpenId(id);
        window.sessionStorage.removeItem("cobranca_ia_open_customer_id");
      }
    } catch {
      /* ignore */
    }
  }, [items]);

  const reload = () => setReloadBump((n) => n + 1);

  const allScreens = useMemo(() => listAllScreens(), [items, screensVersion]);

  // Re-render quando config/regras de disparo mudam
  const [dispatchTick, setDispatchTick] = useState(0);
  useEffect(() => {
    const bump = () => setDispatchTick((n) => n + 1);
    window.addEventListener(AUTO_DISPATCH_EVENT, bump);
    window.addEventListener(MANUAL_RULES_EVENT, bump);
    return () => {
      window.removeEventListener(AUTO_DISPATCH_EVENT, bump);
      window.removeEventListener(MANUAL_RULES_EVENT, bump);
    };
  }, []);

  const dispatchQueue = useMemo<AutoDispatchQueueItem[]>(
    () => computeAutoDispatchQueue(items, allScreens),
    [items, allScreens, dispatchTick],
  );
  const dispatchQueueById = useMemo(() => {
    const m = new Map<string, AutoDispatchQueueItem>();
    for (const q of dispatchQueue) m.set(q.client.id, q);
    return m;
  }, [dispatchQueue]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    const matchesAppFilter = (screens: AppScreen[]): boolean => {
      if (filter === "app_bob") return screens.some((s) => s.app === "bob_player" || s.app === "bob_play");
      if (filter === "app_xciptv") return screens.some((s) => s.app === "xciptv");
      if (filter === "app_ibo") return screens.some((s) => s.app === "ibo_player" || s.app === "ibo_pro" || s.app === "ibo_mix");
      if (filter === "acc_mac_key") return screens.some((s) => s.access_type === "mac_key");
      if (filter === "acc_user_pass") return screens.some((s) => s.access_type === "user_pass");
      if (filter === "needs_update") return screens.some((s) => s.needs_server_update && s.status !== "arquivada");
      return true;
    };

    return items.filter((c) => {
      const kind = classifyStatus(c.status);
      const screens = allScreens[c.id] ?? [];
      if (serverFilter !== "__all__") {
        const active = screens.filter((s) => s.status !== "arquivada");
        if (!screensHaveServer(active, serverFilter)) return false;
      }
      if (filter === "disparo_hoje") {
        if (!dispatchQueueById.has(c.id)) return false;
      } else if (filter === "ativo" || filter === "expirado" || filter === "arquivado") {
        if (kind !== filter) return false;
      } else if (filter === "hoje" || filter === "7d" || filter === "vencidos") {
        const d = customerDueDays(c, screens);
        if (d == null) return false;
        if (filter === "hoje" && d !== 0) return false;
        if (filter === "7d" && (d < 0 || d > 7)) return false;
        if (filter === "vencidos" && d >= 0) return false;
      } else if (filter !== "todos") {
        if (!matchesAppFilter(screens)) return false;
      }
      if (!q) return true;
      const phone = onlyDigits(c.whatsapp ?? "");
      if (
        c.name.toLowerCase().includes(q) ||
        phone.includes(onlyDigits(q)) ||
        (c.whatsapp ?? "").toLowerCase().includes(q)
      ) return true;
      // busca dentro das telas
      return screens.some((s) => {
        const serverNames = (s.server_ids ?? [])
          .map((id) => getServerById(id)?.name?.toLowerCase() ?? "")
          .join(" ");
        const routeHaystack = (s.server_ids ?? [])
          .map((sid) => {
            const r = getPrimaryRouteForServer(sid);
            if (!r) return "";
            return [r.host, r.subdomain, r.value].filter(Boolean).join(" ").toLowerCase();
          })
          .join(" ");
        return (
          s.name.toLowerCase().includes(q) ||
          (APP_CATALOG[s.app]?.label.toLowerCase().includes(q) ?? false) ||
          (s.mac ?? "").toLowerCase().includes(q) ||
          (s.app_key ?? "").toLowerCase().includes(q) ||
          (s.username ?? "").toLowerCase().includes(q) ||
          (s.server ?? "").toLowerCase().includes(q) ||
          serverNames.includes(q) ||
          routeHaystack.includes(q) ||
          (s.list_server_url ?? "").toLowerCase().includes(q) ||
          (s.list_username ?? "").toLowerCase().includes(q) ||
          (s.server_notes ?? "").toLowerCase().includes(q)
        );
      });
    });
  }, [items, query, filter, serverFilter, allScreens, dispatchQueueById]);

  // Contadores por servidor (catálogo ativo) e "sem servidor"
  const serverCounts = useMemo(() => {
    const activeServers = listActiveServers();
    const out: { id: string; name: string; color: string; count: number }[] =
      activeServers.map((s) => ({ id: s.id, name: s.name, color: s.color, count: 0 }));
    let none = 0;
    if (items) {
      for (const it of items) {
        const screens = (allScreens[it.id] ?? []).filter((s) => s.status !== "arquivada");
        const ids = new Set<string>();
        let hasNone = false;
        for (const s of screens) {
          const sids = s.server_ids ?? [];
          if (sids.length === 0) hasNone = true;
          for (const id of sids) ids.add(id);
        }
        for (const o of out) if (ids.has(o.id)) o.count += 1;
        if (hasNone) none += 1;
      }
    }
    return { servers: out, none };
  }, [items, allScreens, screensVersion]);

  // Ordenação por vencimento mais próximo; vencidos vão pro fim.
  // No filtro "disparo_hoje": pendentes em cima (na ordem de envio), enviados embaixo.
  const ordered = useMemo(() => {
    if (filter === "disparo_hoje") {
      return [...filtered].sort((a, b) => {
        const qa = dispatchQueueById.get(a.id);
        const qb = dispatchQueueById.get(b.id);
        const rank = (q?: AutoDispatchQueueItem) => {
          if (!q) return 9999;
          if (q.sent) return 5000 + q.order;     // enviados no fim, mantendo ordem
          if (q.cancelled) return 4000 + q.order; // cancelados antes dos enviados
          return q.order;                          // pendentes em cima na ordem de envio
        };
        return rank(qa) - rank(qb);
      });
    }
    return [...filtered].sort((a, b) => {
      const da = nextDueDays(a.due_day, allScreens[a.id] ?? []);
      const db = nextDueDays(b.due_day, allScreens[b.id] ?? []);
      const rank = (d: number | null) => {
        if (d == null) return 500;
        if (d < 0) return 1000 + Math.abs(d); // vencidos no fim
        return d; // 0,1,2,... primeiros
      };
      return rank(da) - rank(db);
    });
  }, [filtered, allScreens, filter, dispatchQueueById]);

  const counts = useMemo(() => {
    const c = {
      todos: 0, ativo: 0, expirado: 0, arquivado: 0,
      hoje: 0, d7: 0, vencidos: 0,
      app_bob: 0, app_xciptv: 0, app_ibo: 0,
      acc_mac_key: 0, acc_user_pass: 0, needs_update: 0,
    };
    if (items) {
      c.todos = items.length;
      for (const it of items) {
        const k = classifyStatus(it.status);
        if (k === "ativo") c.ativo++;
        else if (k === "expirado") c.expirado++;
        else if (k === "arquivado") c.arquivado++;
        const screens = allScreens[it.id] ?? [];
        const d = nextDueDays(it.due_day, screens);
        if (d != null) {
          if (d === 0) c.hoje++;
          if (d >= 0 && d <= 7) c.d7++;
          if (d < 0) c.vencidos++;
        }
        if (screens.some((s) => s.app === "bob_player" || s.app === "bob_play")) c.app_bob++;
        if (screens.some((s) => s.app === "xciptv")) c.app_xciptv++;
        if (screens.some((s) => s.app === "ibo_player" || s.app === "ibo_pro" || s.app === "ibo_mix")) c.app_ibo++;
        if (screens.some((s) => s.access_type === "mac_key")) c.acc_mac_key++;
        if (screens.some((s) => s.access_type === "user_pass")) c.acc_user_pass++;
        if (screens.some((s) => s.needs_server_update && s.status !== "arquivada")) c.needs_update++;
      }
    }
    return c;
  }, [items, allScreens]);

  const opened = openId ? items?.find((c) => c.id === openId) ?? null : null;

  return (
    <PageContainer>
      <SectionHeader
        title="Clientes"
        subtitle="Gerencie sua base de clientes"
        hint="Edite, arquive e consulte o histórico de cada cliente com segurança."
        action={
          <Button onClick={() => setOpenNew(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Novo cliente
          </Button>
        }
      />





      {/* Busca */}
      <div className="relative mb-3">

        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome, WhatsApp, tela, app, MAC, usuário…"
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

      {/* Filtros (única barra de rolagem) */}
      <div className="mb-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <FilterPill active={filter === "todos"} onClick={() => setFilter("todos")} label="Todos" count={counts.todos} />
        <FilterPill
          active={filter === "disparo_hoje"}
          onClick={() => setFilter("disparo_hoje")}
          label="Disparo hoje"
          count={dispatchQueue.length}
          dim={dispatchQueue.length === 0}
        />
        <FilterPill active={filter === "hoje"} onClick={() => setFilter("hoje")} label="Vencem hoje" count={counts.hoje} />
        <FilterPill active={filter === "7d"} onClick={() => setFilter("7d")} label="Próx. 7 dias" count={counts.d7} />
        <FilterPill active={filter === "vencidos"} onClick={() => setFilter("vencidos")} label="Vencidos" count={counts.vencidos} />
        <FilterPill active={filter === "ativo"} onClick={() => setFilter("ativo")} label="Ativos" count={counts.ativo} />
        <FilterPill active={filter === "expirado"} onClick={() => setFilter("expirado")} label="Expirados" count={counts.expirado} />
        <FilterPill active={filter === "arquivado"} onClick={() => setFilter("arquivado")} label="Arquivados" count={counts.arquivado} />
        <FilterPill active={filter === "needs_update"} onClick={() => setFilter("needs_update")} label="Atualizar servidor" count={counts.needs_update} />
        <FilterPill active={filter === "app_bob"} onClick={() => setFilter("app_bob")} label="Bob Player" count={counts.app_bob} dim={counts.app_bob === 0} />
        <FilterPill active={filter === "app_xciptv"} onClick={() => setFilter("app_xciptv")} label="XCIPTV" count={counts.app_xciptv} dim={counts.app_xciptv === 0} />
        <FilterPill active={filter === "app_ibo"} onClick={() => setFilter("app_ibo")} label="IBO" count={counts.app_ibo} dim={counts.app_ibo === 0} />
        <FilterPill active={filter === "acc_mac_key"} onClick={() => setFilter("acc_mac_key")} label="MAC/Key" count={counts.acc_mac_key} dim={counts.acc_mac_key === 0} />
        <FilterPill active={filter === "acc_user_pass"} onClick={() => setFilter("acc_user_pass")} label="Usuário/Senha" count={counts.acc_user_pass} dim={counts.acc_user_pass === 0} />

        {/* Separador visual entre filtros gerais e servidores */}
        <div className="mx-1 shrink-0 self-center h-6 w-px bg-border" aria-hidden />

        <FilterPill
          active={serverFilter === "__all__"}
          onClick={() => setServerFilter("__all__")}
          label="Todos servidores"
          count={items?.length ?? 0}
        />
        <FilterPill
          active={serverFilter === "__none__"}
          onClick={() => setServerFilter("__none__")}
          label="Sem servidor"
          count={serverCounts.none}
          dim={serverCounts.none === 0}
        />
        {serverCounts.servers.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setServerFilter(s.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              serverFilter === s.id
                ? "border-primary bg-primary text-primary-foreground"
                : s.count === 0
                  ? "border-border/60 bg-card/60 text-muted-foreground hover:bg-muted"
                  : "border-border bg-card text-foreground hover:bg-muted",
            )}
            title={`Servidor ${s.name}`}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
            {s.name}
            <span className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
              serverFilter === s.id ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
            )}>{s.count}</span>
          </button>
        ))}
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
        <div className="space-y-3">
          <EmptyState icon={Users} title="Não foi possível carregar" description={errorMsg} />
          <div className="flex justify-center">
            <Button onClick={() => setOpenNew(true)} className="gap-1.5">
              <UserPlus className="h-4 w-4" /> Cadastrar primeiro cliente
            </Button>
          </div>
        </div>
      )}

      {isAuthenticated && !loading && !errorMsg && ordered.length === 0 && (
        <div className="space-y-3">
          <EmptyState
            icon={Users}
            title="Nenhum cliente cadastrado ainda."
            description={query ? "Tente outra busca." : "Comece cadastrando seu primeiro cliente."}
          />
          {!query && (
            <div className="flex justify-center">
              <Button onClick={() => setOpenNew(true)} className="gap-1.5">
                <UserPlus className="h-4 w-4" /> Cadastrar primeiro cliente
              </Button>
            </div>
          )}
        </div>
      )}


      {isAuthenticated && !loading && !errorMsg && ordered.length > 0 && (
        <div className="space-y-2">
          {ordered.map((c) => (
            <ClientCard
              key={c.id}
              customer={c}
              screens={allScreens[c.id] ?? []}
              dispatchInfo={dispatchQueueById.get(c.id)}
              onDispatchChanged={() => setDispatchTick((t) => t + 1)}
              onOpen={() => { setOpenMode("edit"); setOpenId(c.id); }}
              onRenew={() => setRenewId(c.id)}
              onApps={() => setAppsId(c.id)}
              onDelete={() => setDeleteId(c.id)}
            />
          ))}
        </div>
      )}

      <CustomerSheet
        customer={opened}
        open={!!opened}
        onClose={() => setOpenId(null)}
        onChanged={reload}
        defaultMode={openMode}
      />

      {renewId && (() => {
        const c = items?.find((x) => x.id === renewId);
        if (!c) return null;
        return (
          <QuickRenewDialog
            open={!!renewId}
            onClose={() => setRenewId(null)}
            customerId={renewId}
            customerName={c.name}
            customerDueDay={c.due_day}
            monthlyAmountCents={c.amount_cents}
            whatsappE164={c.whatsapp}
            onRenewed={reload}
          />
        );
      })()}

      <AppsDialog
        customer={appsId ? items?.find((c) => c.id === appsId) ?? null : null}
        screens={appsId ? (allScreens[appsId] ?? []) : []}
        open={!!appsId}
        onClose={() => setAppsId(null)}
        onOpenFull={() => {
          if (appsId) {
            setOpenMode("view");
            setOpenId(appsId);
            setAppsId(null);
          }
        }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && !deleting && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              O cliente <strong>{items?.find((c) => c.id === deleteId)?.name ?? ""}</strong> será
              arquivado e deixará de aparecer na lista ativa. O histórico fica preservado e você
              pode reativar quando quiser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={async (e) => {
                e.preventDefault();
                if (!supabase || !deleteId) return;
                setDeleting(true);
                const { error } = await supabase.rpc("archive_customer_admin", {
                  p_customer_id: deleteId,
                });
                setDeleting(false);
                if (error) {
                  toast.error(friendlyRpcError(error.message));
                  return;
                }
                toast.success("Cliente excluído da lista ativa.");
                setDeleteId(null);
                reload();
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <NewCustomerSheet
        open={openNew}
        onClose={() => setOpenNew(false)}
        onCreated={reload}
      />
    </PageContainer>
  );
}


function FilterPill({
  active,
  onClick,
  label,
  count,
  hideCount,
  dim,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  hideCount?: boolean;
  dim?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : dim
            ? "border-border/60 bg-card/60 text-muted-foreground hover:bg-muted"
            : "border-border bg-card text-foreground hover:bg-muted",
      )}
    >
      {label}
      {!hideCount && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
            active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function ClientCard({
  customer,
  screens,
  dispatchInfo,
  onDispatchChanged,
  onOpen,
  onRenew,
  onApps,
  onDelete,
}: {
  customer: Customer;
  screens: AppScreen[];
  dispatchInfo?: AutoDispatchQueueItem;
  onDispatchChanged?: () => void;
  onOpen: () => void;
  onRenew: () => void;
  onApps: () => void;
  onDelete: () => void;
}) {
  const phone = prettyPhone(customer.whatsapp);
  const initial = customer.name.trim().charAt(0).toUpperCase() || "?";
  const override = getCustomerDueOverride(customer.id);
  const overrideDays = daysFromOverride(override);
  const baseDays = nextDueDays(customer.due_day, screens);
  const days = overrideDays != null ? overrideDays : baseDays;
  const urg = urgencyFromDays(days);
  const activeScreens = screens.filter((s) => s.status !== "arquivada").slice(0, 4);
  const needsUpdate = screens.some((s) => s.needs_server_update && s.status !== "arquivada");

  // Cor de fundo/borda do card conforme urgência
  const tint =
    urg === "vencido"
      ? "border-red-400 bg-red-50 dark:bg-red-950/30"
      : urg === "hoje"
        ? "border-red-300 bg-red-50/70 dark:bg-red-900/20"
        : urg === "3d"
          ? "border-orange-300 bg-orange-50 dark:bg-orange-950/20"
          : urg === "7d"
            ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20"
            : urg === "em_dia"
              ? "border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/15"
              : "border-border bg-card";

  // Próxima data de vencimento (ISO) — override tem prioridade; senão calcula a partir de due_day
  const nextDueIso = (() => {
    if (override) return override;
    if (customer.due_day != null) {
      const today = new Date();
      const dd = Math.min(customer.due_day, 28);
      const next = new Date(today.getFullYear(), today.getMonth(), dd);
      if (next < today) next.setMonth(next.getMonth() + 1);
      const p = (n: number) => String(n).padStart(2, "0");
      return `${next.getFullYear()}-${p(next.getMonth() + 1)}-${p(next.getDate())}`;
    }
    return null;
  })();

  const primaryScreen = activeScreens[0];
  const primaryApp = primaryScreen ? APP_CATALOG[primaryScreen.app] : null;
  const phoneDigits = onlyDigits(customer.whatsapp ?? "");
  const codCliente = phoneDigits ? phoneDigits.slice(-10) : customer.id.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();

  // Estado do disparo de hoje (para colorir nome em vermelho em caso de falha)
  const nowMs = Date.now();
  const dispatchScheduledMs = dispatchInfo ? dispatchInfo.scheduleTime.getTime() : 0;
  const dispatchFailed = !!dispatchInfo && !dispatchInfo.sent && !dispatchInfo.cancelled && dispatchScheduledMs + 60_000 < nowMs;
  const dispatchPending = !!dispatchInfo && !dispatchInfo.sent && !dispatchInfo.cancelled && !dispatchFailed;
  const fmtDateTimeBR = (d: Date) =>
    `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()} ${fmtHHMM(d)}`;

  const sendWhatsAppNow = () => {
    if (!dispatchInfo) return;
    const phoneD = onlyDigits(customer.whatsapp ?? "");
    if (!phoneD) { toast.error("Cliente sem WhatsApp."); return; }
    window.open(
      `https://wa.me/${phoneD}?text=${encodeURIComponent(dispatchInfo.message)}`,
      "_blank",
      "noopener,noreferrer",
    );
    markSent(customer.id);
    onDispatchChanged?.();
  };

  // Abre o site externo do app e copia MAC/Key se houver — sites externos não
  // permitem auto-preenchimento por questões de segurança; o melhor que dá pra fazer
  // é abrir o site e deixar MAC/Key na área de transferência prontos para colar.
  const openAppExternal = () => {
    if (!primaryScreen) return;
    const url = APP_WEBSITE[primaryScreen.app];
    if (!url) { toast.info("Este app não tem site externo cadastrado."); return; }
    const mac = primaryScreen.mac?.trim();
    const key = primaryScreen.app_key?.trim();
    if (mac && key) {
      void navigator.clipboard?.writeText(`MAC: ${mac}\nKey: ${key}`).catch(() => {});
      toast.success("MAC e Key copiados — cole no site do app.");
    } else if (mac) {
      void navigator.clipboard?.writeText(mac).catch(() => {});
      toast.success("MAC copiado — cole no site do app.");
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const Row = ({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) => (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
      <span className={cn("text-[11px] text-right break-words min-w-0", valueClass)}>{value}</span>
    </div>
  );

  return (
    <div className={cn("rounded-lg border border-l-4 p-2.5 shadow-card", tint)}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-info-soft text-info text-[11px] font-semibold">
            {initial}
          </div>
          <p className={cn(
            "text-sm font-semibold truncate",
            dispatchFailed && "text-red-600 dark:text-red-400",
          )}>
            {customer.name}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          aria-label="Abrir detalhes"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="divide-y divide-foreground/5">
        <Row label="WhatsApp" value={phone ?? <span className="text-muted-foreground">—</span>} valueClass="font-mono" />

        <Row
          label="Serviço"
          value={
            primaryScreen && primaryApp ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (primaryApp.tier === "pago") openAppExternal();
                  else onOpen();
                }}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  primaryApp.badgeClass,
                )}
                title={
                  primaryApp.tier === "pago"
                    ? `Abrir site oficial de ${primaryApp.label}`
                    : `${primaryScreen.name} · ${primaryApp.label}`
                }
              >
                {primaryScreen.name} · {primaryApp.label}
                {primaryApp.tier === "pago" && <ExternalLink className="h-2.5 w-2.5" />}
              </button>
            ) : (
              <button
                type="button"
                onClick={onApps}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
              >
                <Tv className="h-3 w-3" /> + Aplicativo
              </button>
            )
          }
        />
        <Row
          label="Valor"
          value={
            customer.amount_cents != null
              ? <strong className="font-semibold text-foreground">{fmtBRL(customer.amount_cents)}</strong>
              : <span className="text-muted-foreground">—</span>
          }
        />
        <Row
          label="Expira"
          value={nextDueIso ? <span className="font-medium text-foreground">{fmtDateBRFromISO(nextDueIso)}</span> : <span className="text-muted-foreground">—</span>}
        />
        <Row
          label="Situação"
          value={
            <span className="inline-flex flex-wrap justify-end gap-1">
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", statusClass(customer.status))}>
                {statusLabel(customer.status)}
              </span>
              {days != null && (
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", urgencyClass(urg))}>
                  {urgencyLabel(urg, days)}
                </span>
              )}
              {needsUpdate && (
                <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-medium text-warning">
                  Atualizar servidor
                </span>
              )}
            </span>
          }
        />
      </div>

      {dispatchInfo && (
        <div className={cn(
          "mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border px-2 py-1 text-[11px]",
          dispatchInfo.sent && "border-emerald-300 bg-emerald-50/70 dark:border-emerald-600/40 dark:bg-emerald-950/20",
          dispatchInfo.cancelled && "border-muted bg-muted/40 opacity-80",
          dispatchFailed && "border-red-400 bg-red-50 dark:border-red-500/40 dark:bg-red-950/25",
          dispatchPending && "border-primary/30 bg-primary/5",
        )}>
          <div className="flex items-center gap-1.5 min-w-0">
            {dispatchInfo.sent ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span className="font-medium text-emerald-700 dark:text-emerald-300">Enviada com sucesso</span>
                <span className="text-muted-foreground font-mono">· {fmtDateTimeBR(dispatchInfo.scheduleTime)}</span>
              </>
            ) : dispatchInfo.cancelled ? (
              <>
                <Ban className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="font-medium">Envio cancelado</span>
                <span className="text-muted-foreground font-mono">· era {fmtDateTimeBR(dispatchInfo.scheduleTime)}</span>
              </>
            ) : dispatchFailed ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                <span className="font-semibold text-red-600 dark:text-red-400">Falha no envio</span>
                <span className="text-muted-foreground font-mono">· {fmtDateTimeBR(dispatchInfo.scheduleTime)}</span>
              </>
            ) : (
              <>
                <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="font-medium">Será enviada em</span>
                <span className="font-mono">{fmtDateTimeBR(dispatchInfo.scheduleTime)}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            {dispatchInfo.cancelled ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setCancelled(customer.id, false); onDispatchChanged?.(); }}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium hover:bg-muted"
              >
                <RotateCcw className="h-3 w-3" /> Reativar
              </button>
            ) : !dispatchInfo.sent ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCancelled(customer.id, true);
                    onDispatchChanged?.();
                    toast.success(`Envio cancelado para ${customer.name}`);
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium hover:bg-muted"
                  title="Cancelar envio"
                >
                  <Ban className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); sendWhatsAppNow(); }}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white hover:opacity-90",
                    dispatchFailed ? "bg-red-600" : "bg-primary",
                  )}
                  title={dispatchFailed ? "Enviar novamente" : "Enviar agora"}
                >
                  {dispatchFailed ? <RotateCcw className="h-3 w-3" /> : <Send className="h-3 w-3" />}
                  {dispatchFailed ? "Reenviar" : "Enviar"}
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}

      <div className="mt-2 grid grid-cols-4 gap-1">
        <button
          type="button"
          onClick={onRenew}
          title="Renovar cliente"
          aria-label="Renovar"
          className="inline-flex h-8 items-center justify-center rounded-md bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onApps}
          title="Aplicativos e dados de acesso"
          aria-label="Aplicativos"
          className="inline-flex h-8 items-center justify-center rounded-md bg-blue-600 text-white shadow-sm hover:bg-blue-700"
        >
          <Tv className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onOpen}
          title="Gerenciar cliente"
          aria-label="Gerenciar"
          className="inline-flex h-8 items-center justify-center rounded-md bg-violet-600 text-white shadow-sm hover:bg-violet-700"
        >
          <Settings2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Excluir cliente"
          aria-label="Excluir"
          className="inline-flex h-8 items-center justify-center rounded-md bg-red-600 text-white shadow-sm hover:bg-red-700"
        >
          <Trash2 className="h-4 w-4" />
        </button>
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
  defaultMode = "view",
}: {
  customer: Customer | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
  defaultMode?: Mode;
}) {
  const [details, setDetails] = useState<DetailsState>({ status: "loading" });
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [busy, setBusy] = useState<null | "save" | "archive" | "reactivate">(null);
  const [timelineBump, setTimelineBump] = useState(0);
  const reloadTimeline = () => setTimelineBump((n) => n + 1);

  useEffect(() => {
    if (!open || !customer) return;
    setMode(defaultMode);
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
  }, [open, customer?.id, defaultMode]);

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
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-md flex-col gap-0 overflow-hidden p-0 border-2 border-border shadow-2xl rounded-xl">
        <DialogHeader className="border-b border-border px-4 py-3 text-left">
          <DialogTitle className="text-sm">{merged.name}</DialogTitle>
          <DialogDescription className="text-[11px]">
            {prettyPhone(merged.whatsapp) ?? "Sem WhatsApp cadastrado"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-3 py-3">
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
          <div className="flex flex-wrap gap-2 border-t border-border bg-card p-2">
            <Button size="sm" onClick={() => setMode("edit")} className="flex-1 min-w-[120px] gap-1.5">
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
            {canReactivate && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 min-w-[100px] gap-1.5"
                disabled={busy === "reactivate"}
                onClick={handleReactivate}
              >
                {busy === "reactivate" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                Reativar
              </Button>
            )}
            {kind !== "arquivado" && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 min-w-[100px] gap-1.5 text-danger hover:text-danger"
                onClick={() => setConfirmArchive(true)}
              >
                <Archive className="h-3.5 w-3.5" /> Arquivar
              </Button>
            )}
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
      </DialogContent>
    </Dialog>

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
      <TabsList className="grid w-full grid-cols-7">
        <TabsTrigger value="dados" className="text-[10px] sm:text-xs">Dados</TabsTrigger>
        <TabsTrigger value="telas" className="text-[10px] sm:text-xs gap-1">
          <Tv className="h-3 w-3" /> Telas
        </TabsTrigger>
        <TabsTrigger value="atend" className="text-[10px] sm:text-xs">Atend.</TabsTrigger>
        <TabsTrigger value="cobrancas" className="text-[10px] sm:text-xs">Cobr.</TabsTrigger>
        <TabsTrigger value="mensagens" className="text-[10px] sm:text-xs">Msg</TabsTrigger>
        <TabsTrigger value="ia" className="text-[10px] sm:text-xs">IA</TabsTrigger>
        <TabsTrigger value="historico" className="text-[10px] sm:text-xs">Hist.</TabsTrigger>
      </TabsList>

      <TabsContent value="telas" className="mt-4">
        <AppScreensSection customerId={customer.id} customerName={customer.name} />
      </TabsContent>

      <TabsContent value="atend" className="mt-4">
        <QuickSupportSection customerId={customer.id} customerName={customer.name} />
      </TabsContent>

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

        <div className="mt-4">
          <SimulatedMessagesPanel
            customerId={customer.id}
            chargeId={null}
            reloadKey={timelineBump}
          />
        </div>
      </TabsContent>

      <TabsContent value="ia" className="mt-4">
        <AISuggestionsPanel
          customerId={customer.id}
          chargeId={null}
          reloadKey={timelineBump}
          title="Sugestões de IA simulada"
        />
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
  const initialExtras = getCustomerExtras(customer.id);
  const [name, setName] = useState(customer.name);
  const [whatsapp, setWhatsapp] = useState(customer.whatsapp ?? "");
  const [email, setEmail] = useState(initialExtras.email ?? "");
  const [birthday, setBirthday] = useState(initialExtras.birthday ?? "");
  const [amount, setAmount] = useState(
    customer.amount_cents != null ? (customer.amount_cents / 100).toFixed(2).replace(".", ",") : "",
  );
  const [dueDay, setDueDay] = useState(customer.due_day != null ? String(customer.due_day) : "");
  const [status, setStatus] = useState(customer.status ?? "ativo");
  const [notes, setNotes] = useState(customer.notes ?? "");
  const createdAt = str(customer.raw, ["created_at", "cadastrado_em", "data_cadastro", "inserted_at"]);
  const screensList = useMemo(() => listScreens(customer.id), [customer.id]);
  const screensCount = screensList.length;

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
    setCustomerExtras(customer.id, { email: email.trim(), birthday: birthday || undefined });
    toast.success("Cliente atualizado com sucesso.");
    onSaved();
  };

  return (
    <form onSubmit={submit} className="space-y-2.5">
      <Field label="Nome">
        <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} className="h-9" />
      </Field>
      <Field label="WhatsApp">
        <Input
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="(11) 99999-9999"
          inputMode="tel"
          maxLength={20}
          className="h-9"
        />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Valor (R$)">
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            inputMode="decimal"
            className="h-9"
          />
        </Field>
        <Field label="Vence dia">
          <Input
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value.replace(/\D/g, "").slice(0, 2))}
            placeholder="10"
            inputMode="numeric"
            className="h-9"
          />
        </Field>
        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="ativo">Ativo</option>
            <option value="expirado">Expirado</option>
            <option value="arquivado">Arquivado</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="E-mail">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@exemplo.com"
            maxLength={120}
            className="h-9"
          />
        </Field>
        <Field label="Aniversário">
          <Input
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            className="h-9"
          />
        </Field>
      </div>
      <Field label="Observações">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={1000}
          className="resize-none"
        />
      </Field>

      <div className="space-y-1.5 rounded-xl border border-border bg-primary-soft/30 p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
            <Tv className="h-3 w-3" />
            Telas e servidores
            <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
              {screensCount}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">Use o botão de TV para adicionar</span>
        </div>
        {screensCount === 0 ? (
          <div className="rounded-md bg-card px-2 py-1.5 text-[11px] text-muted-foreground">
            Nenhuma tela cadastrada ainda.
          </div>
        ) : (
          <ul className="space-y-1">
            {screensList.map((s) => {
              const appLabel = APP_CATALOG[s.app]?.label ?? s.app;
              const serverIds = s.server_ids?.length ? s.server_ids : (s.primary_server_id ? [s.primary_server_id] : []);
              const serverNames = serverIds.map((id) => getServerById(id)?.name).filter(Boolean) as string[];
              const serverText = serverNames.length ? serverNames.join(", ") : (s.server || "Sem servidor");
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-1.5 rounded-md bg-card px-2 py-1 text-[11px]"
                >
                  <span className="truncate font-medium text-foreground">{s.name}</span>
                  <span className="shrink-0 rounded-full bg-primary-soft px-1.5 text-[10px] font-medium text-primary">
                    {appLabel}
                  </span>
                  <span className="ml-auto truncate text-muted-foreground" title={serverText}>
                    {serverText}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-[11px] text-muted-foreground">
        <span>Cadastro: <span className="font-medium text-foreground">{createdAt ? fmtDate(createdAt) : "—"}</span></span>
        <span>Telas: <span className="font-medium text-foreground">{screensCount}</span></span>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={busy} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={busy} className="flex-1 gap-1.5">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
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
  ai_simulated: {
    title: "IA simulada",
    text: "Sugestão de IA simulada criada.",
    icon: MessageSquare,
    tone: "bg-primary/10 text-primary",
  },
  message_simulated: {
    title: "Mensagem simulada",
    text: "Mensagem de cobrança simulada criada.",
    icon: MessageSquare,
    tone: "bg-info-soft text-info",
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

// ---------- new customer sheet ----------
function NewCustomerSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const servers = useMemo(() => listActiveServers(), [open]);

  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [countryCode, setCountryCode] = useState<string>("BR");
  const [customDdi, setCustomDdi] = useState("");
  const [serverId, setServerId] = useState<string>("__none__");
  const [serverIdExtra, setServerIdExtra] = useState<string>("__none__");
  const [app, setApp] = useState<AppKey | "__none__">("__none__");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(""); // yyyy-mm-dd (data completa do cliente)
  const [notes, setNotes] = useState("");
  // Campos de app pago — UI agora; persistência segura definitiva virá com backend.
  const [mac, setMac] = useState("");
  const [appKey, setAppKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [appDueDate, setAppDueDate] = useState(""); // yyyy-mm-dd
  const [busy, setBusy] = useState(false);

  const paidApp = app !== "__none__" && APP_CATALOG[app]?.tier === "pago";

  useEffect(() => {
    if (open) {
      setName(""); setWhatsapp(""); setCountryCode("BR"); setCustomDdi("");
      setServerId("__none__"); setServerIdExtra("__none__");
      setApp("__none__"); setAmount(""); setDueDate(""); setNotes("");
      setMac(""); setAppKey(""); setShowKey(false); setAppDueDate("");
      setBusy(false);
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const waErr = validateWhatsApp(countryCode, customDdi, whatsapp);
    if (waErr) { toast.error(waErr); return; }
    const amt = amount.trim()
      ? Math.round(Number(amount.replace(/\./g, "").replace(",", ".")) * 100)
      : null;
    if (amount.trim() && (amt == null || Number.isNaN(amt) || amt < 0)) {
      toast.error("Informe um valor válido."); return;
    }
    // Converte data completa (yyyy-mm-dd) para dia do mês (1-31)
    // Backend atual ainda só persiste p_due_day; data completa virá com backend futuro.
    let dd: number | null = null;
    if (dueDate.trim()) {
      const parsed = new Date(dueDate + "T00:00:00");
      if (isNaN(+parsed)) {
        toast.error("Informe uma data de vencimento válida.");
        return;
      }
      dd = parsed.getDate();
    }
    if (!supabase) { toast.error("Conexão indisponível."); return; }
    setBusy(true);
    const { accountId: companyId, error: companyErr } = await getActiveAccountId();
    if (!companyId) {
      setBusy(false);
      console.warn("[novo cliente] sem UUID real de conta", companyErr);
      toast.error("Não foi possível preparar sua conta automaticamente. Saia e entre novamente.");
      return;
    }


    const payload = {
      p_company_id: companyId,
      p_name: name.trim() || "Cliente",
      p_whatsapp_e164: buildE164(countryCode, customDdi, whatsapp),
      p_amount_cents: amt ?? 0,
      p_due_day: dd,
      p_notes: notes.trim() || null,
    };
    const safeCompanyMask = typeof companyId === "string" && companyId.length >= 8
      ? `${companyId.slice(0, 4)}…${companyId.slice(-4)}`
      : "***";
    console.info("[customer-create] payload seguro", {
      companyId: safeCompanyMask,
      whatsapp_e164: payload.p_whatsapp_e164,
      amount_cents: payload.p_amount_cents,
      due_day: payload.p_due_day,
      name_present: Boolean(name.trim()),
    });
    const { error } = await supabase.rpc("create_customer_admin", payload);
    if (error) {
      setBusy(false);
      const e = error as { code?: string; message?: string; details?: string; hint?: string };
      console.warn("[customer-create] error", {
        code: e.code ?? null,
        message: e.message ?? null,
        details: e.details ?? null,
        hint: e.hint ?? null,
      });
      const msg = (e.message ?? "").toLowerCase();
      const code = e.code ?? "";
      let friendly = "Não foi possível salvar o cliente. Verifique os dados e tente novamente.";
      if (code === "23505" || msg.includes("duplicate key") || msg.includes("unique") || msg.includes("already exists")) {
        friendly = "Este WhatsApp já está cadastrado.";
      } else if (code === "22P02" && msg.includes("uuid")) {
        friendly = "Sua conta ainda não foi preparada corretamente. Saia e entre novamente.";
      } else if (code === "23502") {
        friendly = "Algum dado obrigatório não foi preenchido.";
      } else if (code === "23514") {
        friendly = "Status do cliente inválido. Tente novamente.";
      } else if (code === "42501" || msg.includes("permission denied")) {
        friendly = "Você não tem permissão para cadastrar nessa conta.";
      }
      toast.error(friendly);
      return;
    }

    const hadServiceSelection =
      serverId !== "__none__" || serverIdExtra !== "__none__" || app !== "__none__";

    setBusy(false);
    toast.success("Cliente cadastrado com sucesso.");
    if (hadServiceSelection) {
      toast.message("Cliente cadastrado. Servidor e aplicativo poderão ser vinculados depois.");
    }
    onCreated();
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="text-base">Novo cliente</SheetTitle>
          <SheetDescription className="text-xs">
            Preencha os dados essenciais. Tudo pode ser editado depois.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="flex-1 space-y-3 px-3 py-3">
          {/* Dados do cliente */}
          <section className="space-y-2 rounded-lg border border-border bg-card/40 p-2.5">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Dados do cliente</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Nome do cliente" />
              </div>
              <div className="space-y-1 col-span-2">
                <div className="flex items-center gap-1">
                  <Label className="text-xs">WhatsApp *</Label>
                  <HelpTip text="Escolha o país e informe o número do cliente. Para Brasil, use DDD + número." />
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2">
                  <Select value={countryCode} onValueChange={setCountryCode}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COUNTRY_LIST.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.label}{c.dial ? ` (+${c.dial})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-1">
                    {countryCode === "OTHER" && (
                      <Input
                        value={customDdi}
                        onChange={(e) => setCustomDdi(onlyDigits(e.target.value).slice(0, 4))}
                        placeholder="DDI"
                        inputMode="numeric"
                        className="w-16"
                        maxLength={4}
                        required
                      />
                    )}
                    <Input
                      value={whatsapp}
                      onChange={(e) => {
                        const c = findCountry(countryCode);
                        const max = c.code === "OTHER" ? 14 : c.localMax;
                        setWhatsapp(onlyDigits(e.target.value).slice(0, max));
                      }}
                      placeholder={
                        countryCode === "BR"
                          ? "DDD + número (ex: 82988936713)"
                          : findCountry(countryCode).example || "Somente números"
                      }
                      inputMode="numeric"
                      required
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Serviço */}
          <section className="space-y-2 rounded-lg border border-border bg-card/40 p-2.5">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Serviço</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Servidor</Label>
                <Select value={serverId} onValueChange={setServerId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Selecionar</SelectItem>
                    {servers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Servidor adicional</Label>
                <Select value={serverIdExtra} onValueChange={setServerIdExtra}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {servers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Aplicativo</Label>
                <Select value={app} onValueChange={(v) => setApp(v as AppKey | "__none__")}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar app" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Não informar</SelectItem>
                    {APP_OPTIONS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {APP_CATALOG[k].label}{APP_CATALOG[k].tier === "pago" ? " (pago)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Dados do app pago — visível somente para apps pagos */}
          {paidApp && (
            <section className="space-y-2 rounded-lg border border-amber-300/50 bg-amber-50/40 p-2.5 dark:border-amber-500/30 dark:bg-amber-500/5">
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Dados do app pago
              </h3>
              <p className="text-[11px] leading-snug text-muted-foreground">
                MAC e Key ainda dependem da proteção segura no servidor para serem salvos de forma definitiva.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs">MAC</Label>
                    <HelpTip text="Endereço MAC do aparelho. Opcional. Persistência segura virá com o backend." />
                  </div>
                  <Input value={mac} onChange={(e) => setMac(e.target.value)} placeholder="00:1A:79:00:00:00" maxLength={32} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs">Key</Label>
                    <HelpTip text="Chave do app pago. Opcional. Persistência segura virá com o backend." />
                  </div>
                  <div className="relative">
                    <Input
                      value={appKey}
                      onChange={(e) => setAppKey(e.target.value)}
                      type={showKey ? "text" : "password"}
                      placeholder="••••••"
                      maxLength={64}
                      className="pr-9"
                    />
                    <button
                      type="button"
                      aria-label={showKey ? "Ocultar key" : "Mostrar key"}
                      onClick={() => setShowKey((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1 col-span-2">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs">Vencimento do app</Label>
                    <HelpTip text="Escolha quando o app pago do cliente vence. Será salvo quando a persistência do app estiver ativada no servidor." />
                  </div>
                  <Input type="date" value={appDueDate} onChange={(e) => setAppDueDate(e.target.value)} />
                </div>
              </div>
            </section>
          )}

          {/* Cobrança */}
          <section className="space-y-2 rounded-lg border border-border bg-card/40 p-2.5">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Cobrança</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Valor mensal</Label>
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" inputMode="decimal" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Label className="text-xs">Data de vencimento</Label>
                  <HelpTip text="Escolha a data em que a mensalidade do cliente vence. Por enquanto o sistema usa o dia dessa data para cobrança mensal." />
                </div>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
          </section>

          {/* Observações */}
          <section className="space-y-2 rounded-lg border border-border bg-card/40 p-2.5">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Observações</h3>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} placeholder="Notas internas." />
          </section>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={busy} className="flex-1 gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Cadastrar
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ---------- Aplicativos do cliente (dialog rápido, com add/edit inline) ----------
type DraftScreen = {
  id?: string;
  name: string;
  app: AppKey;
  mac: string;
  app_key: string;
  username: string;
  password: string;
  app_due_date: string;
};

function blankDraft(suggestedName: string): DraftScreen {
  return {
    name: suggestedName,
    app: "bob_player",
    mac: "",
    app_key: "",
    username: "",
    password: "",
    app_due_date: "",
  };
}

function AppsDialog({
  customer,
  screens,
  open,
  onClose,
  onOpenFull,
}: {
  customer: Customer | null;
  screens: AppScreen[];
  open: boolean;
  onClose: () => void;
  onOpenFull: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftScreen | null>(null);

  const active = screens.filter((s) => s.status !== "arquivada");

  // Abre formulário automaticamente quando não há nenhuma tela
  useEffect(() => {
    if (!open) {
      setDraft(null);
      setEditingId(null);
      return;
    }
    if (active.length === 0 && !draft) {
      setDraft(blankDraft("Tela 1"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active.length]);

  const copy = async (label: string, value?: string | null) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      toast.success(`${label} copiado`);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const startEdit = (s: AppScreen) => {
    setEditingId(s.id);
    setDraft({
      id: s.id,
      name: s.name || "Tela",
      app: s.app,
      mac: s.mac ?? "",
      app_key: s.app_key ?? "",
      username: s.username ?? "",
      password: s.password ?? "",
      app_due_date: s.app_due_date ?? "",
    });
  };

  const startAdd = () => {
    setEditingId(null);
    setDraft(blankDraft(`Tela ${active.length + 1}`));
  };

  const cancelDraft = () => {
    setDraft(null);
    setEditingId(null);
  };

  const saveDraft = () => {
    if (!customer || !draft) return;
    const meta = APP_CATALOG[draft.app];
    const now = new Date().toISOString();
    const base: AppScreen =
      editingId
        ? {
            ...(screens.find((s) => s.id === editingId) as AppScreen),
          }
        : {
            id: newId(),
            customer_id: customer.id,
            name: draft.name.trim() || "Tela",
            app: draft.app,
            tier: meta.tier,
            access_type: meta.access,
            status: "ativa",
            created_at: now,
            updated_at: now,
          };
    const next: AppScreen = {
      ...base,
      name: draft.name.trim() || base.name || "Tela",
      app: draft.app,
      tier: meta.tier,
      access_type: meta.access,
      mac: draft.mac.trim() || undefined,
      app_key: draft.app_key.trim() || undefined,
      username: draft.username.trim() || undefined,
      password: draft.password.trim() || undefined,
      app_due_date: draft.app_due_date || undefined,
      updated_at: now,
    };
    upsertScreen(next);
    toast.success(editingId ? "Tela atualizada" : "Tela adicionada");
    setDraft(null);
    setEditingId(null);
  };

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Aplicativos · {customer.name}</DialogTitle>
          <DialogDescription className="text-xs">
            {active.length === 0
              ? "Selecione o app, preencha os dados e salve."
              : `${active.length} tela${active.length > 1 ? "s" : ""} cadastrada${active.length > 1 ? "s" : ""}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {active.map((s) => {
            if (editingId === s.id) return null;
            const app = APP_CATALOG[s.app];
            const site = APP_WEBSITE[s.app];
            const dDays = appDueDays(s);
            const dUrg = urgencyFromDays(dDays);
            return (
              <div key={s.id} className="rounded-lg border border-border bg-card p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{s.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {site ? (
                        <a
                          href={site}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium hover:opacity-80",
                            app.badgeClass,
                          )}
                        >
                          {app.label}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      ) : (
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", app.badgeClass)}>
                          {app.label}
                        </span>
                      )}
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        {ACCESS_LABEL[s.access_type]}
                      </span>
                      {dDays != null && (
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", urgencyClass(dUrg))}>
                          App: {urgencyLabel(dUrg, dDays)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startEdit(s)}
                    className="h-7 shrink-0 gap-1 px-2 text-[10px]"
                  >
                    <Pencil className="h-3 w-3" /> Editar
                  </Button>
                </div>

                {(s.mac || s.app_key) && (
                  <div className="mt-2 space-y-1.5">
                    {s.mac && (
                      <CredRow label="MAC" value={s.mac} onCopy={() => copy(`MAC (${s.name})`, s.mac)} copied={copied === `MAC (${s.name})`} />
                    )}
                    {s.app_key && (
                      <CredRow label="Key" value={s.app_key} onCopy={() => copy(`Key (${s.name})`, s.app_key)} copied={copied === `Key (${s.name})`} />
                    )}
                  </div>
                )}
                {s.access_type === "user_pass" && (s.username || s.password) && (
                  <div className="mt-2 space-y-1.5">
                    {s.username && (
                      <CredRow label="Usuário" value={s.username} onCopy={() => copy(`Usuário (${s.name})`, s.username)} copied={copied === `Usuário (${s.name})`} />
                    )}
                    {s.password && (
                      <CredRow label="Senha" value={mask(s.password)} onCopy={() => copy(`Senha (${s.name})`, s.password)} copied={copied === `Senha (${s.name})`} />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {draft && (
            <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">
                  {editingId ? "Editando tela" : "Nova tela"}
                </p>
                <Button size="sm" variant="ghost" onClick={cancelDraft} className="h-6 w-6 p-0">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Nome da tela</span>
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="Tela 1"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Aplicativo</span>
                  <select
                    value={draft.app}
                    onChange={(e) => setDraft({ ...draft, app: e.target.value as AppKey })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  >
                    {APP_OPTIONS.map((k) => (
                      <option key={k} value={k}>{APP_CATALOG[k].label}</option>
                    ))}
                  </select>
                </label>
              </div>

              {APP_CATALOG[draft.app].access === "user_pass" ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Usuário</span>
                    <Input value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} className="h-8 text-xs font-mono" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Senha</span>
                    <Input value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} className="h-8 text-xs font-mono" />
                  </label>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">MAC</span>
                    <Input
                      value={draft.mac}
                      onChange={(e) => setDraft({ ...draft, mac: e.target.value })}
                      className="h-8 text-xs font-mono"
                      placeholder="00:1A:79:..."
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Key</span>
                    <Input
                      value={draft.app_key}
                      onChange={(e) => setDraft({ ...draft, app_key: e.target.value })}
                      className="h-8 text-xs font-mono"
                      placeholder="chave do app"
                    />
                  </label>
                </div>
              )}

              <label className="block space-y-1">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Vencimento do app {APP_CATALOG[draft.app].tier === "pago" ? "(pago — usado para cobrar)" : "(opcional)"}
                </span>
                <Input
                  type="date"
                  value={draft.app_due_date}
                  onChange={(e) => setDraft({ ...draft, app_due_date: e.target.value })}
                  className="h-8 text-xs"
                />
              </label>

              <div className="flex gap-2">
                <Button size="sm" onClick={saveDraft} className="flex-1 h-8 gap-1.5 text-xs">
                  <Save className="h-3.5 w-3.5" /> Salvar
                </Button>
                <Button size="sm" variant="outline" onClick={cancelDraft} className="h-8 text-xs">
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {!draft && (
            <Button size="sm" variant="outline" onClick={startAdd} className="w-full gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> Adicionar tela / aplicativo
            </Button>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={onOpenFull} variant="secondary" className="gap-1.5">
            <Settings2 className="h-4 w-4" /> Gerenciar completo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CredRow({
  label, value, onCopy, copied,
}: { label: string; value: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-2 py-1">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate font-mono text-xs">{value}</p>
      </div>
      <Button size="sm" variant="ghost" onClick={onCopy} className="h-7 shrink-0 gap-1 px-2 text-[10px]">
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        Copiar
      </Button>
    </div>
  );
}
