import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Search,
  X,
  Users,
  Copy,
  ExternalLink,
  Download,
  AlertTriangle,
  RefreshCcw,
  Tv,
  MessageSquare,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { CompanyScopeNotice } from "@/components/companies/CompanyScopeNotice";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { ImportAgendaSection } from "@/components/import/ImportAgendaSection";

import { EmptyState } from "@/components/ui-premium/EmptyState";
import { ListCardSkeleton } from "@/components/ui-premium/Skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import { useAuth } from "@/lib/use-auth";
import { supabase, supabaseConfigured } from "@/integrations/supabase/compat";
import { getCurrentCompanyAdmin, listCustomersAdmin } from "@/lib/rpc-admin";
import {
  APP_CATALOG,
  AppKey,
  AppScreen,
  listAllScreens,
  nextDueDays,
  urgencyFromDays,
  urgencyClass,
  urgencyLabel,
  daysUntil,
  mask,
  formatScreenAsText,
  ROUTE_OPTIONS,
  isPaidApp,
  appDueDays,
  paidAppAlerts,
  paidAlertClass,
  PAID_ALERT_LABEL,
} from "@/lib/app-screens";
import { ServerBadge, SemServidorBadge } from "@/components/servers/ServerBadge";
import { ServerRouteInfo } from "@/components/servers/ServerRouteInfo";
import { listActiveServers, screensHaveServer } from "@/lib/server-catalog";

export const Route = createFileRoute("/operacao-dia")({
  component: OperacaoDiaPage,
});

// ---------- types & helpers ----------
type Row = Record<string, unknown>;
type Customer = {
  id: string;
  name: string;
  whatsapp: string | null;
  due_day: number | null;
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
const prettyPhone = (s: string | null | undefined) => {
  if (!s) return null;
  const d = onlyDigits(s);
  if (d.length === 13 && d.startsWith("55"))
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 11)
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return s;
};

const normalize = (r: Row): Customer => ({
  id: String(r.id ?? ""),
  name: str(r, ["name", "nome", "full_name"]) ?? "Cliente",
  whatsapp: str(r, ["whatsapp_e164", "whatsapp", "phone", "telefone"]) ?? null,
  due_day: num(r, ["due_day", "dia_vencimento", "vencimento_dia"]),
  status: str(r, ["status", "situacao"]),
});

const todayStr = () => new Date().toISOString().slice(0, 10);

const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? n;

const copy = async (text: string, label = "Texto") => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  } catch {
    toast.error("Não foi possível copiar");
  }
};

const fmtDateBR = (d?: string | null) => {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return isNaN(+dt) ? d : dt.toLocaleDateString("pt-BR");
};

// Mensagens prontas
function msgCobrancaHoje(name: string) {
  return `Olá, ${firstName(name)}! Tudo bem? 😊\nSua mensalidade vence hoje. Se precisar do PIX ou de ajuda, é só me chamar por aqui. Obrigado!`;
}
function msgVencendoEmBreve(name: string, days: number) {
  return `Oi, ${firstName(name)}! 😊\nPassando para lembrar que sua mensalidade vence em ${days} ${days === 1 ? "dia" : "dias"}. Qualquer dúvida me chama por aqui.`;
}
function msgVencida(name: string, days: number) {
  return `Olá, ${firstName(name)}!\nNotei que sua mensalidade está vencida há ${days} ${days === 1 ? "dia" : "dias"}. Posso te enviar o PIX ou ajudar a renovar agora? 🙂`;
}
function msgPedirPrint() {
  return `Pode me mandar um print da tela com o erro, por favor? Assim consigo entender exatamente o que está acontecendo e te ajudar mais rápido. 🙏`;
}
function msgAtualizarServidor(name: string) {
  return `Olá, ${firstName(name)}! Tudo bem? Estamos atualizando a rota/servidor da sua tela para melhorar a estabilidade. Vou conferir seus dados e te orientar por aqui. 👍`;
}
function msgReiniciar() {
  return `Vamos tentar o básico primeiro 🙂\n1) Desligue a TV/box da tomada por 30s\n2) Reinicie o roteador\n3) Abra o aplicativo de novo\nMe avise se funcionou.`;
}
function msgPedirMacKey() {
  return `Para cadastrar/ajustar seu acesso, preciso do MAC e da Key do aplicativo, por favor. Eles aparecem na tela inicial do app. 🙏`;
}
function msgPedirUserPass() {
  return `Para cadastrar/ajustar seu acesso, preciso do usuário e senha do aplicativo, por favor. 🙏`;
}
function msgHorario() {
  return `Nosso horário de atendimento é de segunda a sábado, das 9h às 21h. Fora desse horário respondo assim que possível. 🙂`;
}
function msgAvisoSimulado() {
  return `(Aviso interno) Este é um ambiente de testes. Nenhuma mensagem foi enviada automaticamente para o cliente.`;
}

// ----- mensagens de app pago -----
function msgAppVencendo(name: string, app: string, tela: string, diasApp: number, vencApp: string, valor?: string) {
  return `Olá ${firstName(name)}, tudo bem? 😊\n\nO aplicativo ${app} da sua ${tela} vence em ${diasApp} dia(s).\n\n📱 App: ${app}\n📺 Tela: ${tela}\n📅 Vencimento do app: ${vencApp}${valor ? `\n💰 Renovação: ${valor}` : ""}\n\nEssa renovação é da licença do aplicativo, separada da mensalidade da lista.`;
}
function msgAppVencido(name: string, app: string, tela: string, vencApp: string) {
  return `Olá ${firstName(name)}, tudo bem? 😊\n\nA licença do aplicativo ${app} da sua ${tela} está vencida.\n\n📱 App: ${app}\n📺 Tela: ${tela}\n📅 Vencimento: ${vencApp}\n\nQuando a licença vence, o app pode parar de abrir ou pedir renovação.`;
}
function msgPedirMacKeyApp(name: string, app: string) {
  return `Olá ${firstName(name)}, tudo bem? 😊\n\nPara eu conferir o app ${app}, preciso que você me envie o MAC e a Key que aparecem na tela do aplicativo.\n\nSe puder, mande também um print da tela.`;
}

// Mensagem de "dados da tela" mascarados
function copyTelaDados(s: AppScreen, customerName: string) {
  return formatScreenAsText(s, customerName, { revealSecrets: false });
}
function copyTelaDadosAbertos(s: AppScreen, customerName: string) {
  return formatScreenAsText(s, customerName, { revealSecrets: true });
}
function copyInstrucaoSuporte(s: AppScreen, customerName: string) {
  const app = APP_CATALOG[s.app]?.label ?? s.app;
  const fn = firstName(customerName);
  if (s.access_type === "mac_key") {
    return `Olá, ${fn}!\nVou te orientar no ${app}. Abra o aplicativo, vá em "Definições/Playlist" e confirme se o MAC e a Key cadastrados estão corretos. Se aparecer erro, me mande um print que ajusto por aqui. 🙂`;
  }
  if (s.access_type === "user_pass") {
    return `Olá, ${fn}!\nVou te orientar no ${app}. Abra o aplicativo, vá em "Adicionar usuário/playlist" e confirme se o servidor, usuário e senha estão corretos. Qualquer coisa, me mande um print. 🙂`;
  }
  return `Olá, ${fn}!\nVou te orientar no ${app}. Abra o aplicativo e me diga em qual etapa está o problema. Pode mandar um print? 🙂`;
}

// ----- linha de prioridade (cliente + tela) -----
type Priority = {
  customer: Customer;
  screen: AppScreen | null; // null = sem app cadastrado
  days: number | null;
  urgency: ReturnType<typeof urgencyFromDays>;
  needsUpdate: boolean;
};

function buildPriorities(
  customers: Customer[],
  allScreens: Record<string, AppScreen[]>,
): Priority[] {
  const out: Priority[] = [];
  for (const c of customers) {
    const screens = (allScreens[c.id] ?? []).filter(
      (s) => s.status !== "arquivada",
    );
    if (screens.length === 0) {
      const days = nextDueDays(c.due_day, []);
      out.push({
        customer: c,
        screen: null,
        days,
        urgency: urgencyFromDays(days),
        needsUpdate: false,
      });
      continue;
    }
    for (const s of screens) {
      const days = daysUntil(s.due_date) ?? nextDueDays(c.due_day, [s]);
      out.push({
        customer: c,
        screen: s,
        days,
        urgency: urgencyFromDays(days),
        needsUpdate: !!s.needs_server_update,
      });
    }
  }
  return out;
}

function rank(p: Priority): number {
  const s = p.screen;
  const paid = s ? isPaidApp(s) : false;
  const ad = s && paid ? appDueDays(s) : null;
  if (p.urgency === "hoje") return 0;
  if (p.urgency === "vencido") return 50 + Math.abs(p.days ?? 0);
  if (paid && ad != null && ad < 0) return 60 + Math.abs(ad);
  if (paid && ad != null && ad <= 7) return 80 + ad;
  if (p.needsUpdate) return 100;
  if (p.urgency === "3d") return 120 + (p.days ?? 0);
  if (p.urgency === "7d") return 140 + (p.days ?? 0);
  if (paid && ad != null && ad <= 30) return 200 + ad;
  if (paid && ad == null) return 260;
  if (paid && s && ((s.access_type === "mac" || s.access_type === "mac_key") && (!s.mac || (s.access_type === "mac_key" && !s.app_key)))) return 280;
  if (p.urgency === "em_dia") return 400 + (p.days ?? 0);
  if (p.urgency === "sem_data") return 700;
  return 800;
}

// ---------- page ----------
type OpFilter =
  | "todos" | "hoje" | "3d" | "7d" | "vencidos" | "needs_update"
  | "app_bob" | "app_xciptv" | "app_ibo" | "app_vu"
  | "app_eagle" | "app_duplex" | "app_set" | "app_smartone"
  | "acc_mac_key" | "acc_user_pass" | "sem_app"
  | "app_pago_vencendo" | "app_pago_7d" | "app_pago_vencido"
  | "app_sem_venc" | "app_sem_mackey";

function OperacaoDiaPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Customer[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<OpFilter>("hoje");
  const [serverFilter, setServerFilter] = useState<string>("__all__");
  const [screensVersion, setScreensVersion] = useState(0);
  const [confirmReveal, setConfirmReveal] = useState<
    | null
    | { screen: AppScreen; customerName: string }
  >(null);

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
        setErrorMsg(
          companyErr
            ? "Não foi possível identificar a empresa."
            : "Nenhuma empresa autorizada encontrada.",
        );
        setItems(null);
        setLoading(false);
        return;
      }
      const res = await listCustomersAdmin({
        p_company_id: companyId,
        p_status: null,
        p_search: null,
        p_limit: 500,
        p_offset: 0,
      });
      if (!alive) return;
      if (res.error) {
        setErrorMsg(res.error.message ?? "Falha ao carregar clientes");
        setItems(null);
      } else {
        setItems(((res.data ?? []) as Row[]).map(normalize));
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [isAuthenticated, authLoading]);

  const allScreens = useMemo(
    () => listAllScreens(),
    [items, screensVersion],
  );

  const priorities = useMemo(
    () => (items ? buildPriorities(items, allScreens) : []),
    [items, allScreens],
  );

  // ----- contadores -----
  const summary = useMemo(() => {
    const s = {
      hoje: 0,
      d3: 0,
      d7: 0,
      vencidos: 0,
      needsUpdate: 0,
      semApp: 0,
      mackey: 0,
      userpass: 0,
      // por app
      bob: 0,
      xciptv: 0,
      ibo: 0,
      vu: 0,
      eagle: 0,
      duplex: 0,
      setiptv: 0,
      smartone: 0,
      // apps pagos
      paidVenc30: 0,
      paidVenc7: 0,
      paidVencido: 0,
      paidSemVenc: 0,
      paidSemMacKey: 0,
    };
    for (const p of priorities) {
      if (p.urgency === "hoje") s.hoje++;
      else if (p.urgency === "3d") s.d3++;
      else if (p.urgency === "7d") s.d7++;
      else if (p.urgency === "vencido") s.vencidos++;
      if (p.needsUpdate) s.needsUpdate++;
      if (!p.screen) s.semApp++;
      else {
        if (p.screen.access_type === "mac_key") s.mackey++;
        if (p.screen.access_type === "user_pass") s.userpass++;
        const a = p.screen.app;
        if (a === "bob_player" || a === "bob_play") s.bob++;
        if (a === "xciptv") s.xciptv++;
        if (a === "ibo_player" || a === "ibo_pro" || a === "ibo_mix") s.ibo++;
        if (a === "vu_player") s.vu++;
        if (a === "eagle_play") s.eagle++;
        if (a === "duplex_play") s.duplex++;
        if (a === "set_iptv") s.setiptv++;
        if (a === "smart_one") s.smartone++;
        if (isPaidApp(p.screen)) {
          const d = appDueDays(p.screen);
          if (d == null) s.paidSemVenc++;
          else if (d < 0) s.paidVencido++;
          else if (d <= 7) s.paidVenc7++;
          if (d != null && d >= 0 && d <= 30) s.paidVenc30++;
          const at = p.screen.access_type;
          if ((at === "mac" || at === "mac_key") && (!p.screen.mac || (at === "mac_key" && !p.screen.app_key))) {
            s.paidSemMacKey++;
          }
        }
      }
    }
    return s;
  }, [priorities]);

  // ----- filtro -----
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchesFilter = (p: Priority): boolean => {
      const s = p.screen;
      const paid = s ? isPaidApp(s) : false;
      const ad = s && paid ? appDueDays(s) : null;
      switch (filter) {
        case "todos": return true;
        case "hoje": return p.urgency === "hoje";
        case "3d": return p.urgency === "hoje" || p.urgency === "3d";
        case "7d": return p.urgency === "hoje" || p.urgency === "3d" || p.urgency === "7d";
        case "vencidos": return p.urgency === "vencido";
        case "needs_update": return p.needsUpdate;
        case "sem_app": return p.screen == null;
        case "app_bob": return s?.app === "bob_player" || s?.app === "bob_play";
        case "app_xciptv": return s?.app === "xciptv";
        case "app_ibo": return s?.app === "ibo_player" || s?.app === "ibo_pro" || s?.app === "ibo_mix";
        case "app_vu": return s?.app === "vu_player";
        case "app_eagle": return s?.app === "eagle_play";
        case "app_duplex": return s?.app === "duplex_play";
        case "app_set": return s?.app === "set_iptv";
        case "app_smartone": return s?.app === "smart_one";
        case "acc_mac_key": return s?.access_type === "mac_key";
        case "acc_user_pass": return s?.access_type === "user_pass";
        case "app_pago_vencendo": return paid && ad != null && ad >= 0 && ad <= 30;
        case "app_pago_7d": return paid && ad != null && ad >= 0 && ad <= 7;
        case "app_pago_vencido": return paid && ad != null && ad < 0;
        case "app_sem_venc": return paid && ad == null;
        case "app_sem_mackey": {
          if (!paid || !s) return false;
          const at = s.access_type;
          return (at === "mac" || at === "mac_key") && (!s.mac || (at === "mac_key" && !s.app_key));
        }
      }
    };
    return priorities.filter((p) => {
      if (!matchesFilter(p)) return false;
      if (serverFilter !== "__all__") {
        if (serverFilter === "__none__") {
          if (p.screen && (p.screen.server_ids ?? []).length > 0) return false;
        } else {
          if (!p.screen) return false;
          if (!(p.screen.server_ids ?? []).includes(serverFilter)) return false;
        }
      }
      if (!q) return true;
      const c = p.customer;
      const phone = onlyDigits(c.whatsapp ?? "");
      if (
        c.name.toLowerCase().includes(q) ||
        phone.includes(onlyDigits(q)) ||
        (c.whatsapp ?? "").toLowerCase().includes(q)
      ) return true;
      const s = p.screen;
      if (!s) return false;
      return (
        s.name.toLowerCase().includes(q) ||
        (APP_CATALOG[s.app]?.label.toLowerCase().includes(q) ?? false) ||
        (s.mac ?? "").toLowerCase().includes(q) ||
        (s.app_key ?? "").toLowerCase().includes(q) ||
        (s.username ?? "").toLowerCase().includes(q) ||
        (s.server ?? "").toLowerCase().includes(q) ||
        (s.route ?? "").toLowerCase().includes(q)
      );
    });
  }, [priorities, filter, serverFilter, query]);

  // Contadores por servidor para a barra de filtros
  const serverCounts = useMemo(() => {
    const active = listActiveServers();
    const out = active.map((s) => ({ id: s.id, name: s.name, color: s.color, count: 0 }));
    let none = 0;
    for (const p of priorities) {
      const sids = p.screen?.server_ids ?? [];
      if (p.screen && sids.length === 0) none += 1;
      for (const o of out) if (sids.includes(o.id)) o.count += 1;
    }
    return { servers: out, none };
  }, [priorities, screensVersion]);

  const ordered = useMemo(
    () => [...filtered].sort((a, b) => rank(a) - rank(b)),
    [filtered],
  );

  const semAppList = useMemo(
    () => priorities.filter((p) => p.screen == null),
    [priorities],
  );

  const needsUpdateList = useMemo(
    () => priorities.filter((p) => p.needsUpdate),
    [priorities],
  );

  const openCustomer = (id: string, tab?: "telas" | "atend") => {
    try {
      window.sessionStorage.setItem("cobranca_ia_open_customer_id", id);
      if (tab) window.sessionStorage.setItem("cobranca_ia_open_customer_tab", tab);
    } catch { /* ignore */ }
    navigate({ to: "/clientes" });
  };

  const exportTxt = () => {
    const lines: string[] = [];
    const date = new Date().toLocaleDateString("pt-BR");
    lines.push(`Operação do dia — CobraEasy`);
    lines.push(`Data: ${date}`);
    lines.push(`Ambiente: simulado (nada enviado)`);
    lines.push("");

    const block = (title: string, list: Priority[]) => {
      lines.push(`=== ${title} (${list.length}) ===`);
      if (list.length === 0) {
        lines.push("(vazio)");
      } else {
        for (const p of list) {
          const phone = prettyPhone(p.customer.whatsapp) ?? "sem WhatsApp";
          const tela = p.screen ? `${p.screen.name} · ${APP_CATALOG[p.screen.app]?.label ?? p.screen.app}` : "(sem app)";
          const venc = p.days == null ? "sem data" : `${urgencyLabel(p.urgency, p.days)}`;
          lines.push(`- ${p.customer.name} | ${phone} | ${tela} | ${venc}`);
        }
      }
      lines.push("");
    };

    block("Vencem hoje", priorities.filter((p) => p.urgency === "hoje"));
    block("Próximos 7 dias", priorities.filter((p) => p.urgency === "3d" || p.urgency === "7d"));
    block("Vencidos", priorities.filter((p) => p.urgency === "vencido"));
    block("Precisam atualizar servidor", needsUpdateList);
    block("Sem app cadastrado", semAppList);

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `operacao-dia-cobranca-ia-${todayStr()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Lista do dia exportada");
  };

  return (
    <PageContainer>
      <SectionHeader
        title="Operação do dia"
        subtitle="Veja quem precisa de atenção hoje e copie mensagens rápidas para atendimento."
        hint="Tela apenas para organizar seu atendimento — nada é enviado automaticamente."
      />
      <CompanyScopeNotice moduleKey="cobranca_ia_app_screens_v1" />

      {/* aviso fixo */}
      {flags.stagingMode && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft/60 px-3 py-2 text-xs text-warning-foreground">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <b>Ambiente de testes:</b> nada será enviado automaticamente. Mensagens e dados são apenas copiados para você usar manualmente.
          </span>
        </div>
      )}

      {/* Cards de resumo */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryCard label="Vencem hoje" value={summary.hoje} tone="red" />
        <SummaryCard label="Próx. 3 dias" value={summary.d3} tone="orange" />
        <SummaryCard label="Próx. 7 dias" value={summary.d7} tone="amber" />
        <SummaryCard label="Vencidos" value={summary.vencidos} tone="redDeep" />
        <SummaryCard label="Atualizar servidor" value={summary.needsUpdate} tone="violet" />
        <SummaryCard label="Sem app cadastrado" value={summary.semApp} tone="slate" />
        <SummaryCard label="Apps MAC/Key" value={summary.mackey} tone="emerald" />
        <SummaryCard label="Apps Usuário/Senha" value={summary.userpass} tone="blue" />
      </div>

      {/* Cards de app pago */}
      <div className="mb-2 text-xs font-medium text-muted-foreground">Apps pagos</div>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <SummaryCard label="App vence 30 dias" value={summary.paidVenc30} tone="amber" />
        <SummaryCard label="App vence 7 dias" value={summary.paidVenc7} tone="orange" />
        <SummaryCard label="App vencido" value={summary.paidVencido} tone="redDeep" />
        <SummaryCard label="App sem vencimento" value={summary.paidSemVenc} tone="slate" />
        <SummaryCard label="App sem MAC/Key" value={summary.paidSemMacKey} tone="violet" />
      </div>

      {/* Mensagens rápidas */}
      <QuickMessagesBar />

      {/* Busca */}
      <div className="relative mt-4 mb-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por cliente, WhatsApp, tela, app, MAC, usuário, servidor, rota…"
          className="h-11 pl-9 pr-9"
          inputMode="search"
        />
        {query && (
          <button
            type="button"
            aria-label="Limpar"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="mb-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <FilterChip active={filter === "todos"} onClick={() => setFilter("todos")} label="Todos" count={priorities.length} />
        <FilterChip active={filter === "hoje"} onClick={() => setFilter("hoje")} label="Hoje" count={summary.hoje} />
        <FilterChip active={filter === "3d"} onClick={() => setFilter("3d")} label="3 dias" count={summary.hoje + summary.d3} />
        <FilterChip active={filter === "7d"} onClick={() => setFilter("7d")} label="7 dias" count={summary.hoje + summary.d3 + summary.d7} />
        <FilterChip active={filter === "vencidos"} onClick={() => setFilter("vencidos")} label="Vencidos" count={summary.vencidos} />
        <FilterChip active={filter === "needs_update"} onClick={() => setFilter("needs_update")} label="Atualizar servidor" count={summary.needsUpdate} />
        <FilterChip active={filter === "app_bob"} onClick={() => setFilter("app_bob")} label="Bob Player" count={summary.bob} dim={summary.bob === 0} />
        <FilterChip active={filter === "app_xciptv"} onClick={() => setFilter("app_xciptv")} label="XCIPTV" count={summary.xciptv} dim={summary.xciptv === 0} />
        <FilterChip active={filter === "app_ibo"} onClick={() => setFilter("app_ibo")} label="IBO" count={summary.ibo} dim={summary.ibo === 0} />
        <FilterChip active={filter === "app_vu"} onClick={() => setFilter("app_vu")} label="Vu Player" count={summary.vu} dim={summary.vu === 0} />
        <FilterChip active={filter === "acc_mac_key"} onClick={() => setFilter("acc_mac_key")} label="MAC/Key" count={summary.mackey} dim={summary.mackey === 0} />
        <FilterChip active={filter === "acc_user_pass"} onClick={() => setFilter("acc_user_pass")} label="Usuário/Senha" count={summary.userpass} dim={summary.userpass === 0} />
        <FilterChip active={filter === "sem_app"} onClick={() => setFilter("sem_app")} label="Sem app" count={summary.semApp} dim={summary.semApp === 0} />
        <FilterChip active={filter === "app_pago_vencendo"} onClick={() => setFilter("app_pago_vencendo")} label="App pago vencendo" count={summary.paidVenc30} dim={summary.paidVenc30 === 0} />
        <FilterChip active={filter === "app_pago_7d"} onClick={() => setFilter("app_pago_7d")} label="App pago 7 dias" count={summary.paidVenc7} dim={summary.paidVenc7 === 0} />
        <FilterChip active={filter === "app_pago_vencido"} onClick={() => setFilter("app_pago_vencido")} label="App pago vencido" count={summary.paidVencido} dim={summary.paidVencido === 0} />
        <FilterChip active={filter === "app_sem_venc"} onClick={() => setFilter("app_sem_venc")} label="Sem vencimento do app" count={summary.paidSemVenc} dim={summary.paidSemVenc === 0} />
        <FilterChip active={filter === "app_sem_mackey"} onClick={() => setFilter("app_sem_mackey")} label="Sem MAC/Key" count={summary.paidSemMacKey} dim={summary.paidSemMacKey === 0} />
        <FilterChip active={filter === "app_eagle"} onClick={() => setFilter("app_eagle")} label="Eagle Play" count={summary.eagle} dim={summary.eagle === 0} />
        <FilterChip active={filter === "app_duplex"} onClick={() => setFilter("app_duplex")} label="Duplex Play" count={summary.duplex} dim={summary.duplex === 0} />
        <FilterChip active={filter === "app_set"} onClick={() => setFilter("app_set")} label="Set IPTV" count={summary.setiptv} dim={summary.setiptv === 0} />
        <FilterChip active={filter === "app_smartone"} onClick={() => setFilter("app_smartone")} label="SmartOne" count={summary.smartone} dim={summary.smartone === 0} />
      </div>

      {/* Filtros por servidor */}
      <div className="mb-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <FilterChip active={serverFilter === "__all__"} onClick={() => setServerFilter("__all__")} label="Todos servidores" count={priorities.length} />
        <FilterChip active={serverFilter === "__none__"} onClick={() => setServerFilter("__none__")} label="Sem servidor" count={serverCounts.none} dim={serverCounts.none === 0} />
        {serverCounts.servers.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setServerFilter(s.id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition inline-flex items-center gap-1.5",
              serverFilter === s.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-muted",
              s.count === 0 && serverFilter !== s.id && "opacity-60",
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
            {s.name} <span className={cn("ml-0.5 tabular-nums", serverFilter === s.id ? "opacity-90" : "text-muted-foreground")}>({s.count})</span>
          </button>
        ))}
      </div>



      {/* exportar */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Prioridade de hoje</h3>
        <Button variant="outline" size="sm" onClick={exportTxt} className="gap-2">
          <Download className="h-4 w-4" /> Exportar lista do dia
        </Button>
      </div>

      {/* estados */}
      {!isAuthenticated && !authLoading && (
        <EmptyState icon={Users} title="Entre para ver sua operação" description="Faça login para organizar o atendimento do dia." />
      )}

      {isAuthenticated && loading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <ListCardSkeleton key={i} />)}
        </div>
      )}

      {isAuthenticated && !loading && errorMsg && (
        <EmptyState icon={AlertTriangle} title="Não foi possível carregar" description={errorMsg} />
      )}

      {isAuthenticated && !loading && !errorMsg && ordered.length === 0 && (
        <EmptyState
          icon={CalendarClock}
          title="Nada urgente por aqui"
          description={query ? "Tente outra busca." : "Quando houver vencimentos próximos, eles aparecem ordenados aqui."}
        />
      )}

      {isAuthenticated && !loading && !errorMsg && ordered.length > 0 && (
        <div className="space-y-2">
          {ordered.map((p, idx) => (
            <PriorityCard
              key={`${p.customer.id}-${p.screen?.id ?? "no-app"}-${idx}`}
              p={p}
              onOpenCustomer={() => openCustomer(p.customer.id)}
              onOpenTelas={() => openCustomer(p.customer.id, "telas")}
              onRequestReveal={(s) => setConfirmReveal({ screen: s, customerName: p.customer.name })}
            />
          ))}
        </div>
      )}

      {/* Bloco: Sem app cadastrado */}
      {isAuthenticated && !loading && semAppList.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-2 text-sm font-semibold flex items-center gap-2">
            <Tv className="h-4 w-4 text-muted-foreground" /> Sem app cadastrado ({semAppList.length})
          </h3>
          <p className="mb-2 text-xs text-muted-foreground">
            Cadastre o aplicativo usado pelo cliente para agilizar o suporte.
          </p>
          <div className="space-y-2">
            {semAppList.map((p) => (
              <div key={p.customer.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{p.customer.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {prettyPhone(p.customer.whatsapp) ?? "Sem WhatsApp"}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row">
                    <Button size="sm" variant="outline" onClick={() => openCustomer(p.customer.id)}>
                      Abrir cliente
                    </Button>
                    <Button size="sm" onClick={() => openCustomer(p.customer.id, "telas")}>
                      Cadastrar app
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Bloco: Precisam atualizar servidor */}
      {isAuthenticated && !loading && needsUpdateList.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-2 text-sm font-semibold flex items-center gap-2">
            <RefreshCcw className="h-4 w-4 text-violet-500" /> Precisam atualizar servidor ({needsUpdateList.length})
          </h3>
          <div className="space-y-2">
            {needsUpdateList.map((p) => (
              <div key={`${p.customer.id}-${p.screen?.id}`} className="rounded-lg border border-violet-300/40 bg-violet-50/40 p-3 dark:border-violet-500/30 dark:bg-violet-500/5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{p.customer.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {p.screen?.name} · {APP_CATALOG[p.screen!.app]?.label}
                    </div>
                    <div className="mt-1 text-xs">
                      Rota: <b>{ROUTE_OPTIONS.find((o) => o.value === p.screen?.route)?.label ?? "—"}</b>
                      {p.screen?.server ? <> · Servidor: <span className="font-mono">{p.screen.server}</span></> : null}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copy(msgAtualizarServidor(p.customer.name), "Aviso")}
                      className="gap-1"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copiar aviso
                    </Button>
                    <Button size="sm" onClick={() => openCustomer(p.customer.id, "telas")}>
                      Abrir cliente
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Confirmação para revelar senha/key ao copiar */}
      <AlertDialog open={!!confirmReveal} onOpenChange={(o) => !o && setConfirmReveal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copiar dados com senha/key?</AlertDialogTitle>
            <AlertDialogDescription>
              Os dados sensíveis serão copiados em texto aberto para sua área de transferência.
              Cole apenas em um lugar seguro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmReveal) {
                  copy(
                    copyTelaDadosAbertos(confirmReveal.screen, confirmReveal.customerName),
                    "Dados (abertos)",
                  );
                }
                setConfirmReveal(null);
              }}
            >
              Copiar com senha/key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="mt-4">
        <ImportAgendaSection
          title="Disparos planejados pela importação"
          subtitle="Itens vindos da última importação local. Nenhum envio automático."
          hideWhenEmpty
        />
      </div>
    </PageContainer>
  );
}


// ---------- subcomponents ----------
function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "red" | "orange" | "amber" | "redDeep" | "violet" | "slate" | "emerald" | "blue";
}) {
  const toneCls: Record<string, string> = {
    red: "border-red-300/50 bg-red-50/60 dark:border-red-500/30 dark:bg-red-500/10",
    orange: "border-orange-300/50 bg-orange-50/60 dark:border-orange-500/30 dark:bg-orange-500/10",
    amber: "border-amber-300/50 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10",
    redDeep: "border-red-400/60 bg-red-100/60 dark:border-red-600/40 dark:bg-red-700/15",
    violet: "border-violet-300/50 bg-violet-50/60 dark:border-violet-500/30 dark:bg-violet-500/10",
    slate: "border-border bg-muted/40",
    emerald: "border-emerald-300/50 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10",
    blue: "border-blue-300/50 bg-blue-50/60 dark:border-blue-500/30 dark:bg-blue-500/10",
  };
  return (
    <div className={cn("rounded-xl border p-3", toneCls[tone])}>
      <div className="text-2xl font-bold leading-none">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  dim,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  dim?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-muted",
        dim && !active && "opacity-60",
      )}
    >
      {label} <span className={cn("ml-1 tabular-nums", active ? "opacity-90" : "text-muted-foreground")}>({count})</span>
    </button>
  );
}

function QuickMessagesBar() {
  const buttons: { label: string; build: () => string }[] = [
    { label: "Vence hoje", build: () => msgCobrancaHoje("cliente") },
    { label: "Vence em breve", build: () => msgVencendoEmBreve("cliente", 3) },
    { label: "Mensalidade vencida", build: () => msgVencida("cliente", 2) },
    { label: "Pedir print", build: () => msgPedirPrint() },
    { label: "Atualizar servidor", build: () => msgAtualizarServidor("cliente") },
    { label: "Reiniciar TV/net", build: () => msgReiniciar() },
    { label: "Pedir MAC e Key", build: () => msgPedirMacKey() },
    { label: "Pedir usuário/senha", build: () => msgPedirUserPass() },
    { label: "Horário de atendimento", build: () => msgHorario() },
    { label: "Aviso simulado", build: () => msgAvisoSimulado() },
  ];
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" /> Mensagens rápidas do dia
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {buttons.map((b) => (
          <button
            key={b.label}
            type="button"
            onClick={() => copy(b.build(), b.label)}
            className="shrink-0 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs hover:bg-muted"
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PriorityCard({
  p,
  onOpenCustomer,
  onOpenTelas,
  onRequestReveal,
}: {
  p: Priority;
  onOpenCustomer: () => void;
  onOpenTelas: () => void;
  onRequestReveal: (s: AppScreen) => void;
}) {
  const phone = prettyPhone(p.customer.whatsapp);
  const s = p.screen;
  const appMeta = s ? APP_CATALOG[s.app] : null;
  const urgency = p.urgency;
  const days = p.days;

  const buildCobranca = () => {
    if (urgency === "hoje") return msgCobrancaHoje(p.customer.name);
    if (urgency === "3d" || urgency === "7d") return msgVencendoEmBreve(p.customer.name, days ?? 0);
    if (urgency === "vencido") return msgVencida(p.customer.name, Math.abs(days ?? 0));
    return msgCobrancaHoje(p.customer.name);
  };

  const alerts = s ? paidAppAlerts(s) : [];
  const paid = s ? isPaidApp(s) : false;
  const adays = s && paid ? appDueDays(s) : null;
  const appLabel = appMeta?.label ?? "";

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold">{p.customer.name}</span>
            {appMeta && (
              <span className={cn("rounded-md px-1.5 py-0.5 text-[10px]", appMeta.badgeClass)}>
                {appMeta.label}
              </span>
            )}
            {paid && (
              <span className="rounded-md border border-purple-400/60 bg-purple-100 px-1.5 py-0.5 text-[10px] text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">
                App pago
              </span>
            )}
            <span className={cn("rounded-md px-1.5 py-0.5 text-[10px]", urgencyClass(urgency))}>
              {urgencyLabel(urgency, days)}
            </span>
            {p.needsUpdate && (
              <span className="rounded-md border border-violet-400/60 bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                Atualizar servidor
              </span>
            )}
            {alerts.map((a) => (
              <span key={a} className={cn("rounded-md px-1.5 py-0.5 text-[10px]", paidAlertClass(a))}>
                {a === "vence_7d" && adays != null ? `App vence em ${adays}d` : PAID_ALERT_LABEL[a]}
              </span>
            ))}
            {s?.app_renewal_value && paid && (
              <span className="rounded-md border border-emerald-400/60 bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                Renovação: {s.app_renewal_value}
              </span>
            )}
            {s && ((s.server_ids ?? []).length > 0
              ? (s.server_ids ?? []).map((sid) => <ServerBadge key={sid} serverId={sid} size="xs" />)
              : <SemServidorBadge />)}
          </div>
          {s && (s.server_ids ?? []).length > 0 && (
            <ServerRouteInfo
              serverIds={s.server_ids}
              primaryServerId={s.primary_server_id}
              className="mt-1"
            />
          )}
          <div className="mt-1 text-xs text-muted-foreground">
            {phone ?? "Sem WhatsApp"}
            {s ? (
              <>
                {" · "}{s.name}
                {s.due_date ? <> · vence {fmtDateBR(s.due_date)}</> : null}
                {s.app_due_date ? <> · app vence {fmtDateBR(s.app_due_date)}</> : null}
                {s.route ? <> · {ROUTE_OPTIONS.find((o) => o.value === s.route)?.label}</> : null}
              </>
            ) : (
              <> · sem app cadastrado</>
            )}
          </div>
          {s && (s.access_type === "mac_key" ? (
            <div className="mt-1 text-[11px] font-mono text-muted-foreground">
              MAC: {s.mac ?? "—"} · Key: {mask(s.app_key)}
            </div>
          ) : s.access_type === "user_pass" ? (
            <div className="mt-1 text-[11px] font-mono text-muted-foreground">
              Usuário: {s.username ?? "—"} · Senha: {mask(s.password)}
            </div>
          ) : null)}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" onClick={onOpenCustomer}>Abrir cliente</Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => copy(buildCobranca(), "Mensagem de cobrança")}
          className="gap-1"
        >
          <Copy className="h-3.5 w-3.5" /> Cobrança
        </Button>
        {s && paid && alerts.includes("vencido") && (
          <Button size="sm" variant="outline" className="gap-1"
            onClick={() => copy(msgAppVencido(p.customer.name, appLabel, s.name, fmtDateBR(s.app_due_date)), "App vencido")}>
            <Copy className="h-3.5 w-3.5" /> Aviso app vencido
          </Button>
        )}
        {s && paid && (alerts.includes("vence_7d") || alerts.includes("vence_30d")) && adays != null && (
          <Button size="sm" variant="outline" className="gap-1"
            onClick={() => copy(msgAppVencendo(p.customer.name, appLabel, s.name, adays, fmtDateBR(s.app_due_date), s.app_renewal_value), "App vencendo")}>
            <Copy className="h-3.5 w-3.5" /> Aviso app vencendo
          </Button>
        )}
        {s && paid && alerts.includes("sem_mac_key") && (
          <Button size="sm" variant="outline" className="gap-1"
            onClick={() => copy(msgPedirMacKeyApp(p.customer.name, appLabel), "Pedir MAC/Key")}>
            <Copy className="h-3.5 w-3.5" /> Pedir MAC/Key
          </Button>
        )}
        {s && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copy(copyTelaDados(s, p.customer.name), "Dados da tela")}
              className="gap-1"
            >
              <Copy className="h-3.5 w-3.5" /> Dados (mascarados)
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRequestReveal(s)}
              className="gap-1"
            >
              Copiar com senha/key
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copy(copyInstrucaoSuporte(s, p.customer.name), "Instrução de suporte")}
              className="gap-1"
            >
              <Copy className="h-3.5 w-3.5" /> Suporte
            </Button>
            {s.portal_url && (
              <a
                href={s.portal_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs hover:bg-muted"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Portal
              </a>
            )}
          </>
        )}
        {!s && (
          <Button size="sm" onClick={onOpenTelas}>Cadastrar app</Button>
        )}
      </div>
    </div>
  );
}
