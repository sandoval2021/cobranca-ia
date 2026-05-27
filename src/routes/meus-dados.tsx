import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  UserCog,
  Save,
  Building2,
  CreditCard,
  Gift,
  ShieldCheck,
  LifeBuoy,
  LogOut,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Mail,
  Phone,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { HelpTip } from "@/components/ui-premium/HelpTip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLocalAuth } from "@/lib/use-local-auth";
import {
  COMPANIES_EVENT,
  daysUntilDue,
  ensureLocalAccount,
  getCompanyForUser,
  getCompanyStatus,
  getPlanById,
  saveCompany,
  slugify,
  type Company,
} from "@/lib/companies";
import { supabase } from "@/integrations/supabase/client";
import { PaymentTermsCard } from "@/components/companies/PaymentTermsCard";
import { BillingPaymentCard } from "@/components/billing/BillingPaymentCard";

export const Route = createFileRoute("/meus-dados")({ component: MinhaContaPage });

function formatDateBR(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function statusLabel(s: ReturnType<typeof getCompanyStatus>): {
  text: string;
  tone: "ok" | "warn" | "danger" | "muted";
} {
  switch (s) {
    case "ativa":
      return { text: "Ativa", tone: "ok" };
    case "teste":
      return { text: "Em teste grátis", tone: "warn" };
    case "vencida":
      return { text: "Vencida", tone: "danger" };
    case "suspensa":
      return { text: "Suspensa", tone: "danger" };
    case "cancelada":
      return { text: "Cancelada", tone: "danger" };
    default:
      return { text: "Sem conta vinculada", tone: "muted" };
  }
}

function MinhaContaPage() {
  const { user } = useLocalAuth();
  const [, setTick] = useState(0);
  useEffect(() => {
    const r = () => setTick((n) => n + 1);
    window.addEventListener(COMPANIES_EVENT, r);
    return () => window.removeEventListener(COMPANIES_EVENT, r);
  }, []);

  const company = useMemo<Company | null>(() => {
    const existing = getCompanyForUser(user?.email);
    if (existing) return existing;
    return ensureLocalAccount(user?.email, user?.nome, user?.whatsapp);
  }, [user?.email, user?.nome, user?.whatsapp]);

  const plan = getPlanById(company?.plano_id);
  const status = getCompanyStatus(company);
  const statusInfo = statusLabel(status);
  const dias = daysUntilDue(company);
  const emTeste = status === "teste";

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => ({
    nome: company?.nome ?? "",
    dono_nome: company?.dono_nome ?? user?.nome ?? "",
    dono_whatsapp: company?.dono_whatsapp ?? user?.whatsapp ?? "",
    observacao: company?.observacao ?? "",
  }));

  useEffect(() => {
    if (!company) return;
    setForm({
      nome: company.nome,
      dono_nome: company.dono_nome,
      dono_whatsapp: company.dono_whatsapp,
      observacao: company.observacao ?? "",
    });
  }, [company?.id]);

  function handleSave() {
    if (!company) {
      toast.error("Não foi possível preparar sua conta. Saia e entre novamente.");
      return;
    }
    if (!form.nome.trim()) return toast.error("Informe o nome da empresa.");
    saveCompany({
      ...company,
      nome: form.nome,
      dono_nome: form.dono_nome,
      dono_whatsapp: form.dono_whatsapp,
      observacao: form.observacao,
      slug: company.slug || slugify(form.nome),
    });
    toast.success("Dados atualizados.");
    setEditing(false);
  }

  async function handleLogout() {
    try {
      await supabase?.auth.signOut();
      toast.success("Sessão encerrada.");
    } catch {
      toast.error("Não foi possível sair agora. Tente novamente.");
    }
  }

  return (
    <PageContainer>
      <SectionHeader
        title="Minha conta"
        subtitle="Veja os dados da sua empresa, o plano atual e ajustes da conta."
      />

      <div className="space-y-3">
        {/* 1) Dados da empresa/base */}
        <Card
          icon={<Building2 className="h-5 w-5" />}
          title="Dados da empresa"
          hint="São os dados que aparecem nas suas mensagens e relatórios."
          action={
            !editing ? (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="h-9">
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
            ) : undefined
          }
        >
          {!editing ? (
            <dl className="grid gap-3 text-sm">
              <Row label="Nome da empresa" value={company?.nome ?? "—"} />
              <Row label="Responsável" value={company?.dono_nome ?? user?.nome ?? "—"} />
              <Row label="E-mail" value={user?.email ?? company?.dono_email ?? "—"} />
              <Row label="WhatsApp" value={company?.dono_whatsapp || user?.whatsapp || "—"} />
              <Row
                label="Segmento / observações"
                value={company?.observacao?.trim() || "Não informado"}
              />
            </dl>
          ) : (
            <div className="grid gap-3">
              <div>
                <Label>Nome da empresa</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex.: Minha Revenda"
                  className="h-11"
                />
              </div>
              <div>
                <Label>Responsável</Label>
                <Input
                  value={form.dono_nome}
                  onChange={(e) => setForm((f) => ({ ...f, dono_nome: e.target.value }))}
                  placeholder="Seu nome"
                  className="h-11"
                />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input
                  value={form.dono_whatsapp}
                  onChange={(e) => setForm((f) => ({ ...f, dono_whatsapp: e.target.value }))}
                  placeholder="(00) 00000-0000"
                  className="h-11"
                />
              </div>
              <div>
                <Label>Segmento / observações</Label>
                <Textarea
                  value={form.observacao}
                  onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
                  rows={3}
                  placeholder="Ex.: revenda de streaming, atendimento manhã/noite…"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                O e-mail de login não pode ser alterado aqui. Para trocar, fale com o suporte.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSave} className="h-11 flex-1 sm:flex-initial">
                  <Save className="h-4 w-4" />
                  Salvar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setEditing(false)}
                  className="h-11 flex-1 sm:flex-initial"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* 2) Plano atual */}
        <Card
          icon={<CreditCard className="h-5 w-5" />}
          title="Plano atual"
          hint="Mostra qual plano está ativo na sua conta."
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                {plan?.nome ?? "Plano não definido"}
              </span>
              <StatusBadge tone={statusInfo.tone} text={statusInfo.text} />
            </div>

            <dl className="grid gap-3 text-sm">
              <Row
                label="Valor mensal"
                value={
                  plan && plan.preco_mensal > 0
                    ? `R$ ${plan.preco_mensal.toFixed(2).replace(".", ",")}`
                    : "Sem valor configurado"
                }
              />
              <Row label="Forma de pagamento" value="Ainda não configurada" />
              <Row
                label="Próximo vencimento"
                value={company?.data_vencimento ? formatDateBR(company.data_vencimento) : "—"}
              />
              {dias !== null && status !== "vencida" && (
                <Row
                  label="Dias restantes"
                  value={dias >= 0 ? `${dias} dia${dias === 1 ? "" : "s"}` : "Vencido"}
                />
              )}
            </dl>
          </div>
        </Card>

        {/* 3) Teste grátis */}
        <Card icon={<Gift className="h-5 w-5" />} title="Teste grátis">
          {emTeste && dias !== null && dias >= 0 ? (
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                <Clock className="h-3.5 w-3.5" />
                Teste grátis — faltam {dias} dia{dias === 1 ? "" : "s"}
              </div>
              <p className="text-sm text-muted-foreground">
                Seu teste está ativo. Você pode cadastrar clientes e testar as principais funções.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              Status do teste será exibido aqui quando estiver ativo.
            </div>
          )}
        </Card>

        {/* 4) Pagamento (visual apenas) */}
        <Card icon={<CreditCard className="h-5 w-5" />} title="Pagamento">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
            Em breve você poderá pagar por Pix, cartão ou cartão recorrente.
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Nenhuma cobrança real é feita por aqui agora.
          </p>
        </Card>

        {/* 5) Segurança da conta */}
        <Card
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Segurança da conta"
          hint="Dados usados para acessar o painel."
        >
          <dl className="grid gap-3 text-sm">
            <Row
              label="E-mail de login"
              value={user?.email ?? "—"}
              icon={<Mail className="h-4 w-4 text-muted-foreground" />}
            />
            <Row
              label="WhatsApp cadastrado"
              value={company?.dono_whatsapp || user?.whatsapp || "—"}
              icon={<Phone className="h-4 w-4 text-muted-foreground" />}
            />
          </dl>

          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Nunca compartilhe sua senha com ninguém.</span>
          </div>

          <Button
            variant="outline"
            onClick={handleLogout}
            className="mt-3 h-11 w-full border-destructive/30 text-destructive hover:bg-destructive/5"
          >
            <LogOut className="h-4 w-4" />
            Sair da conta
          </Button>
        </Card>

        {/* 6) Pagamento (Mercado Pago — em preparação) */}
        <BillingPaymentCard company={company} />

        {/* 6b) Termos de pagamento */}
        <PaymentTermsCard />

        {/* 7) Ajuda */}
        <Card icon={<LifeBuoy className="h-5 w-5" />} title="Precisa de ajuda?">
          <p className="text-sm text-muted-foreground">
            Entre em contato com o suporte para ajustar plano, pagamento ou dados da conta.
          </p>
        </Card>
      </div>
    </PageContainer>
  );
}

function Card({
  icon,
  title,
  hint,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </span>
          <h3 className="truncate text-base font-semibold">{title}</h3>
          {hint && <HelpTip text={hint} />}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-2 break-words text-sm font-medium text-foreground">
        {icon}
        <span className="min-w-0 break-words">{value}</span>
      </dd>
    </div>
  );
}

function StatusBadge({ tone, text }: { tone: "ok" | "warn" | "danger" | "muted"; text: string }) {
  const map = {
    ok: { bg: "bg-emerald-100", fg: "text-emerald-800", Icon: CheckCircle2 },
    warn: { bg: "bg-amber-100", fg: "text-amber-800", Icon: Clock },
    danger: { bg: "bg-red-100", fg: "text-red-800", Icon: AlertTriangle },
    muted: { bg: "bg-muted", fg: "text-muted-foreground", Icon: UserCog },
  } as const;
  const { bg, fg, Icon } = map[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${bg} ${fg}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {text}
    </span>
  );
}
