import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Plus, Trash2, Download, Upload, Copy, Target, Calculator,
  TrendingUp, Receipt, Settings as SettingsIcon, Info,
} from "lucide-react";

import { PageContainer } from "@/components/layout/PageContainer";
import { CompanyScopeNotice } from "@/components/companies/CompanyScopeNotice";
import { PlanLimitNotice } from "@/components/companies/PlanLimitNotice";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

import {
  type FinanceEntry, type FinanceGoal, type EntryType, type PaymentMethod,
  type FinanceDraft,
  listFinanceEntries, saveFinanceEntry, deleteFinanceEntry,
  listFinanceGoals, saveFinanceGoal, updateFinanceGoal, deleteFinanceGoal,
  getFinanceSettings, saveFinanceSettings, upsertServerCost, upsertAppCost,
  calculateFinanceSummary, filterEntriesByMonth, filterEntriesToday,
  simulateRenewalFinance, exportFinanceData, importFinanceData,
  consumeFinanceDraft, formatBRL, buildSummaryText, todayDate,
  ENTRY_TYPE_LABEL, METHOD_LABEL, FINANCE_EVENT, FINANCE_DRAFT_EVENT,
} from "@/lib/financeiro-local";
import { listServers, listActiveServers } from "@/lib/server-catalog";
import { APP_CATALOG, APP_OPTIONS } from "@/lib/app-screens";
import { useSecurityGuard } from "@/components/security/PinConfirmDialog";
import { ProtectedModeBadge } from "@/components/security/ProtectedModeBadge";
import { FinanceDashboard } from "@/components/financeiro/FinanceDashboard";


export const Route = createFileRoute("/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Cobrança IA" },
      { name: "description", content: "Controle local de receitas, custos, lucro e objetivos." },
    ],
  }),
  component: FinanceiroPage,
});

type Period = "mes" | "hoje" | "tudo";

function FinanceiroPage() {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [goals, setGoals] = useState<FinanceGoal[]>([]);
  const [settings, setSettings] = useState(getFinanceSettings());
  const [period, setPeriod] = useState<Period>("mes");
  const [typeFilter, setTypeFilter] = useState<EntryType | "todos">("todos");
  const [entryDraft, setEntryDraft] = useState<FinanceDraft | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { guard, dialog: securityDialog } = useSecurityGuard();

  const reload = useCallback(() => {
    setEntries(listFinanceEntries());
    setGoals(listFinanceGoals());
    setSettings(getFinanceSettings());
  }, []);

  useEffect(() => {
    reload();
    const onChange = () => reload();
    const onDraft = () => {
      const d = consumeFinanceDraft();
      if (d) setEntryDraft(d);
    };
    window.addEventListener(FINANCE_EVENT, onChange);
    window.addEventListener(FINANCE_DRAFT_EVENT, onDraft);
    // also consume on mount (deep link from another screen)
    const d = consumeFinanceDraft();
    if (d) setEntryDraft(d);
    return () => {
      window.removeEventListener(FINANCE_EVENT, onChange);
      window.removeEventListener(FINANCE_DRAFT_EVENT, onDraft);
    };
  }, [reload]);

  const filtered = useMemo(() => {
    let list = entries;
    if (period === "mes") list = filterEntriesByMonth(list);
    else if (period === "hoje") list = filterEntriesToday(list);
    if (typeFilter !== "todos") list = list.filter((e) => e.type === typeFilter);
    return list;
  }, [entries, period, typeFilter]);

  const summary = useMemo(() => calculateFinanceSummary(filtered), [filtered]);
  const mainGoal = useMemo(() => goals.find((g) => g.id === settings.default_goal_id) ?? goals.find((g) => g.status === "ativo"), [goals, settings.default_goal_id]);

  const handleCopySummary = () => {
    const text = buildSummaryText(summary, mainGoal);
    navigator.clipboard.writeText(text).then(() => toast.success("Resumo copiado"));
  };

  return (
    <PageContainer>
      <div className="mb-1"><ProtectedModeBadge /></div>
      <SectionHeader
        title="Financeiro"
        subtitle="Controle receitas, custos, lucro e objetivos do seu negócio."
      />

      <CompanyScopeNotice moduleKey="cobranca_ia_finance_entries_v1" />
      <PlanLimitNotice moduleKey="financeiro" action="usar" />


      <Card className="p-3 border-dashed bg-muted/30 mb-4 flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">
          Controle local: esses dados ficam neste navegador até existir persistência no servidor. Nenhum pagamento real é feito aqui.
        </p>
      </Card>

      <FinanceDashboard />


      {/* Period filter */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="mes">Este mês</SelectItem>
            <SelectItem value="tudo">Tudo</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleCopySummary}>
          <Copy className="h-4 w-4 mr-1" /> Copiar resumo
        </Button>
        <Button size="sm" onClick={() => setEntryDraft({})}>
          <Plus className="h-4 w-4 mr-1" /> Nova entrada
        </Button>
      </div>

      <SummaryCards summary={summary} />

      <Tabs defaultValue="entradas" className="mt-6">
        <TabsList className="w-full overflow-x-auto flex justify-start gap-1">
          <TabsTrigger value="entradas"><Receipt className="h-4 w-4 mr-1" />Entradas</TabsTrigger>
          <TabsTrigger value="custos"><SettingsIcon className="h-4 w-4 mr-1" />Custos</TabsTrigger>
          <TabsTrigger value="objetivos"><Target className="h-4 w-4 mr-1" />Objetivos</TabsTrigger>
          <TabsTrigger value="simulador"><Calculator className="h-4 w-4 mr-1" />Simulador</TabsTrigger>
          <TabsTrigger value="graficos"><TrendingUp className="h-4 w-4 mr-1" />Gráficos</TabsTrigger>
          <TabsTrigger value="export"><Download className="h-4 w-4 mr-1" />Backup</TabsTrigger>
        </TabsList>

        <TabsContent value="entradas" className="mt-4">
          <EntriesList
            entries={filtered}
            typeFilter={typeFilter}
            onTypeChange={setTypeFilter}
            onDelete={(id) => setDeleteId(id)}
          />
        </TabsContent>

        <TabsContent value="custos" className="mt-4">
          <CostsSettings settings={settings} onChange={(p) => { saveFinanceSettings(p); reload(); }} />
        </TabsContent>

        <TabsContent value="objetivos" className="mt-4">
          <GoalsSection goals={goals} settings={settings} onReload={reload} />
        </TabsContent>

        <TabsContent value="simulador" className="mt-4">
          <SimulatorSection goals={goals} />
        </TabsContent>

        <TabsContent value="graficos" className="mt-4">
          <ChartsSection summary={summary} goals={goals} />
        </TabsContent>

        <TabsContent value="export" className="mt-4">
          <ExportImportSection summary={summary} mainGoal={mainGoal} onReload={reload} />
        </TabsContent>
      </Tabs>

      {entryDraft && (
        <EntrySheet
          draft={entryDraft}
          goals={goals}
          onClose={() => setEntryDraft(null)}
          onSaved={() => { setEntryDraft(null); reload(); toast.success("Entrada registrada"); }}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir entrada?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita. A entrada será removida deste navegador.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (!deleteId) return;
              const id = deleteId;
              setDeleteId(null);
              guard({
                kind: "delete",
                title: "Excluir entrada financeira",
                description: "Esta ação não pode ser desfeita.",
                actionLabel: "Excluir",
                onConfirm: () => { deleteFinanceEntry(id); reload(); toast.success("Entrada excluída"); },
              });
            }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {securityDialog}
    </PageContainer>
  );
}

// ---------- Summary cards ----------
function StatBox({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("text-xl sm:text-2xl font-semibold mt-0.5", accent)}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </Card>
  );
}

function SummaryCards({ summary }: { summary: ReturnType<typeof calculateFinanceSummary> }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <StatBox label="Receita" value={formatBRL(summary.revenue)} />
      <StatBox label="Custos" value={formatBRL(summary.costs)} accent="text-destructive" />
      <StatBox label="Reservado" value={formatBRL(summary.reserve)} accent="text-amber-600 dark:text-amber-400" />
      <StatBox label="Lucro líquido" value={formatBRL(summary.net_profit)} accent="text-emerald-600 dark:text-emerald-400" hint={`Margem ${summary.margin_pct.toFixed(1)}%`} />
      <StatBox label="Renovações" value={String(summary.count_renewals)} />
      <StatBox label="Apps renovados" value={String(summary.count_apps)} />
      <StatBox label="Vendas novas" value={String(summary.count_new_sales)} />
      <StatBox label="Total entradas" value={String(summary.count_total)} />
    </div>
  );
}

// ---------- Entries list ----------
function EntriesList({
  entries, typeFilter, onTypeChange, onDelete,
}: {
  entries: FinanceEntry[];
  typeFilter: EntryType | "todos";
  onTypeChange: (v: EntryType | "todos") => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <Select value={typeFilter} onValueChange={(v) => onTypeChange(v as EntryType | "todos")}>
        <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os tipos</SelectItem>
          {(Object.keys(ENTRY_TYPE_LABEL) as EntryType[]).map((k) => (
            <SelectItem key={k} value={k}>{ENTRY_TYPE_LABEL[k]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {entries.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhuma entrada no período. Use “Nova entrada” para registrar.
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <Card key={e.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{e.customer_name || "Sem cliente"}</span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{ENTRY_TYPE_LABEL[e.type]}</span>
                    <span className="text-[11px] text-muted-foreground">{e.date}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {[e.screen_label, e.app_label].filter(Boolean).join(" • ") || "—"}
                  </div>
                  <div className="text-xs mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>Recebido: <strong>{formatBRL(e.amount_received)}</strong></span>
                    <span className="text-muted-foreground">Custos: {formatBRL(e.cost_screen + e.cost_server + e.cost_app + e.cost_fixed)}</span>
                    <span className="text-amber-600 dark:text-amber-400">Reserva: {formatBRL(e.reserve)}</span>
                    <span className="text-emerald-600 dark:text-emerald-400">Lucro: {formatBRL(e.net_profit)}</span>
                    <span className="text-muted-foreground">{METHOD_LABEL[e.method]}</span>
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => onDelete(e.id)} aria-label="Excluir">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Costs settings ----------
function CostsSettings({ settings, onChange }: { settings: ReturnType<typeof getFinanceSettings>; onChange: (p: Partial<ReturnType<typeof getFinanceSettings>>) => void }) {
  const servers = listServers();
  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <h3 className="font-medium text-sm">Custos do negócio</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Custo padrão por tela/lista (R$)</Label>
            <Input type="number" step="0.01" defaultValue={settings.default_screen_cost} onBlur={(e) => onChange({ default_screen_cost: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <Label className="text-xs">Custo fixo mensal (R$)</Label>
            <Input type="number" step="0.01" defaultValue={settings.monthly_fixed_cost} onBlur={(e) => onChange({ monthly_fixed_cost: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <Label className="text-xs">Modo de reserva</Label>
            <Select value={settings.reserve_mode} onValueChange={(v) => onChange({ reserve_mode: v as "percentual" | "valor_fixo" | "desativado" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentual">Percentual (%)</SelectItem>
                <SelectItem value="valor_fixo">Valor fixo (R$)</SelectItem>
                <SelectItem value="desativado">Desativado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Reserva padrão</Label>
            <Input type="number" step="0.01" defaultValue={settings.reserve_value} onBlur={(e) => onChange({ reserve_value: Number(e.target.value) || 0 })} />
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-medium text-sm">Custo por servidor</h3>
        {servers.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum servidor cadastrado. Vá em Servidores para criar.</p>
        ) : servers.map((s) => {
          const c = settings.servers.find((x) => x.server_id === s.id);
          return (
            <div key={s.id} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end border-b last:border-0 pb-2">
              <div className="text-sm font-medium" style={{ color: s.color }}>{s.name}</div>
              <div>
                <Label className="text-xs">Custo mensal (R$)</Label>
                <Input type="number" step="0.01" defaultValue={c?.monthly ?? 0}
                  onBlur={(e) => upsertServerCost({ server_id: s.id, monthly: Number(e.target.value) || 0, per_screen: c?.per_screen ?? 0, notes: c?.notes })} />
              </div>
              <div>
                <Label className="text-xs">Custo por tela (R$)</Label>
                <Input type="number" step="0.01" defaultValue={c?.per_screen ?? 0}
                  onBlur={(e) => upsertServerCost({ server_id: s.id, monthly: c?.monthly ?? 0, per_screen: Number(e.target.value) || 0, notes: c?.notes })} />
              </div>
            </div>
          );
        })}
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-medium text-sm">Custo por app pago</h3>
        {APP_OPTIONS.map((appKey) => {
          const meta = APP_CATALOG[appKey];
          if (meta.tier !== "pago") return null;
          const c = settings.apps.find((a) => a.app_key === appKey);
          return (
            <div key={appKey} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end border-b last:border-0 pb-2">
              <div className="text-sm font-medium">{meta.label}</div>
              <div>
                <Label className="text-xs">Licença (R$)</Label>
                <Input type="number" step="0.01" defaultValue={c?.license_cost ?? 0}
                  onBlur={(e) => upsertAppCost({ app_key: appKey, license_cost: Number(e.target.value) || 0, suggested_price: c?.suggested_price ?? 0 })} />
              </div>
              <div>
                <Label className="text-xs">Preço sugerido (R$)</Label>
                <Input type="number" step="0.01" defaultValue={c?.suggested_price ?? 0}
                  onBlur={(e) => upsertAppCost({ app_key: appKey, license_cost: c?.license_cost ?? 0, suggested_price: Number(e.target.value) || 0 })} />
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// ---------- Goals ----------
function GoalsSection({ goals, settings, onReload }: { goals: FinanceGoal[]; settings: ReturnType<typeof getFinanceSettings>; onReload: () => void }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState<number>(0);
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const { guard, dialog: securityDialog } = useSecurityGuard();

  const create = () => {
    if (!name || target <= 0) { toast.error("Informe nome e valor alvo"); return; }
    saveFinanceGoal({ name, target, deadline: deadline || undefined, description, status: "ativo" });
    setName(""); setTarget(0); setDeadline(""); setDescription(""); setCreating(false);
    onReload();
    toast.success("Objetivo criado");
  };


  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Objetivos & conquistas</h3>
        <Button size="sm" onClick={() => setCreating((v) => !v)}>
          <Plus className="h-4 w-4 mr-1" /> Novo objetivo
        </Button>
      </div>

      {creating && (
        <Card className="p-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><Label className="text-xs">Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Comprar painel" /></div>
            <div><Label className="text-xs">Valor alvo (R$)</Label><Input type="number" step="0.01" value={target} onChange={(e) => setTarget(Number(e.target.value))} /></div>
            <div><Label className="text-xs">Prazo</Label><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
            <div className="sm:col-span-2"><Label className="text-xs">Descrição</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          </div>
          <div className="flex gap-2"><Button size="sm" onClick={create}>Criar</Button><Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button></div>
        </Card>
      )}

      {goals.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum objetivo criado.</Card>
      ) : goals.map((g) => {
        const pct = g.target > 0 ? Math.min(100, (g.reserved / g.target) * 100) : 0;
        const missing = Math.max(0, g.target - g.reserved);
        const isDefault = settings.default_goal_id === g.id;
        return (
          <Card key={g.id} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{g.name}</span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted">{g.status}</span>
                  {isDefault && <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">Padrão</span>}
                </div>
                {g.description && <p className="text-xs text-muted-foreground mt-0.5">{g.description}</p>}
                <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3">
                  <span>{formatBRL(g.reserved)} / {formatBRL(g.target)}</span>
                  <span>Falta {formatBRL(missing)}</span>
                  {g.deadline && <span>Prazo: {g.deadline}</span>}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Button size="sm" variant="ghost" onClick={() => guard({
                  kind: "finance",
                  title: isDefault ? "Remover objetivo padrão" : "Tornar objetivo padrão",
                  description: "Isso altera a separação automática da reserva.",
                  actionLabel: "Confirmar",
                  onConfirm: () => { saveFinanceSettings({ default_goal_id: isDefault ? undefined : g.id }); onReload(); },
                })}>
                  {isDefault ? "Remover padrão" : "Tornar padrão"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => guard({
                  kind: "finance",
                  title: g.status === "pausado" ? "Retomar objetivo" : "Pausar objetivo",
                  actionLabel: "Confirmar",
                  onConfirm: () => { updateFinanceGoal(g.id, { status: g.status === "pausado" ? "ativo" : "pausado" }); onReload(); },
                })}>
                  {g.status === "pausado" ? "Retomar" : "Pausar"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => guard({
                  kind: "delete",
                  title: `Excluir objetivo "${g.name}"?`,
                  description: "Esta ação não pode ser desfeita.",
                  actionLabel: "Excluir",
                  onConfirm: () => { deleteFinanceGoal(g.id); onReload(); toast.success("Objetivo excluído"); },
                })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

            </div>
          </Card>
        );
      })}
      {securityDialog}
    </div>
  );

}

// ---------- Simulator ----------
function SimulatorSection({ goals }: { goals: FinanceGoal[] }) {
  const servers = listActiveServers();
  const [amount, setAmount] = useState<number>(30);
  const [screens, setScreens] = useState<number>(1);
  const [serverId, setServerId] = useState<string>("none");
  const [appKey, setAppKey] = useState<string>("none");
  const [renewApp, setRenewApp] = useState(false);
  const [goalId, setGoalId] = useState<string>("default");

  const result = useMemo(() => simulateRenewalFinance({
    amount, screens,
    server_ids: serverId !== "none" ? [serverId] : [],
    app_key: appKey !== "none" ? appKey : undefined,
    renew_app: renewApp,
    goal_id: goalId !== "default" ? goalId : undefined,
  }), [amount, screens, serverId, appKey, renewApp, goalId]);

  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-medium text-sm">Simulador de renovação</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label className="text-xs">Valor recebido (R$)</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
        <div><Label className="text-xs">Quantidade de telas</Label><Input type="number" min={1} value={screens} onChange={(e) => setScreens(Number(e.target.value) || 1)} /></div>
        <div>
          <Label className="text-xs">Servidor</Label>
          <Select value={serverId} onValueChange={setServerId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {servers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">App</Label>
          <Select value={appKey} onValueChange={setAppKey}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {APP_OPTIONS.filter((k) => APP_CATALOG[k].tier === "pago").map((k) => <SelectItem key={k} value={k}>{APP_CATALOG[k].label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2"><input id="renewApp" type="checkbox" checked={renewApp} onChange={(e) => setRenewApp(e.target.checked)} /><Label htmlFor="renewApp" className="text-xs">Renovar app pago?</Label></div>
        <div>
          <Label className="text-xs">Objetivo</Label>
          <Select value={goalId} onValueChange={setGoalId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Padrão das configurações</SelectItem>
              {goals.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-2 rounded-md border p-3 bg-muted/30 text-sm space-y-1">
        <div className="flex justify-between"><span>Valor recebido</span><strong>{formatBRL(result.amount)}</strong></div>
        <div className="flex justify-between text-muted-foreground"><span>Custo lista</span><span>{formatBRL(result.cost_screen)}</span></div>
        <div className="flex justify-between text-muted-foreground"><span>Custo servidor</span><span>{formatBRL(result.cost_server)}</span></div>
        <div className="flex justify-between text-muted-foreground"><span>Custo app</span><span>{formatBRL(result.cost_app)}</span></div>
        <div className="flex justify-between text-amber-600 dark:text-amber-400"><span>Reserva objetivo</span><span>{formatBRL(result.reserve)}</span></div>
        <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold"><span>Lucro líquido</span><span>{formatBRL(result.net_profit)}</span></div>
        {result.renewals_needed_for_goal != null && (
          <p className="text-xs text-muted-foreground pt-1">Você precisa de aproximadamente <strong>{result.renewals_needed_for_goal}</strong> renovações iguais para bater o objetivo.</p>
        )}
      </div>
    </Card>
  );
}

// ---------- Charts (simple CSS bars) ----------
function ChartsSection({ summary, goals }: { summary: ReturnType<typeof calculateFinanceSummary>; goals: FinanceGoal[] }) {
  const max1 = Math.max(summary.revenue, summary.costs, summary.net_profit, 1);
  const bars = [
    { label: "Receita", value: summary.revenue, color: "bg-emerald-500" },
    { label: "Custos", value: summary.costs, color: "bg-rose-500" },
    { label: "Lucro", value: summary.net_profit, color: "bg-primary" },
  ];
  const costParts = [
    { label: "Lista/Tela", value: summary.by_cost.screen, color: "bg-sky-500" },
    { label: "Servidores", value: summary.by_cost.server, color: "bg-indigo-500" },
    { label: "Apps", value: summary.by_cost.app, color: "bg-violet-500" },
    { label: "Fixo", value: summary.by_cost.fixed, color: "bg-slate-500" },
  ];
  const totalCosts = Math.max(1, costParts.reduce((a, b) => a + b.value, 0));
  const typeRows = (Object.keys(summary.by_type) as Array<keyof typeof summary.by_type>).filter((k) => summary.by_type[k].amount > 0);
  const maxType = Math.max(1, ...typeRows.map((k) => summary.by_type[k].amount));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Card className="p-4">
        <h4 className="text-sm font-medium mb-3">Receita x Custos x Lucro</h4>
        <div className="space-y-2">
          {bars.map((b) => (
            <div key={b.label}>
              <div className="flex justify-between text-xs"><span>{b.label}</span><span>{formatBRL(b.value)}</span></div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className={cn("h-full", b.color)} style={{ width: `${Math.max(0, (b.value / max1) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h4 className="text-sm font-medium mb-3">Distribuição de custos</h4>
        <div className="flex h-3 rounded-full overflow-hidden bg-muted">
          {costParts.map((p) => (
            <div key={p.label} className={cn("h-full", p.color)} style={{ width: `${(p.value / totalCosts) * 100}%` }} title={`${p.label}: ${formatBRL(p.value)}`} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1 text-xs">
          {costParts.map((p) => (
            <div key={p.label} className="flex items-center gap-2">
              <span className={cn("inline-block h-2 w-2 rounded-sm", p.color)} />
              <span className="text-muted-foreground">{p.label}</span>
              <span className="ml-auto">{formatBRL(p.value)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h4 className="text-sm font-medium mb-3">Receita por tipo</h4>
        {typeRows.length === 0 ? <p className="text-xs text-muted-foreground">Sem dados.</p> : (
          <div className="space-y-2">
            {typeRows.map((k) => (
              <div key={k}>
                <div className="flex justify-between text-xs"><span>{ENTRY_TYPE_LABEL[k]}</span><span>{formatBRL(summary.by_type[k].amount)}</span></div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${(summary.by_type[k].amount / maxType) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h4 className="text-sm font-medium mb-3">Progresso dos objetivos</h4>
        {goals.length === 0 ? <p className="text-xs text-muted-foreground">Sem objetivos.</p> : (
          <div className="space-y-2">
            {goals.map((g) => {
              const pct = g.target > 0 ? Math.min(100, (g.reserved / g.target) * 100) : 0;
              return (
                <div key={g.id}>
                  <div className="flex justify-between text-xs"><span>{g.name}</span><span>{pct.toFixed(0)}%</span></div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------- Export / Import ----------
function ExportImportSection({ summary, mainGoal, onReload }: { summary: ReturnType<typeof calculateFinanceSummary>; mainGoal?: FinanceGoal; onReload: () => void }) {
  const [importText, setImportText] = useState("");
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const { guard, dialog } = useSecurityGuard();

  const doExport = () => guard({
    kind: "finance",
    title: "Exportar financeiro",
    description: "Confirme com PIN para exportar dados financeiros.",
    actionLabel: "Exportar",
    onConfirm: () => {
      const data = exportFinanceData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `financeiro-cobranca-ia-${todayDate()}.json`; a.click();
      URL.revokeObjectURL(url);
    },
  });

  const doExportTxt = () => {
    const text = buildSummaryText(summary, mainGoal);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio-financeiro-cobranca-ia-${todayDate()}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = () => {
    if (!importText.trim()) { toast.error("Cole o JSON exportado"); return; }
    if (mode === "replace" && !confirm("Substituir TODOS os dados financeiros locais?")) return;
    guard({
      kind: mode === "replace" ? "delete" : "finance",
      title: mode === "replace" ? "Substituir dados financeiros" : "Importar financeiro",
      actionLabel: mode === "replace" ? "Substituir" : "Importar",
      onConfirm: () => {
        const r = importFinanceData(importText, mode);
        if (!r.ok) { toast.error(r.error || "Falha na importação"); return; }
        setImportText("");
        onReload();
        toast.success(`Importação ok (${r.counts?.entries ?? 0} entradas, ${r.counts?.goals ?? 0} objetivos)`);
      },
    });
  };

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <h4 className="text-sm font-medium mb-2">Exportar</h4>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={doExport}><Download className="h-4 w-4 mr-1" />Exportar JSON</Button>
          <Button size="sm" variant="outline" onClick={doExportTxt}><Download className="h-4 w-4 mr-1" />Exportar relatório TXT</Button>
        </div>
      </Card>
      <Card className="p-4 space-y-2">
        <h4 className="text-sm font-medium">Importar</h4>
        <Textarea rows={6} placeholder="Cole aqui o JSON exportado…" value={importText} onChange={(e) => setImportText(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={mode} onValueChange={(v) => setMode(v as "merge" | "replace")}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="merge">Mesclar</SelectItem>
              <SelectItem value="replace">Substituir</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={doImport}><Upload className="h-4 w-4 mr-1" />Importar</Button>
        </div>
      </Card>
      {dialog}
    </div>
  );
}


// ---------- Entry Sheet ----------
function EntrySheet({ draft, goals, onClose, onSaved }: { draft: FinanceDraft; goals: FinanceGoal[]; onClose: () => void; onSaved: () => void }) {
  const settings = getFinanceSettings();
  const [date, setDate] = useState(draft.date ?? todayDate());
  const [name, setName] = useState(draft.customer_name ?? "");
  const [whatsapp, setWhatsapp] = useState(draft.customer_whatsapp ?? "");
  const [screenLabel, setScreenLabel] = useState(draft.screen_label ?? "");
  const [appLabel, setAppLabel] = useState(draft.app_label ?? "");
  const [amount, setAmount] = useState<number>(Number(draft.amount_received ?? 0));
  const [method, setMethod] = useState<PaymentMethod>((draft.method as PaymentMethod) ?? "pix");
  const [type, setType] = useState<EntryType>((draft.type as EntryType) ?? "renovacao_lista");
  const [goalId, setGoalId] = useState<string>(draft.goal_id ?? settings.default_goal_id ?? "none");
  const [note, setNote] = useState(draft.note ?? "");
  const [costScreen, setCostScreen] = useState<number>(Number(draft.cost_screen ?? settings.default_screen_cost));
  const [costServer, setCostServer] = useState<number>(Number(draft.cost_server ?? 0));
  const [costApp, setCostApp] = useState<number>(Number(draft.cost_app ?? 0));
  const [costFixed, setCostFixed] = useState<number>(Number(draft.cost_fixed ?? 0));
  const [reserve, setReserve] = useState<number>(() => {
    if (draft.reserve != null) return Number(draft.reserve);
    if (settings.reserve_mode === "percentual") return (Number(draft.amount_received ?? 0) * settings.reserve_value) / 100;
    if (settings.reserve_mode === "valor_fixo") return settings.reserve_value;
    return 0;
  });

  const net = amount - costScreen - costServer - costApp - costFixed - reserve;

  const submit = () => {
    if (amount <= 0) { toast.error("Informe o valor recebido"); return; }
    saveFinanceEntry({
      date, customer_name: name || undefined, customer_whatsapp: whatsapp || undefined,
      screen_label: screenLabel || undefined, app_label: appLabel || undefined,
      server_ids: draft.server_ids,
      amount_received: amount, method, type,
      cost_screen: costScreen, cost_server: costServer, cost_app: costApp, cost_fixed: costFixed,
      reserve, net_profit: net,
      goal_id: goalId !== "none" ? goalId : undefined,
      note: note || undefined,
    });
    onSaved();
  };

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Nova entrada financeira</SheetTitle>
          <SheetDescription>Registro local. Nenhum pagamento real é processado.</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 mt-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as EntryType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ENTRY_TYPE_LABEL) as EntryType[]).map((k) => <SelectItem key={k} value={k}>{ENTRY_TYPE_LABEL[k]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Cliente</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label className="text-xs">WhatsApp</Label><Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Tela/Lista</Label><Input value={screenLabel} onChange={(e) => setScreenLabel(e.target.value)} /></div>
            <div><Label className="text-xs">App</Label><Input value={appLabel} onChange={(e) => setAppLabel(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Valor recebido (R$)</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
            <div>
              <Label className="text-xs">Forma</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((k) => <SelectItem key={k} value={k}>{METHOD_LABEL[k]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Custo lista (R$)</Label><Input type="number" step="0.01" value={costScreen} onChange={(e) => setCostScreen(Number(e.target.value))} /></div>
            <div><Label className="text-xs">Custo servidor (R$)</Label><Input type="number" step="0.01" value={costServer} onChange={(e) => setCostServer(Number(e.target.value))} /></div>
            <div><Label className="text-xs">Custo app (R$)</Label><Input type="number" step="0.01" value={costApp} onChange={(e) => setCostApp(Number(e.target.value))} /></div>
            <div><Label className="text-xs">Custo fixo (R$)</Label><Input type="number" step="0.01" value={costFixed} onChange={(e) => setCostFixed(Number(e.target.value))} /></div>
            <div><Label className="text-xs">Reserva objetivo (R$)</Label><Input type="number" step="0.01" value={reserve} onChange={(e) => setReserve(Number(e.target.value))} /></div>
            <div>
              <Label className="text-xs">Objetivo</Label>
              <Select value={goalId} onValueChange={setGoalId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {goals.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label className="text-xs">Observação</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>

          <div className="rounded-md border p-2 bg-muted/30 text-sm flex justify-between">
            <span>Lucro líquido estimado</span>
            <strong className={cn(net >= 0 ? "text-emerald-600" : "text-destructive")}>{formatBRL(net)}</strong>
          </div>
        </div>
        <SheetFooter className="mt-4 gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit}>Salvar entrada</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
