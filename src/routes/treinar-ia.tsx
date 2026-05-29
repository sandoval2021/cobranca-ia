import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  BookOpen,
  HelpCircle,
  Wallet,
  Smartphone,
  PlayCircle,
  SlidersHorizontal,
  Plus,
  Pencil,
  Trash2,
  Save,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { HelpTip } from "@/components/ui-premium/HelpTip";
import { getActiveCompanyId } from "@/lib/company-scope";
import {
  getCompanyAiKnowledge,
  upsertCompanyAiKnowledge,
  listCompanyAiFaqs,
  upsertCompanyAiFaq,
  deleteCompanyAiFaq,
  getCompanyAiPaymentSettings,
  upsertCompanyAiPaymentSettings,
  listCompanyAiApps,
  upsertCompanyAiApp,
  deleteCompanyAiApp,
  simulateAiReply,
} from "@/lib/ai-training/ai-training.functions";

export const Route = createFileRoute("/treinar-ia")({
  head: () => ({ meta: [{ title: "Treinar IA — CobraEasy" }] }),
  component: TreinarIaPage,
});

const KNOWLEDGE_LIMIT = 20000;

const EXAMPLE_KNOWLEDGE = `Somos a TV Premium.
Trabalhamos com IPTV: canais, filmes e séries.

Nossos planos:
- Plano Individual: R$30/mês (1 tela)
- Plano Família: R$60/mês (2 telas)
- Plano Premium: R$90/mês (4 telas)

Aplicativos recomendados:
- Bob Player
- IBO Player
- VU Player Pro
Apps pagos custam R$35 por ano.

Horário de atendimento:
Segunda a sábado, 07h às 20h.
Domingo, 07h às 14h.

Quando o cliente reclamar de travamento:
1. Pedir para atualizar o aplicativo.
2. Reiniciar TV e roteador por 2 minutos.
3. Perguntar qual aplicativo está usando.
4. Pedir print da tela.

Atendemos apenas por mensagem de texto.
Sempre responder de forma educada e objetiva.`;

function TreinarIaPage() {
  const companyId = getActiveCompanyId();
  if (!companyId) {
    return (
      <PageContainer>
        <SectionHeader title="Treinar IA" subtitle="Selecione uma empresa ativa para treinar a IA." />
      </PageContainer>
    );
  }
  return (
    <PageContainer>
      <SectionHeader
        title="Treinar IA"
        subtitle="Ensine sua IA a responder do jeito da sua empresa."
      />
      <Tabs defaultValue="knowledge" className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-auto">
          <TabsTrigger value="knowledge" className="text-xs sm:text-sm">
            <BookOpen className="mr-1 h-3.5 w-3.5" />Conhecimento
          </TabsTrigger>
          <TabsTrigger value="faqs" className="text-xs sm:text-sm">
            <HelpCircle className="mr-1 h-3.5 w-3.5" />FAQs
          </TabsTrigger>
          <TabsTrigger value="rules" className="text-xs sm:text-sm">
            <SlidersHorizontal className="mr-1 h-3.5 w-3.5" />Regras
          </TabsTrigger>
          <TabsTrigger value="payment" className="text-xs sm:text-sm">
            <Wallet className="mr-1 h-3.5 w-3.5" />Pagamento
          </TabsTrigger>
          <TabsTrigger value="apps" className="text-xs sm:text-sm">
            <Smartphone className="mr-1 h-3.5 w-3.5" />Apps
          </TabsTrigger>
          <TabsTrigger value="test" className="text-xs sm:text-sm">
            <PlayCircle className="mr-1 h-3.5 w-3.5" />Testar
          </TabsTrigger>
        </TabsList>
        <TabsContent value="knowledge"><KnowledgeTab companyId={companyId} /></TabsContent>
        <TabsContent value="faqs"><FaqsTab companyId={companyId} /></TabsContent>
        <TabsContent value="rules"><RulesTab companyId={companyId} /></TabsContent>
        <TabsContent value="payment"><PaymentTab companyId={companyId} /></TabsContent>
        <TabsContent value="apps"><AppsTab companyId={companyId} /></TabsContent>
        <TabsContent value="test"><TestTab companyId={companyId} /></TabsContent>
      </Tabs>
    </PageContainer>
  );
}

// ========================================================
// KNOWLEDGE
// ========================================================
function KnowledgeTab({ companyId }: { companyId: string }) {
  const get = useServerFn(getCompanyAiKnowledge);
  const save = useServerFn(upsertCompanyAiKnowledge);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await get({ data: { companyId } });
        setText((r.knowledge?.knowledge_text as string) ?? "");
      } catch (e: any) {
        toast.error(e?.message ?? "Erro ao carregar");
      } finally {
        setLoading(false);
      }
    })();
  }, [companyId]);

  async function handleSave() {
    if (text.length > KNOWLEDGE_LIMIT) {
      toast.error(`Limite de ${KNOWLEDGE_LIMIT.toLocaleString()} caracteres excedido.`);
      return;
    }
    setSaving(true);
    try {
      await save({ data: { company_id: companyId, knowledge_text: text } });
      toast.success("Treinamento salvo");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Conte para a IA sobre sua empresa
          <HelpTip text="Quanto mais informações você colocar, melhor a IA responde seus clientes." />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Descreva planos, aplicativos, horários, suporte e qualquer regra. A IA usará isso
          em todas as respostas, sempre respeitando as regras globais do CobraEasy.
        </p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={EXAMPLE_KNOWLEDGE}
          rows={18}
          className="font-mono text-xs"
          maxLength={KNOWLEDGE_LIMIT + 1000}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className={text.length > KNOWLEDGE_LIMIT ? "text-destructive font-medium" : "text-muted-foreground"}>
            {text.length.toLocaleString()} de {KNOWLEDGE_LIMIT.toLocaleString()} caracteres
          </span>
          <span className="text-muted-foreground">
            Evite colocar senhas ou dados sensíveis.
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-1 h-4 w-4" />
            {saving ? "Salvando…" : "Salvar treinamento"}
          </Button>
          <Button variant="outline" onClick={() => setText("")}>Limpar</Button>
          <Button variant="ghost" onClick={() => setText(EXAMPLE_KNOWLEDGE)}>
            <Sparkles className="mr-1 h-4 w-4" />Restaurar exemplo
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ========================================================
// FAQs
// ========================================================
const FAQ_CATEGORIES = [
  "Saudação", "Preço", "Teste", "Aplicativos", "Suporte", "Pagamento", "Renovação", "Cancelamento", "Outros",
];

type Faq = {
  id: string;
  company_id: string;
  category: string;
  question: string;
  answer: string;
  is_active: boolean;
};

function FaqsTab({ companyId }: { companyId: string }) {
  const list = useServerFn(listCompanyAiFaqs);
  const save = useServerFn(upsertCompanyAiFaq);
  const del = useServerFn(deleteCompanyAiFaq);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<Faq> | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const r = await list({ data: { companyId } });
      setFaqs((r.faqs as Faq[]) ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [companyId]);

  async function handleSave() {
    if (!edit?.question?.trim() || !edit?.answer?.trim()) {
      toast.error("Preencha pergunta e resposta");
      return;
    }
    try {
      await save({
        data: {
          ...edit,
          company_id: companyId,
          category: edit.category || "Outros",
          question: edit.question.trim(),
          answer: edit.answer.trim(),
          is_active: edit.is_active !== false,
        } as any,
      });
      toast.success("FAQ salva");
      setEdit(null);
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    }
  }
  async function handleDelete(id: string) {
    if (!confirm("Excluir esta FAQ?")) return;
    try {
      await del({ data: { id } });
      reload();
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Cadastre perguntas comuns dos seus clientes e a resposta ideal. A IA usará como preferência.
        </p>
        <Button size="sm" onClick={() => setEdit({ category: "Preço", question: "", answer: "", is_active: true })}>
          <Plus className="mr-1 h-4 w-4" /> Nova pergunta
        </Button>
      </div>

      {faqs.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
          Nenhuma pergunta cadastrada ainda.
        </CardContent></Card>
      ) : (
        faqs.map((f) => (
          <Card key={f.id}>
            <CardContent className="p-3 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">{f.category}</Badge>
                    {!f.is_active && <Badge variant="outline" className="text-xs">Inativa</Badge>}
                  </div>
                  <p className="mt-1 font-medium text-sm">{f.question}</p>
                  <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{f.answer}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEdit(f)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(f.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar pergunta" : "Nova pergunta"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div>
                <Label>Categoria</Label>
                <Select value={edit.category ?? "Outros"} onValueChange={(v) => setEdit({ ...edit, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FAQ_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Pergunta ou situação</Label>
                <Input
                  value={edit.question ?? ""}
                  onChange={(e) => setEdit({ ...edit, question: e.target.value })}
                  placeholder="Ex.: Qual o valor do plano?"
                />
              </div>
              <div>
                <Label>Resposta recomendada</Label>
                <Textarea
                  rows={4}
                  value={edit.answer ?? ""}
                  onChange={(e) => setEdit({ ...edit, answer: e.target.value })}
                  placeholder="Ex.: Nosso plano mensal começa em R$30. Temos opções 1, 2 e família."
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-2">
                <Label className="m-0">Ativa</Label>
                <Switch checked={edit.is_active !== false} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button onClick={handleSave}><Save className="mr-1 h-4 w-4" />Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ========================================================
// RULES
// ========================================================
function RulesTab({ companyId }: { companyId: string }) {
  const get = useServerFn(getCompanyAiKnowledge);
  const save = useServerFn(upsertCompanyAiKnowledge);
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await get({ data: { companyId } });
        setState({
          tone: r.knowledge?.tone ?? "profissional",
          answer_length: r.knowledge?.answer_length ?? "media",
          allow_after_hours: r.knowledge?.allow_after_hours ?? true,
          accepts_audio: r.knowledge?.accepts_audio ?? false,
          auto_offer_trial: r.knowledge?.auto_offer_trial ?? false,
          human_on_complaint: r.knowledge?.human_on_complaint ?? true,
          human_when_unsure: r.knowledge?.human_when_unsure ?? true,
          allow_paid_apps_info: r.knowledge?.allow_paid_apps_info ?? true,
          use_manual_pix_fallback: r.knowledge?.use_manual_pix_fallback ?? true,
        });
      } catch (e: any) { toast.error(e?.message ?? "Erro"); }
      finally { setLoading(false); }
    })();
  }, [companyId]);

  async function handleSave() {
    setSaving(true);
    try {
      await save({ data: { company_id: companyId, ...state } });
      toast.success("Regras salvas");
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
    finally { setSaving(false); }
  }

  if (loading || !state) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>;

  const toggles: Array<[keyof typeof state, string, string]> = [
    ["allow_after_hours", "Responder fora do horário", "Se desativado, fora do horário a IA pede para aguardar."],
    ["accepts_audio", "Aceita áudio", "Se desativado, a IA pede mensagem de texto."],
    ["auto_offer_trial", "Oferecer teste automaticamente", "A IA pode oferecer teste sem o cliente pedir."],
    ["human_on_complaint", "Encaminhar humano em reclamações", "Reclamações vão direto para atendente humano."],
    ["human_when_unsure", "Chamar humano quando não souber", "Se a IA não souber com segurança, chama humano."],
    ["allow_paid_apps_info", "Falar sobre aplicativos pagos", "A IA pode citar apps pagos e seus valores."],
    ["use_manual_pix_fallback", "Usar Pix manual se Mercado Pago não estiver conectado", "Se a empresa não tiver MP conectado, a IA envia o Pix manual cadastrado."],
  ];

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Regras de atendimento</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="flex items-center gap-1">Tom da IA <HelpTip text="Como a IA conversa com o cliente." /></Label>
            <Select value={state.tone} onValueChange={(v) => setState({ ...state, tone: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="amigavel">Amigável</SelectItem>
                <SelectItem value="profissional">Profissional</SelectItem>
                <SelectItem value="vendedor">Vendedor</SelectItem>
                <SelectItem value="tecnico">Técnico</SelectItem>
                <SelectItem value="objetivo">Objetivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="flex items-center gap-1">Tamanho da resposta <HelpTip text="Quão extensa a IA responde." /></Label>
            <Select value={state.answer_length} onValueChange={(v) => setState({ ...state, answer_length: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="curta">Curta</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="detalhada">Detalhada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          {toggles.map(([key, label, help]) => (
            <div key={String(key)} className="flex items-center justify-between rounded-lg border p-3">
              <Label className="m-0 flex items-center gap-1 text-sm">
                {label}
                <HelpTip text={help} />
              </Label>
              <Switch
                checked={!!state[key]}
                onCheckedChange={(v) => setState({ ...state, [key]: v })}
              />
            </div>
          ))}
        </div>

        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-1 h-4 w-4" />{saving ? "Salvando…" : "Salvar regras"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ========================================================
// PAYMENT
// ========================================================
function PaymentTab({ companyId }: { companyId: string }) {
  const get = useServerFn(getCompanyAiPaymentSettings);
  const save = useServerFn(upsertCompanyAiPaymentSettings);
  const [state, setState] = useState<any>({
    manual_pix_key: "", manual_pix_holder: "", manual_pix_bank: "", payment_note: "",
  });
  const [mp, setMp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await get({ data: { companyId } });
        if (r.payment) setState({
          manual_pix_key: r.payment.manual_pix_key ?? "",
          manual_pix_holder: r.payment.manual_pix_holder ?? "",
          manual_pix_bank: r.payment.manual_pix_bank ?? "",
          payment_note: r.payment.payment_note ?? "",
        });
        setMp(r.mercado_pago);
      } catch (e: any) { toast.error(e?.message ?? "Erro"); }
      finally { setLoading(false); }
    })();
  }, [companyId]);

  async function handleSave() {
    setSaving(true);
    try {
      await save({
        data: {
          company_id: companyId,
          manual_pix_key: state.manual_pix_key || null,
          manual_pix_holder: state.manual_pix_holder || null,
          manual_pix_bank: state.manual_pix_bank || null,
          payment_note: state.payment_note || null,
        },
      });
      toast.success("Pagamento salvo");
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>;

  const mpConnected = mp?.status === "connected";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Mercado Pago
            {mpConnected ? (
              <Badge className="bg-success text-success-foreground"><CheckCircle2 className="mr-1 h-3 w-3" />Conectado</Badge>
            ) : (
              <Badge variant="outline"><AlertCircle className="mr-1 h-3 w-3" />Não conectado</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Se conectado, a IA prefere gerar link/Pix Mercado Pago automaticamente.
            Se não, ela usará o Pix manual abaixo.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/pagamentos/mercado-pago">Abrir Pagamentos · Mercado Pago</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Pix manual da empresa</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Chave Pix</Label>
            <Input value={state.manual_pix_key} onChange={(e) => setState({ ...state, manual_pix_key: e.target.value })} placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Nome do titular</Label>
              <Input value={state.manual_pix_holder} onChange={(e) => setState({ ...state, manual_pix_holder: e.target.value })} />
            </div>
            <div>
              <Label>Banco</Label>
              <Input value={state.manual_pix_bank} onChange={(e) => setState({ ...state, manual_pix_bank: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Observação de pagamento</Label>
            <Textarea rows={2} value={state.payment_note} onChange={(e) => setState({ ...state, payment_note: e.target.value })} placeholder="Ex.: Após o pagamento, envie o comprovante por aqui." />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-1 h-4 w-4" />{saving ? "Salvando…" : "Salvar pagamento"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ========================================================
// APPS
// ========================================================
const SUGGESTED_APPS = ["Bob Player", "IBO Player", "VU Player Pro", "IPTV Smarters", "XCIPTV", "IPTV Blink", "UNITV", "PoPlay"];

type AppGuide = {
  id: string;
  company_id: string;
  app_name: string;
  is_paid: boolean;
  app_price_cents: number;
  login_type: string;
  install_steps: string | null;
  update_steps: string | null;
  cache_steps: string | null;
  route_steps: string | null;
  common_issues: string | null;
  default_reply: string | null;
  is_active: boolean;
};

function AppsTab({ companyId }: { companyId: string }) {
  const list = useServerFn(listCompanyAiApps);
  const save = useServerFn(upsertCompanyAiApp);
  const del = useServerFn(deleteCompanyAiApp);
  const [apps, setApps] = useState<AppGuide[]>([]);
  const [edit, setEdit] = useState<Partial<AppGuide> | null>(null);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    try {
      const r = await list({ data: { companyId } });
      setApps((r.apps as AppGuide[]) ?? []);
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
    finally { setLoading(false); }
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [companyId]);

  async function handleSave() {
    if (!edit?.app_name?.trim()) { toast.error("Informe o nome do app"); return; }
    try {
      await save({
        data: {
          ...edit,
          company_id: companyId,
          app_name: edit.app_name.trim(),
          login_type: edit.login_type ?? "user_pass",
          app_price_cents: edit.app_price_cents ?? 0,
          is_paid: !!edit.is_paid,
          is_active: edit.is_active !== false,
        } as any,
      });
      toast.success("App salvo");
      setEdit(null);
      reload();
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }
  async function handleDelete(id: string) {
    if (!confirm("Excluir este app?")) return;
    try { await del({ data: { id } }); reload(); }
    catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>;

  const existingNames = new Set(apps.map((a) => a.app_name.toLowerCase()));
  const suggestions = SUGGESTED_APPS.filter((n) => !existingNames.has(n.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Cadastre os aplicativos que sua empresa usa e como atender dúvidas técnicas.
        </p>
        <Button size="sm" onClick={() => setEdit({ app_name: "", login_type: "user_pass", is_active: true, is_paid: false, app_price_cents: 0 })}>
          <Plus className="mr-1 h-4 w-4" />Novo app
        </Button>
      </div>

      {suggestions.length > 0 && (
        <Card><CardContent className="p-3">
          <p className="mb-2 text-xs text-muted-foreground">Adicionar rapidamente:</p>
          <div className="flex flex-wrap gap-1">
            {suggestions.map((s) => (
              <Button key={s} size="sm" variant="outline"
                onClick={() => setEdit({ app_name: s, login_type: "mac_key", is_active: true, is_paid: false, app_price_cents: 0 })}>
                + {s}
              </Button>
            ))}
          </div>
        </CardContent></Card>
      )}

      {apps.map((a) => (
        <Card key={a.id}>
          <CardContent className="p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{a.app_name}</span>
                  <Badge variant="outline" className="text-xs">
                    {a.login_type === "mac_key" ? "MAC/Key" : a.login_type === "both" ? "Ambos" : a.login_type === "other" ? "Outro" : "Usuário/Senha"}
                  </Badge>
                  {a.is_paid && <Badge variant="secondary" className="text-xs">Pago · R$ {(a.app_price_cents / 100).toFixed(2)}</Badge>}
                  {!a.is_active && <Badge variant="outline" className="text-xs">Inativo</Badge>}
                </div>
                {a.default_reply && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.default_reply}</p>
                )}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => setEdit(a)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => handleDelete(a.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar app" : "Novo app"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input value={edit.app_name ?? ""} onChange={(e) => setEdit({ ...edit, app_name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo de login</Label>
                  <Select value={edit.login_type ?? "user_pass"} onValueChange={(v) => setEdit({ ...edit, login_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user_pass">Usuário/Senha</SelectItem>
                      <SelectItem value="mac_key">MAC/Key</SelectItem>
                      <SelectItem value="both">Ambos</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valor anual (R$)</Label>
                  <Input
                    type="number" step="0.01" min={0}
                    value={(edit.app_price_cents ?? 0) / 100}
                    onChange={(e) => setEdit({ ...edit, app_price_cents: Math.round((Number(e.target.value) || 0) * 100) })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-2">
                <Label className="m-0">App pago</Label>
                <Switch checked={!!edit.is_paid} onCheckedChange={(v) => setEdit({ ...edit, is_paid: v })} />
              </div>
              <div>
                <Label>Como instalar</Label>
                <Textarea rows={2} value={edit.install_steps ?? ""} onChange={(e) => setEdit({ ...edit, install_steps: e.target.value })} />
              </div>
              <div>
                <Label>Como atualizar</Label>
                <Textarea rows={2} value={edit.update_steps ?? ""} onChange={(e) => setEdit({ ...edit, update_steps: e.target.value })} />
              </div>
              <div>
                <Label>Como limpar cache</Label>
                <Textarea rows={2} value={edit.cache_steps ?? ""} onChange={(e) => setEdit({ ...edit, cache_steps: e.target.value })} />
              </div>
              <div>
                <Label>Como trocar rota</Label>
                <Textarea rows={2} value={edit.route_steps ?? ""} onChange={(e) => setEdit({ ...edit, route_steps: e.target.value })} />
              </div>
              <div>
                <Label>Problemas comuns</Label>
                <Textarea rows={2} value={edit.common_issues ?? ""} onChange={(e) => setEdit({ ...edit, common_issues: e.target.value })} />
              </div>
              <div>
                <Label>Resposta padrão</Label>
                <Textarea rows={2} value={edit.default_reply ?? ""} onChange={(e) => setEdit({ ...edit, default_reply: e.target.value })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-2">
                <Label className="m-0">Ativo</Label>
                <Switch checked={edit.is_active !== false} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button onClick={handleSave}><Save className="mr-1 h-4 w-4" />Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ========================================================
// TEST
// ========================================================
const TEST_EXAMPLES = ["Bom dia", "Qual valor?", "Quero teste", "Meu app está travando", "Manda o Pix", "Quero cancelar"];

function TestTab({ companyId }: { companyId: string }) {
  const sim = useServerFn(simulateAiReply);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ reply: string; sources: string[]; needsHuman: boolean } | null>(null);

  async function run(t?: string) {
    const v = (t ?? text).trim();
    if (!v) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await sim({ data: { companyId, text: v } });
      setResult(r);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Testar IA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Simulação interna. Nada é enviado ao cliente nem ao WhatsApp.
          </p>
          <Textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Digite uma mensagem de cliente para testar."
          />
          <div className="flex flex-wrap gap-1">
            {TEST_EXAMPLES.map((ex) => (
              <Button key={ex} size="sm" variant="outline" onClick={() => { setText(ex); run(ex); }}>
                {ex}
              </Button>
            ))}
          </div>
          <Button onClick={() => run()} disabled={loading || !text.trim()}>
            <PlayCircle className="mr-1 h-4 w-4" />{loading ? "Gerando…" : "Testar"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              Resposta da IA
              {result.needsHuman && <Badge variant="destructive">Encaminhar humano</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">{result.reply}</div>
            <div className="flex flex-wrap gap-1">
              {result.sources.map((s) => (
                <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
