import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Search,
  X,
  Copy,
  Download,
  ShieldAlert,
  Users,
  CheckCircle2,
  Wrench,
  ExternalLink,
  AlertTriangle,
  PhoneOff,
  Tv,
  RefreshCcw,
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
  AppScreen,
  listAllScreens,
  nextDueDays,
  urgencyFromDays,
  urgencyClass,
  urgencyLabel,
  daysUntil,
  formatScreenAsText,
  ROUTE_OPTIONS,
  isPaidApp,
  appDueDays,
} from "@/lib/app-screens";
import { ServerBadge, SemServidorBadge } from "@/components/servers/ServerBadge";
import { ServerRouteInfo } from "@/components/servers/ServerRouteInfo";
import { listActiveServers, SERVER_CATALOG_EVENT } from "@/lib/server-catalog";

export const Route = createFileRoute("/pendencias")({
  component: PendenciasPage,
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
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return isNaN(+dt) ? d : dt.toLocaleDateString("pt-BR");
};
const isTodayIso = (iso: string) => {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear()
    && d.getMonth() === n.getMonth()
    && d.getDate() === n.getDate();
};

const normalize = (r: Row): Customer => ({
  id: String(r.id ?? ""),
  name: str(r, ["name", "nome", "full_name"]) ?? "Cliente",
  whatsapp: str(r, ["whatsapp_e164", "whatsapp", "phone", "telefone"]) ?? null,
  due_day: num(r, ["due_day", "dia_vencimento", "vencimento_dia"]),
  status: str(r, ["status", "situacao"]),
});

// ----- copy helpers -----
const copy = async (text: string, label = "Texto") => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  } catch {
    toast.error("Não foi possível copiar");
  }
};

// ----- mensagens -----
function msgVenceHoje(name: string) {
  return `Olá ${firstName(name)}, tudo bem? 😊\nSua mensalidade vence hoje. Se quiser o PIX ou ajuda para renovar, me chama por aqui!`;
}
function msgVencido(name: string, days: number) {
  return `Olá ${firstName(name)}!\nSua mensalidade está vencida há ${days} dia(s). Posso te enviar o PIX para regularizar agora?`;
}
function msgProx7(name: string, days: number) {
  return `Oi ${firstName(name)}! Passando para lembrar que sua mensalidade vence em ${days} dia(s). Qualquer dúvida me chama. 🙂`;
}
function msgAtualizarServidor(name: string) {
  return `Olá ${firstName(name)}! Estamos atualizando a rota/servidor da sua tela para melhorar a estabilidade. Vou conferir seus dados e te orientar por aqui. 👍`;
}
function msgPedirApp(name: string) {
  return `Olá ${firstName(name)}! Para agilizar o suporte, pode me informar qual aplicativo você usa (Bob Player, XCIPTV, IBO, Vu Player…) e os dados de acesso? 🙏`;
}
function msgPedirWhats(name: string) {
  return `Olá ${firstName(name)}! Não tenho seu WhatsApp salvo. Pode me confirmar o número com DDD para que eu te atenda por aqui? 🙂`;
}
function msgAppPagoVencendo(name: string, app: string, tela: string, dias: number, venc: string, valor?: string) {
  return `Olá ${firstName(name)}, tudo bem? 😊\n\nO aplicativo ${app} da sua ${tela} vence em ${dias} dia(s).\n\n📱 App: ${app}\n📺 Tela: ${tela}\n📅 Vencimento do app: ${venc}${valor ? `\n💰 Renovação: ${valor}` : ""}\n\nEssa renovação é da licença do aplicativo, separada da mensalidade da lista.`;
}
function msgAppPagoVencido(name: string, app: string, tela: string, venc: string) {
  return `Olá ${firstName(name)}, tudo bem? 😊\n\nA licença do aplicativo ${app} da sua ${tela} está vencida.\n\n📱 App: ${app}\n📺 Tela: ${tela}\n📅 Vencimento: ${venc}\n\nQuando a licença vence, o app pode parar de abrir ou pedir renovação.`;
}
function msgPedirMacKeyApp(name: string, app: string) {
  return `Olá ${firstName(name)}, tudo bem? 😊\n\nPara eu conferir o app ${app}, preciso que você me envie o MAC e a Key que aparecem na tela do aplicativo.\n\nSe puder, mande também um print da tela.`;
}

// ----- pendências técnicas (fixas) -----
type TechItem = { id: string; title: string; description: string };
const TECH_PENDING: TechItem[] = [
  { id: "tech-1", title: "Criar persistência real para Telas e Aplicativos", description: "Hoje os dados de telas ficam no localStorage. Migrar para o backend antes da versão final." },
  { id: "tech-2", title: "Criar list_messages_admin", description: "RPC para listar mensagens reais sem depender de leituras diretas no client." },
  { id: "tech-3", title: "Criar list_ai_messages_admin", description: "RPC para mensagens geradas pela IA." },
  { id: "tech-4", title: "Criar get_dashboard_counts_admin", description: "RPC para contadores agregados do dashboard." },
  { id: "tech-5", title: "Remover últimas leituras diretas locais", description: "Substituir SELECTs no client por RPCs seguras." },
  { id: "tech-6", title: "Revisar antes de PR final", description: "Checklist de segurança, RLS e logs antes de abrir PR." },
  { id: "tech-7", title: "Validar no Codex quando estiver com acesso", description: "Rodar a bateria de validação automatizada quando o Codex estiver disponível." },
  { id: "tech-8", title: "Não ativar WhatsApp real ainda", description: "Manter integração simulada até liberação explícita." },
  { id: "tech-9", title: "Não ativar OpenAI real ainda", description: "Manter IA simulada até liberação explícita." },
  { id: "tech-10", title: "Não ativar pagamento real ainda", description: "Manter cobranças simuladas até liberação explícita." },
];

// ----- tipos de pendência -----
type PendingType =
  | "hoje" | "vencido" | "7d"
  | "sem_app" | "sem_whats" | "atualizar_servidor"
  | "app_pago_vencido" | "app_pago_7d" | "app_pago_30d"
  | "app_sem_venc" | "app_sem_mackey" | "app_sem_valor"
  | "campanha_pendente" | "tecnica";

const TYPE_META: Record<PendingType, { label: string; tone: string; icon: typeof AlertCircle; priority: number }> = {
  hoje:                { label: "Vence hoje",          tone: "border-red-400/60 bg-red-50/60 dark:border-red-500/40 dark:bg-red-500/10",            icon: AlertCircle, priority: 0 },
  vencido:             { label: "Vencido",             tone: "border-red-500/60 bg-red-100/60 dark:border-red-600/40 dark:bg-red-700/15",           icon: AlertCircle, priority: 1 },
  app_pago_vencido:    { label: "App pago vencido",    tone: "border-red-500/60 bg-red-100/60 dark:border-red-600/40 dark:bg-red-700/15",           icon: AlertCircle, priority: 2 },
  atualizar_servidor:  { label: "Atualizar servidor",  tone: "border-violet-400/60 bg-violet-50/60 dark:border-violet-500/40 dark:bg-violet-500/10", icon: RefreshCcw,  priority: 3 },
  app_pago_7d:         { label: "App pago vence 7d",   tone: "border-orange-400/50 bg-orange-50/60 dark:border-orange-500/30 dark:bg-orange-500/10",icon: AlertTriangle, priority: 4 },
  sem_whats:           { label: "Sem WhatsApp",        tone: "border-amber-400/60 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-500/10",    icon: PhoneOff,    priority: 5 },
  sem_app:             { label: "Sem app cadastrado",  tone: "border-slate-300/60 bg-muted/40",                                                      icon: Tv,          priority: 6 },
  "7d":                { label: "Próximos 7 dias",     tone: "border-amber-300/50 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10",    icon: AlertTriangle, priority: 7 },
  app_pago_30d:        { label: "App pago vence 30d",  tone: "border-amber-300/50 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10",    icon: AlertTriangle, priority: 8 },
  app_sem_venc:        { label: "App pago sem vencimento", tone: "border-slate-300/60 bg-muted/40",                                                  icon: Tv,          priority: 9 },
  app_sem_mackey:      { label: "App pago sem MAC/Key",tone: "border-violet-300/50 bg-violet-50/60 dark:border-violet-500/30 dark:bg-violet-500/10",icon: Wrench,      priority: 10 },
  app_sem_valor:       { label: "App pago sem valor de renovação", tone: "border-border bg-card",                                                    icon: Wrench,      priority: 11 },
  campanha_pendente:   { label: "Campanha não copiada",tone: "border-orange-300/50 bg-orange-50/60 dark:border-orange-500/30 dark:bg-orange-500/10",icon: Copy,        priority: 12 },
  tecnica:             { label: "Pendência técnica",   tone: "border-border bg-card",                                                                icon: Wrench,      priority: 13 },
};

type PendingItem = {
  key: string;
  type: PendingType;
  customer?: Customer;
  screen?: AppScreen | null;
  days?: number | null;
  description: string;
  recommended: string;
  techId?: string;
};

// ----- resolvidas localmente -----
const RESOLVED_KEY = "cobranca_ia_pending_resolved_v1";
type Resolved = { at: string };
function readResolved(): Record<string, Resolved> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(RESOLVED_KEY);
    return raw ? (JSON.parse(raw) ?? {}) : {};
  } catch { return {}; }
}
function writeResolved(m: Record<string, Resolved>) {
  try {
    window.localStorage.setItem(RESOLVED_KEY, JSON.stringify(m));
    window.dispatchEvent(new CustomEvent("pending-resolved:changed"));
  } catch { /* ignore */ }
}

// ----- campanhas copiadas (lido para detectar pendentes do dia) -----
function readCampaignCopied(): Record<string, { at: string }> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem("cobranca_ia_campaign_copied_v1");
    return raw ? (JSON.parse(raw) ?? {}) : {};
  } catch { return {}; }
}

// ============================================================
type FilterKey =
  | "todas" | "criticas" | "hoje" | "vencidos" | "7d"
  | "sem_app" | "sem_whats" | "atualizar_servidor" | "tecnicas"
  | "app_pago_vencido" | "app_pago_7d" | "app_pago_30d" | "app_sem_venc" | "app_sem_mackey";

function PendenciasPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Customer[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("todas");
  const [serverFilter, setServerFilter] = useState<string>("__all__");
  const [showResolved, setShowResolved] = useState(false);
  const [screensVersion, setScreensVersion] = useState(0);
  const [resolvedVersion, setResolvedVersion] = useState(0);
  const [serversVersion, setServersVersion] = useState(0);
  const [confirmReveal, setConfirmReveal] = useState<null | { screen: AppScreen; customerName: string }>(null);

  useEffect(() => {
    const bumpS = () => setScreensVersion((v) => v + 1);
    const bumpR = () => setResolvedVersion((v) => v + 1);
    const bumpSrv = () => setServersVersion((v) => v + 1);
    window.addEventListener("app-screens:changed", bumpS);
    window.addEventListener("campaign-copy:changed", bumpR);
    window.addEventListener("pending-resolved:changed", bumpR);
    window.addEventListener(SERVER_CATALOG_EVENT, bumpSrv);
    return () => {
      window.removeEventListener("app-screens:changed", bumpS);
      window.removeEventListener("campaign-copy:changed", bumpR);
      window.removeEventListener("pending-resolved:changed", bumpR);
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
    if (!isAuthenticated) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    setErrorMsg(null);
    (async () => {
      const { companyId, error: companyErr } = await getCurrentCompanyAdmin();
      if (!alive) return;
      if (companyErr || !companyId) {
        setErrorMsg(companyErr ? "Não foi possível identificar a empresa." : "Nenhuma empresa autorizada encontrada.");
        setItems(null);
        setLoading(false);
        return;
      }
      const res = await listCustomersAdmin({
        p_company_id: companyId, p_status: null, p_search: null,
        p_limit: 500, p_offset: 0,
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
  const resolved = useMemo(() => readResolved(), [resolvedVersion]);
  const campaignCopied = useMemo(() => readCampaignCopied(), [resolvedVersion]);

  // ----- construir pendências -----
  const pendings = useMemo<PendingItem[]>(() => {
    const out: PendingItem[] = [];
    if (items) {
      for (const c of items) {
        const screens = (allScreens[c.id] ?? []).filter((s) => s.status !== "arquivada");

        // Sem WhatsApp
        if (!c.whatsapp || onlyDigits(c.whatsapp).length < 8) {
          out.push({
            key: `whats::${c.id}`,
            type: "sem_whats",
            customer: c,
            description: "Cliente sem WhatsApp cadastrado.",
            recommended: "Solicite o número e cadastre em Clientes.",
          });
        }

        // Sem app
        if (screens.length === 0) {
          const days = nextDueDays(c.due_day, []);
          out.push({
            key: `noapp::${c.id}`,
            type: "sem_app",
            customer: c,
            screen: null,
            days,
            description: "Sem app cadastrado para este cliente.",
            recommended: "Abra o cliente e cadastre o aplicativo na aba Telas.",
          });
        }

        for (const s of screens) {
          const days = daysUntil(s.due_date) ?? nextDueDays(c.due_day, [s]);
          const u = urgencyFromDays(days);
          if (u === "hoje") {
            out.push({
              key: `hoje::${c.id}::${s.id}`, type: "hoje", customer: c, screen: s, days,
              description: `Vence hoje a tela ${s.name} (${APP_CATALOG[s.app]?.label ?? s.app}).`,
              recommended: "Envie um lembrete amigável manualmente.",
            });
          } else if (u === "vencido") {
            out.push({
              key: `venc::${c.id}::${s.id}`, type: "vencido", customer: c, screen: s, days,
              description: `Tela ${s.name} vencida há ${Math.abs(days ?? 0)} dia(s).`,
              recommended: "Copie a mensagem de cobrança e cole no WhatsApp.",
            });
          } else if (u === "3d" || u === "7d") {
            out.push({
              key: `7d::${c.id}::${s.id}`, type: "7d", customer: c, screen: s, days,
              description: `Vence em ${days} dia(s).`,
              recommended: "Programe um lembrete amigável.",
            });
          }

          if (s.needs_server_update) {
            out.push({
              key: `srv::${c.id}::${s.id}`,
              type: "atualizar_servidor",
              customer: c, screen: s, days,
              description: `A tela ${s.name} precisa atualizar servidor/rota.`,
              recommended: "Atualize a rota/servidor e avise o cliente.",
            });
          }

          // ----- App pago -----
          if (isPaidApp(s)) {
            const ad = appDueDays(s);
            const appLabel = APP_CATALOG[s.app]?.label ?? s.app;
            if (ad == null) {
              out.push({
                key: `appnov::${c.id}::${s.id}`, type: "app_sem_venc", customer: c, screen: s,
                description: `App pago ${appLabel} sem vencimento cadastrado.`,
                recommended: "Cadastre o vencimento da licença do app.",
              });
            } else if (ad < 0) {
              out.push({
                key: `appvenc::${c.id}::${s.id}`, type: "app_pago_vencido", customer: c, screen: s, days: ad,
                description: `Licença do app ${appLabel} vencida há ${Math.abs(ad)} dia(s).`,
                recommended: "Envie aviso de renovação do app.",
              });
            } else if (ad <= 7) {
              out.push({
                key: `app7::${c.id}::${s.id}`, type: "app_pago_7d", customer: c, screen: s, days: ad,
                description: `App ${appLabel} vence em ${ad} dia(s).`,
                recommended: "Avise o cliente sobre a renovação da licença.",
              });
            } else if (ad <= 30) {
              out.push({
                key: `app30::${c.id}::${s.id}`, type: "app_pago_30d", customer: c, screen: s, days: ad,
                description: `App ${appLabel} vence em ${ad} dia(s).`,
                recommended: "Programe lembrete de renovação do app.",
              });
            }
            const at = s.access_type;
            if ((at === "mac" || at === "mac_key") && (!s.mac || (at === "mac_key" && !s.app_key))) {
              out.push({
                key: `appmac::${c.id}::${s.id}`, type: "app_sem_mackey", customer: c, screen: s,
                description: `App pago ${appLabel} sem MAC/Key.`,
                recommended: "Peça o MAC e a Key ao cliente.",
              });
            }
            if (ad != null && ad <= 30 && !(s.app_renewal_value && s.app_renewal_value.trim())) {
              out.push({
                key: `appval::${c.id}::${s.id}`, type: "app_sem_valor", customer: c, screen: s,
                description: `App ${appLabel} sem valor de renovação.`,
                recommended: "Cadastre o valor da renovação para usar nas mensagens.",
              });
            }
          }
        }
      }
    }

    // Campanhas pendentes do dia: itens marcados como copiados HOJE -> ok; nada copiado hoje => bloco informativo
    const copiedToday = Object.values(campaignCopied).filter((v) => isTodayIso(v.at)).length;
    if (items && items.length > 0 && copiedToday === 0) {
      out.push({
        key: "campanha::sem-copia-hoje",
        type: "campanha_pendente",
        description: "Nenhuma mensagem de campanha foi copiada hoje.",
        recommended: "Abra Campanhas manuais e gere mensagens para os clientes do dia.",
      });
    }

    // Técnicas
    for (const t of TECH_PENDING) {
      out.push({
        key: `tech::${t.id}`,
        type: "tecnica",
        techId: t.id,
        description: t.title,
        recommended: t.description,
      });
    }
    return out;
  }, [items, allScreens, campaignCopied]);

  // ----- contadores -----
  const counts = useMemo(() => {
    const c = {
      todas: 0, criticas: 0, hoje: 0, vencidos: 0, d7: 0,
      sem_app: 0, sem_whats: 0, atualizar_servidor: 0, tecnicas: 0,
      campanha_pendente: 0,
      app_pago_vencido: 0, app_pago_7d: 0, app_pago_30d: 0,
      app_sem_venc: 0, app_sem_mackey: 0,
    };
    for (const p of pendings) {
      if (resolved[p.key] && !showResolved) continue;
      c.todas++;
      if (p.type === "hoje") { c.hoje++; c.criticas++; }
      if (p.type === "vencido") { c.vencidos++; c.criticas++; }
      if (p.type === "7d") c.d7++;
      if (p.type === "sem_app") c.sem_app++;
      if (p.type === "sem_whats") c.sem_whats++;
      if (p.type === "atualizar_servidor") { c.atualizar_servidor++; c.criticas++; }
      if (p.type === "tecnica") c.tecnicas++;
      if (p.type === "campanha_pendente") c.campanha_pendente++;
      if (p.type === "app_pago_vencido") { c.app_pago_vencido++; c.criticas++; }
      if (p.type === "app_pago_7d") c.app_pago_7d++;
      if (p.type === "app_pago_30d") c.app_pago_30d++;
      if (p.type === "app_sem_venc") c.app_sem_venc++;
      if (p.type === "app_sem_mackey") c.app_sem_mackey++;
    }
    return c;
  }, [pendings, resolved, showResolved]);

  // ----- resumo (cards topo, independentes do filtro) -----
  const summary = useMemo(() => {
    const s = { hoje: 0, vencidos: 0, d7: 0, sem_app: 0, atualizar: 0, sem_whats: 0, campanhas: 0, tecnicas: TECH_PENDING.length };
    for (const p of pendings) {
      if (p.type === "hoje") s.hoje++;
      if (p.type === "vencido") s.vencidos++;
      if (p.type === "7d") s.d7++;
      if (p.type === "sem_app") s.sem_app++;
      if (p.type === "atualizar_servidor") s.atualizar++;
      if (p.type === "sem_whats") s.sem_whats++;
      if (p.type === "campanha_pendente") s.campanhas++;
    }
    return s;
  }, [pendings]);

  // ----- filtro/busca -----
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (p: PendingItem): boolean => {
      switch (filter) {
        case "todas": return true;
        case "criticas": return p.type === "hoje" || p.type === "vencido" || p.type === "atualizar_servidor";
        case "hoje": return p.type === "hoje";
        case "vencidos": return p.type === "vencido";
        case "7d": return p.type === "7d";
        case "sem_app": return p.type === "sem_app";
        case "sem_whats": return p.type === "sem_whats";
        case "atualizar_servidor": return p.type === "atualizar_servidor";
        case "tecnicas": return p.type === "tecnica";
        case "app_pago_vencido": return p.type === "app_pago_vencido";
        case "app_pago_7d": return p.type === "app_pago_7d";
        case "app_pago_30d": return p.type === "app_pago_30d";
        case "app_sem_venc": return p.type === "app_sem_venc";
        case "app_sem_mackey": return p.type === "app_sem_mackey";
      }
    };
    return pendings.filter((p) => {
      if (!showResolved && resolved[p.key]) return false;
      if (!match(p)) return false;
      // Filtro por servidor
      if (serverFilter !== "__all__") {
        const sids = p.screen?.server_ids ?? [];
        if (serverFilter === "__none__") {
          // Sem servidor: pendência sem tela OU tela sem vínculo
          if (p.screen && sids.length > 0) return false;
        } else {
          if (!p.screen || !sids.includes(serverFilter)) return false;
        }
      }
      if (!q) return true;
      const c = p.customer;
      const s = p.screen;
      const inText =
        TYPE_META[p.type].label.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (c?.name.toLowerCase().includes(q) ?? false) ||
        onlyDigits(c?.whatsapp ?? "").includes(onlyDigits(q)) ||
        (s?.name.toLowerCase().includes(q) ?? false) ||
        (APP_CATALOG[s?.app ?? "outro"]?.label.toLowerCase().includes(q) ?? false) ||
        (s?.server ?? "").toLowerCase().includes(q) ||
        (s?.route ?? "").toLowerCase().includes(q);
      return inText;
    });
  }, [pendings, filter, serverFilter, query, resolved, showResolved]);

  // Contadores por servidor (respeita "Mostrar resolvidas")
  const serverCounts = useMemo(() => {
    void serversVersion;
    const active = listActiveServers();
    const out = active.map((s) => ({ id: s.id, name: s.name, color: s.color, count: 0 }));
    let none = 0;
    let total = 0;
    for (const p of pendings) {
      if (!showResolved && resolved[p.key]) continue;
      total += 1;
      const sids = p.screen?.server_ids ?? [];
      if (!p.screen || sids.length === 0) none += 1;
      for (const o of out) if (sids.includes(o.id)) o.count += 1;
    }
    return { servers: out, none, total };
  }, [pendings, resolved, showResolved, serversVersion]);

  const ordered = useMemo(
    () => [...filtered].sort((a, b) => TYPE_META[a.type].priority - TYPE_META[b.type].priority),
    [filtered],
  );

  // ----- ações -----
  const openCustomer = (id: string, tab?: "telas" | "atend") => {
    try {
      window.sessionStorage.setItem("cobranca_ia_open_customer_id", id);
      if (tab) window.sessionStorage.setItem("cobranca_ia_open_customer_tab", tab);
    } catch { /* ignore */ }
    navigate({ to: "/clientes" });
  };

  const markResolved = (k: string) => {
    const m = readResolved();
    m[k] = { at: new Date().toISOString() };
    writeResolved(m);
    toast.success("Marcada como resolvida");
  };
  const unmarkResolved = (k: string) => {
    const m = readResolved();
    delete m[k];
    writeResolved(m);
  };
  const clearTodayResolved = () => {
    const m = readResolved();
    const next: Record<string, Resolved> = {};
    for (const [k, v] of Object.entries(m)) {
      if (!isTodayIso(v.at)) next[k] = v;
    }
    writeResolved(next);
    toast.success("Resolvidas de hoje limpas");
  };

  const buildLembrete = (p: PendingItem): string => {
    const name = p.customer?.name ?? "cliente";
    const s = p.screen;
    const appLabel = s ? APP_CATALOG[s.app]?.label ?? s.app : "";
    const venc = s?.app_due_date ? fmtDateBR(s.app_due_date) : "—";
    if (p.type === "hoje") return msgVenceHoje(name);
    if (p.type === "vencido") return msgVencido(name, Math.abs(p.days ?? 0));
    if (p.type === "7d") return msgProx7(name, p.days ?? 0);
    if (p.type === "atualizar_servidor") return msgAtualizarServidor(name);
    if (p.type === "sem_app") return msgPedirApp(name);
    if (p.type === "sem_whats") return msgPedirWhats(name);
    if (p.type === "app_pago_vencido" && s) return msgAppPagoVencido(name, appLabel, s.name, venc);
    if ((p.type === "app_pago_7d" || p.type === "app_pago_30d") && s)
      return msgAppPagoVencendo(name, appLabel, s.name, p.days ?? 0, venc, s.app_renewal_value);
    if (p.type === "app_sem_mackey" && s) return msgPedirMacKeyApp(name, appLabel);
    return p.description;
  };

  const exportTxt = () => {
    const date = new Date().toLocaleDateString("pt-BR");
    const lines: string[] = [];
    lines.push("Central de Pendências — Cobrança IA");
    lines.push(`Data: ${date}`);
    lines.push(`Ambiente: simulado (nada enviado)`);
    lines.push("");
    lines.push("=== Resumo ===");
    lines.push(`Vencem hoje: ${summary.hoje}`);
    lines.push(`Vencidos: ${summary.vencidos}`);
    lines.push(`Próximos 7 dias: ${summary.d7}`);
    lines.push(`Sem app cadastrado: ${summary.sem_app}`);
    lines.push(`Atualizar servidor: ${summary.atualizar}`);
    lines.push(`Sem WhatsApp: ${summary.sem_whats}`);
    lines.push(`Campanhas pendentes: ${summary.campanhas}`);
    lines.push(`Pendências técnicas: ${summary.tecnicas}`);
    lines.push("");
    const groups: Record<string, PendingItem[]> = {};
    for (const p of pendings) {
      if (resolved[p.key]) continue;
      const k = TYPE_META[p.type].label;
      (groups[k] ??= []).push(p);
    }
    for (const [g, list] of Object.entries(groups)) {
      lines.push(`=== ${g} (${list.length}) ===`);
      for (const p of list) {
        const who = p.customer ? `${p.customer.name} (${prettyPhone(p.customer.whatsapp) ?? "sem WhatsApp"})` : "";
        const tela = p.screen ? ` | ${p.screen.name} · ${APP_CATALOG[p.screen.app]?.label}` : "";
        lines.push(`- ${who}${tela}`);
        lines.push(`  · ${p.description}`);
        lines.push(`  → ${p.recommended}`);
      }
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `pendencias-cobranca-ia-${todayStr()}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success("Pendências exportadas");
  };

  return (
    <PageContainer>
      <SectionHeader
        title="Central de Pendências"
        subtitle="Veja o que precisa ser resolvido antes de avançar."
        hint="Reúne tudo que pede atenção: vencimentos, telas, dados faltando e itens técnicos."
      />
      <CompanyScopeNotice moduleKey="cobranca_ia_app_screens_v1" />

      <div className="mb-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft/60 px-3 py-2 text-xs text-warning-foreground">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <b>Modo seguro:</b> esta tela apenas organiza pendências. Nada será enviado automaticamente.
        </span>
      </div>

      {/* Resumo */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Mini label="Vencem hoje" value={summary.hoje} tone="red" />
        <Mini label="Vencidos" value={summary.vencidos} tone="redDeep" />
        <Mini label="Próx. 7 dias" value={summary.d7} tone="amber" />
        <Mini label="Sem app" value={summary.sem_app} tone="slate" />
        <Mini label="Atualizar servidor" value={summary.atualizar} tone="violet" />
        <Mini label="Sem WhatsApp" value={summary.sem_whats} tone="orange" />
        <Mini label="Campanhas pendentes" value={summary.campanhas} tone="orange" />
        <Mini label="Pendências técnicas" value={summary.tecnicas} tone="slate" />
      </div>

      {/* Ações topo */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => navigate({ to: "/operacao-dia" })} className="gap-1">
          <ExternalLink className="h-3.5 w-3.5" /> Operação do dia
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigate({ to: "/campanhas-manuais" })} className="gap-1">
          <ExternalLink className="h-3.5 w-3.5" /> Campanhas manuais
        </Button>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setShowResolved((v) => !v)}>
            {showResolved ? "Ocultar resolvidas" : "Mostrar resolvidas"}
          </Button>
          <Button size="sm" variant="ghost" onClick={clearTodayResolved}>
            Limpar resolvidas de hoje
          </Button>
          <Button size="sm" onClick={exportTxt} className="gap-1">
            <Download className="h-4 w-4" /> Exportar pendências
          </Button>
        </div>
      </div>

      {/* Busca */}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por cliente, WhatsApp, app, tela, tipo, rota ou servidor…"
          className="h-11 pl-9 pr-9"
          inputMode="search"
        />
        {query && (
          <button
            type="button" aria-label="Limpar"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
          ><X className="h-4 w-4" /></button>
        )}
      </div>

      {/* Filtros */}
      <div className="mb-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <Chip active={filter === "todas"} onClick={() => setFilter("todas")} label="Todas" count={counts.todas} />
        <Chip active={filter === "criticas"} onClick={() => setFilter("criticas")} label="Críticas" count={counts.criticas} />
        <Chip active={filter === "hoje"} onClick={() => setFilter("hoje")} label="Hoje" count={counts.hoje} />
        <Chip active={filter === "vencidos"} onClick={() => setFilter("vencidos")} label="Vencidos" count={counts.vencidos} />
        <Chip active={filter === "7d"} onClick={() => setFilter("7d")} label="7 dias" count={counts.d7} />
        <Chip active={filter === "sem_app"} onClick={() => setFilter("sem_app")} label="Sem app" count={counts.sem_app} dim={counts.sem_app === 0} />
        <Chip active={filter === "sem_whats"} onClick={() => setFilter("sem_whats")} label="Sem WhatsApp" count={counts.sem_whats} dim={counts.sem_whats === 0} />
        <Chip active={filter === "atualizar_servidor"} onClick={() => setFilter("atualizar_servidor")} label="Atualizar servidor" count={counts.atualizar_servidor} dim={counts.atualizar_servidor === 0} />
        <Chip active={filter === "tecnicas"} onClick={() => setFilter("tecnicas")} label="Técnicas" count={counts.tecnicas} />
        <Chip active={filter === "app_pago_vencido"} onClick={() => setFilter("app_pago_vencido")} label="App pago vencido" count={counts.app_pago_vencido} dim={counts.app_pago_vencido === 0} />
        <Chip active={filter === "app_pago_7d"} onClick={() => setFilter("app_pago_7d")} label="App pago 7 dias" count={counts.app_pago_7d} dim={counts.app_pago_7d === 0} />
        <Chip active={filter === "app_pago_30d"} onClick={() => setFilter("app_pago_30d")} label="App pago 30 dias" count={counts.app_pago_30d} dim={counts.app_pago_30d === 0} />
        <Chip active={filter === "app_sem_venc"} onClick={() => setFilter("app_sem_venc")} label="Sem vencimento do app" count={counts.app_sem_venc} dim={counts.app_sem_venc === 0} />
        <Chip active={filter === "app_sem_mackey"} onClick={() => setFilter("app_sem_mackey")} label="App sem MAC/Key" count={counts.app_sem_mackey} dim={counts.app_sem_mackey === 0} />
      </div>

      {/* Filtros por servidor */}
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

      {/* Estados */}
      {!isAuthenticated && !authLoading && (
        <EmptyState icon={Users} title="Entre para ver suas pendências" description="Faça login para organizar o que precisa de atenção." />
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
          icon={CheckCircle2}
          title="Tudo em dia por aqui"
          description={query ? "Nada encontrado para esta busca." : "Nenhuma pendência ativa neste filtro."}
        />
      )}

      {isAuthenticated && !loading && !errorMsg && ordered.length > 0 && (
        <div className="space-y-2">
          {ordered.map((p) => (
            <PendingCard
              key={p.key}
              p={p}
              resolved={!!resolved[p.key]}
              onCopyLembrete={() => copy(buildLembrete(p), "Lembrete")}
              onCopyDados={() => p.screen && copy(formatScreenAsText(p.screen, p.customer?.name ?? "Cliente", { revealSecrets: false }), "Dados (mascarados)")}
              onCopyDadosAbertos={() => p.screen && p.customer && setConfirmReveal({ screen: p.screen, customerName: p.customer.name })}
              onOpenCustomer={() => p.customer && openCustomer(p.customer.id)}
              onOpenTelas={() => p.customer && openCustomer(p.customer.id, "telas")}
              onOpenOperacao={() => navigate({ to: "/operacao-dia" })}
              onOpenCampanhas={() => navigate({ to: "/campanhas-manuais" })}
              onResolve={() => markResolved(p.key)}
              onUnresolve={() => unmarkResolved(p.key)}
            />
          ))}
        </div>
      )}

      {/* Confirmação de dados sensíveis */}
      <AlertDialog open={!!confirmReveal} onOpenChange={(o) => !o && setConfirmReveal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copiar dados com senha/key?</AlertDialogTitle>
            <AlertDialogDescription>
              Os dados sensíveis serão copiados em texto aberto para sua área de transferência. Cole apenas em um lugar seguro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmReveal) {
                  copy(formatScreenAsText(confirmReveal.screen, confirmReveal.customerName, { revealSecrets: true }), "Dados (abertos)");
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
          title="Pendências da agenda da importação"
          subtitle="Disparos pendentes, bloqueados e itens para revisar da última importação."
          hideWhenEmpty
        />
      </div>
    </PageContainer>
  );
}


// ---------- subcomponents ----------
function Mini({
  label, value, tone,
}: {
  label: string; value: number;
  tone?: "red" | "redDeep" | "amber" | "orange" | "violet" | "slate";
}) {
  const tones: Record<string, string> = {
    red: "border-red-300/50 bg-red-50/60 dark:border-red-500/30 dark:bg-red-500/10",
    redDeep: "border-red-400/60 bg-red-100/60 dark:border-red-600/40 dark:bg-red-700/15",
    amber: "border-amber-300/50 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10",
    orange: "border-orange-300/50 bg-orange-50/60 dark:border-orange-500/30 dark:bg-orange-500/10",
    violet: "border-violet-300/50 bg-violet-50/60 dark:border-violet-500/30 dark:bg-violet-500/10",
    slate: "border-border bg-muted/40",
  };
  return (
    <div className={cn("rounded-xl border p-3", tone ? tones[tone] : "border-border bg-card")}>
      <div className="text-2xl font-bold leading-none tabular-nums">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function Chip({
  active, onClick, label, count, dim,
}: { active: boolean; onClick: () => void; label: string; count: number; dim?: boolean }) {
  return (
    <button
      type="button" onClick={onClick}
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

function PendingCard({
  p, resolved,
  onCopyLembrete, onCopyDados, onCopyDadosAbertos,
  onOpenCustomer, onOpenTelas, onOpenOperacao, onOpenCampanhas,
  onResolve, onUnresolve,
}: {
  p: PendingItem;
  resolved: boolean;
  onCopyLembrete: () => void;
  onCopyDados: () => void;
  onCopyDadosAbertos: () => void;
  onOpenCustomer: () => void;
  onOpenTelas: () => void;
  onOpenOperacao: () => void;
  onOpenCampanhas: () => void;
  onResolve: () => void;
  onUnresolve: () => void;
}) {
  const meta = TYPE_META[p.type];
  const Icon = meta.icon;
  const s = p.screen;
  const c = p.customer;

  return (
    <div className={cn("rounded-xl border p-3", meta.tone, resolved && "opacity-60")}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="mt-0.5 rounded-md border border-border bg-background/60 p-1">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium">
              {meta.label}
            </span>
            {c && (
              <span className="truncate text-sm font-semibold">{c.name}</span>
            )}
            {s && (
              <span className={cn("rounded-md px-1.5 py-0.5 text-[10px]", APP_CATALOG[s.app]?.badgeClass)}>
                {APP_CATALOG[s.app]?.label}
              </span>
            )}
            {p.days != null && (p.type === "hoje" || p.type === "vencido" || p.type === "7d") && (
              <span className={cn("rounded-md px-1.5 py-0.5 text-[10px]", urgencyClass(urgencyFromDays(p.days)))}>
                {urgencyLabel(urgencyFromDays(p.days), p.days)}
              </span>
            )}
            {resolved && (
              <span className="rounded-md border border-emerald-400/60 bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                Resolvida
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
            {c && <>{prettyPhone(c.whatsapp) ?? "Sem WhatsApp"}</>}
            {s && <>{c ? " · " : ""}{s.name}{s.due_date ? <> · vence {fmtDateBR(s.due_date)}</> : null}{s.route ? <> · {ROUTE_OPTIONS.find((o) => o.value === s.route)?.label}</> : null}</>}
          </div>
          <div className="mt-2 text-xs">
            <div>{p.description}</div>
            <div className="text-muted-foreground">→ {p.recommended}</div>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {p.type !== "tecnica" && p.type !== "campanha_pendente" && (
              <>
                {c && <Button size="sm" variant="outline" onClick={onOpenCustomer}>Abrir cliente</Button>}
                <Button size="sm" variant="outline" onClick={onCopyLembrete} className="gap-1">
                  <Copy className="h-3.5 w-3.5" /> Copiar lembrete
                </Button>
                {p.type === "sem_app" && c && (
                  <Button size="sm" onClick={onOpenTelas}>Cadastrar app</Button>
                )}
                {s && (
                  <>
                    <Button size="sm" variant="outline" onClick={onCopyDados} className="gap-1">
                      <Copy className="h-3.5 w-3.5" /> Dados (mascarados)
                    </Button>
                    <Button size="sm" variant="ghost" onClick={onCopyDadosAbertos}>
                      Copiar com senha/key
                    </Button>
                  </>
                )}
                <Button size="sm" variant="ghost" onClick={onOpenOperacao}>Operação do dia</Button>
                <Button size="sm" variant="ghost" onClick={onOpenCampanhas}>Campanhas</Button>
              </>
            )}
            {p.type === "campanha_pendente" && (
              <Button size="sm" onClick={onOpenCampanhas}>Abrir Campanhas manuais</Button>
            )}
            {p.type === "tecnica" && (
              <span className="text-[11px] text-muted-foreground">Informativo — não exige backend.</span>
            )}
            <div className="ml-auto" />
            {resolved
              ? <Button size="sm" variant="ghost" onClick={onUnresolve}>Reabrir</Button>
              : <Button size="sm" variant="ghost" onClick={onResolve} className="gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Marcar como resolvida
                </Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
