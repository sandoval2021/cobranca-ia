import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus, Search, Copy, Check, X, Archive, MessageCircle, ExternalLink,
  Download, Upload, Pencil, Info, Eye, EyeOff,
} from "lucide-react";
import { listActiveServers } from "@/lib/server-catalog";

import { PageContainer } from "@/components/layout/PageContainer";
import { CompanyScopeNotice } from "@/components/companies/CompanyScopeNotice";
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
  exportTrialLeads, importTrialLeads, TRIAL_ORIGINS, TRIAL_STATUSES,
  TRIAL_TEMPLATES, INDICADO_TEMPLATE, FOLLOWUP_LABEL, renderTemplate, waLink,
  type TrialLead, type TrialOrigin, type FollowUpStatus,
} from "@/lib/trial-leads";
import {
  saveReferral, updateReferralByLead, summarizeByIndicador, getReferralRules,
  bonusDescription, renderReferralMessage, applyBonusForIndicator,
} from "@/lib/referrals";
import { useSecurityGuard } from "@/components/security/PinConfirmDialog";
import { ProtectedModeBadge } from "@/components/security/ProtectedModeBadge";
import { canCreateTrialLead } from "@/lib/plan-limits";
import { PlanLimitNotice } from "@/components/companies/PlanLimitNotice";
import { supabase } from "@/integrations/supabase/compat";
import { getActiveAccountId, listCustomersAdmin } from "@/lib/rpc-admin";
import { validateWhatsapp, maskBR, maskIntl, onlyDigits } from "@/lib/whatsapp-validation";
import { listActiveServices, formatBRL, type ServiceItem } from "@/lib/services-catalog";


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
  "Indicados", "Hoje", "Atrasados",
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
  
  const [closedLead, setClosedLead] = useState<TrialLead | null>(null);
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
      const decision = canCreateTrialLead();
      if (!decision.allowed) {
        toast.error(decision.message ?? "Bloqueado pelo plano");
        return;
      }
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
      if (s) {
        const bonificacao = bonusDescription(rules);
        if (s.fecharam >= rules.meta) {
          // aplica a bonificação automaticamente (zera o ciclo) e mantém histórico
          const aplicadas = applyBonusForIndicator(indicatorKey, rules.meta);
          if (aplicadas >= rules.meta) {
            const msg = renderReferralMessage("bateu_meta", {
              indicador: s.nome, fechadas: s.fecharam, faltam: 0, meta: rules.meta, bonificacao,
            });
            navigator.clipboard?.writeText(msg).catch(() => {});
            const wa = (s.whatsapp || "").replace(/\D/g, "");
            toast.success(`Bonificação liberada para ${s.nome}!`, {
              description: rules.tipo === "1mes"
                ? "Renovação 1 mês grátis liberada. Mensagem copiada — confira em Clientes para aplicar a renovação."
                : "Mensagem de premiação copiada. Veja em Indicações.",
              action: wa ? {
                label: "WhatsApp",
                onClick: () => window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, "_blank"),
              } : undefined,
              duration: 12000,
            });
          }
        } else {
          // ainda falta — notifica progresso
          const msg = renderReferralMessage("fechou_falta", {
            indicador: s.nome, fechadas: s.fecharam, faltam: s.faltamParaMeta, meta: rules.meta, bonificacao,
          });
          navigator.clipboard?.writeText(msg).catch(() => {});
          const wa = (s.whatsapp || "").replace(/\D/g, "");
          toast.info(`Indicador ${s.nome}: ${s.fecharam} de ${rules.meta} — falta ${s.faltamParaMeta}`, {
            description: "Mensagem para o indicador copiada.",
            action: wa ? {
              label: "WhatsApp",
              onClick: () => window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, "_blank"),
            } : undefined,
            duration: 10000,
          });
        }
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
      <div className="mb-1"><ProtectedModeBadge /></div>
      <CompanyScopeNotice moduleKey="cobranca_ia_trial_leads_v1" />
      <PlanLimitNotice moduleKey="testes" />
      <SectionHeader
        title="Testes"
        subtitle="Acompanhe pessoas que pediram teste e ainda não viraram clientes."


        action={
          <div className="grid grid-cols-3 gap-1.5">
            <Button size="sm" onClick={() => { setEditing(null); setOpenNew(true); }} className="gap-1 px-2 text-xs">
              <Plus className="h-3.5 w-3.5" /> Novo
            </Button>
            <Button size="sm" variant="outline" onClick={handleExport} className="gap-1 px-2 text-xs">
              <Download className="h-3.5 w-3.5" /> Exportar
            </Button>
            <label className="inline-flex w-full">
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
              <Button size="sm" variant="outline" asChild className="w-full gap-1 px-2 text-xs cursor-pointer">
                <span><Upload className="h-3.5 w-3.5" /> Importar</span>
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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7 mb-4">
        <StatTile label="Novos" value={stats.novos} />
        <StatTile label="Em teste" value={stats.emTeste} />
        <StatTile label="Aguardando" value={stats.aguardando} />
        <StatTile label="Vencendo hoje" value={stats.vencendoHoje} />
        <StatTile label="Fecharam" value={stats.fecharam} />
        <StatTile label="Não fecharam" value={stats.naoFecharam} />
        <StatTile label="Indicados" value={stats.indicados} />
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
                <Button size="sm" variant="outline" onClick={() => setClosedLead(l)} className="gap-1">
                  <Check className="h-3.5 w-3.5" /> Fechou
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleLost(l)} className="gap-1">
                  <X className="h-3.5 w-3.5" /> Não fechou
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

      <ClosedDialog
        lead={closedLead}
        onClose={() => setClosedLead(null)}
        onConverted={(l) => {
          // 1) marca como fechou no fluxo de indicações/bonificação
          handleClosed(l);
          // 2) arquiva o lead para sair da lista de testes ativos
          archiveTrialLead(l.id);
          setClosedLead(null);
          reload();
        }}
      />

      {securityDialog}
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

function NewTrialSheet({
  open, onOpenChange, editing, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: TrialLead | null;
  onSave: (input: Partial<TrialLead> & { whatsapp: string }) => void;
}) {
  const [form, setForm] = useState<Partial<TrialLead> & { whatsapp: string }>({
    whatsapp: "", origem: "Outro", horas_teste: 2,
  });
  const [showSenha, setShowSenha] = useState(false);
  const [intl, setIntl] = useState(false); // WhatsApp do lead — fora do Brasil
  const [intlInd, setIntlInd] = useState(false); // WhatsApp indicador — fora do Brasil
  const [waErr, setWaErr] = useState<string | undefined>();
  const [waIndErr, setWaIndErr] = useState<string | undefined>();
  const [serviceId, setServiceId] = useState<string>("");
  const [matchedCust, setMatchedCust] = useState<{ id?: string; name?: string } | null>(null);
  const servers = useMemo(() => listActiveServers(), [open]);
  const services = useMemo<ServiceItem[]>(() => listActiveServices(), [open]);

  function nowLocalIso() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }
  function addHoursIso(startIso: string | undefined, hours: number) {
    const base = startIso ? new Date(startIso) : new Date();
    if (Number.isNaN(base.getTime())) return "";
    const end = new Date(base.getTime() + hours * 3600 * 1000);
    end.setMinutes(end.getMinutes() - end.getTimezoneOffset());
    return end.toISOString().slice(0, 16);
  }

  useEffect(() => {
    if (editing) {
      setForm(editing);
      // detecta se whatsapp do lead parece BR (10/11 digitos) ou intl
      const dE = onlyDigits(editing.whatsapp);
      setIntl(!(dE.length === 10 || dE.length === 11));
      const dI = onlyDigits(editing.indicado_por_whatsapp || "");
      setIntlInd(dI.length > 0 && !(dI.length === 10 || dI.length === 11));
      // tenta achar service pelo valor
      if (editing.valor_cents) {
        const found = services.find((s) => s.preco_cents === editing.valor_cents);
        setServiceId(found?.id ?? "");
      } else setServiceId("");
    } else {
      const inicio = nowLocalIso();
      setForm({
        whatsapp: "", origem: "Outro",
        data_inicio: inicio, horas_teste: 2, data_fim: addHoursIso(inicio, 2),
      });
      setServiceId("");
      setIntl(false);
      setIntlInd(false);
    }
    setShowSenha(false);
    setWaErr(undefined);
    setWaIndErr(undefined);
    setMatchedCust(null);
  }, [editing, open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recalcula Fim do teste sempre que Início ou Horas mudarem
  useEffect(() => {
    if (form.data_inicio && form.horas_teste != null) {
      const novo = addHoursIso(form.data_inicio, form.horas_teste);
      if (novo && novo !== form.data_fim) {
        setForm((f) => ({ ...f, data_fim: novo }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.data_inicio, form.horas_teste]);

  function onWaChange(v: string) {
    const formatted = intl ? maskIntl(v) : maskBR(v);
    setForm((f) => ({ ...f, whatsapp: formatted }));
    if (waErr) setWaErr(undefined);
  }
  function onWaIndChange(v: string) {
    const formatted = intlInd ? maskIntl(v) : maskBR(v);
    setForm((f) => ({ ...f, indicado_por_whatsapp: formatted }));
    if (waIndErr) setWaIndErr(undefined);
    if (matchedCust) setMatchedCust(null);
  }

  // Lookup: quando o WhatsApp indicador estiver válido, busca cliente existente
  async function lookupIndicator() {
    const v = form.indicado_por_whatsapp || "";
    if (!v.trim()) return;
    const check = validateWhatsapp(v, { international: intlInd });
    if (!check.ok) return;
    const { accountId } = await getActiveAccountId();
    if (!accountId) return;
    const search = check.digits.slice(-8); // últimos 8 dígitos
    const res = await listCustomersAdmin({ p_company_id: accountId, p_search: search, p_limit: 5 });
    const rows = (res.data ?? []) as Array<Record<string, unknown>>;
    const found = rows.find((r) => {
      const raw = String(r.whatsapp_e164 || r.whatsapp || "");
      return onlyDigits(raw).endsWith(search);
    });
    if (found) {
      const id = String(found.id || "");
      const name = String(found.name || found.nome || "Cliente");
      setMatchedCust({ id, name });
      setForm((f) => ({
        ...f,
        indicado_por_cliente_id: id,
        indicado_por_nome: f.indicado_por_nome?.trim() ? f.indicado_por_nome : name,
      }));
    } else {
      setMatchedCust(null);
    }
  }

  function submit() {
    const waCheck = validateWhatsapp(form.whatsapp || "", { international: intl });
    if (!waCheck.ok) { setWaErr(waCheck.error); toast.error(waCheck.error || "WhatsApp inválido"); return; }
    if (form.indicado_por_whatsapp?.trim()) {
      const c = validateWhatsapp(form.indicado_por_whatsapp, { international: intlInd });
      if (!c.ok) { setWaIndErr(c.error); toast.error(c.error || "WhatsApp do indicador inválido"); return; }
    }
    if (!form.servidor?.trim()) { toast.error("Selecione um servidor"); return; }
    if (form.usuario?.trim() && !form.senha?.trim()) { toast.error("Informe a senha para esse usuário"); return; }
    if (form.senha?.trim() && !form.usuario?.trim()) { toast.error("Informe o usuário para essa senha"); return; }
    const horas = Number(form.horas_teste);
    if (!horas || horas <= 0) { toast.error("Informe as horas do teste"); return; }
    let valor_cents: number | undefined;
    if (serviceId) {
      const svc = services.find((s) => s.id === serviceId);
      if (svc) valor_cents = svc.preco_cents;
    } else if (editing?.valor_cents) {
      valor_cents = editing.valor_cents;
    }
    onSave({
      ...form,
      whatsapp: waCheck.e164,
      indicado_por_whatsapp: form.indicado_por_whatsapp?.trim()
        ? validateWhatsapp(form.indicado_por_whatsapp, { international: intlInd }).e164
        : undefined,
      valor_cents,
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-base">{editing ? "Editar teste" : "Novo teste"}</SheetTitle>
          <SheetDescription className="text-xs">Apenas a data em que o teste foi pedido é necessária. Nada é enviado automaticamente.</SheetDescription>
        </SheetHeader>
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Nome">
              <Input value={form.nome ?? ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Opcional" />
            </Field>
            <Field label="WhatsApp *">
              <Input
                value={form.whatsapp ?? ""}
                onChange={(e) => onWaChange(e.target.value)}
                placeholder={intl ? "+DDI número" : "(00) 90000-0000"}
                inputMode="tel"
                aria-invalid={!!waErr}
              />
              <label className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={intl}
                  onChange={(e) => {
                    setIntl(e.target.checked);
                    // re-aplica máscara ao trocar
                    const v = form.whatsapp || "";
                    setForm((f) => ({ ...f, whatsapp: e.target.checked ? maskIntl(v) : maskBR(v) }));
                    setWaErr(undefined);
                  }}
                />
                Fora do Brasil (internacional)
              </label>
              {waErr && <p className="text-[11px] text-destructive">{waErr}</p>}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Origem">
              <select className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={form.origem ?? "Outro"} onChange={(e) => setForm({ ...form, origem: e.target.value as TrialOrigin })}>
                {TRIAL_ORIGINS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={form.status ?? "Teste solicitado"} onChange={(e) => setForm({ ...form, status: e.target.value as TrialLead["status"] })}>
                {TRIAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Quem indicou">
              <Input
                value={form.indicado_por_nome ?? ""}
                onChange={(e) => setForm({ ...form, indicado_por_nome: e.target.value })}
                placeholder="Opcional"
              />
              {matchedCust && (
                <p className="text-[11px] text-success">Cliente existente · {matchedCust.name}</p>
              )}
            </Field>
            <Field label="WhatsApp indicador">
              <Input
                value={form.indicado_por_whatsapp ?? ""}
                onChange={(e) => onWaIndChange(e.target.value)}
                onBlur={lookupIndicator}
                placeholder="Opcional"
                inputMode="tel"
                aria-invalid={!!waIndErr}
              />
              <label className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={intlInd}
                  onChange={(e) => {
                    setIntlInd(e.target.checked);
                    const v = form.indicado_por_whatsapp || "";
                    setForm((f) => ({ ...f, indicado_por_whatsapp: e.target.checked ? maskIntl(v) : maskBR(v) }));
                    setWaIndErr(undefined);
                  }}
                />
                Fora do Brasil
              </label>
              {waIndErr && <p className="text-[11px] text-destructive">{waIndErr}</p>}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Servidor *">
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={form.servidor ?? ""}
                onChange={(e) => setForm({ ...form, servidor: e.target.value })}
              >
                <option value="">Selecione…</option>
                {servers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Servidor adicional">
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={form.servidor_adicional ?? ""}
                onChange={(e) => setForm({ ...form, servidor_adicional: e.target.value })}
              >
                <option value="">Nenhum</option>
                {servers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Usuário">
              <Input value={form.usuario ?? ""} onChange={(e) => setForm({ ...form, usuario: e.target.value })} autoComplete="off" />
            </Field>
            <Field label="Senha">
              <div className="relative">
                <Input
                  type={showSenha ? "text" : "password"}
                  value={form.senha ?? ""}
                  onChange={(e) => setForm({ ...form, senha: e.target.value })}
                  autoComplete="new-password"
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowSenha((v) => !v)}
                  aria-label={showSenha ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
                >
                  {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Field label="Serviço">
              {services.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-surface-muted px-2 py-1.5 text-xs">
                  Nenhum serviço cadastrado.{" "}
                  <Link to="/cadastros-servicos" className="underline">Cadastrar</Link>
                </div>
              ) : (
                <select
                  className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.nome} — {formatBRL(s.preco_cents)}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Horas">
              <Input
                type="number" min={1} max={720}
                value={form.horas_teste ?? 2}
                onChange={(e) => setForm({ ...form, horas_teste: Number(e.target.value) })}
              />
            </Field>
            <Field label="Início">
              <Input
                type="datetime-local"
                value={form.data_inicio?.slice(0, 16) ?? ""}
                onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Observação">
            <Textarea value={form.observacao ?? ""} onChange={(e) => setForm({ ...form, observacao: e.target.value })} rows={2} />
          </Field>
        </div>
        <div className="mt-3 flex justify-end gap-2">
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


// --- ClosedDialog: converts trial lead into active customer ---
function toE164FromLead(raw: string): string {
  const trimmed = (raw || "").trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return `+${digits}`;
}

function addDaysDate(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function fmtBR(d: Date) {
  return d.toLocaleDateString("pt-BR");
}

function buildClosedMessage(opts: {
  vencimento: Date;
  app?: string;
  usuario?: string;
  telas?: number;
  servidor?: string;
}) {
  const lines: string[] = [];
  lines.push("Olá, tudo bem? 😊");
  lines.push("");
  lines.push("Muito obrigado por fechar conosco!");
  lines.push(`Seu acesso ficou ativo até: ${fmtBR(opts.vencimento)}.`);
  lines.push("Vamos te lembrar 3 dias antes do vencimento para você não ficar sem acesso.");
  const info: string[] = [];
  if (opts.app && opts.app.trim()) info.push(`App: ${opts.app.trim()}`);
  if (opts.usuario && opts.usuario.trim()) info.push(`Usuário: ${opts.usuario.trim()}`);
  if (opts.telas && opts.telas > 0) info.push(`Telas: ${opts.telas}`);
  if (opts.servidor && opts.servidor.trim()) info.push(`Servidor: ${opts.servidor.trim()}`);
  if (info.length) {
    lines.push("");
    lines.push("Informações do seu acesso:");
    lines.push(...info);
  }
  lines.push("");
  lines.push("Qualquer dúvida, é só chamar por aqui.");
  return lines.join("\n");
}

function ClosedDialog({
  lead, onClose, onConverted,
}: {
  lead: TrialLead | null;
  onClose: () => void;
  onConverted: (l: TrialLead) => void;
}) {
  const [months, setMonths] = useState<number>(1);
  const [customMonths, setCustomMonths] = useState<string>("");
  const [valor, setValor] = useState<string>("");
  const [telas, setTelas] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { msg: string; waLink: string }>(null);

  useEffect(() => {
    if (lead) {
      setMonths(1);
      setCustomMonths("");
      setValor(lead.valor_cents ? (lead.valor_cents / 100).toFixed(2).replace(".", ",") : "");
      setTelas("");
      setDone(null);
      setBusy(false);
    }
  }, [lead]);

  if (!lead) return null;

  const effectiveMonths = months === -1
    ? Math.max(1, Math.min(36, parseInt(customMonths || "0", 10) || 0))
    : months;
  const today = new Date();
  const vencimento = addDaysDate(today, effectiveMonths * 30);
  const valorCents = (() => {
    const n = parseFloat((valor || "").replace(/\./g, "").replace(",", "."));
    if (!isFinite(n) || n <= 0) return lead.valor_cents ?? 0;
    return Math.round(n * 100);
  })();
  const telasNum = parseInt(telas || "0", 10) || 0;

  async function confirmar() {
    if (!lead) return;
    const currentLead = lead;
    if (effectiveMonths < 1) {
      toast.error("Informe a quantidade de meses (mínimo 1).");
      return;
    }
    if (!supabase) {
      toast.error("Conexão indisponível.");
      return;
    }
    setBusy(true);
    const { accountId: companyId, error: companyErr } = await getActiveAccountId();
    if (!companyId) {
      setBusy(false);
      console.warn("[fechou] sem UUID de conta", companyErr);
      toast.error("Não foi possível preparar sua conta. Saia e entre novamente.");
      return;
    }
    const e164 = toE164FromLead(currentLead.whatsapp);
    if (!e164) {
      setBusy(false);
      toast.error("WhatsApp inválido neste teste.");
      return;
    }
    const payload = {
      p_company_id: companyId,
      p_name: (currentLead.nome || "").trim() || "Cliente",
      p_whatsapp_e164: e164,
      p_amount_cents: valorCents,
      p_due_day: vencimento.getDate(),
      p_notes: `Convertido do teste em ${fmtBR(today)} — ${effectiveMonths} mês(es). Vencimento ${fmtBR(vencimento)}.`,
    };
    const { error } = await supabase.rpc("create_customer_admin", payload);
    if (error) {
      setBusy(false);
      const e = error as { code?: string; message?: string };
      const msg = (e.message ?? "").toLowerCase();
      if (e.code === "23505" || msg.includes("duplicate") || msg.includes("unique")) {
        toast.error("Este WhatsApp já está cadastrado em Clientes.");
      } else {
        toast.error("Não foi possível converter o teste. Tente novamente.");
      }
      console.warn("[fechou] error", { code: e.code, message: e.message });
      return;
    }
    const finalMsg = buildClosedMessage({
      vencimento,
      app: currentLead.app,
      usuario: currentLead.usuario,
      telas: telasNum > 0 ? telasNum : undefined,
      servidor: currentLead.servidor,
    });
    const waDigits = e164.replace(/\D/g, "");
    const waHref = `https://wa.me/${waDigits}?text=${encodeURIComponent(finalMsg)}`;
    setBusy(false);
    setDone({ msg: finalMsg, waLink: waHref });
    toast.success("Cliente convertido com sucesso.");
    onConverted(currentLead);
  }

  const lembrete = addDaysDate(vencimento, -3);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cliente fechou?</DialogTitle>
          <DialogDescription>
            Escolha por quantos meses o cliente contratou. O vencimento será calculado automaticamente (30 dias por mês).
          </DialogDescription>
        </DialogHeader>

        {!done ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonths(m)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm",
                    months === m ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-surface-muted",
                  )}
                >{m} {m === 1 ? "mês" : "meses"}</button>
              ))}
              <button
                type="button"
                onClick={() => setMonths(-1)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm",
                  months === -1 ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-surface-muted",
                )}
              >Personalizado</button>
            </div>
            {months === -1 && (
              <div>
                <Label className="text-xs">Quantidade de meses</Label>
                <Input
                  type="number"
                  min={1}
                  max={36}
                  value={customMonths}
                  onChange={(e) => setCustomMonths(e.target.value)}
                  placeholder="Ex.: 6"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data de início</Label>
                <div className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm">{fmtBR(today)}</div>
              </div>
              <div>
                <Label className="text-xs">Vencimento</Label>
                <div className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm font-medium">{fmtBR(vencimento)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Valor mensal (R$)</Label>
                <Input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Telas (opcional)</Label>
                <Input
                  type="number"
                  min={0}
                  value={telas}
                  onChange={(e) => setTelas(e.target.value)}
                  placeholder="Ex.: 1"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Lembrete previsto para: {fmtBR(lembrete)}
            </p>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
              <Button onClick={confirmar} disabled={busy}>
                {busy ? "Convertendo…" : "Confirmar fechamento"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              Cliente convertido. Vencimento em <strong>{fmtBR(vencimento)}</strong>.
            </p>
            <Textarea
              value={done.msg}
              readOnly
              className="min-h-[180px] text-sm"
            />
            <DialogFooter className="flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(done.msg);
                  toast.success("Mensagem copiada");
                }}
                className="gap-1"
              >
                <Copy className="h-3.5 w-3.5" /> Copiar mensagem
              </Button>
              <Button asChild className="gap-1">
                <a href={done.waLink} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-3.5 w-3.5" /> Abrir WhatsApp
                </a>
              </Button>
              <Button asChild variant="outline" className="gap-1">
                <Link to="/clientes">
                  <ExternalLink className="h-3.5 w-3.5" /> Ver cliente
                </Link>
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
