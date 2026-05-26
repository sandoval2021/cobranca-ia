import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Save, Trash2, RotateCcw, Info } from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import {
  AUTO_DISPATCH_EVENT,
  defaultAutoDispatchConfig,
  getAutoDispatchConfig,
  saveAutoDispatchConfig,
  type AutoDispatchConfig,
  type AmountSchedule,
} from "@/lib/auto-dispatch";
import { listActiveServices, SERVICES_EVENT, formatBRL as fmtBRLsvc } from "@/lib/services-catalog";

export const Route = createFileRoute("/agenda-disparo")({
  component: AgendaDisparoPage,
});

const DAYS = [
  { k: "dom", label: "Dom" }, { k: "seg", label: "Seg" }, { k: "ter", label: "Ter" },
  { k: "qua", label: "Qua" }, { k: "qui", label: "Qui" }, { k: "sex", label: "Sex" },
  { k: "sab", label: "Sáb" },
] as const;


function AgendaDisparoPage() {
  const [cfg, setCfg] = useState<AutoDispatchConfig>(() => getAutoDispatchConfig());
  const [services, setServices] = useState(() => listActiveServices());
  const [bulkHour, setBulkHour] = useState<string>("09:00");

  useEffect(() => {
    const sync = () => setCfg(getAutoDispatchConfig());
    window.addEventListener(AUTO_DISPATCH_EVENT, sync);
    return () => window.removeEventListener(AUTO_DISPATCH_EVENT, sync);
  }, []);

  const update = (patch: Partial<AutoDispatchConfig>) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    saveAutoDispatchConfig(next);
  };

  const toggleDay = (d: AutoDispatchConfig["allowedDays"][number]) => {
    const has = cfg.allowedDays.includes(d);
    update({
      allowedDays: has
        ? cfg.allowedDays.filter((x) => x !== d)
        : [...cfg.allowedDays, d],
    });
  };

  // Sincroniza catálogo de serviços
  useEffect(() => {
    const sync = () => setServices(listActiveServices());
    window.addEventListener(SERVICES_EVENT, sync);
    return () => window.removeEventListener(SERVICES_EVENT, sync);
  }, []);

  const scheduleByCents = new Map(cfg.amountSchedules.map((a) => [a.amountCents, a.sendHour]));

  const setServiceHour = (cents: number, hour: string) => {
    const others = cfg.amountSchedules.filter((a) => a.amountCents !== cents);
    const next: AmountSchedule[] = [...others, { amountCents: cents, sendHour: hour }]
      .sort((a, b) => a.amountCents - b.amountCents);
    update({ amountSchedules: next });
  };

  const clearServiceHour = (cents: number) => {
    update({ amountSchedules: cfg.amountSchedules.filter((a) => a.amountCents !== cents) });
  };

  const applyHourToAllServices = (hour: string) => {
    if (!/^\d{2}:\d{2}$/.test(hour)) {
      toast.error("Horário inválido.");
      return;
    }
    const next: AmountSchedule[] = services.map((s) => ({ amountCents: s.preco_cents, sendHour: hour }))
      .sort((a, b) => a.amountCents - b.amountCents);
    update({ amountSchedules: next });
    toast.success(`Horário ${hour} aplicado a todos os serviços.`);
  };

  const clearAllServiceHours = () => {
    update({ amountSchedules: [] });
    toast.success("Horários personalizados removidos. Todos seguem o padrão.");
  };

  const resetAll = () => {
    const d = defaultAutoDispatchConfig();
    setCfg(d);
    saveAutoDispatchConfig(d);
    toast.success("Agenda restaurada ao padrão.");
  };

  // Simulação simples: quanto demoraria para enviar N mensagens
  const sample = (() => {
    const total = Math.min(cfg.maxPerDay, 50);
    const interval = Math.max(1, cfg.intervalSeconds);
    const batch = Math.max(1, cfg.batchSize);
    const pause = Math.max(0, cfg.batchPauseSeconds);
    const completed = Math.max(0, Math.floor((total - 1) / batch));
    const seconds = (total - 1) * interval + completed * pause;
    const mins = Math.round(seconds / 60);
    return { total, mins };
  })();

  return (
    <PageContainer>
      <SectionHeader
        title="Agenda de disparo automático"
        subtitle="Configure quando e com que ritmo as mensagens automáticas são enviadas. Você pode definir horários diferentes por valor de serviço."
      />

      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={cfg.enabled} onCheckedChange={(v) => update({ enabled: v })} />
            <div>
              <div className="text-sm font-semibold">Envio automático ativo</div>
              <div className="text-[11px] text-muted-foreground">
                Quando ligado, as mensagens são montadas e listadas no painel "Disparos automáticos hoje".
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={resetAll} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrão
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Horário padrão de início</Label>
            <Input
              type="time"
              value={cfg.sendHour}
              onChange={(e) => update({ sendHour: e.target.value })}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Intervalo entre mensagens (segundos)</Label>
            <Input
              type="number" min={5} max={3600}
              value={cfg.intervalSeconds}
              onChange={(e) => update({ intervalSeconds: Math.max(5, Number(e.target.value) || 5) })}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Máximo de envios por dia</Label>
            <Input
              type="number" min={1} max={500}
              value={cfg.maxPerDay}
              onChange={(e) => update({ maxPerDay: Math.max(1, Number(e.target.value) || 1) })}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mensagens por lote</Label>
            <Input
              type="number" min={1} max={100}
              value={cfg.batchSize}
              onChange={(e) => update({ batchSize: Math.max(1, Number(e.target.value) || 1) })}
              className="h-9"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Pausa entre lotes (segundos)</Label>
            <Input
              type="number" min={0} max={3600}
              value={cfg.batchPauseSeconds}
              onChange={(e) => update({ batchPauseSeconds: Math.max(0, Number(e.target.value) || 0) })}
              className="h-9"
            />
            <p className="text-[11px] text-muted-foreground">
              Ex.: 5 mensagens com 30s entre elas e depois pausa de 300s (5 min).
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Dias da semana permitidos</Label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => {
              const active = cfg.allowedDays.includes(d.k);
              return (
                <button
                  key={d.k} type="button"
                  onClick={() => toggleDay(d.k)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-md border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground flex items-start gap-2">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Estimativa: para enviar {sample.total} mensagens nas regras atuais leva cerca de{" "}
            <strong>{sample.mins} min</strong> a partir do horário de início.
          </span>
        </div>
      </Card>

      <Card className="mt-4 p-4 space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Horário de envio por serviço</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Aqui aparecem todos os serviços cadastrados (em <strong>Cadastros</strong>). Para cada
            serviço você pode escolher um horário próprio de envio — por exemplo, o plano de R$ 12
            sai às 09:00 e o de R$ 30 sai às 12:00. Quando deixar como{" "}
            <strong>Padrão</strong>, o serviço usa o horário padrão definido acima.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            A ordem de envio segue sempre a mesma regra do painel: primeiro os que estão{" "}
            <strong>perto de vencer</strong>, depois os que vencem <strong>hoje</strong> e por
            último os <strong>vencidos</strong> (quanto mais antigo o vencimento, mais ao fim da
            fila).
          </p>
        </div>

        <div className="rounded-md border bg-muted/20 p-3 space-y-2">
          <Label className="text-xs font-semibold">Aplicar o mesmo horário a todos os serviços</Label>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              type="time"
              value={bulkHour}
              onChange={(e) => setBulkHour(e.target.value)}
              className="h-9 w-[130px]"
            />
            <Button size="sm" onClick={() => applyHourToAllServices(bulkHour)} className="h-9 gap-1.5">
              <Save className="h-3.5 w-3.5" /> Aplicar a todos
            </Button>
            <Button size="sm" variant="outline" onClick={clearAllServiceHours} className="h-9 gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Voltar ao padrão
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Use quando quiser que <strong>todos os serviços</strong> sejam disparados no mesmo
            horário, mantendo a regra de fila (próximos do vencimento primeiro).
          </p>
        </div>

        {services.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground leading-relaxed">
            Nenhum serviço cadastrado ainda. Vá em <strong>Cadastros</strong> e crie seus planos
            para configurar um horário individual para cada um.
          </div>
        ) : (
          <div className="space-y-2">
            {services.map((s) => {
              const customHour = scheduleByCents.get(s.preco_cents);
              const isCustom = !!customHour;
              return (
                <div key={s.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold break-words">{s.nome}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {fmtBRLsvc(s.preco_cents)} · {s.telas} tela(s) · {s.meses} mês(es)
                      </div>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        isCustom
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {isCustom ? `Envia às ${customHour}` : `Padrão (${cfg.sendHour})`}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Horário deste serviço</Label>
                      <Input
                        type="time"
                        value={customHour ?? cfg.sendHour}
                        onChange={(e) => setServiceHour(s.preco_cents, e.target.value)}
                        className="h-9 w-[130px]"
                      />
                    </div>
                    {isCustom && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => clearServiceHour(s.preco_cents)}
                        className="h-9 gap-1 text-[11px]"
                      >
                        <Trash2 className="h-3 w-3" /> Usar padrão
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <p className="mt-4 mb-2 text-[11px] text-muted-foreground inline-flex items-start gap-1 leading-snug">
        <Save className="h-3 w-3 mt-0.5 shrink-0" />
        <span>
          Tudo é salvo automaticamente neste aparelho. Você pode alterar quantas vezes quiser — a
          próxima rodada de disparos já usa as novas configurações.
        </span>
      </p>
    </PageContainer>
  );
}
