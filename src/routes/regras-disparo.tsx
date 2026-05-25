import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Settings2, Pencil, Power, Download, Upload, RotateCcw, Play, Info, Save, X, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

import {
  listRules, upsertRule, restoreDefaultRules, buildBackup, parseBackup, mergeRules,
  saveRules, getLimits, saveLimits, restoreDefaultLimits,
  pickRule, applyTemplate, ALLOWED_VARIABLES,
  RULE_TYPE_LABEL, RULE_PRIORITY_LABEL, RULE_TONE_LABEL,
  type ManualDispatchRule, type RuleType, type RulePriority, type RuleTone,
  type DispatchLimits,
} from "@/lib/manual-dispatch-rules";

export const Route = createFileRoute("/regras-disparo")({
  component: RegrasDisparoPage,
});

function todayStamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function dayLabel(off: number): string {
  if (off === 0) return "D0";
  if (off < 0) return `D${off}`;
  return `D+${off}`;
}

function RuleEditorSheet({
  rule, open, onClose, onSaved,
}: {
  rule: ManualDispatchRule | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<ManualDispatchRule | null>(rule);
  useEffect(() => setDraft(rule), [rule]);

  if (!draft) return null;

  const update = <K extends keyof ManualDispatchRule>(k: K, v: ManualDispatchRule[K]) =>
    setDraft({ ...draft, [k]: v });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar regra</SheetTitle>
          <SheetDescription>
            Edição local. Nada é enviado automaticamente.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4 pb-6">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={draft.name} onChange={(e) => update("name", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Dias relativos</Label>
              <Input
                type="number"
                value={draft.daysOffset}
                onChange={(e) => update("daysOffset", parseInt(e.target.value || "0", 10))}
              />
              <p className="text-[11px] text-muted-foreground">
                Negativo = antes do vencimento. Atual: {dayLabel(draft.daysOffset)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Ativa</Label>
              <Button
                type="button"
                variant={draft.active ? "default" : "outline"}
                className="w-full"
                onClick={() => update("active", !draft.active)}
              >
                <Power className="mr-2 h-4 w-4" />
                {draft.active ? "Ativa" : "Inativa"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <select
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={draft.type}
                onChange={(e) => update("type", e.target.value as RuleType)}
              >
                {Object.entries(RULE_TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <select
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={draft.priority}
                onChange={(e) => update("priority", e.target.value as RulePriority)}
              >
                {Object.entries(RULE_PRIORITY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Tom</Label>
              <select
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={draft.tone}
                onChange={(e) => update("tone", e.target.value as RuleTone)}
              >
                {Object.entries(RULE_TONE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Mensagem</Label>
            <Textarea
              rows={6}
              value={draft.template}
              onChange={(e) => update("template", e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5">
              {ALLOWED_VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  className="rounded-md border bg-muted/40 px-2 py-0.5 text-[11px] hover:bg-muted"
                  onClick={() => update("template", `${draft.template}${v}`)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium">Bloqueios desta regra</p>
            <ToggleRow
              label="Bloquear se sem WhatsApp"
              value={draft.blockNoWhatsapp}
              onChange={(v) => update("blockNoWhatsapp", v)}
            />
            <ToggleRow
              label="Bloquear se sem vencimento"
              value={draft.blockNoDue}
              onChange={(v) => update("blockNoDue", v)}
            />
            <ToggleRow
              label="Bloquear duplicado"
              value={draft.blockDuplicate}
              onChange={(v) => update("blockDuplicate", v)}
            />
            <ToggleRow
              label="Lista vencida 30+ vira recuperação (ignora app)"
              value={draft.recoveryOverApp}
              onChange={(v) => update("recoveryOverApp", v)}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              <X className="mr-2 h-4 w-4" /> Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                upsertRule(draft);
                toast.success("Regra salva localmente");
                onSaved();
                onClose();
              }}
            >
              <Save className="mr-2 h-4 w-4" /> Salvar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void; }) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm"
      onClick={() => onChange(!value)}
    >
      <span className="text-left">{label}</span>
      <span className={cn(
        "rounded-full px-2 py-0.5 text-[11px]",
        value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      )}>{value ? "ativo" : "inativo"}</span>
    </button>
  );
}

function RegrasDisparoPage() {
  const [rules, setRules] = useState<ManualDispatchRule[]>(() => listRules());
  const [limits, setLimits] = useState<DispatchLimits>(() => getLimits());
  const [editing, setEditing] = useState<ManualDispatchRule | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<{ rules: ManualDispatchRule[] } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const refresh = () => setRules(listRules());

  const handleToggle = (r: ManualDispatchRule) => {
    upsertRule({ ...r, active: !r.active });
    refresh();
  };

  const handleExport = () => {
    const backup = buildBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `regras-disparo-cobranca-ia-${todayStamp()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Regras exportadas (somente local).");
  };

  const handleImportFile = async (f: File) => {
    try {
      const text = await f.text();
      const b = parseBackup(text);
      setImportPreview({ rules: b.rules });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Arquivo inválido");
    }
  };

  const applyImport = (mode: "merge" | "replace") => {
    if (!importPreview) return;
    const next = mode === "replace" ? importPreview.rules : mergeRules(rules, importPreview.rules);
    saveRules(next);
    refresh();
    setImportPreview(null);
    toast.success(`Regras ${mode === "replace" ? "substituídas" : "mescladas"} (local).`);
  };

  return (
    <PageContainer>
      <SectionHeader
        title="Regras de disparo"
        subtitle="Configure quando o sistema deve sugerir mensagens manuais de cobrança."
        hint="As regras ficam salvas apenas neste navegador."
      />

      <Card className="mb-3 border-amber-300/40 bg-amber-50/40 p-3 text-xs text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Essas regras apenas criam <strong>sugestões</strong>. Nenhuma mensagem será enviada automaticamente.</p>
        </div>
      </Card>

      <div className="mb-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={handleExport}>
          <Download className="mr-1.5 h-4 w-4" /> Exportar
        </Button>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-1.5 h-4 w-4" /> Importar
        </Button>
        <Button size="sm" variant="outline" onClick={() => setRestoreOpen(true)}>
          <RotateCcw className="mr-1.5 h-4 w-4" /> Restaurar padrão
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImportFile(f);
            e.target.value = "";
          }}
        />
      </div>

      <div className="space-y-2">
        {rules.sort((a, b) => a.daysOffset - b.daysOffset).map((r) => (
          <Card key={r.id} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md border bg-muted/40 px-1.5 py-0.5 text-[11px] font-mono">
                    {dayLabel(r.daysOffset)}
                  </span>
                  <span className="truncate text-sm font-medium">{r.name}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                  <span>{RULE_TYPE_LABEL[r.type]}</span>
                  <span>·</span>
                  <span>{RULE_PRIORITY_LABEL[r.priority]}</span>
                  <span>·</span>
                  <span>{RULE_TONE_LABEL[r.tone]}</span>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant={r.active ? "default" : "outline"}
                  onClick={() => handleToggle(r)}
                >
                  <Power className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(r)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6">
        <SectionHeader title="Simular regras" subtitle="Veja qual mensagem seria sugerida sem salvar nada." />
        <SimulatorBlock rules={rules} />
      </div>

      <div className="mt-6">
        <SectionHeader title="Limites de operação manual" subtitle="Apenas avisos visuais — nada bloqueia o envio real." />
        <LimitsBlock
          value={limits}
          onChange={(l) => { setLimits(l); saveLimits(l); }}
          onRestore={() => { const d = restoreDefaultLimits(); setLimits(d); }}
        />
      </div>

      <RuleEditorSheet
        rule={editing}
        open={!!editing}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />

      <AlertDialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar regras padrão?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as edições locais serão substituídas pelas 10 regras padrão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setRules(restoreDefaultRules()); toast.success("Padrão restaurado"); }}>
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!importPreview} onOpenChange={(o) => !o && setImportPreview(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Importar regras</AlertDialogTitle>
            <AlertDialogDescription>
              Encontradas {importPreview?.rules.length ?? 0} regras no arquivo. Escolha como aplicar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="outline" onClick={() => applyImport("merge")}>Mesclar</Button>
            <AlertDialogAction onClick={() => applyImport("replace")}>Substituir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

function SimulatorBlock({ rules }: { rules: ManualDispatchRule[] }) {
  const [name, setName] = useState("Maria Exemplo");
  const [due, setDue] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 0);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  });
  const [valor, setValor] = useState("49,90");
  const [hasWa, setHasWa] = useState(true);
  const [dup, setDup] = useState(false);

  const result = useMemo(() => {
    const blocks: string[] = [];
    if (!hasWa) blocks.push("Sem WhatsApp");
    if (!due) blocks.push("Sem vencimento");
    if (dup) blocks.push("Duplicado");

    const dueDate = new Date(due + "T00:00:00");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Math.floor((+dueDate - +today) / 86400000);

    if (blocks.length > 0) {
      return { blocked: true, reason: blocks.join(" · "), rule: null as ManualDispatchRule | null, days, message: "" };
    }
    const rule = pickRule(days, rules);
    if (!rule) return { blocked: true, reason: "Nenhuma regra ativa cobre este caso", rule: null, days, message: "" };
    const message = applyTemplate(rule.template, {
      nome: name,
      vencimento: dueDate.toLocaleDateString("pt-BR"),
      dias: Math.abs(days),
      valor: `R$ ${valor}`,
    });
    return { blocked: false, reason: "", rule, days, message };
  }, [name, due, valor, hasWa, dup, rules]);

  return (
    <Card className="space-y-3 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Vencimento</Label>
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Valor</Label>
          <Input value={valor} onChange={(e) => setValor(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant={hasWa ? "default" : "outline"} onClick={() => setHasWa((v) => !v)}>
            WhatsApp: {hasWa ? "sim" : "não"}
          </Button>
          <Button variant={dup ? "default" : "outline"} onClick={() => setDup((v) => !v)}>
            Duplicado: {dup ? "sim" : "não"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        {result.blocked ? (
          <div className="flex items-start gap-2 text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <div>
              <p className="font-medium">Bloqueado</p>
              <p className="text-xs text-muted-foreground">{result.reason}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              Dias até vencimento: {result.days} · Regra: <strong>{result.rule?.name}</strong> ·
              Prioridade: {result.rule ? RULE_PRIORITY_LABEL[result.rule.priority] : "—"}
            </p>
            <pre className="whitespace-pre-wrap rounded-md border bg-background p-2 text-xs">
              {result.message}
            </pre>
          </div>
        )}
      </div>
    </Card>
  );
}

function LimitsBlock({
  value, onChange, onRestore,
}: {
  value: DispatchLimits;
  onChange: (v: DispatchLimits) => void;
  onRestore: () => void;
}) {
  const days: { k: DispatchLimits["allowedDays"][number]; label: string }[] = [
    { k: "dom", label: "Dom" }, { k: "seg", label: "Seg" }, { k: "ter", label: "Ter" },
    { k: "qua", label: "Qua" }, { k: "qui", label: "Qui" }, { k: "sex", label: "Sex" }, { k: "sab", label: "Sáb" },
  ];
  return (
    <Card className="space-y-3 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Máx. mensagens por dia</Label>
          <Input
            type="number"
            value={value.maxCopiesPerDay}
            onChange={(e) => onChange({ ...value, maxCopiesPerDay: parseInt(e.target.value || "0", 10) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Início recomendado</Label>
          <Input type="time" value={value.startHour} onChange={(e) => onChange({ ...value, startHour: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Fim recomendado</Label>
          <Input type="time" value={value.endHour} onChange={(e) => onChange({ ...value, endHour: e.target.value })} />
        </div>
      </div>

      <ToggleRow
        label="Evitar repetir mensagem no mesmo dia"
        value={value.avoidRepeatSameDay}
        onChange={(v) => onChange({ ...value, avoidRepeatSameDay: v })}
      />
      <ToggleRow
        label="Mostrar aviso se cliente já foi copiado hoje"
        value={value.warnIfCopiedToday}
        onChange={(v) => onChange({ ...value, warnIfCopiedToday: v })}
      />

      <div className="space-y-1.5">
        <Label>Dias permitidos para lembrete</Label>
        <div className="flex flex-wrap gap-1.5">
          {days.map((d) => {
            const on = value.allowedDays.includes(d.k);
            return (
              <button
                key={d.k}
                type="button"
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs",
                  on ? "bg-primary text-primary-foreground" : "bg-background"
                )}
                onClick={() =>
                  onChange({
                    ...value,
                    allowedDays: on
                      ? value.allowedDays.filter((x) => x !== d.k)
                      : [...value.allowedDays, d.k],
                  })
                }
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Button size="sm" variant="outline" onClick={onRestore}>
          <RotateCcw className="mr-1.5 h-4 w-4" /> Restaurar limites padrão
        </Button>
      </div>
    </Card>
  );
}
