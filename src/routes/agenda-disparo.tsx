import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, Save, Trash2, Plus, RotateCcw, Info } from "lucide-react";
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

export const Route = createFileRoute("/agenda-disparo")({
  component: AgendaDisparoPage,
});

const DAYS = [
  { k: "dom", label: "Dom" }, { k: "seg", label: "Seg" }, { k: "ter", label: "Ter" },
  { k: "qua", label: "Qua" }, { k: "qui", label: "Qui" }, { k: "sex", label: "Sex" },
  { k: "sab", label: "Sáb" },
] as const;

function fmtBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function AgendaDisparoPage() {
  const [cfg, setCfg] = useState<AutoDispatchConfig>(() => getAutoDispatchConfig());
  const [newAmount, setNewAmount] = useState<string>("");
  const [newHour, setNewHour] = useState<string>("09:00");

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

  const addAmountSchedule = () => {
    const raw = newAmount.replace(",", ".").trim();
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Informe um valor em reais válido (ex: 12 ou 29,90).");
      return;
    }
    const cents = Math.round(value * 100);
    if (cfg.amountSchedules.some((a) => a.amountCents === cents)) {
      toast.error("Já existe um horário para esse valor.");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(newHour)) {
      toast.error("Horário inválido.");
      return;
    }
    const next: AmountSchedule[] = [...cfg.amountSchedules, { amountCents: cents, sendHour: newHour }]
      .sort((a, b) => a.amountCents - b.amountCents);
    update({ amountSchedules: next });
    setNewAmount("");
    toast.success(`Horário customizado adicionado para ${fmtBRL(cents)}.`);
  };

  const updateAmountHour = (cents: number, hour: string) => {
    update({
      amountSchedules: cfg.amountSchedules.map((a) =>
        a.amountCents === cents ? { ...a, sendHour: hour } : a,
      ),
    });
  };

  const removeAmount = (cents: number) => {
    update({ amountSchedules: cfg.amountSchedules.filter((a) => a.amountCents !== cents) });
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
        icon={Clock}
        title="Agenda de disparo automático"
        description="Configure quando e com que ritmo as mensagens automáticas são enviadas. Você pode definir horários diferentes por valor de serviço."
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

      <Card className="mt-4 p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Horário por valor de serviço</h3>
          <p className="text-[11px] text-muted-foreground">
            Quando o valor do cliente bater exatamente com um da lista, o disparo usa esse horário em vez do padrão.
            Ex.: serviços de R$ 12,00 enviam às 09:00; serviços de R$ 30,00 enviam às 12:00.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/20 p-3">
          <div className="space-y-1">
            <Label className="text-xs">Valor (R$)</Label>
            <Input
              type="text" inputMode="decimal" placeholder="12,00"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              className="h-9 w-[120px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Horário</Label>
            <Input
              type="time"
              value={newHour}
              onChange={(e) => setNewHour(e.target.value)}
              className="h-9 w-[120px]"
            />
          </div>
          <Button size="sm" onClick={addAmountSchedule} className="gap-1.5 h-9">
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>

        {cfg.amountSchedules.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            Nenhum horário customizado. Todos os clientes seguem o horário padrão.
          </div>
        ) : (
          <div className="space-y-2">
            {cfg.amountSchedules.map((a) => (
              <div key={a.amountCents} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
                <div className="text-sm font-semibold">{fmtBRL(a.amountCents)}</div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Enviar às</Label>
                  <Input
                    type="time"
                    value={a.sendHour}
                    onChange={(e) => updateAmountHour(a.amountCents, e.target.value)}
                    className="h-8 w-[110px]"
                  />
                  <Button
                    size="sm" variant="outline"
                    onClick={() => removeAmount(a.amountCents)}
                    className="h-8 gap-1 text-[11px]"
                  >
                    <Trash2 className="h-3 w-3" /> Remover
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <p className="mt-4 text-[11px] text-muted-foreground inline-flex items-center gap-1">
        <Save className="h-3 w-3" /> As alterações são salvas automaticamente neste dispositivo.
      </p>
    </PageContainer>
  );
}
