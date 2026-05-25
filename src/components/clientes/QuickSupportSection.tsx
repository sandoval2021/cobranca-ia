import { useEffect, useMemo, useState } from "react";
import {
  Headphones, Copy, ExternalLink, Tv, RotateCcw, History, Trash2,
  MessageSquare, KeyRound, AlertCircle, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/ui-premium/EmptyState";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import {
  APP_CATALOG, AppScreen, ROUTE_OPTIONS,
  listScreens, mask,
} from "@/lib/app-screens";
import { applyRevendaVariables, getRevendaSettings, REVENDA_SETTINGS_EVENT } from "@/lib/revenda-settings";
import { useSecurityGuard } from "@/components/security/PinConfirmDialog";
import { ProtectedModeBadge } from "@/components/security/ProtectedModeBadge";
import type { ProtectedActionKind } from "@/lib/local-security";



// ------- tipos & storage -------

type SupportKey =
  | "dados_acesso"
  | "como_atualizar"
  | "reiniciar_tv"
  | "app_instavel"
  | "troca_servidor"
  | "pagamento_pendente"
  | "mensalidade_vencida"
  | "solicitar_print"
  | "mac_key"
  | "fora_horario";

type QuickKey =
  | "bom_dia"
  | "pedir_print"
  | "informar_app"
  | "informar_mac_key"
  | "informar_user_pass"
  | "encerrado"
  | "horario"
  | "renovacao_disponivel"
  | "acesso_vencido"
  | "vou_verificar";

type HistoryItem = {
  id: string;
  at: string; // ISO
  kind: string; // label do tipo
  app?: string;
  screen?: string;
  text: string;
};

const HIST_KEY = "cobranca_ia_quick_support_history_v1";
const HIST_LIMIT = 12;

function readHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function writeHistory(items: HistoryItem[]) {
  try {
    window.localStorage.setItem(HIST_KEY, JSON.stringify(items.slice(0, HIST_LIMIT)));
    window.dispatchEvent(new CustomEvent("quick-support:history-changed"));
  } catch {
    /* noop */
  }
}
function pushHistory(item: Omit<HistoryItem, "id" | "at">) {
  const list = readHistory();
  list.unshift({
    ...item,
    id: `qs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
  });
  writeHistory(list);
}

function copyText(text: string, label: string, meta?: Omit<HistoryItem, "id" | "at" | "text">) {
  if (!text) return;
  const finalText = applyRevendaVariables(text);
  try {
    navigator.clipboard?.writeText(finalText);
    toast.success(`${label} copiado`);
    if (meta) pushHistory({ ...meta, text: finalText });
  } catch {
    toast.error("Não foi possível copiar");
  }
}

// ------- helpers -------

function fmtDate(d?: string): string {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(+dt)) return d;
  return dt.toLocaleDateString("pt-BR");
}

function routeLabel(r?: string): string | null {
  if (!r) return null;
  return ROUTE_OPTIONS.find((o) => o.value === r)?.label ?? null;
}

function isUserPassApp(s: AppScreen): boolean {
  return s.access_type === "user_pass";
}
function isMacKeyApp(s: AppScreen): boolean {
  return s.access_type === "mac_key" || s.access_type === "mac";
}

// ------- geradores de texto -------

type GenInput = {
  customerName: string;
  screen: AppScreen;
  reveal: boolean;
};

function header(s: AppScreen) {
  const app = APP_CATALOG[s.app]?.label ?? s.app;
  const parts: string[] = [];
  parts.push(`📺 Tela: ${s.name}`);
  parts.push(`📱 App: ${app}`);
  if (isUserPassApp(s)) {
    if (s.username) parts.push(`👤 Usuário: ${s.username}`);
  }
  if (isMacKeyApp(s)) {
    if (s.mac) parts.push(`🔑 MAC: ${s.mac}`);
  }
  if (s.due_date) parts.push(`📅 Vencimento: ${fmtDate(s.due_date)}`);
  const r = routeLabel(s.route);
  if (r) parts.push(`🛰 Rota: ${r}`);
  return parts.join("\n");
}

function technicalBlock({ screen: s, reveal }: GenInput): string {
  const lines: string[] = [];
  if (isUserPassApp(s)) {
    if (s.username) lines.push(`👤 Usuário: ${s.username}`);
    if (s.password) lines.push(`🔐 Senha: ${reveal ? s.password : mask(s.password)}`);
    if (s.server) lines.push(`🌐 Servidor: ${s.server}`);
    if (s.port) lines.push(`🔌 Porta: ${s.port}`);
  } else if (isMacKeyApp(s)) {
    if (s.mac) lines.push(`🔑 MAC: ${s.mac}`);
    if (s.app_key) lines.push(`🔐 Key: ${reveal ? s.app_key : mask(s.app_key)}`);
    if (s.portal_url) lines.push(`🔗 Portal: ${s.portal_url}`);
  } else {
    if (s.portal_url) lines.push(`🔗 Portal: ${s.portal_url}`);
  }
  return lines.join("\n");
}

function genDadosAcesso(i: GenInput): string {
  const { customerName, screen: s } = i;
  const tech = technicalBlock(i);
  if (isMacKeyApp(s)) {
    return (
`Olá ${customerName}, tudo bem? 😊
Identifiquei que sua TV está usando o app ${APP_CATALOG[s.app]?.label ?? s.app}.

${header(s)}

${tech}

Para atualizar ou alterar o servidor, acesse o portal do app e confira os dados acima.`
    );
  }
  if (isUserPassApp(s)) {
    return (
`Olá ${customerName}, tudo bem? 😊
Sua tela está configurada no ${APP_CATALOG[s.app]?.label ?? s.app}.

${header(s)}

${tech}

Se estiver travando, feche o app, desligue a TV e o roteador por 2 minutos e tente novamente.`
    );
  }
  return (
`Olá ${customerName}! 😊
Segue os dados de acesso da sua tela:

${header(s)}

${tech}`
  );
}

function genComoAtualizar(i: GenInput): string {
  const { customerName, screen: s } = i;
  const app = APP_CATALOG[s.app]?.label ?? "seu app";
  const dica = isMacKeyApp(s)
    ? "Abra o app, vá até as configurações e procure por “Atualizar”, “Recarregar” ou “Update”. Em apps com MAC/Key, também é possível atualizar pelo portal do aplicativo."
    : "Abra o app, vá até as configurações e procure por “Atualizar lista”, “Recarregar” ou “Refresh”. Depois saia e entre novamente.";
  return (
`Olá ${customerName}! 😊
Sobre o ${app} (${s.name}):

${dica}

Se continuar travando, feche o app completamente e abra de novo.`
  );
}

function genReiniciar(i: GenInput): string {
  const { customerName, screen: s } = i;
  return (
`Olá ${customerName}! 😊
Antes de qualquer ajuste, vamos testar o básico:

1. Desligue a TV pela tomada por 2 minutos.
2. Desligue o roteador da internet pela tomada por 2 minutos.
3. Ligue tudo de novo, abra o app ${APP_CATALOG[s.app]?.label ?? ""} e tente novamente.

📺 Tela: ${s.name}

Se ainda apresentar erro, me envie um print por favor.`
  );
}

function genAppInstavel(i: GenInput): string {
  const { customerName, screen: s } = i;
  const sugestao = isMacKeyApp(s)
    ? "Se persistir, vale testar o IBO Player ou outro app com MAC/Key, que costumam ser mais estáveis."
    : "Se persistir, podemos testar o Smarters, que costuma ser mais estável que outros apps de usuário/senha.";
  return (
`Olá ${customerName}! 😊
Esse comportamento pode ser do próprio aplicativo ${APP_CATALOG[s.app]?.label ?? ""} (${s.name}), não do sinal.

${sugestao}

Me avise se quiser que eu te ajude a configurar.`
  );
}

function genTrocaServidor(i: GenInput): string {
  const { customerName, screen: s } = i;
  const tech = technicalBlock(i);
  const r = routeLabel(s.route);
  return (
`Olá ${customerName}! 😊
Atualizei o servidor/rota da sua tela ${s.name} (${APP_CATALOG[s.app]?.label ?? ""}).

${r ? `🛰 Rota atual: ${r}\n` : ""}${tech ? `\n${tech}\n` : ""}
Por favor, abra o app, recarregue a lista e tente novamente. Qualquer coisa me chama por aqui.`
  );
}

function genPagamentoPendente(i: GenInput): string {
  const { customerName, screen: s } = i;
  return (
`Olá ${customerName}, tudo bem? 😊
Passando para lembrar que sua mensalidade está próxima do vencimento${s.due_date ? ` (${fmtDate(s.due_date)})` : ""}.

📺 Tela: ${s.name}

Quando puder, me confirme o pagamento para deixar tudo certinho. Obrigado!`
  );
}

function genMensalidadeVencida(i: GenInput): string {
  const { customerName, screen: s } = i;
  return (
`Olá ${customerName}, tudo bem?
Identifiquei que a mensalidade da sua tela ${s.name} (${APP_CATALOG[s.app]?.label ?? ""}) está em atraso${s.due_date ? ` desde ${fmtDate(s.due_date)}` : ""}.

Para evitar interrupção do acesso, por favor regularize quando possível. Qualquer dúvida me chama.`
  );
}

function genSolicitarPrint(i: GenInput): string {
  const { customerName, screen: s } = i;
  return (
`Olá ${customerName}! 😊
Para te ajudar mais rápido, me envia por favor:

1. Print da tela com o erro
2. Nome do app que está usando (no seu cadastro: ${APP_CATALOG[s.app]?.label ?? "—"})
3. Nome da tela (no seu cadastro: ${s.name})
${isMacKeyApp(s) ? "4. Se possível, MAC do aparelho" : "4. Se possível, o usuário do app"}

Assim consigo identificar exatamente o que está acontecendo.`
  );
}

function genMacKey(i: GenInput): string {
  const { customerName, screen: s, reveal } = i;
  if (!isMacKeyApp(s)) {
    return (
`Olá ${customerName}!
Esse app usa usuário e senha, não MAC e Key. Caso esteja em outro aparelho, me informe qual app está usando para eu te passar os dados corretos.`
    );
  }
  return (
`Olá ${customerName}! 😊
Segue MAC e Key da sua tela ${s.name} (${APP_CATALOG[s.app]?.label ?? ""}):

🔑 MAC: ${s.mac ?? "—"}
🔐 Key: ${s.app_key ? (reveal ? s.app_key : mask(s.app_key)) : "—"}
${s.portal_url ? `🔗 Portal: ${s.portal_url}\n` : ""}
Cadastre esses dados no portal do app. Qualquer dúvida me chama.`
  );
}

function genForaHorario(i: GenInput): string {
  const { customerName } = i;
  const rev = getRevendaSettings();
  const custom = rev.atendimento.texto_fora_horario?.trim();
  if (custom) {
    return `Olá ${customerName}! 😊\n${applyRevendaVariables(custom)}`;
  }
  const horario = rev.atendimento.horario_semana?.trim() || "segunda a sábado, das 09h às 21h";
  return (
`Olá ${customerName}! 😊
No momento estamos fora do horário de atendimento.

🕘 Atendimento: ${horario}.

Sua mensagem foi registrada e respondo assim que possível. Obrigado pela compreensão!`
  );
}

// short / completo helpers para o card atual
function genShort(i: GenInput): string {
  const { screen: s } = i;
  if (isMacKeyApp(s)) {
    return `Tela: ${s.name} · ${APP_CATALOG[s.app]?.label ?? s.app}\nMAC: ${s.mac ?? "—"} · Key: ${mask(s.app_key)}${s.portal_url ? `\nPortal: ${s.portal_url}` : ""}`;
  }
  if (isUserPassApp(s)) {
    return `Tela: ${s.name} · ${APP_CATALOG[s.app]?.label ?? s.app}\nUsuário: ${s.username ?? "—"} · Senha: ${mask(s.password)}${s.server ? `\nServidor: ${s.server}${s.port ? `:${s.port}` : ""}` : ""}`;
  }
  return `Tela: ${s.name} · ${APP_CATALOG[s.app]?.label ?? s.app}`;
}

const SUPPORT_DEFS: { key: SupportKey; label: string; description: string; gen: (i: GenInput) => string }[] = [
  { key: "dados_acesso",        label: "Dados de acesso",       description: "Envie os dados do app",                gen: genDadosAcesso },
  { key: "como_atualizar",      label: "Como atualizar app",     description: "Atualizar/recarregar a lista",         gen: genComoAtualizar },
  { key: "reiniciar_tv",        label: "Reiniciar TV e internet", description: "Desligar TV e roteador por 2 min",   gen: genReiniciar },
  { key: "app_instavel",        label: "App instável",          description: "Sugerir app mais estável",              gen: genAppInstavel },
  { key: "troca_servidor",      label: "Troca de servidor/rota", description: "Avisar que o link foi atualizado",     gen: genTrocaServidor },
  { key: "pagamento_pendente",  label: "Pagamento pendente",    description: "Lembrete amigável de mensalidade",      gen: genPagamentoPendente },
  { key: "mensalidade_vencida", label: "Mensalidade vencida",   description: "Aviso firme, mas educado",              gen: genMensalidadeVencida },
  { key: "solicitar_print",     label: "Solicitar print",       description: "Pedir print, app e dados",              gen: genSolicitarPrint },
  { key: "mac_key",             label: "MAC / Key",             description: "Informar ou pedir MAC e Key",           gen: genMacKey },
  { key: "fora_horario",        label: "Suporte fora do horário", description: "Aviso de horário de atendimento",     gen: genForaHorario },
];

function buildQuickMessages(): { key: QuickKey; label: string; text: string }[] {
  const rev = getRevendaSettings();
  const a = rev.atendimento;
  const horarioFallback = "Nosso horário de atendimento é de segunda a sábado, das 09h às 21h. 🕘";
  return [
    { key: "bom_dia",                label: "Bom dia, como posso ajudar?",       text: "Bom dia! 😊 Como posso te ajudar hoje?" },
    { key: "pedir_print",            label: "Por favor, envie print do erro",    text: a.texto_pedir_print?.trim() || "Por favor, me envia um print da tela com o erro para eu te ajudar?" },
    { key: "informar_app",           label: "Informe qual app você usa",         text: a.texto_pedir_nome_app?.trim() || "Você consegue me informar qual aplicativo está usando na sua TV?" },
    { key: "informar_mac_key",       label: "Informe MAC e Key",                 text: "Para te ajudar, me informa por favor o MAC e a Key do seu aparelho." },
    { key: "informar_user_pass",     label: "Informe usuário e senha",           text: "Para te ajudar, me informa por favor o usuário e a senha cadastrados no app." },
    { key: "encerrado",              label: "Atendimento encerrado",             text: "Tudo certo então! Qualquer coisa estou à disposição. 😊" },
    { key: "horario",                label: "Horário de atendimento",            text: a.horario_semana?.trim() ? `Nosso horário de atendimento: ${a.horario_semana}. 🕘` : horarioFallback },
    { key: "renovacao_disponivel",   label: "Mensalidade disponível para renovação", text: "Sua mensalidade já está disponível para renovação. Quando puder, me confirme o pagamento. Obrigado!" },
    { key: "acesso_vencido",         label: "Seu acesso está vencido",           text: "Identifiquei que seu acesso está vencido. Para evitar interrupção, por favor regularize quando possível." },
    { key: "vou_verificar",          label: "Vou verificar sua tela",            text: "Vou verificar sua tela aqui e já te retorno, ok? 😊" },
  ];
}

// ------- componente -------

export function QuickSupportSection({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  const [screens, setScreens] = useState<AppScreen[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [quickMessages, setQuickMessages] = useState(() => buildQuickMessages());
  const [confirmReveal, setConfirmReveal] = useState<null | {
    onConfirm: () => void;
  }>(null);

  const refreshScreens = () => setScreens(listScreens(customerId));
  const refreshHistory = () => setHistory(readHistory());
  const refreshQuick = () => setQuickMessages(buildQuickMessages());

  useEffect(() => {
    refreshScreens();
    refreshHistory();
    const onS = () => refreshScreens();
    const onH = () => refreshHistory();
    const onR = () => refreshQuick();
    window.addEventListener("app-screens:changed", onS);
    window.addEventListener("quick-support:history-changed", onH);
    window.addEventListener(REVENDA_SETTINGS_EVENT, onR);
    return () => {
      window.removeEventListener("app-screens:changed", onS);
      window.removeEventListener("quick-support:history-changed", onH);
      window.removeEventListener(REVENDA_SETTINGS_EVENT, onR);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const activeScreens = useMemo(
    () => screens.filter((s) => s.status !== "arquivada"),
    [screens],
  );

  useEffect(() => {
    if (!selectedId && activeScreens.length > 0) setSelectedId(activeScreens[0].id);
    if (selectedId && !activeScreens.some((s) => s.id === selectedId)) {
      setSelectedId(activeScreens[0]?.id ?? null);
    }
  }, [activeScreens, selectedId]);

  const selected = activeScreens.find((s) => s.id === selectedId) ?? null;

  const askReveal = (fn: () => void) => setConfirmReveal({ onConfirm: fn });

  const copyAndLog = (text: string, label: string, kind: string) => {
    copyText(text, label, {
      kind,
      app: selected ? APP_CATALOG[selected.app]?.label : undefined,
      screen: selected?.name,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Headphones className="h-4 w-4 text-primary" /> Atendimento rápido
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Gere respostas prontas com base no app e na tela do cliente.
        </p>
      </div>

      <div className="rounded-md border border-info/40 bg-info-soft/40 p-2 text-[11px] text-info">
        <AlertCircle className="mr-1 inline h-3 w-3" />
        Nada será enviado automaticamente. Você apenas copia o texto e envia manualmente.
      </div>

      <div className="text-[11px] text-muted-foreground">
        Mensagens usando dados de Minha Revenda.{" "}
        <Link to="/configuracoes-revenda" className="underline">Editar Minha Revenda</Link>
      </div>

      {/* Seleção de tela */}
      {activeScreens.length === 0 ? (
        <EmptyState
          icon={Tv}
          title="Sem telas cadastradas"
          description="Cadastre uma tela em ‘Telas e aplicativos’ para gerar textos personalizados."
        />
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tela / app</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {activeScreens.map((s) => {
              const app = APP_CATALOG[s.app];
              const active = s.id === selectedId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:bg-muted",
                  )}
                >
                  {s.name} · {app?.label ?? s.app}
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="rounded-xl border border-border bg-card p-3 text-xs">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", APP_CATALOG[selected.app]?.badgeClass)}>
                  {APP_CATALOG[selected.app]?.label ?? selected.app}
                </span>
                {selected.due_date && (
                  <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] text-muted-foreground">
                    Vence {fmtDate(selected.due_date)}
                  </span>
                )}
                {routeLabel(selected.route) && (
                  <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] text-muted-foreground">
                    Rota: {routeLabel(selected.route)}
                  </span>
                )}
              </div>

              <div className="space-y-1 rounded-md bg-surface p-2 text-[11px] text-muted-foreground">
                {isUserPassApp(selected) && (
                  <>
                    <Row k="Usuário" v={selected.username} />
                    <Row k="Senha" v={reveal ? selected.password : mask(selected.password)} />
                    <Row k="Servidor" v={selected.server} />
                    {selected.port && <Row k="Porta" v={selected.port} />}
                  </>
                )}
                {isMacKeyApp(selected) && (
                  <>
                    <Row k="MAC" v={selected.mac} />
                    <Row k="Key" v={reveal ? selected.app_key : mask(selected.app_key)} />
                  </>
                )}
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5"
                  onClick={() => {
                    if (reveal) setReveal(false);
                    else askReveal(() => setReveal(true));
                  }}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  {reveal ? "Ocultar senha/key" : "Revelar senha/key"}
                </Button>
                {selected.portal_url && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5"
                    onClick={() => window.open(selected.portal_url, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Abrir portal do app
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5"
                  onClick={() =>
                    copyAndLog(genShort({ customerName, screen: selected, reveal: false }), "Instrução curta", "Instrução curta")
                  }
                >
                  <Copy className="h-3.5 w-3.5" /> Copiar instrução curta
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tipos de atendimento */}
      {selected && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tipos de atendimento</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SUPPORT_DEFS.map((def) => (
              <SupportCard
                key={def.key}
                title={def.label}
                description={def.description}
                getText={(reveal) => def.gen({ customerName, screen: selected, reveal })}
                onCopy={(text, kind) => copyAndLog(text, def.label, kind)}
                onCopyReveal={(genReveal) =>
                  askReveal(() => {
                    const text = genReveal();
                    copyAndLog(text, `${def.label} (sensível)`, def.label);
                  })
                }
                screenAccessKind={selected.access_type}
              />
            ))}
          </div>
        </div>
      )}

      {/* Mensagens rápidas */}
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <MessageSquare className="h-3 w-3" /> Mensagens prontas
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {quickMessages.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => copyAndLog(m.text, m.label, "Mensagem pronta")}
              className="flex items-start gap-2 rounded-lg border border-border bg-card p-2 text-left text-xs hover:bg-muted"
            >
              <Copy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{m.label}</span>
                <span className="block truncate text-[10px] text-muted-foreground">{m.text}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Histórico local */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <History className="h-3 w-3" /> Últimos textos copiados
          </p>
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => { writeHistory([]); toast.success("Histórico limpo"); }}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
            >
              <Trash2 className="h-3 w-3" /> Limpar
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-surface p-2 text-center text-[11px] text-muted-foreground">
            Nada copiado ainda. Use os atendimentos acima.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {history.map((h) => (
              <li key={h.id} className="rounded-lg border border-border bg-card p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium">{h.kind}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      <Clock className="mr-1 inline h-2.5 w-2.5" />
                      {new Date(h.at).toLocaleString("pt-BR")}
                      {h.screen ? ` · ${h.screen}` : ""}
                      {h.app ? ` · ${h.app}` : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 px-2"
                    onClick={() => copyText(h.text, "Texto", undefined)}
                  >
                    <RotateCcw className="h-3 w-3" /> Copiar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Confirmação senha/key */}
      <AlertDialog open={!!confirmReveal} onOpenChange={(o) => !o && setConfirmReveal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dados sensíveis</AlertDialogTitle>
            <AlertDialogDescription>
              Esse texto inclui senha/key do cliente. Deseja copiar mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmReveal?.onConfirm();
                setConfirmReveal(null);
              }}
            >
              Copiar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[10px] uppercase tracking-wide">{k}</span>
      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{v || "—"}</span>
    </div>
  );
}

function SupportCard({
  title,
  description,
  getText,
  onCopy,
  onCopyReveal,
  screenAccessKind,
}: {
  title: string;
  description: string;
  getText: (reveal: boolean) => string;
  onCopy: (text: string, kind: string) => void;
  onCopyReveal: (gen: () => string) => void;
  screenAccessKind: import("@/lib/app-screens").AccessType;
}) {
  const hasSensitive = screenAccessKind !== "outro" && screenAccessKind !== "nao_informado";
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2">
        <p className="text-xs font-semibold">{title}</p>
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 flex-1 gap-1.5"
          onClick={() => onCopy(getText(false), title)}
        >
          <Copy className="h-3.5 w-3.5" /> Copiar texto
        </Button>
        {hasSensitive && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 flex-1 gap-1.5"
            onClick={() => onCopyReveal(() => getText(true))}
          >
            <KeyRound className="h-3.5 w-3.5" /> Com senha/key
          </Button>
        )}
      </div>
    </div>
  );
}
