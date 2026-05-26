import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bot, Clock, Send, Ban, RotateCcw, Settings2, ChevronDown, ChevronUp, MessageSquare, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AUTO_DISPATCH_EVENT,
  fmtHHMM,
  getAutoDispatchConfig,
  getCancelled,
  getSent,
  isDayAllowed,
  markSent,
  saveAutoDispatchConfig,
  setCancelled,
  type AutoDispatchConfig,
} from "@/lib/auto-dispatch";
import { MANUAL_RULES_EVENT } from "@/lib/manual-dispatch-rules";
import { type AppScreen } from "@/lib/app-screens";
import {
  computeAutoDispatchQueue,
  type AutoDispatchQueueItem as QueueItem,
  type QueueClientLike,
} from "@/lib/auto-dispatch-queue";

type ClientLike = QueueClientLike;

const DAYS = [
  { k: "dom", label: "Dom" }, { k: "seg", label: "Seg" }, { k: "ter", label: "Ter" },
  { k: "qua", label: "Qua" }, { k: "qui", label: "Qui" }, { k: "sex", label: "Sex" },
  { k: "sab", label: "Sáb" },
] as const;

function onlyDigits(s: string) { return (s || "").replace(/\D+/g, ""); }
function fmtDueDateBR(daysUntil: number): string {
  const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + daysUntil);
  return d.toLocaleDateString("pt-BR");
}

export function AutoDispatchTodayPanel({
  items,
  allScreens,
  defaultOpen = false,
}: {
  items: ClientLike[] | null;
  allScreens: Record<string, AppScreen[]>;
  defaultOpen?: boolean;
}) {
  const [cfg, setCfg] = useState<AutoDispatchConfig>(() => getAutoDispatchConfig());
  const [open, setOpen] = useState(defaultOpen);
  const [showCfg, setShowCfg] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => { setCfg(getAutoDispatchConfig()); setTick((t) => t + 1); };
    window.addEventListener(AUTO_DISPATCH_EVENT, refresh);
    window.addEventListener(MANUAL_RULES_EVENT, refresh);
    return () => {
      window.removeEventListener(AUTO_DISPATCH_EVENT, refresh);
      window.removeEventListener(MANUAL_RULES_EVENT, refresh);
    };
  }, []);

  const dayAllowed = isDayAllowed(cfg);
  const cancelled = useMemo(() => getCancelled(), [tick]);
  const sent = useMemo(() => getSent(), [tick]);
  const queue: QueueItem[] = useMemo(
    () => computeAutoDispatchQueue(items, allScreens, cfg),
    [items, allScreens, cfg, tick],
  );

  const updateCfg = (patch: Partial<AutoDispatchConfig>) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    saveAutoDispatchConfig(next);
  };

  const toggleDay = (d: AutoDispatchConfig["allowedDays"][number]) => {
    const has = cfg.allowedDays.includes(d);
    const next = has ? cfg.allowedDays.filter((x) => x !== d) : [...cfg.allowedDays, d];
    updateCfg({ allowedDays: next });
  };

  const sendNow = (q: QueueItem) => {
    const phone = onlyDigits(q.client.whatsapp ?? "");
    if (!phone) { toast.error("Cliente sem WhatsApp."); return; }
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(q.message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    markSent(q.client.id);
    toast.success(`Mensagem aberta para ${q.client.name}`);
  };

  const pending = queue.filter((q) => !q.cancelled && !q.sent);
  const now = new Date();
  const overdue = pending.filter((q) => q.scheduleTime.getTime() < now.getTime());
  const totalCount = queue.length;

  const sendAllOverdue = () => {
    if (overdue.length === 0) return;
    overdue.forEach((q, i) => {
      const phone = onlyDigits(q.client.whatsapp ?? "");
      if (!phone) return;
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(q.message)}`;
      // Pequeno atraso evita bloqueio do popup
      setTimeout(() => window.open(url, "_blank", "noopener,noreferrer"), i * 250);
      markSent(q.client.id);
    });
    setTick((t) => t + 1);
    toast.success(`Reenviando ${overdue.length} mensagem(ns) atrasada(s).`);
  };


  return (
    <Card className="mb-4 overflow-hidden border-primary/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40"
      >
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <div>
            <div className="text-sm font-semibold">Disparos automáticos hoje</div>
            <div className="text-[11px] text-muted-foreground">
              {cfg.enabled
                ? `${pending.length} pendente(s) • ${sent.size} enviada(s)`
                : "Automação desativada — veja a lista e configure"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
            cfg.enabled ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"
          )}>
            {cfg.enabled ? "ATIVA" : "PAUSADA"}
          </span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-3">
          {/* Controles principais */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 rounded-md border p-2">
              <Switch checked={cfg.enabled} onCheckedChange={(v) => updateCfg({ enabled: v })} />
              <span className="text-xs font-medium">Envio automático</span>
            </label>
            <div className="flex items-center gap-2 rounded-md border p-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs">Início</Label>
              <Input
                type="time" value={cfg.sendHour}
                onChange={(e) => updateCfg({ sendHour: e.target.value })}
                className="h-7 w-[100px] text-xs"
              />
            </div>
            <div className="flex items-center gap-2 rounded-md border p-2">
              <Label className="text-xs">Intervalo</Label>
              <Input
                type="number" min={5} max={3600} value={cfg.intervalSeconds}
                onChange={(e) => updateCfg({ intervalSeconds: Math.max(5, Number(e.target.value) || 5) })}
                className="h-7 w-[80px] text-xs"
              />
              <span className="text-[11px] text-muted-foreground">seg</span>
            </div>
            <div className="flex items-center gap-2 rounded-md border p-2">
              <Label className="text-xs">Máx/dia</Label>
              <Input
                type="number" min={1} max={500} value={cfg.maxPerDay}
                onChange={(e) => updateCfg({ maxPerDay: Math.max(1, Number(e.target.value) || 1) })}
                className="h-7 w-[80px] text-xs"
              />
            </div>
            <Button
              size="sm" variant="outline" className="gap-1.5"
              onClick={() => setShowCfg((v) => !v)}
            >
              <Settings2 className="h-3.5 w-3.5" /> Dias da semana
            </Button>
            <Button
              asChild size="sm" variant="outline" className="gap-1.5"
            >
              <Link to="/agenda-disparo">
                <ExternalLink className="h-3.5 w-3.5" /> Configuração completa
              </Link>
            </Button>
          </div>

          {overdue.length > 0 && cfg.enabled && (
            <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-[12px] text-amber-900 dark:text-amber-100 flex flex-wrap items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold">
                  {overdue.length} mensagem(ns) atrasada(s)
                </div>
                <div className="text-[11px] opacity-90">
                  Estavam programadas para até agora e ainda não saíram. Reenvie em lote ou abra individualmente abaixo.
                </div>
              </div>
              <Button size="sm" className="h-7 gap-1 text-[11px]" onClick={sendAllOverdue}>
                <Send className="h-3 w-3" /> Enviar todas atrasadas
              </Button>
            </div>
          )}

          {showCfg && (
            <div className="flex flex-wrap gap-2 rounded-md border bg-muted/30 p-2">
              {DAYS.map((d) => {
                const active = cfg.allowedDays.includes(d.k);
                return (
                  <button
                    key={d.k} type="button"
                    onClick={() => toggleDay(d.k)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium",
                      active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          )}

          {!dayAllowed && cfg.enabled && (
            <div className="rounded-md border border-amber-300/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200">
              Hoje não está nos dias permitidos — nenhum envio automático ocorrerá.
            </div>
          )}

          {/* Resumo */}
          <div className="flex flex-wrap gap-2 text-[11px]">
            <Badge>{totalCount} na fila</Badge>
            <Badge tone="ok">{pending.length} pendente(s)</Badge>
            <Badge tone="muted">{cancelled.size} cancelada(s)</Badge>
            <Badge tone="ok">{sent.size} enviada(s)</Badge>
          </div>

          {/* Lista */}
          {totalCount === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
              Nenhum cliente se encaixa nas regras de disparo de hoje.
            </div>
          ) : (
            <div className="space-y-2">
              {queue.map((q) => (
                <div
                  key={q.client.id}
                  className={cn(
                    "rounded-md border p-3 text-xs space-y-2",
                    q.cancelled && "opacity-60 bg-muted/40",
                    q.sent && "border-emerald-400/40 bg-emerald-50/40 dark:bg-emerald-950/20",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{q.client.name}</span>
                        {q.sent && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                        {q.cancelled && <Ban className="h-3.5 w-3.5 text-muted-foreground" />}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {q.client.whatsapp ?? "sem WhatsApp"} • {q.ruleName}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {q.daysUntilDue === 0
                          ? "Vence hoje"
                          : q.daysUntilDue > 0
                            ? `Vence em ${q.daysUntilDue} dia(s) — ${fmtDueDateBR(q.daysUntilDue)}`
                            : `Vencido há ${Math.abs(q.daysUntilDue)} dia(s)`}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-mono text-[11px]">
                        <Clock className="h-3 w-3" /> {fmtHHMM(q.scheduleTime)}
                      </div>
                    </div>
                  </div>

                  <details className="text-[11px]">
                    <summary className="cursor-pointer text-muted-foreground inline-flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> Ver mensagem
                    </summary>
                    <pre className="mt-1 whitespace-pre-wrap rounded bg-muted/60 p-2 font-sans text-[11px] leading-relaxed">
                      {q.message}
                    </pre>
                  </details>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {q.cancelled ? (
                      <Button
                        size="sm" variant="outline" className="h-7 gap-1 text-[11px]"
                        onClick={() => { setCancelled(q.client.id, false); setTick((t) => t + 1); }}
                      >
                        <RotateCcw className="h-3 w-3" /> Reativar
                      </Button>
                    ) : (
                      <Button
                        size="sm" variant="outline" className="h-7 gap-1 text-[11px]"
                        onClick={() => { setCancelled(q.client.id, true); setTick((t) => t + 1); toast.success(`Envio cancelado para ${q.client.name}`); }}
                      >
                        <Ban className="h-3 w-3" /> Cancelar envio
                      </Button>
                    )}
                    <Button
                      size="sm" className="h-7 gap-1 text-[11px]"
                      disabled={q.cancelled || q.sent}
                      onClick={() => sendNow(q)}
                    >
                      <Send className="h-3 w-3" /> Enviar agora
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-[10px] text-muted-foreground">
            Edite as regras e modelos em <strong>Regras de disparo</strong>. Os horários são calculados a partir do
            "Início" + intervalo entre mensagens. As configurações ficam salvas neste dispositivo.
          </div>
        </div>
      )}
    </Card>
  );
}

function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "ok" | "muted" }) {
  return (
    <span className={cn(
      "rounded-full px-2 py-0.5 font-semibold",
      tone === "ok" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
      tone === "muted" && "bg-muted text-muted-foreground",
      tone === "default" && "bg-primary/10 text-primary",
    )}>{children}</span>
  );
}
