import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus, Search, Copy, Check, X, Archive, MessageCircle, ExternalLink,
  Download, Upload, UserPlus, Pencil, Info,
} from "lucide-react";

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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

import {
  listTrialLeads, saveTrialLead, updateTrialLead, archiveTrialLead,
  markTrialLeadClosed, markTrialLeadLost, listFollowUps, updateFollowUpStatus,
  exportTrialLeads, importTrialLeads, TRIAL_ORIGINS, TRIAL_STATUSES, TRIAL_INTERESTS,
  TRIAL_TEMPLATES, INDICADO_TEMPLATE, FOLLOWUP_LABEL, renderTemplate, waLink,
  type TrialLead, type TrialOrigin, type TrialInterest, type FollowUpStatus,
} from "@/lib/trial-leads";
import {
  saveReferral, updateReferralByLead, summarizeByIndicador, getReferralRules,
  bonusDescription, renderReferralMessage,
} from "@/lib/referrals";
import { useSecurityGuard } from "@/components/security/PinConfirmDialog";
import { ProtectedModeBadge } from "@/components/security/ProtectedModeBadge";


export const Route = createFileRoute("/testes")({
  component: TestesPage,
});

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

function isToday(iso?: string) {
  if (!iso) return false;
  const d = new Date(iso);
  const t = new Date();
  return d.toDateString() === t.toDateString();
}

const FILTERS = [
  "Todos", "Novos", "Em teste", "Aguardando", "Fecharam", "Não fecharam",
  "Indicados", "Quentes", "Hoje", "Atrasados",
] as const;
type Filter = (typeof FILTERS)[number];

function TestesPage() {
  const [leads, setLeads] = useState<TrialLead[]>([]);
  const [followups, setFollowups] = useState(() => listFollowUps());
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<TrialLead | null>(null);
  const [filter, setFilter] = useState<Filter>("Todos");
  const [query, setQuery] = useState("");
  const [msgLead, setMsgLead] = useState<TrialLead | null>(null);
  const [convertLead, setConvertLead] = useState<TrialLead | null>(null);
  const { guard, dialog: securityDialog } = useSecurityGuard();


  const reload = () => {
    setLeads(listTrialLeads());
    setFollowups(listFollowUps());
  };

  useEffect(() => {
    reload();
    const h = () => reload();
    window.addEventListener("trial-leads:changed", h);
    return () => window.removeEventListener("trial-leads:changed", h);
  }, []);

  const visible = useMemo(() => leads.filter((l) => !l.arquivado), [leads]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    return {
      novos: visible.filter((l) => l.status === "Novo contato" || l.status === "Teste solicitado").length,
      emTeste: visible.filter((l) => l.status === "Em teste" || l.status === "Teste enviado").length,
      aguardando: visible.filter((l) => l.status === "Aguardando resposta").length,
      vencendoHoje: visible.filter((l) => l.data_fim && new Date(l.data_fim).toDateString() === today).length,
      fecharam: visible.filter((l) => l.status === "Fechou" || l.status === "Convertido em cliente").length,
      naoFecharam: visible.filter((l) => l.status === "Não fechou" || l.status === "Perdido").length,
      indicados: visible.filter((l) => l.indicado_por_nome || l.indicado_por_whatsapp).length,
      quentes: visible.filter((l) => l.interesse === "Quente").length,
    };
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visible.filter((l) => {
      if (q) {
        const hay = [
          l.nome, l.whatsapp, l.origem, l.indicado_por_nome, l.app, l.servidor, l.observacao,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      switch (filter) {
        case "Todos": return true;
        case "Novos": return l.status === "Novo contato" || l.status === "Teste solicitado";
        case "Em teste": return l.status === "Em teste" || l.status === "Teste enviado";
        case "Aguardando": return l.status === "Aguardando resposta";
        case "Fecharam": return l.status === "Fechou" || l.status === "Convertido em cliente";
        case "Não fecharam": return l.status === "Não fechou" || l.status === "Perdido";
        case "Indicados": return !!(l.indicado_por_nome || l.indicado_por_whatsapp);
        case "Quentes": return l.interesse === "Quente";
        case "Hoje": return isToday(l.data_contato) || isToday(l.data_inicio);
        case "Atrasados":
          return !!l.data_fim && new Date(l.data_fim) < new Date() &&
            !["Fechou", "Convertido em cliente", "Não fechou", "Perdido"].includes(l.status);
      }
    });
  }, [visible, filter, query]);

  const pendingFollowups = useMemo(
    () => followups
      .filter((f) => f.status === "Pendente")
      .sort((a, b) => a.data_planejada.localeCompare(b.data_planejada))
      .slice(0, 8),
    [followups],
  );

  function handleSaveLead(input: Partial<TrialLead> & { whatsapp: string }) {
    const isEdit = !!editing;
    if (isEdit && editing) {
      updateTrialLead(editing.id, input);
      // sync referral
      if (input.indicado_por_nome || input.indicado_por_whatsapp) {
        updateReferralByLead(editing.id, {
          indicador_nome: input.indicado_por_nome ?? editing.indicado_por_nome ?? "",
          indicador_whatsapp: input.indicado_por_whatsapp ?? editing.indicado_por_whatsapp ?? "",
        });
      }
      toast.success("Teste atualizado");
    } else {
      const lead = saveTrialLead(input);
      if (lead.indicado_por_nome || lead.indicado_por_whatsapp) {
        saveReferral({
          indicador_cliente_id: lead.indicado_por_cliente_id,
          indicador_nome: lead.indicado_por_nome || "Sem nome",
          indicador_whatsapp: lead.indicado_por_whatsapp || "",
          indicado_nome: lead.nome || "Sem nome",
          indicado_whatsapp: lead.whatsapp,
          lead_id: lead.id,
          status: "Em teste",
        });
      }
      toast.success("Teste cadastrado");
    }
    setOpenNew(false);
    setEditing(null);
    reload();
  }

  function handleClosed(lead: TrialLead) {
    markTrialLeadClosed(lead.id);
    updateReferralByLead(lead.id, { status: "Fechou", data_fechamento: new Date().toISOString() });
    // bonus check
    const rules = getReferralRules();
    const summary = summarizeByIndicador();
    const indicatorKey = lead.indicado_por_cliente_id || lead.indicado_por_whatsapp || lead.indicado_por_nome;
    if (indicatorKey) {
      const s = summary.find((x) => x.key === indicatorKey);
      if (s && s.fecharam >= rules.meta && s.bonificacaoPendente === 0) {
        // mark one referral as bonificação pendente
        // Find the latest "Fechou" for this indicator and bump
        // (handled visually in /indicacoes)
        toast.success("Indicador bateu meta — confira em Indicações");
      }
    }
    reload();
    toast.success("Marcado como Fechou");
  }

  function handleLost(lead: TrialLead) {
    guard({
      kind: "delete",
      title: "Marcar como Não fechou?",
      description: "Esta alteração é definitiva neste lead.",
      actionLabel: "Confirmar",
      onConfirm: () => {
        markTrialLeadLost(lead.id);
        updateReferralByLead(lead.id, { status: "Não fechou" });
        reload();
        toast.success("Marcado como Não fechou");
      },
    });
  }

  function handleArchive(lead: TrialLead) {
    guard({
      kind: "delete",
      title: "Arquivar teste?",
      description: "O teste será removido da lista ativa.",
      actionLabel: "Arquivar",
      onConfirm: () => {
        archiveTrialLead(lead.id);
        reload();
        toast.success("Teste arquivado");
      },
    });
  }

  function handleExport() {
    guard({
      kind: "backup",
      title: "Exportar testes",
      description: "Será gerado um arquivo JSON com os testes locais.",
      actionLabel: "Exportar",
      onConfirm: () => {
        const data = exportTrialLeads();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `testes-cobranca-ia-${todayIso()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },
    });
  }

  function handleImport(file: File) {
    guard({
      kind: "backup",
      title: "Importar testes",
      description: "Os dados do arquivo serão mesclados com os testes locais.",
      actionLabel: "Importar",
      onConfirm: () => {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const parsed = JSON.parse(String(reader.result));
            const res = importTrialLeads(parsed, "merge");
            toast.success(`Importados ${res.imported} testes`);
            reload();
          } catch {
            toast.error("Arquivo inválido");
          }
        };
        reader.readAsText(file);
      },
    });
  }


  return (
    <PageContainer>
      <SectionHeader
        title="Testes"
        subtitle="Acompanhe pessoas que pediram teste e ainda não viraram clientes."
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { setEditing(null); setOpenNew(true); }} className="gap-2">
              <Plus className="h-4 w-4" /> Novo teste
            </Button>
            <Button variant="outline" onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" /> Exportar
            </Button>
            <label className="inline-flex">
              <input
                type="file"
                accept="application/json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImport(f);
                  e.target.value = "";
                }}
              />
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
          <span>Modo manual: nenhuma mensagem será enviada automaticamente.</span>
        </div>
      </Card>

      <div className="mb-3 text-[11px] text-muted-foreground">
        Mensagens usando dados de Minha Revenda.{" "}
        <Link to="/configuracoes-revenda" className="underline">Editar Minha Revenda</Link>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8 mb-4">
        <StatTile label="Novos" value={stats.novos} />
        <StatTile label="Em teste" value={stats.emTeste} />
        <StatTile label="Aguardando" value={stats.aguardando} />
        <StatTile label="Vencendo hoje" value={stats.vencendoHoje} />
        <StatTile label="Fecharam" value={stats.fecharam} />
        <StatTile label="Não fecharam" value={stats.naoFecharam} />
        <StatTile label="Indicados" value={stats.indicados} />
        <StatTile label="Quentes" value={stats.quentes} />
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, WhatsApp, origem, indicador, app, servidor…"
            className="pl-8" />
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
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Nenhum teste para esse filtro.
          </Card>
        )}
        {filtered.map((l) => {
          const link = waLink(l.whatsapp);
          const indicado = l.indicado_por_nome || l.indicado_por_whatsapp;
          return (
            <Card key={l.id} className="p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{l.nome || "Sem nome"}</p>
                    <StatusChip status={l.status} />
                    <InterestChip interesse={l.interesse} />
                    {indicado && (
                      <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">
                        Indicado por {l.indicado_por_nome || l.indicado_por_whatsapp}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {l.whatsapp} · {l.origem}
                    {l.app ? ` · ${l.app}` : ""}
                    {l.servidor ? ` · ${l.servidor}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Início: {fmtDate(l.data_inicio)} · Fim: {fmtDate(l.data_fim)}
                  </p>
                  {l.observacao && <p className="mt-1 text-xs">{l.observacao}</p>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setMsgLead(l)} className="gap-1">
                  <Copy className="h-3.5 w-3.5" /> Mensagens
                </Button>
                {link && (
                  <Button size="sm" variant="outline" asChild className="gap-1">
                    <a href={link} target="_blank" rel="noreferrer">
                      <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                    </a>
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => handleClosed(l)} className="gap-1">
                  <Check className="h-3.5 w-3.5" /> Fechou
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleLost(l)} className="gap-1">
                  <X className="h-3.5 w-3.5" /> Não fechou
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConvertLead(l)} className="gap-1">
                  <UserPlus className="h-3.5 w-3.5" /> Converter
                </Button>
                {(l.status === "Fechou" || l.status === "Convertido em cliente") && (
                  <Button size="sm" variant="outline" onClick={() => {
                    import("@/lib/financeiro-local").then(({ openFinanceWithDraft }) => {
                      openFinanceWithDraft({
                        customer_name: l.nome,
                        customer_whatsapp: l.whatsapp,
                        type: l.status === "Convertido em cliente" ? "teste_convertido" : "venda_nova",
                        source: "teste",
                      });
                    });
                  }} className="gap-1">
                    💰 Financeiro
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => { setEditing(l); setOpenNew(true); }} className="gap-1">
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleArchive(l)} className="gap-1">
                  <Archive className="h-3.5 w-3.5" /> Arquivar
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {pendingFollowups.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold">Agenda de acompanhamento</h3>
          <div className="space-y-2">
            {pendingFollowups.map((f) => {
              const lead = leads.find((l) => l.id === f.lead_id);
              if (!lead) return null;
              const tpl = TRIAL_TEMPLATES[f.type];
              const msg = renderTemplate(tpl, lead);
              return (
                <Card key={f.id} className="p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{FOLLOWUP_LABEL[f.type]} — {lead.nome || lead.whatsapp}</p>
                      <p className="text-xs text-muted-foreground">Planejado: {fmtDate(f.data_planejada)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={async () => {
                        await navigator.clipboard.writeText(msg);
                        updateFollowUpStatus(f.id, "Copiado");
                        reload();
                        toast.success("Mensagem copiada");
                      }} className="gap-1">
                        <Copy className="h-3.5 w-3.5" /> Copiar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { updateFollowUpStatus(f.id, "Resolvido"); reload(); }}>
                        Resolver
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { updateFollowUpStatus(f.id, "Ignorado"); reload(); }}>
                        Ignorar
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <NewTrialSheet
        open={openNew}
        onOpenChange={(v) => { setOpenNew(v); if (!v) setEditing(null); }}
        editing={editing}
        onSave={handleSaveLead}
      />

      <MessagesDialog lead={msgLead} onClose={() => setMsgLead(null)} />

      <ConvertDialog lead={convertLead} onClose={() => setConvertLead(null)} onConfirmConverted={(l) => {
        updateTrialLead(l.id, { status: "Convertido em cliente" });
        updateReferralByLead(l.id, { status: "Fechou", data_fechamento: new Date().toISOString() });
        reload();
        setConvertLead(null);
      }} />
    </PageContainer>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </Card>
  );
}

function StatusChip({ status }: { status: string }) {
  const tone =
    status === "Fechou" || status === "Convertido em cliente" ? "bg-success/15 text-success" :
    status === "Não fechou" || status === "Perdido" ? "bg-destructive/15 text-destructive" :
    status === "Em teste" || status === "Teste enviado" ? "bg-primary-soft text-primary" :
    "bg-surface-muted text-foreground/70";
  return <span className={cn("rounded-full px-2 py-0.5 text-xs", tone)}>{status}</span>;
}

function InterestChip({ interesse }: { interesse: string }) {
  const tone =
    interesse === "Quente" ? "bg-destructive/15 text-destructive" :
    interesse === "Morno" ? "bg-warning/15 text-warning" :
    "bg-surface-muted text-muted-foreground";
  return <span className={cn("rounded-full px-2 py-0.5 text-xs", tone)}>{interesse}</span>;
}

function NewTrialSheet({
  open, onOpenChange, editing, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: TrialLead | null;
  onSave: (input: Partial<TrialLead> & { whatsapp: string }) => void;
}) {
  const [form, setForm] = useState<Partial<TrialLead> & { whatsapp: string }>({
    whatsapp: "", origem: "Outro", interesse: "Morno",
  });

  useEffect(() => {
    if (editing) setForm(editing);
    else setForm({ whatsapp: "", origem: "Outro", interesse: "Morno", data_inicio: todayIso() });
  }, [editing, open]);

  function submit() {
    if (!form.whatsapp?.trim()) { toast.error("WhatsApp é obrigatório"); return; }
    onSave(form);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editing ? "Editar teste" : "Novo teste"}</SheetTitle>
          <SheetDescription>Cadastro rápido — só WhatsApp é obrigatório.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <Field label="Nome">
            <Input value={form.nome ?? ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Opcional" />
          </Field>
          <Field label="WhatsApp *">
            <Input value={form.whatsapp ?? ""} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="(00) 00000-0000" />
          </Field>
          <Field label="Origem">
            <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={form.origem ?? "Outro"} onChange={(e) => setForm({ ...form, origem: e.target.value as TrialOrigin })}>
              {TRIAL_ORIGINS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Quem indicou (nome)">
              <Input value={form.indicado_por_nome ?? ""} onChange={(e) => setForm({ ...form, indicado_por_nome: e.target.value })} placeholder="Opcional" />
            </Field>
            <Field label="WhatsApp indicador">
              <Input value={form.indicado_por_whatsapp ?? ""} onChange={(e) => setForm({ ...form, indicado_por_whatsapp: e.target.value })} placeholder="Opcional" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="App sugerido">
              <Input value={form.app ?? ""} onChange={(e) => setForm({ ...form, app: e.target.value })} placeholder="Opcional" />
            </Field>
            <Field label="Servidor sugerido">
              <Input value={form.servidor ?? ""} onChange={(e) => setForm({ ...form, servidor: e.target.value })} placeholder="Opcional" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Início do teste">
              <Input type="date" value={form.data_inicio?.slice(0, 10) ?? ""} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
            </Field>
            <Field label="Fim do teste">
              <Input type="date" value={form.data_fim?.slice(0, 10) ?? ""} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} />
            </Field>
          </div>
          <Field label="Status">
            <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={form.status ?? "Teste solicitado"} onChange={(e) => setForm({ ...form, status: e.target.value as TrialLead["status"] })}>
              {TRIAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Interesse">
            <div className="flex gap-2">
              {TRIAL_INTERESTS.map((i) => (
                <button key={i} type="button" onClick={() => setForm({ ...form, interesse: i as TrialInterest })}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-1.5 text-sm",
                    form.interesse === i ? "border-primary bg-primary text-primary-foreground" : "border-border",
                  )}>{i}</button>
              ))}
            </div>
          </Field>
          <Field label="Observação">
            <Textarea value={form.observacao ?? ""} onChange={(e) => setForm({ ...form, observacao: e.target.value })} rows={3} />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Salvar teste</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function MessagesDialog({ lead, onClose }: { lead: TrialLead | null; onClose: () => void }) {
  if (!lead) return null;
  const isIndicado = !!(lead.indicado_por_nome || lead.indicado_por_whatsapp);
  const items: { key: string; label: string; text: string }[] = [
    ...(isIndicado ? [{ key: "indicado", label: "Cliente indicado", text: renderTemplate(INDICADO_TEMPLATE, lead) }] : []),
    { key: "boas", label: "Teste enviado", text: renderTemplate(TRIAL_TEMPLATES.boas_vindas, lead) },
    { key: "meio", label: "Meio do teste", text: renderTemplate(TRIAL_TEMPLATES.meio_teste, lead) },
    { key: "fim", label: "Fim do teste", text: renderTemplate(TRIAL_TEMPLATES.fim_teste, lead) },
    { key: "rec1", label: "Recuperação +1d", text: renderTemplate(TRIAL_TEMPLATES.recuperacao_1d, lead) },
    { key: "rec3", label: "Última chamada +3d", text: renderTemplate(TRIAL_TEMPLATES.recuperacao_3d, lead) },
  ];
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mensagens — {lead.nome || lead.whatsapp}</DialogTitle>
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

function ConvertDialog({
  lead, onClose, onConfirmConverted,
}: {
  lead: TrialLead | null;
  onClose: () => void;
  onConfirmConverted: (l: TrialLead) => void;
}) {
  if (!lead) return null;
  const payload = [
    `Nome: ${lead.nome || ""}`,
    `WhatsApp: ${lead.whatsapp}`,
    `Origem: ${lead.origem}`,
    lead.indicado_por_nome ? `Indicado por: ${lead.indicado_por_nome}` : "",
    lead.observacao ? `Observação: ${lead.observacao}` : "",
  ].filter(Boolean).join("\n");
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Converter em cliente</DialogTitle>
          <DialogDescription>
            Copie os dados e abra Clientes para concluir o cadastro. Nada é alterado automaticamente.
          </DialogDescription>
        </DialogHeader>
        <pre className="whitespace-pre-wrap rounded-md border border-border bg-surface-muted p-3 text-sm">
          {payload}
        </pre>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={async () => {
            await navigator.clipboard.writeText(payload);
            toast.success("Dados copiados");
          }}>Copiar dados para cadastro</Button>
          <Button asChild variant="outline">
            <Link to="/clientes">Abrir Clientes</Link>
          </Button>
          <Button onClick={() => onConfirmConverted(lead)}>Marcar como convertido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
