import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Megaphone,
  Search,
  X,
  Copy,
  Download,
  ShieldAlert,
  Users,
  CheckCheck,
  Eraser,
  AlertTriangle,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { ImportAgendaSection } from "@/components/import/ImportAgendaSection";

import { EmptyState } from "@/components/ui-premium/EmptyState";
import { ListCardSkeleton } from "@/components/ui-premium/Skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { applyRevendaVariables } from "@/lib/revenda-settings";
import { toast } from "sonner";
import { useAuth } from "@/lib/use-auth";
import { supabase, supabaseConfigured } from "@/integrations/supabase/client";
import { getCurrentCompanyAdmin, listCustomersAdmin } from "@/lib/rpc-admin";
import {
  APP_CATALOG,
  AppScreen,
  listAllScreens,
  nextDueDays,
  urgencyFromDays,
  urgencyClass,
  urgencyLabel,
  daysUntil,
  mask,
  ROUTE_OPTIONS,
} from "@/lib/app-screens";
import { ServerBadge, SemServidorBadge } from "@/components/servers/ServerBadge";
import { ServerRouteInfo } from "@/components/servers/ServerRouteInfo";
import { buildServerVarsForScreen, listActiveServers, SERVER_CATALOG_EVENT } from "@/lib/server-catalog";

export const Route = createFileRoute("/campanhas-manuais")({
  component: CampanhasManuaisPage,
});

// ---------- helpers ----------
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
const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? n;
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDateBR = (d?: string | null) => {
  if (!d) return "não informado";
  const dt = new Date(d + "T00:00:00");
  return isNaN(+dt) ? d : dt.toLocaleDateString("pt-BR");
};

const normalize = (r: Row): Customer => ({
  id: String(r.id ?? ""),
  name: str(r, ["name", "nome", "full_name"]) ?? "Cliente",
  whatsapp: str(r, ["whatsapp_e164", "whatsapp", "phone", "telefone"]) ?? null,
  due_day: num(r, ["due_day", "dia_vencimento", "vencimento_dia"]),
  status: str(r, ["status", "situacao"]),
});

// ---------- modelos ----------
type TemplateKey =
  | "lembrete"
  | "hoje"
  | "vencida"
  | "atualizar_servidor"
  | "pedir_dados"
  | "instavel"
  | "renovacao"
  | "app_vencendo"
  | "app_vencido"
  | "app_renovado"
  | "pedir_mac_key"
  | "explicar_app_vs_lista"
  | "personalizado";

type Template = {
  key: TemplateKey;
  label: string;
  hint: string;
  body: string;
  sensitive: boolean;
};

const TEMPLATES: Template[] = [
  {
    key: "lembrete",
    label: "Lembrete amigável",
    hint: "Para clientes que vencem hoje ou em breve.",
    sensitive: false,
    body:
`Olá {nome}, tudo bem? 😊
Passando para lembrar que sua tela {tela} no app {app} vence em {dias} dia(s) — vencimento {vencimento}.
Qualquer dúvida me chama por aqui!`,
  },
  {
    key: "hoje",
    label: "Vencimento hoje",
    hint: "Mensagem objetiva avisando que vence hoje.",
    sensitive: false,
    body:
`Oi {nome}! Sua mensalidade vence hoje ({vencimento}).
Se quiser o PIX ou precisar de ajuda para renovar, me chama por aqui. Obrigado! 🙏`,
  },
  {
    key: "vencida",
    label: "Mensalidade vencida",
    hint: "Mensagem firme, educada e curta.",
    sensitive: false,
    body:
`Olá {nome}, tudo bem?
Sua mensalidade está vencida há {dias} dia(s). Para evitar o bloqueio do acesso da tela {tela} ({app}), peço que regularize hoje, por favor. Posso te enviar o PIX agora?`,
  },
  {
    key: "atualizar_servidor",
    label: "Atualização de servidor",
    hint: "Para quem está marcado como 'Precisa atualizar servidor'.",
    sensitive: false,
    body:
`Oi {nome}! Estamos atualizando a rota/servidor da sua tela {tela} ({app}) para melhorar a estabilidade.
Rota atual: {rota} · Servidor: {servidor}.
Vou conferir seus dados e te orientar por aqui. 👍`,
  },
  {
    key: "pedir_dados",
    label: "Pedir dados do app",
    hint: "Para clientes sem app cadastrado.",
    sensitive: false,
    body:
`Olá {nome}! Para agilizar o suporte, pode me informar qual aplicativo você usa (Bob Player, XCIPTV, IBO, Vu Player, etc.)?
Se for por MAC/Key, me manda o MAC. Se for por usuário/senha, me manda o usuário. 🙂`,
  },
  {
    key: "instavel",
    label: "App instável",
    hint: "Explicar instabilidade do app e pedir print.",
    sensitive: false,
    body:
`Oi {nome}! Às vezes o {app} fica instável por alguns minutos.
Tenta: 1) fechar e abrir o app; 2) reiniciar a TV/box; 3) reiniciar o roteador.
Se continuar, me manda um print do erro que eu olho aqui. 🙏`,
  },
  {
    key: "renovacao",
    label: "Renovação disponível",
    hint: "Mensagem de renovação amigável.",
    sensitive: false,
    body:
`Olá {nome}! Sua renovação está disponível. 🎉
Tela: {tela} · App: {app} · Vencimento: {vencimento}.
Quer que eu já envie o PIX para você renovar?`,
  },
  {
    key: "app_vencendo",
    label: "App pago vencendo",
    hint: "Aviso de licença do app pago perto do vencimento.",
    sensitive: false,
    body:
`Olá {nome}, tudo bem? 😊
O aplicativo {app} da sua {tela} vence em {dias_app} dia(s).
📱 App: {app}
📺 Tela: {tela}
🔐 MAC: {mac}
📅 Vencimento do app: {vencimento_app}
💰 Renovação do app: {valor_app}
Essa renovação é da licença do aplicativo, separada da mensalidade da lista.`,
  },
  {
    key: "app_vencido",
    label: "App pago vencido",
    hint: "Licença do app pago vencida.",
    sensitive: false,
    body:
`Olá {nome}, tudo bem? 😊
A licença do aplicativo {app} da sua {tela} está vencida.
Por isso o app pode parar de abrir ou pedir renovação.
📱 App: {app}
📺 Tela: {tela}
📅 Vencimento: {vencimento_app}
Me chama aqui que te ajudo com a renovação.`,
  },
  {
    key: "app_renovado",
    label: "App pago renovado",
    hint: "Confirmação após renovar a licença do app.",
    sensitive: false,
    body:
`Pronto ✅
O aplicativo {app} da sua {tela} foi renovado.
📅 Novo vencimento: {vencimento_app}
⏳ Validade: 1 ano
Guarde essa informação para acompanhar a licença do app.`,
  },
  {
    key: "pedir_mac_key",
    label: "Solicitar MAC/Key",
    hint: "Pedir dados de aplicativo pago.",
    sensitive: false,
    body:
`Olá {nome}! Para te ajudar com o {app}, pode me enviar o MAC do aparelho?
Se o app também pedir Key, me manda junto.
Esses dados são usados só para configurar a sua tela. 🙂`,
  },
  {
    key: "explicar_app_vs_lista",
    label: "App pago x Lista (explicação)",
    hint: "Explica a diferença entre licença do app e mensalidade da lista.",
    sensitive: false,
    body:
`Oi {nome}! Esclarecendo rapidinho 🙂

🧾 Mensalidade da lista: é o serviço que eu te entrego todo mês.
📱 Licença do aplicativo {app}: é uma cobrança do próprio app (geralmente 1x por ano).

São duas coisas separadas. Qualquer dúvida me chama!`,
  },
  {
    key: "personalizado",
    label: "Personalizado",
    hint: "Você escreve a mensagem usando as variáveis disponíveis.",
    sensitive: false,
    body:
`Olá {nome}!
`,
  },
];

const VARS = [
  "nome", "whatsapp", "tela", "app", "vencimento", "dias", "rota",
  "servidor", "mac", "key", "usuario",
  "vencimento_app", "dias_app", "valor_app", "tipo_app", "portal_app",
  "painel", "usuario_painel", "senha_painel",
  "link_lista", "usuario_lista", "senha_lista",
] as const;

type VarKey = (typeof VARS)[number];

function renderTemplate(
  body: string,
  values: Record<VarKey, string>,
): string {
  // Primeiro substitui variáveis do contexto da campanha; tokens desconhecidos
  // permanecem para serem resolvidos por applyRevendaVariables (revenda).
  const first = body.replace(/\{(\w+)\}/g, (match, k) => {
    const v = (values as Record<string, string>)[k];
    if (v && v.length) return v;
    if (k in (values as Record<string, string>)) return "não informado";
    return match;
  });
  // Aplica variáveis globais da Minha Revenda.
  const second = applyRevendaVariables(first);
  // Qualquer placeholder remanescente vira "não informado".
  return second.replace(/\{(\w+)\}/g, () => "não informado");
}

function hasSensitiveVars(body: string): boolean {
  return /\{(senha|password|key|mac|usuario|senha_painel|senha_lista)\}/i.test(body);
}

function hasServerSecretVars(body: string): boolean {
  return /\{(senha_painel|senha_lista)\}/i.test(body);
}

// ---------- "público" (publico) selecionável ----------
type PublicItem = {
  customer: Customer;
  screen: AppScreen | null;
  days: number | null;
  urgency: ReturnType<typeof urgencyFromDays>;
  needsUpdate: boolean;
};

function buildPublic(
  customers: Customer[],
  allScreens: Record<string, AppScreen[]>,
): PublicItem[] {
  const out: PublicItem[] = [];
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

function itemKey(it: PublicItem): string {
  return `${it.customer.id}::${it.screen?.id ?? "noapp"}`;
}

function buildValues(
  it: PublicItem,
  opts: { revealSecrets?: boolean } = {},
): Record<VarKey, string> {
  const s = it.screen;
  const route = s?.route
    ? ROUTE_OPTIONS.find((o) => o.value === s.route)?.label ?? ""
    : "";
  const venc = s?.due_date ? fmtDateBR(s.due_date)
    : it.customer.due_day != null ? `dia ${it.customer.due_day}` : "";
  const dias = it.days == null
    ? ""
    : it.days < 0
      ? `${Math.abs(it.days)} (vencido)`
      : String(it.days);
  const appDue = s?.app_due_date ? fmtDateBR(s.app_due_date) : "";
  const appDays = s?.app_due_date ? (() => {
    const d = new Date(s.app_due_date + "T00:00:00");
    const t = new Date(); t.setHours(0,0,0,0);
    if (isNaN(+d)) return "";
    const diff = Math.floor((+d - +t) / 86400000);
    return diff < 0 ? `${Math.abs(diff)} (vencido)` : String(diff);
  })() : "";
  const serverVars = s
    ? buildServerVarsForScreen(s, { revealSecrets: !!opts.revealSecrets })
    : { servidor: "", painel: "", usuario_painel: "", senha_painel: "", link_lista: "", usuario_lista: "", senha_lista: "" };
  return {
    nome: firstName(it.customer.name),
    whatsapp: prettyPhone(it.customer.whatsapp) ?? "",
    tela: s?.name ?? "",
    app: s ? APP_CATALOG[s.app]?.label ?? "" : "",
    vencimento: venc,
    dias,
    rota: route,
    servidor: serverVars.servidor || (s?.server ?? ""),
    mac: s?.mac ?? "",
    key: opts.revealSecrets ? (s?.app_key ?? "") : (s?.app_key ? mask(s.app_key) : ""),
    usuario: s?.username ?? "",
    vencimento_app: appDue,
    dias_app: appDays,
    valor_app: s?.app_renewal_value ?? "",
    tipo_app: s?.tier ?? (s ? APP_CATALOG[s.app]?.tier ?? "" : ""),
    portal_app: s?.portal_url ?? "",
    painel: serverVars.painel,
    usuario_painel: serverVars.usuario_painel,
    senha_painel: serverVars.senha_painel,
    link_lista: serverVars.link_lista,
    usuario_lista: serverVars.usuario_lista,
    senha_lista: serverVars.senha_lista,
  };
}

// ---------- histórico local de cópias ----------
const COPY_KEY = "cobranca_ia_campaign_copied_v1";
type CopyMark = { at: string }; // ISO

function readCopyMarks(): Record<string, CopyMark> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(COPY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch { return {}; }
}
function writeCopyMarks(m: Record<string, CopyMark>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COPY_KEY, JSON.stringify(m));
    window.dispatchEvent(new CustomEvent("campaign-copy:changed"));
  } catch { /* ignore */ }
}
function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

// ---------- filtros ----------
type Audience =
  | "todos" | "hoje" | "3d" | "7d" | "vencidos" | "needs_update" | "sem_app"
  | "app_bob" | "app_xciptv" | "app_ibo" | "app_vu"
  | "acc_mac_key" | "acc_user_pass"
  | "app_pago_vencendo" | "app_pago_vencido" | "app_pago_7d"
  | "app_sem_venc" | "app_sem_mackey";

function isPaid(s: AppScreen | null): boolean {
  if (!s) return false;
  const tier = s.tier ?? APP_CATALOG[s.app]?.tier ?? "desconhecido";
  return tier === "pago";
}
function appDays(s: AppScreen | null): number | null {
  if (!s || !isPaid(s) || !s.app_due_date) return null;
  const d = new Date(s.app_due_date + "T00:00:00");
  if (isNaN(+d)) return null;
  const t = new Date(); t.setHours(0,0,0,0);
  return Math.floor((+d - +t) / 86400000);
}

// Cliente com lista mensal vencida há mais de 30 dias: priorizar recuperação,
// não aparecer em públicos de "app pago".
function listaMuitoVencida(p: PublicItem): boolean {
  return p.days != null && p.days < -30;
}

function matchesAudience(p: PublicItem, a: Audience): boolean {
  const s = p.screen;
  const paid = isPaid(s);
  const ad = appDays(s);
  switch (a) {
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
    case "acc_mac_key": return s?.access_type === "mac_key";
    case "acc_user_pass": return s?.access_type === "user_pass";
    case "app_pago_vencendo": return paid && !listaMuitoVencida(p) && ad != null && ad >= 0 && ad <= 30;
    case "app_pago_7d": return paid && !listaMuitoVencida(p) && ad != null && ad >= 0 && ad <= 7;
    case "app_pago_vencido": return paid && !listaMuitoVencida(p) && ad != null && ad < 0;
    case "app_sem_venc": return paid && !listaMuitoVencida(p) && s != null && !s.app_due_date;
    case "app_sem_mackey": {
      if (!paid || !s || listaMuitoVencida(p)) return false;
      const at = s.access_type;
      return (at === "mac" || at === "mac_key") && (!s.mac || (at === "mac_key" && !s.app_key));
    }
  }
}

const AUDIENCE_LABEL: Record<Audience, string> = {
  todos: "Todos",
  hoje: "Vencem hoje",
  "3d": "Vencem em 3 dias",
  "7d": "Vencem em 7 dias",
  vencidos: "Vencidos",
  needs_update: "Atualizar servidor",
  sem_app: "Sem app cadastrado",
  app_bob: "Bob Player",
  app_xciptv: "XCIPTV",
  app_ibo: "IBO",
  app_vu: "Vu Player",
  acc_mac_key: "MAC/Key",
  acc_user_pass: "Usuário/Senha",
  app_pago_vencendo: "App pago vencendo",
  app_pago_vencido: "App pago vencido",
  app_pago_7d: "App pago 7 dias",
  app_sem_venc: "Sem vencimento do app",
  app_sem_mackey: "App pago sem MAC/Key",
};

// ============================================================
function CampanhasManuaisPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Customer[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [audience, setAudience] = useState<Audience>("hoje");
  const [serverFilter, setServerFilter] = useState<string>("__all__");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [templateKey, setTemplateKey] = useState<TemplateKey>("lembrete");
  const [customBody, setCustomBody] = useState<string>(
    TEMPLATES.find((t) => t.key === "personalizado")?.body ?? "",
  );
  const [editingBody, setEditingBody] = useState<string | null>(null); // override do modelo selecionado
  const [screensVersion, setScreensVersion] = useState(0);
  const [copyVersion, setCopyVersion] = useState(0);
  const [serversVersion, setServersVersion] = useState(0);
  const [confirmSensitive, setConfirmSensitive] = useState<null | {
    text: string;
    label: string;
    itemKey: string;
    serverSecrets?: boolean;
  }>(null);

  useEffect(() => {
    const bumpS = () => setScreensVersion((v) => v + 1);
    const bumpC = () => setCopyVersion((v) => v + 1);
    const bumpSrv = () => setServersVersion((v) => v + 1);
    window.addEventListener("app-screens:changed", bumpS);
    window.addEventListener("campaign-copy:changed", bumpC);
    window.addEventListener(SERVER_CATALOG_EVENT, bumpSrv);
    return () => {
      window.removeEventListener("app-screens:changed", bumpS);
      window.removeEventListener("campaign-copy:changed", bumpC);
      window.removeEventListener(SERVER_CATALOG_EVENT, bumpSrv);
    };
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
    return () => { alive = false; };
  }, [isAuthenticated, authLoading]);

  const allScreens = useMemo(() => listAllScreens(), [items, screensVersion]);
  const publicAll = useMemo(
    () => (items ? buildPublic(items, allScreens) : []),
    [items, allScreens],
  );

  const counts = useMemo(() => {
    const c: Record<Audience, number> = {
      todos: publicAll.length,
      hoje: 0, "3d": 0, "7d": 0, vencidos: 0, needs_update: 0, sem_app: 0,
      app_bob: 0, app_xciptv: 0, app_ibo: 0, app_vu: 0,
      acc_mac_key: 0, acc_user_pass: 0,
      app_pago_vencendo: 0, app_pago_vencido: 0, app_pago_7d: 0,
      app_sem_venc: 0, app_sem_mackey: 0,
    };
    const keys = Object.keys(c) as Audience[];
    for (const p of publicAll) {
      for (const k of keys) {
        if (k === "todos") continue;
        if (matchesAudience(p, k)) c[k] += 1;
      }
    }
    return c;
  }, [publicAll]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return publicAll.filter((p) => {
      if (!matchesAudience(p, audience)) return false;
      if (serverFilter !== "__all__") {
        const sids = p.screen?.server_ids ?? [];
        if (serverFilter === "__none__") {
          if (p.screen && sids.length > 0) return false;
        } else {
          if (!p.screen || !sids.includes(serverFilter)) return false;
        }
      }
      if (!q) return true;
      const c = p.customer;
      const phone = onlyDigits(c.whatsapp ?? "");
      if (
        c.name.toLowerCase().includes(q) ||
        phone.includes(onlyDigits(q)) ||
        (p.screen?.name ?? "").toLowerCase().includes(q) ||
        (APP_CATALOG[p.screen?.app ?? "outro"]?.label.toLowerCase().includes(q) ?? false)
      ) return true;
      return false;
    });
  }, [publicAll, audience, serverFilter, query]);

  // Contadores por servidor (sobre o público já filtrado por audience)
  const serverCounts = useMemo(() => {
    void serversVersion;
    const audiencePool = publicAll.filter((p) => matchesAudience(p, audience));
    const active = listActiveServers();
    const out = active.map((s) => ({ id: s.id, name: s.name, color: s.color, count: 0 }));
    let none = 0;
    for (const p of audiencePool) {
      const sids = p.screen?.server_ids ?? [];
      if (!p.screen || sids.length === 0) none += 1;
      for (const o of out) if (sids.includes(o.id)) o.count += 1;
    }
    return { servers: out, none, total: audiencePool.length };
  }, [publicAll, audience, serversVersion]);

  // Quando trocar filtro/busca, manter apenas selecionados que ainda aparecem
  useEffect(() => {
    setSelected((prev) => {
      const visible = new Set(filtered.map(itemKey));
      const next = new Set<string>();
      prev.forEach((k) => { if (visible.has(k)) next.add(k); });
      return next;
    });
  }, [filtered]);

  const copyMarks = useMemo(() => readCopyMarks(), [copyVersion]);

  const selectedItems = useMemo(
    () => filtered.filter((p) => selected.has(itemKey(p))),
    [filtered, selected],
  );

  const currentTemplate = TEMPLATES.find((t) => t.key === templateKey)!;
  const effectiveBody = editingBody != null
    ? editingBody
    : (templateKey === "personalizado" ? customBody : currentTemplate.body);

  const sensitiveBody = hasSensitiveVars(effectiveBody);
  const serverSecretsBody = hasServerSecretVars(effectiveBody);

  // Resumo
  const summary = useMemo(() => {
    const found = filtered.length;
    const sel = selectedItems.length;
    let copied = 0, pending = 0, vencidos = 0, hoje = 0;
    for (const p of selectedItems) {
      const m = copyMarks[itemKey(p)];
      if (m && isToday(m.at)) copied++; else pending++;
      if (p.urgency === "vencido") vencidos++;
      if (p.urgency === "hoje") hoje++;
    }
    return { found, sel, copied, pending, vencidos, hoje };
  }, [filtered, selectedItems, copyMarks]);

  const selectAll = () => {
    setSelected(new Set(filtered.map(itemKey)));
  };
  const clearSelection = () => setSelected(new Set());
  const toggle = (k: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const markCopied = (key: string) => {
    const m = readCopyMarks();
    m[key] = { at: new Date().toISOString() };
    writeCopyMarks(m);
  };
  const clearTodayMarks = () => {
    const m = readCopyMarks();
    const next: Record<string, CopyMark> = {};
    for (const [k, v] of Object.entries(m)) {
      if (!isToday(v.at)) next[k] = v;
    }
    writeCopyMarks(next);
    toast.success("Marcações de hoje limpas");
  };

  const doCopy = async (text: string, label: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      markCopied(key);
      toast.success(`${label} copiada`);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const requestCopySensitive = (text: string, label: string, key: string) => {
    setConfirmSensitive({ text, label, itemKey: key });
  };

  const exportCampaign = () => {
    const date = new Date().toLocaleDateString("pt-BR");
    const lines: string[] = [];
    lines.push("Campanha manual — Cobrança IA");
    lines.push(`Data: ${date}`);
    lines.push(`Filtro: ${AUDIENCE_LABEL[audience]}`);
    lines.push(`Modelo: ${currentTemplate.label}`);
    lines.push(`Selecionados: ${selectedItems.length}`);
    lines.push(`Ambiente: simulado (nada enviado)`);
    lines.push("");
    lines.push("=".repeat(40));
    for (const p of selectedItems) {
      const vals = buildValues(p, { revealSecrets: false });
      const text = renderTemplate(effectiveBody, vals);
      const tela = p.screen
        ? `${p.screen.name} · ${APP_CATALOG[p.screen.app]?.label}`
        : "(sem app)";
      lines.push(`Cliente: ${p.customer.name}`);
      lines.push(`WhatsApp: ${prettyPhone(p.customer.whatsapp) ?? "—"}`);
      lines.push(`Tela: ${tela}`);
      lines.push("Mensagem:");
      lines.push(text);
      lines.push("-".repeat(40));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campanha-manual-cobranca-ia-${todayStr()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Campanha exportada");
  };

  return (
    <PageContainer>
      <SectionHeader
        title="Campanhas manuais"
        subtitle="Monte listas de cobrança e copie mensagens personalizadas sem envio automático."
        hint="Tudo é gerado e copiado localmente — você cola no WhatsApp manualmente."
      />

      {/* aviso fixo */}
      <div className="mb-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft/60 px-3 py-2 text-xs text-warning-foreground">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <b>Modo manual:</b> nenhuma mensagem será enviada automaticamente. Esta tela não envia WhatsApp — apenas gera textos para copiar.
        </span>
      </div>

      <div className="mb-3 text-[11px] text-muted-foreground">
        Variáveis da revenda disponíveis ({"{nome_revenda}, {pix}, {valor_mensal}…"}).{" "}
        <Link to="/configuracoes-revenda" className="underline">Editar Minha Revenda</Link>
      </div>

      {/* Resumo */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Mini label="Encontrados" value={summary.found} />
        <Mini label="Selecionados" value={summary.sel} tone="primary" />
        <Mini label="Copiadas" value={summary.copied} tone="emerald" />
        <Mini label="Pendentes" value={summary.pending} tone="amber" />
        <Mini label="Vencidos" value={summary.vencidos} tone="red" />
        <Mini label="Vencem hoje" value={summary.hoje} tone="orange" />
      </div>

      {/* Filtros de público */}
      <div className="mb-2 text-xs font-medium text-muted-foreground">Filtro de público</div>
      <div className="mb-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <Chip active={audience === "todos"} onClick={() => setAudience("todos")} label="Todos" count={counts.todos} />
        <Chip active={audience === "hoje"} onClick={() => setAudience("hoje")} label="Hoje" count={counts.hoje} />
        <Chip active={audience === "3d"} onClick={() => setAudience("3d")} label="3 dias" count={counts["3d"]} />
        <Chip active={audience === "7d"} onClick={() => setAudience("7d")} label="7 dias" count={counts["7d"]} />
        <Chip active={audience === "vencidos"} onClick={() => setAudience("vencidos")} label="Vencidos" count={counts.vencidos} />
        <Chip active={audience === "needs_update"} onClick={() => setAudience("needs_update")} label="Atualizar servidor" count={counts.needs_update} />
        <Chip active={audience === "sem_app"} onClick={() => setAudience("sem_app")} label="Sem app" count={counts.sem_app} dim={counts.sem_app === 0} />
        <Chip active={audience === "app_bob"} onClick={() => setAudience("app_bob")} label="Bob Player" count={counts.app_bob} dim={counts.app_bob === 0} />
        <Chip active={audience === "app_xciptv"} onClick={() => setAudience("app_xciptv")} label="XCIPTV" count={counts.app_xciptv} dim={counts.app_xciptv === 0} />
        <Chip active={audience === "app_ibo"} onClick={() => setAudience("app_ibo")} label="IBO" count={counts.app_ibo} dim={counts.app_ibo === 0} />
        <Chip active={audience === "app_vu"} onClick={() => setAudience("app_vu")} label="Vu Player" count={counts.app_vu} dim={counts.app_vu === 0} />
        <Chip active={audience === "acc_mac_key"} onClick={() => setAudience("acc_mac_key")} label="MAC/Key" count={counts.acc_mac_key} dim={counts.acc_mac_key === 0} />
        <Chip active={audience === "acc_user_pass"} onClick={() => setAudience("acc_user_pass")} label="Usuário/Senha" count={counts.acc_user_pass} dim={counts.acc_user_pass === 0} />
        <Chip active={audience === "app_pago_vencendo"} onClick={() => setAudience("app_pago_vencendo")} label="App pago vencendo" count={counts.app_pago_vencendo} dim={counts.app_pago_vencendo === 0} />
        <Chip active={audience === "app_pago_vencido"} onClick={() => setAudience("app_pago_vencido")} label="App pago vencido" count={counts.app_pago_vencido} dim={counts.app_pago_vencido === 0} />
        <Chip active={audience === "app_pago_7d"} onClick={() => setAudience("app_pago_7d")} label="App pago 7 dias" count={counts.app_pago_7d} dim={counts.app_pago_7d === 0} />
        <Chip active={audience === "app_sem_venc"} onClick={() => setAudience("app_sem_venc")} label="Sem vencimento do app" count={counts.app_sem_venc} dim={counts.app_sem_venc === 0} />
        <Chip active={audience === "app_sem_mackey"} onClick={() => setAudience("app_sem_mackey")} label="Sem MAC/Key" count={counts.app_sem_mackey} dim={counts.app_sem_mackey === 0} />
      </div>

      {/* Filtros por servidor */}
      <div className="mb-2 text-xs font-medium text-muted-foreground">Servidor</div>
      <div className="mb-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <Chip active={serverFilter === "__all__"} onClick={() => setServerFilter("__all__")} label="Todos servidores" count={serverCounts.total} />
        <Chip active={serverFilter === "__none__"} onClick={() => setServerFilter("__none__")} label="Sem servidor" count={serverCounts.none} dim={serverCounts.none === 0} />
        {serverCounts.servers.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setServerFilter(s.id)}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition",
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


      {/* Busca */}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar dentro do filtro: nome, WhatsApp, tela ou app…"
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

      {/* Seleção / ações */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={selectAll} className="gap-1">
          <CheckCheck className="h-3.5 w-3.5" /> Selecionar todos
        </Button>
        <Button size="sm" variant="ghost" onClick={clearSelection}>
          Limpar seleção
        </Button>
        <Button size="sm" variant="ghost" onClick={clearTodayMarks} className="gap-1">
          <Eraser className="h-3.5 w-3.5" /> Limpar marcações de hoje
        </Button>
        <div className="ml-auto" />
        <Button size="sm" onClick={exportCampaign} disabled={selectedItems.length === 0} className="gap-1">
          <Download className="h-4 w-4" /> Exportar campanha
        </Button>
      </div>

      {/* Modelos */}
      <div className="mb-2 text-xs font-medium text-muted-foreground">Modelo de mensagem</div>
      <div className="mb-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TEMPLATES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTemplateKey(t.key);
              setEditingBody(null);
            }}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition",
              templateKey === t.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-3 rounded-xl border border-border bg-card p-3">
        <div className="mb-1 text-xs text-muted-foreground">{currentTemplate.hint}</div>
        <Textarea
          value={effectiveBody}
          onChange={(e) => {
            if (templateKey === "personalizado") setCustomBody(e.target.value);
            setEditingBody(e.target.value);
          }}
          rows={5}
          className="font-mono text-xs"
          placeholder="Escreva sua mensagem usando variáveis…"
        />
        <div className="mt-2 flex flex-wrap gap-1">
          {VARS.map((v) => (
            <span
              key={v}
              className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
            >
              {`{${v}}`}
            </span>
          ))}
        </div>
        {sensitiveBody && (
          <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-300/50 bg-amber-50/60 p-2 text-[11px] text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Este modelo usa variáveis sensíveis (MAC/Key/senha/usuário). Senha e Key permanecem mascaradas até você confirmar a cópia com dados abertos.
          </div>
        )}
      </div>

      {/* Lista de candidatos */}
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">
          Público encontrado <span className="ml-1 text-muted-foreground">({filtered.length})</span>
        </h3>
        <div className="text-xs text-muted-foreground">
          {selectedItems.length} selecionado(s)
        </div>
      </div>

      {!isAuthenticated && !authLoading && (
        <EmptyState icon={Users} title="Entre para montar uma campanha" description="Faça login para ver seus clientes." />
      )}
      {isAuthenticated && loading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <ListCardSkeleton key={i} />)}
        </div>
      )}
      {isAuthenticated && !loading && errorMsg && (
        <EmptyState icon={AlertTriangle} title="Não foi possível carregar" description={errorMsg} />
      )}
      {isAuthenticated && !loading && !errorMsg && filtered.length === 0 && (
        <EmptyState
          icon={Megaphone}
          title="Nenhum cliente neste filtro"
          description="Troque o filtro ou ajuste a busca."
        />
      )}

      {isAuthenticated && !loading && !errorMsg && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((p) => {
            const k = itemKey(p);
            const isSel = selected.has(k);
            const mark = copyMarks[k];
            const previewVals = buildValues(p, { revealSecrets: false });
            const preview = isSel ? renderTemplate(effectiveBody, previewVals) : null;

            return (
              <div key={k} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={isSel}
                    onCheckedChange={() => toggle(k)}
                    className="mt-1"
                    aria-label="Selecionar"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{p.customer.name}</span>
                      {p.screen && (
                        <span className={cn(
                          "rounded-md px-1.5 py-0.5 text-[10px]",
                          APP_CATALOG[p.screen.app]?.badgeClass,
                        )}>
                          {APP_CATALOG[p.screen.app]?.label}
                        </span>
                      )}
                      <span className={cn("rounded-md px-1.5 py-0.5 text-[10px]", urgencyClass(p.urgency))}>
                        {urgencyLabel(p.urgency, p.days)}
                      </span>
                      {p.needsUpdate && (
                        <span className="rounded-md border border-violet-400/60 bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                          Atualizar servidor
                        </span>
                      )}
                      {p.screen && (
                        (p.screen.server_ids ?? []).length > 0
                          ? (p.screen.server_ids ?? []).map((sid) => (
                              <ServerBadge key={sid} serverId={sid} size="xs" />
                            ))
                          : <SemServidorBadge />
                      )}
                      {mark && isToday(mark.at) && (
                        <span className="rounded-md border border-emerald-400/60 bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                          Copiado às {new Date(mark.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {prettyPhone(p.customer.whatsapp) ?? "Sem WhatsApp"}
                      {p.screen ? (
                        <>
                          {" · "}{p.screen.name}
                          {p.screen.due_date ? <> · vence {fmtDateBR(p.screen.due_date)}</> : null}
                          {p.screen.route ? <> · {ROUTE_OPTIONS.find((o) => o.value === p.screen!.route)?.label}</> : null}
                        </>
                      ) : <> · sem app cadastrado</>}
                    </div>

                    {preview && (
                      <div className="mt-2 rounded-md border border-border bg-muted/40 p-2">
                        <pre className="whitespace-pre-wrap break-words text-[11px] leading-snug">{preview}</pre>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => doCopy(preview, "Mensagem", k)}
                            className="gap-1"
                          >
                            <Copy className="h-3.5 w-3.5" /> Copiar
                          </Button>
                          {sensitiveBody && p.screen && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const openText = renderTemplate(
                                  effectiveBody,
                                  buildValues(p, { revealSecrets: true }),
                                );
                                requestCopySensitive(openText, "Mensagem com dados", k);
                              }}
                            >
                              Copiar com dados sensíveis
                            </Button>
                          )}
                          {serverSecretsBody && p.screen && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const openText = renderTemplate(
                                  effectiveBody,
                                  buildValues(p, { revealSecrets: true }),
                                );
                                setConfirmSensitive({
                                  text: openText,
                                  label: "Mensagem com senhas do servidor",
                                  itemKey: k,
                                  serverSecrets: true,
                                });
                              }}
                              className="text-amber-700 dark:text-amber-300"
                            >
                              Copiar com senhas do servidor
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmação dados sensíveis */}
      <AlertDialog open={!!confirmSensitive} onOpenChange={(o) => !o && setConfirmSensitive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmSensitive?.serverSecrets
                ? "Copiar com senhas do painel/lista?"
                : "Copiar com dados sensíveis?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmSensitive?.serverSecrets
                ? "Esse texto inclui senhas do painel/lista do servidor. Deseja copiar mesmo assim?"
                : "Essa mensagem pode conter dados sensíveis (senha, key, MAC, usuário) em texto aberto. Cole apenas em um lugar seguro."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmSensitive) {
                  doCopy(confirmSensitive.text, confirmSensitive.label, confirmSensitive.itemKey);
                }
                setConfirmSensitive(null);
              }}
            >
              {confirmSensitive?.serverSecrets ? "Copiar com senhas" : "Copiar mesmo assim"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="mt-4">
        <ImportAgendaSection
          title="Agenda da importação"
          subtitle="Filtre por hoje, pendentes, copiados, bloqueados, recuperação e inativos."
          initialChip="todos"
          restrictTo={[
            "todos",
            "hoje",
            "pendentes",
            "copiados",
            "bloqueados",
            "recuperar",
            "inativos",
          ]}
        />
      </div>
    </PageContainer>
  );
}


// ---------- mini components ----------
function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "primary" | "emerald" | "amber" | "red" | "orange";
}) {
  const tones: Record<string, string> = {
    primary: "border-primary/40 bg-primary/5",
    emerald: "border-emerald-300/50 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10",
    amber: "border-amber-300/50 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10",
    red: "border-red-300/50 bg-red-50/60 dark:border-red-500/30 dark:bg-red-500/10",
    orange: "border-orange-300/50 bg-orange-50/60 dark:border-orange-500/30 dark:bg-orange-500/10",
  };
  return (
    <div className={cn("rounded-xl border p-3", tone ? tones[tone] : "border-border bg-card")}>
      <div className="text-xl font-bold leading-none tabular-nums">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function Chip({
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
