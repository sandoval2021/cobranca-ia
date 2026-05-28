import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Search, Download, Upload, Check, Info, Settings2, Plus } from "lucide-react";

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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

import {
  listReferrals, updateReferral, summarizeByIndicador, getReferralRules,
  saveReferralRules, exportReferrals, importReferrals, REFERRAL_STATUSES,
  bonusDescription, renderReferralMessage, saveReferral,
  type Referral, type ReferralRules, type BonusType,
} from "@/lib/referrals";
import { getActiveAccountId, listCustomersForSelectAdmin } from "@/lib/rpc-admin";
import { useSecurityGuard } from "@/components/security/PinConfirmDialog";
import { ProtectedModeBadge } from "@/components/security/ProtectedModeBadge";



export const Route = createFileRoute("/indicacoes")({
  component: IndicacoesPage,
});

const FILTERS = [
  "Todos", "Em teste", "Fecharam", "Não fecharam", "Bonificação pendente", "Bonificação aplicada",
] as const;
type Filter = (typeof FILTERS)[number];

function IndicacoesPage() {
  const [refs, setRefs] = useState<Referral[]>([]);
  const [rules, setRules] = useState<ReferralRules>(getReferralRules());
  const [filter, setFilter] = useState<Filter>("Todos");
  const [query, setQuery] = useState("");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [msgFor, setMsgFor] = useState<string | null>(null); // indicator key
  const [applyForId, setApplyForId] = useState<string | null>(null);
  const { guard, dialog: securityDialog } = useSecurityGuard();



  const reload = () => {
    setRefs(listReferrals());
    setRules(getReferralRules());
  };

  useEffect(() => {
    reload();
    const h = () => reload();
    window.addEventListener("referrals:changed", h);
    return () => window.removeEventListener("referrals:changed", h);
  }, []);

  const summary = useMemo(() => summarizeByIndicador(), [refs, rules]);

  const stats = useMemo(() => ({
    total: refs.length,
    emTeste: refs.filter((r) => r.status === "Em teste" || r.status === "Indicou").length,
    fecharam: refs.filter((r) => r.status === "Fechou" || r.status === "Bonificação pendente" || r.status === "Bonificação aplicada").length,
    naoFecharam: refs.filter((r) => r.status === "Não fechou").length,
    bonifPendente: refs.filter((r) => r.status === "Bonificação pendente").length,
    bonifAplicada: refs.filter((r) => r.status === "Bonificação aplicada").length,
  }), [refs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return refs.filter((r) => {
      if (q) {
        const hay = [r.indicador_nome, r.indicador_whatsapp, r.indicado_nome, r.indicado_whatsapp, r.status]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      switch (filter) {
        case "Todos": return true;
        case "Em teste": return r.status === "Em teste" || r.status === "Indicou";
        case "Fecharam": return r.status === "Fechou";
        case "Não fecharam": return r.status === "Não fechou";
        case "Bonificação pendente": return r.status === "Bonificação pendente";
        case "Bonificação aplicada": return r.status === "Bonificação aplicada";
      }
    });
  }, [refs, filter, query]);

  function handleExport() {
    guard({
      kind: "backup",
      title: "Exportar indicações",
      actionLabel: "Exportar",
      onConfirm: () => {
        const data = exportReferrals();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `indicacoes-cobranca-ia-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },
    });
  }

  function handleImport(file: File) {
    guard({
      kind: "backup",
      title: "Importar indicações",
      description: "Os dados serão mesclados com as indicações locais.",
      actionLabel: "Importar",
      onConfirm: () => {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const parsed = JSON.parse(String(reader.result));
            const res = importReferrals(parsed, "merge");
            toast.success(`Importadas ${res.imported} indicações`);
            reload();
          } catch {
            toast.error("Arquivo inválido");
          }
        };
        reader.readAsText(file);
      },
    });
  }

  function markPending(r: Referral) {
    updateReferral(r.id, { status: "Bonificação pendente" });
    reload();
  }
  function markApplied(id: string) {
    guard({
      kind: "delete",
      title: "Marcar bonificação como aplicada",
      description: "Esta alteração é definitiva no histórico local.",
      actionLabel: "Confirmar",
      onConfirm: () => {
        updateReferral(id, { status: "Bonificação aplicada", bonificacao_aplicada_em: new Date().toISOString() });
        setApplyForId(null);
        reload();
        toast.success("Bonificação marcada como aplicada");
      },
    });
  }


  return (
    <PageContainer>
      <div className="mb-1"><ProtectedModeBadge /></div>
      <CompanyScopeNotice moduleKey="cobranca_ia_referrals_v1" />
      <PlanLimitNotice moduleKey="indicacoes" />
      <SectionHeader

        title="Indicações"
        subtitle="Acompanhe clientes que indicaram pessoas e controle bonificações."
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setNewOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Nova indicação
            </Button>
            <Button variant="outline" onClick={() => setRulesOpen(true)} className="gap-2">
              <Settings2 className="h-4 w-4" /> Regras de bonificação
            </Button>
            <Button variant="outline" onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" /> Exportar
            </Button>
            <label className="inline-flex">
              <input type="file" accept="application/json" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }} />
              <Button variant="outline" asChild className="gap-2 cursor-pointer">
                <span><Upload className="h-4 w-4" /> Importar</span>
              </Button>
            </label>
          </div>

        }
      />

      <Card className="mb-4 border-warning/40 bg-warning/5 p-3 text-sm">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 text-warning" />
          <span>
            Regra atual: <strong>{rules.meta}</strong> indicações que fechem · {bonusDescription(rules)}
          </span>
        </div>
      </Card>

      <div className="mb-3 text-[11px] text-muted-foreground">
        Mensagens usando dados de Minha Revenda.{" "}
        <Link to="/configuracoes-revenda" className="underline">Editar Minha Revenda</Link>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 mb-4">
        <Tile label="Indicações" value={stats.total} />
        <Tile label="Em teste" value={stats.emTeste} />
        <Tile label="Fecharam" value={stats.fecharam} />
        <Tile label="Não fecharam" value={stats.naoFecharam} />
        <Tile label="Bonif. pendente" value={stats.bonifPendente} />
        <Tile label="Bonif. aplicada" value={stats.bonifAplicada} />
      </div>

      <h3 className="mb-2 mt-4 text-sm font-semibold">Por cliente indicador</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 mb-6">
        {summary.length === 0 && (
          <Card className="p-4 text-sm text-muted-foreground">Nenhuma indicação registrada ainda.</Card>
        )}
        {summary.map((s) => (
          <Card key={s.key} className="p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{s.nome}</p>
                <p className="text-xs text-muted-foreground">{s.whatsapp || "—"}</p>
                <p className="mt-1 text-xs">
                  Indicou: <strong>{s.total}</strong> · Fecharam: <strong>{s.fecharam}</strong> ·
                  {s.faltamParaMeta > 0
                    ? <> Faltam <strong>{s.faltamParaMeta}</strong> para bonificação</>
                    : <span className="ml-1 text-success">Bonificação liberada</span>}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setMsgFor(s.key)} className="gap-1">
                <Copy className="h-3.5 w-3.5" /> Mensagem
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por indicador, indicado, WhatsApp, status…" className="pl-8" />
        </div>
      </div>

      <div className="-mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors",
              filter === f ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-surface-muted",
            )}>{f}</button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">Sem indicações para esse filtro.</Card>
        )}
        {filtered.map((r) => (
          <Card key={r.id} className="p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <strong>{r.indicador_nome}</strong> indicou <strong>{r.indicado_nome}</strong>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.indicador_whatsapp || "—"} → {r.indicado_whatsapp || "—"} · {new Date(r.data_indicacao).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <span className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                r.status === "Fechou" || r.status === "Bonificação aplicada" ? "bg-success/15 text-success" :
                r.status === "Não fechou" ? "bg-destructive/15 text-destructive" :
                r.status === "Bonificação pendente" ? "bg-warning/15 text-warning" :
                "bg-surface-muted",
              )}>{r.status}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <select className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                value={r.status} onChange={(e) => { updateReferral(r.id, { status: e.target.value as Referral["status"] }); reload(); }}>
                {REFERRAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {r.status === "Fechou" && (
                <Button size="sm" variant="outline" onClick={() => markPending(r)}>Marcar bonificação pendente</Button>
              )}
              {r.status === "Bonificação pendente" && (
                <Button size="sm" variant="outline" onClick={() => setApplyForId(r.id)} className="gap-1">
                  <Check className="h-3.5 w-3.5" /> Marcar bonificação aplicada
                </Button>
              )}
              {(r.status === "Bonificação pendente" || r.status === "Bonificação aplicada") && (
                <Button size="sm" variant="outline" onClick={() => {
                  import("@/lib/financeiro-local").then(({ openFinanceWithDraft }) => {
                    openFinanceWithDraft({
                      customer_name: r.indicador_nome,
                      customer_whatsapp: r.indicador_whatsapp,
                      type: "bonificacao",
                      note: `Bonificação por indicar ${r.indicado_nome}`,
                      source: "indicacao",
                    });
                  });
                }}>💰 Registrar no financeiro</Button>
              )}
              {r.lead_id && (
                <Button size="sm" variant="ghost" asChild>
                  <Link to="/testes">Ver teste</Link>
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Rules dialog */}
      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regras de bonificação</DialogTitle>
            <DialogDescription>Configurado localmente — usado nas mensagens e contadores.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Indicações fechadas para bonificação</Label>
              <Input type="number" min={1} value={rules.meta} onChange={(e) => setRules({ ...rules, meta: Math.max(1, Number(e.target.value) || 1) })} />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={rules.tipo} onChange={(e) => setRules({ ...rules, tipo: e.target.value as BonusType })}>
                <option value="1mes">1 mês grátis</option>
                <option value="desconto">Desconto</option>
                <option value="valor">Valor fixo</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea rows={3} value={rules.descricao} onChange={(e) => setRules({ ...rules, descricao: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRulesOpen(false)}>Cancelar</Button>
            <Button onClick={() => { saveReferralRules(rules); setRulesOpen(false); reload(); toast.success("Regras salvas"); }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <IndicatorMessageDialog
        open={!!msgFor} onClose={() => setMsgFor(null)}
        summary={summary.find((s) => s.key === msgFor) ?? null}
        rules={rules}
      />

      <AlertDialog open={!!applyForId} onOpenChange={(v) => !v && setApplyForId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar bonificação como aplicada?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso apenas registra localmente que você aplicou a bonificação. Nada será alterado no vencimento do cliente automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => applyForId && markApplied(applyForId)}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <NewReferralDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={() => { setNewOpen(false); reload(); toast.success("Indicação registrada"); }}
      />

      {securityDialog}
    </PageContainer>


  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </Card>
  );
}

function IndicatorMessageDialog({
  open, onClose, summary, rules,
}: {
  open: boolean;
  onClose: () => void;
  summary: ReturnType<typeof summarizeByIndicador>[number] | null;
  rules: ReferralRules;
}) {
  if (!summary) return null;
  const bonificacao = bonusDescription(rules);
  const items = [
    {
      key: "em_teste",
      label: "Indicação em teste",
      text: renderReferralMessage("em_teste", { indicador: summary.nome, fechadas: summary.fecharam, faltam: summary.faltamParaMeta, meta: rules.meta, bonificacao }),
    },
    {
      key: "fechou_falta",
      label: "Fechou, ainda falta",
      text: renderReferralMessage("fechou_falta", { indicador: summary.nome, fechadas: summary.fecharam, faltam: summary.faltamParaMeta, meta: rules.meta, bonificacao }),
    },
    {
      key: "bateu_meta",
      label: "Bateu meta",
      text: renderReferralMessage("bateu_meta", { indicador: summary.nome, fechadas: summary.fecharam, faltam: summary.faltamParaMeta, meta: rules.meta, bonificacao }),
    },
  ];
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mensagens para {summary.nome}</DialogTitle>
          <DialogDescription>Copie e cole no WhatsApp. Nada é enviado automaticamente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {items.map((m) => (
            <Card key={m.key} className="p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">{m.label}</p>
              <pre className="whitespace-pre-wrap text-sm">{m.text}</pre>
              <div className="mt-2">
                <Button size="sm" variant="outline" onClick={async () => {
                  await navigator.clipboard.writeText(m.text);
                  toast.success("Copiado");
                }} className="gap-1">
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type CustomerOption = { id: string; name: string; phone: string };

function NewReferralDialog({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [indicador, setIndicador] = useState<CustomerOption | null>(null);
  const [indicadorQuery, setIndicadorQuery] = useState("");
  const [indicadoNome, setIndicadoNome] = useState("");
  const [indicadoWhats, setIndicadoWhats] = useState("");
  const [obs, setObs] = useState("");

  useEffect(() => {
    if (!open) {
      setIndicador(null); setIndicadorQuery(""); setIndicadoNome(""); setIndicadoWhats(""); setObs("");
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      const { accountId } = await getActiveAccountId();
      if (!alive) return;
      setCompanyId(accountId ?? null);
      if (!accountId) { setLoading(false); return; }
      const res = await listCustomersForSelectAdmin({ p_company_id: accountId, p_limit: 200 });
      if (!alive) return;
      const raw = (res.data as unknown) ?? [];
      const arr = Array.isArray(raw) ? raw : [];
      setCustomers(arr.map((r: Record<string, unknown>) => ({
        id: String(r.id ?? ""),
        name: String(r.name ?? r.nome ?? ""),
        phone: String(r.phone ?? r.whatsapp ?? ""),
      })).filter((c) => c.id && c.name));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [open]);

  const filteredCustomers = useMemo(() => {
    const q = indicadorQuery.trim().toLowerCase();
    if (!q) return customers.slice(0, 12);
    return customers.filter((c) =>
      c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q),
    ).slice(0, 20);
  }, [customers, indicadorQuery]);

  function submit() {
    if (!indicador) return toast.error("Selecione o cliente que indicou.");
    if (!indicadoNome.trim()) return toast.error("Informe o nome do indicado.");
    saveReferral({
      company_id: companyId,
      indicador_cliente_id: indicador.id,
      indicador_nome: indicador.name,
      indicador_whatsapp: indicador.phone,
      indicado_nome: indicadoNome.trim(),
      indicado_whatsapp: indicadoWhats.trim(),
      observacao: obs.trim() || undefined,
      status: "Em teste",
    });
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova indicação</DialogTitle>
          <DialogDescription>Busque o cliente que indicou por nome ou WhatsApp.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Quem indicou (cliente) *</Label>
            {indicador ? (
              <div className="flex items-center justify-between rounded-md border border-input bg-card p-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{indicador.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{indicador.phone || "—"}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setIndicador(null)}>Trocar</Button>
              </div>
            ) : (
              <>
                <Input
                  placeholder="Buscar por nome ou WhatsApp…"
                  value={indicadorQuery}
                  onChange={(e) => setIndicadorQuery(e.target.value)}
                  autoFocus
                />
                <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-border">
                  {loading ? (
                    <p className="p-3 text-xs text-muted-foreground">Carregando clientes…</p>
                  ) : filteredCustomers.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">
                      {customers.length === 0 ? "Nenhum cliente cadastrado." : "Nenhum resultado."}
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {filteredCustomers.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => { setIndicador(c); setIndicadorQuery(""); }}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                          >
                            <span className="truncate">{c.name}</span>
                            <span className="ml-2 truncate text-xs text-muted-foreground">{c.phone}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Nome do indicado *</Label>
              <Input value={indicadoNome} onChange={(e) => setIndicadoNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div>
              <Label className="text-xs">WhatsApp do indicado</Label>
              <Input value={indicadoWhats} onChange={(e) => setIndicadoWhats(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
          </div>

          <div>
            <Label className="text-xs">Observação</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={!indicador || !indicadoNome.trim()}>Salvar indicação</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

