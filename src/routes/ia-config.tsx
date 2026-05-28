import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, Trash2, Bot, Tag, Smartphone, HelpCircle, Save, Star } from "lucide-react";
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
import { getActiveCompanyId } from "@/lib/company-scope";
import {
  listPriceGroups,
  upsertPriceGroup,
  deletePriceGroup,
  upsertPlan,
  deletePlan,
  listApps,
  upsertApp,
  deleteApp,
  getAiSettings,
  updateAiSettings,
} from "@/lib/ia-config/ia-config.functions";

export const Route = createFileRoute("/ia-config")({ component: IaConfigPage });

type PriceGroup = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  ai_notes: string | null;
  priority: number;
};
type Plan = {
  id: string;
  company_id: string;
  price_group_id: string;
  name: string;
  screens: number;
  duration_days: number;
  price_cents: number;
  allow_installments: boolean;
  notes: string | null;
  is_active: boolean;
};
type App = {
  id: string;
  company_id: string;
  app_name: string;
  login_type: "user_pass" | "mac_key" | "other";
  is_paid: boolean;
  stability_level: "stable" | "medium" | "unstable";
  how_to_update: string | null;
  how_to_change_route: string | null;
  common_issues: string | null;
  default_reply: string | null;
  escalate_when: string | null;
  is_active: boolean;
};

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function IaConfigPage() {
  const companyId = getActiveCompanyId();

  if (!companyId) {
    return (
      <PageContainer>
        <SectionHeader title="Configuração da IA" subtitle="Selecione uma empresa ativa para configurar." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <SectionHeader
        title="Configuração da IA"
        subtitle="Tabelas de preço, indicações, aplicativos e instruções gerais"
      />
      <Tabs defaultValue="precos" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="precos"><Tag className="mr-1 h-3.5 w-3.5" />Preços</TabsTrigger>
          <TabsTrigger value="apps"><Smartphone className="mr-1 h-3.5 w-3.5" />Apps</TabsTrigger>
          <TabsTrigger value="indicacao"><Star className="mr-1 h-3.5 w-3.5" />Indicação</TabsTrigger>
          <TabsTrigger value="geral"><Bot className="mr-1 h-3.5 w-3.5" />Geral</TabsTrigger>
        </TabsList>
        <TabsContent value="precos"><PriceGroupsTab companyId={companyId} /></TabsContent>
        <TabsContent value="apps"><AppsTab companyId={companyId} /></TabsContent>
        <TabsContent value="indicacao"><ReferralTab companyId={companyId} /></TabsContent>
        <TabsContent value="geral"><GeneralTab companyId={companyId} /></TabsContent>
      </Tabs>
    </PageContainer>
  );
}

// ============================================================
// PREÇOS
// ============================================================
function PriceGroupsTab({ companyId }: { companyId: string }) {
  const list = useServerFn(listPriceGroups);
  const saveGroup = useServerFn(upsertPriceGroup);
  const delGroup = useServerFn(deletePriceGroup);
  const savePlan = useServerFn(upsertPlan);
  const delPlan = useServerFn(deletePlan);

  const [groups, setGroups] = useState<PriceGroup[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editGroup, setEditGroup] = useState<Partial<PriceGroup> | null>(null);
  const [editPlan, setEditPlan] = useState<Partial<Plan> | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const r = await list({ data: { companyId } });
      setGroups(r.groups as PriceGroup[]);
      setPlans(r.plans as Plan[]);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [companyId]);

  async function handleSaveGroup() {
    if (!editGroup?.name?.trim()) return toast.error("Informe o nome");
    try {
      await saveGroup({
        data: {
          ...editGroup,
          company_id: companyId,
          name: editGroup.name!.trim(),
        } as any,
      });
      toast.success("Grupo salvo");
      setEditGroup(null);
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    }
  }
  async function handleDeleteGroup(id: string) {
    if (!confirm("Excluir esta tabela de preço e seus planos?")) return;
    try {
      await delGroup({ data: { id } });
      reload();
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }
  async function handleSavePlan() {
    if (!editPlan?.name?.trim() || !editPlan.price_group_id) return toast.error("Dados incompletos");
    try {
      await savePlan({
        data: {
          ...editPlan,
          company_id: companyId,
          name: editPlan.name!.trim(),
          screens: Number(editPlan.screens) || 1,
          duration_days: Number(editPlan.duration_days) || 30,
          price_cents: Number(editPlan.price_cents) || 0,
        } as any,
      });
      toast.success("Plano salvo");
      setEditPlan(null);
      reload();
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }
  async function handleDeletePlan(id: string) {
    if (!confirm("Excluir este plano?")) return;
    try { await delPlan({ data: { id } }); reload(); } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setEditGroup({ name: "", is_default: groups.length === 0, is_active: true, priority: 0 })}>
          <Plus className="mr-1 h-4 w-4" /> Nova tabela
        </Button>
      </div>

      {groups.length === 0 && (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
          Crie sua primeira tabela de preço (ex.: "Novos clientes R$29,90").
        </CardContent></Card>
      )}

      {groups.map((g) => {
        const gPlans = plans.filter((p) => p.price_group_id === g.id);
        return (
          <Card key={g.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  {g.name}
                  {g.is_default && <Badge variant="secondary"><Star className="mr-1 h-3 w-3" />Padrão</Badge>}
                  {!g.is_active && <Badge variant="outline">Inativa</Badge>}
                </CardTitle>
                {g.description && <p className="mt-1 text-xs text-muted-foreground">{g.description}</p>}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => setEditGroup(g)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => handleDeleteGroup(g.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {gPlans.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum plano nesta tabela.</p>
              ) : (
                <div className="space-y-1">
                  {gPlans.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                      <div>
                        <span className="font-medium">{p.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {p.screens} tela{p.screens > 1 ? "s" : ""} · {p.duration_days} dias · {fmtBRL(p.price_cents)}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setEditPlan(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDeletePlan(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button size="sm" variant="outline" onClick={() => setEditPlan({ price_group_id: g.id, name: "", screens: 1, duration_days: 30, price_cents: 0, allow_installments: false, is_active: true })}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar plano
              </Button>
            </CardContent>
          </Card>
        );
      })}

      {/* Dialog grupo */}
      <Dialog open={!!editGroup} onOpenChange={(o) => !o && setEditGroup(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editGroup?.id ? "Editar tabela" : "Nova tabela de preço"}</DialogTitle></DialogHeader>
          {editGroup && (
            <div className="space-y-3">
              <div>
                <Label>Nome da tabela</Label>
                <Input value={editGroup.name ?? ""} onChange={(e) => setEditGroup({ ...editGroup, name: e.target.value })} placeholder="Ex.: Novos clientes R$29,90" />
              </div>
              <div>
                <Label>Descrição (opcional)</Label>
                <Input value={editGroup.description ?? ""} onChange={(e) => setEditGroup({ ...editGroup, description: e.target.value })} />
              </div>
              <div>
                <Label>Observações para a IA</Label>
                <Textarea rows={2} value={editGroup.ai_notes ?? ""} onChange={(e) => setEditGroup({ ...editGroup, ai_notes: e.target.value })} placeholder="Dicas extras que a IA deve considerar ao falar desta tabela." />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-2">
                <Label className="m-0 flex items-center gap-1">Tabela padrão <HelpCircle className="h-3 w-3 text-muted-foreground" /></Label>
                <Switch checked={!!editGroup.is_default} onCheckedChange={(v) => setEditGroup({ ...editGroup, is_default: v })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-2">
                <Label className="m-0">Ativa</Label>
                <Switch checked={editGroup.is_active !== false} onCheckedChange={(v) => setEditGroup({ ...editGroup, is_active: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGroup(null)}>Cancelar</Button>
            <Button onClick={handleSaveGroup}><Save className="mr-1 h-4 w-4" />Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog plano */}
      <Dialog open={!!editPlan} onOpenChange={(o) => !o && setEditPlan(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editPlan?.id ? "Editar plano" : "Novo plano"}</DialogTitle></DialogHeader>
          {editPlan && (
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input value={editPlan.name ?? ""} onChange={(e) => setEditPlan({ ...editPlan, name: e.target.value })} placeholder="Ex.: 1 tela mensal" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Telas</Label>
                  <Input type="number" min={1} value={editPlan.screens ?? 1} onChange={(e) => setEditPlan({ ...editPlan, screens: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Duração (dias)</Label>
                  <Input type="number" min={1} value={editPlan.duration_days ?? 30} onChange={(e) => setEditPlan({ ...editPlan, duration_days: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  type="number" step="0.01" min={0}
                  value={(editPlan.price_cents ?? 0) / 100}
                  onChange={(e) => setEditPlan({ ...editPlan, price_cents: Math.round((Number(e.target.value) || 0) * 100) })}
                />
              </div>
              <div>
                <Label>Observações</Label>
                <Input value={editPlan.notes ?? ""} onChange={(e) => setEditPlan({ ...editPlan, notes: e.target.value })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-2">
                <Label className="m-0">Permite parcelar</Label>
                <Switch checked={!!editPlan.allow_installments} onCheckedChange={(v) => setEditPlan({ ...editPlan, allow_installments: v })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-2">
                <Label className="m-0">Ativo</Label>
                <Switch checked={editPlan.is_active !== false} onCheckedChange={(v) => setEditPlan({ ...editPlan, is_active: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPlan(null)}>Cancelar</Button>
            <Button onClick={handleSavePlan}><Save className="mr-1 h-4 w-4" />Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// APPS
// ============================================================
const DEFAULT_APPS = ["XCIPTV", "IPTV Smarters", "IBO Player", "IBO Revenda", "Bob Player", "Vu Player", "IPTV Blink", "Unitv"];

function AppsTab({ companyId }: { companyId: string }) {
  const list = useServerFn(listApps);
  const save = useServerFn(upsertApp);
  const del = useServerFn(deleteApp);
  const [apps, setApps] = useState<App[]>([]);
  const [edit, setEdit] = useState<Partial<App> | null>(null);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    try { const r = await list({ data: { companyId } }); setApps(r.apps as App[]); }
    catch (e: any) { toast.error(e?.message ?? "Erro"); }
    finally { setLoading(false); }
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [companyId]);

  async function handleSave() {
    if (!edit?.app_name?.trim()) return toast.error("Informe o nome do app");
    try {
      await save({
        data: {
          ...edit,
          company_id: companyId,
          app_name: edit.app_name!.trim(),
          login_type: edit.login_type ?? "user_pass",
          stability_level: edit.stability_level ?? "stable",
        } as any,
      });
      toast.success("App salvo");
      setEdit(null);
      reload();
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>;

  const existingNames = new Set(apps.map((a) => a.app_name.toLowerCase()));
  const suggestions = DEFAULT_APPS.filter((n) => !existingNames.has(n.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Base de conhecimento dos apps que a IA usa para responder dúvidas técnicas.</p>
        <Button size="sm" onClick={() => setEdit({ app_name: "", login_type: "user_pass", stability_level: "stable", is_active: true, is_paid: false })}>
          <Plus className="mr-1 h-4 w-4" /> Novo app
        </Button>
      </div>

      {suggestions.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <p className="mb-2 text-xs text-muted-foreground">Adicionar rapidamente:</p>
            <div className="flex flex-wrap gap-1">
              {suggestions.map((s) => (
                <Button key={s} size="sm" variant="outline" onClick={() => setEdit({ app_name: s, login_type: "user_pass", stability_level: "stable", is_active: true })}>
                  + {s}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {apps.map((a) => (
        <Card key={a.id}>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                {a.app_name}
                <Badge variant="outline" className="text-xs">{a.login_type === "mac_key" ? "MAC/Key" : a.login_type === "user_pass" ? "Usuário/Senha" : "Outro"}</Badge>
                <Badge variant={a.stability_level === "stable" ? "secondary" : a.stability_level === "medium" ? "default" : "destructive"} className="text-xs">
                  {a.stability_level === "stable" ? "Estável" : a.stability_level === "medium" ? "Médio" : "Instável"}
                </Badge>
              </CardTitle>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => setEdit(a)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={async () => { if (confirm("Excluir?")) { await del({ data: { id: a.id } }); reload(); } }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          {a.default_reply && <CardContent className="pt-0 text-xs text-muted-foreground line-clamp-2">{a.default_reply}</CardContent>}
        </Card>
      ))}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar app" : "Novo app"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <div>
                <Label>Nome do app</Label>
                <Input value={edit.app_name ?? ""} onChange={(e) => setEdit({ ...edit, app_name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo de login</Label>
                  <Select value={edit.login_type ?? "user_pass"} onValueChange={(v) => setEdit({ ...edit, login_type: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user_pass">Usuário/Senha</SelectItem>
                      <SelectItem value="mac_key">MAC/Key</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Estabilidade</Label>
                  <Select value={edit.stability_level ?? "stable"} onValueChange={(v) => setEdit({ ...edit, stability_level: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stable">Estável</SelectItem>
                      <SelectItem value="medium">Médio</SelectItem>
                      <SelectItem value="unstable">Instável</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Como atualizar</Label>
                <Textarea rows={2} value={edit.how_to_update ?? ""} onChange={(e) => setEdit({ ...edit, how_to_update: e.target.value })} />
              </div>
              <div>
                <Label>Como trocar a rota/servidor</Label>
                <Textarea rows={2} value={edit.how_to_change_route ?? ""} onChange={(e) => setEdit({ ...edit, how_to_change_route: e.target.value })} />
              </div>
              <div>
                <Label>Problemas comuns</Label>
                <Textarea rows={2} value={edit.common_issues ?? ""} onChange={(e) => setEdit({ ...edit, common_issues: e.target.value })} placeholder="Ex.: travamento, sem áudio, lista fora, erro de login" />
              </div>
              <div>
                <Label>Resposta padrão da IA</Label>
                <Textarea rows={3} value={edit.default_reply ?? ""} onChange={(e) => setEdit({ ...edit, default_reply: e.target.value })} placeholder="O que a IA deve responder quando o cliente cita este app." />
              </div>
              <div>
                <Label>Quando encaminhar para humano</Label>
                <Textarea rows={2} value={edit.escalate_when ?? ""} onChange={(e) => setEdit({ ...edit, escalate_when: e.target.value })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-2">
                <Label className="m-0">Pago</Label>
                <Switch checked={!!edit.is_paid} onCheckedChange={(v) => setEdit({ ...edit, is_paid: v })} />
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

// ============================================================
// INDICAÇÃO + GERAL (compartilham ai_company_settings)
// ============================================================
function useAiSettings(companyId: string) {
  const get = useServerFn(getAiSettings);
  const upd = useServerFn(updateAiSettings);
  const [s, setS] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  async function reload() {
    setLoading(true);
    try { const r = await get({ data: { companyId } }); setS(r.settings); }
    catch (e: any) { toast.error(e?.message ?? "Erro"); }
    finally { setLoading(false); }
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [companyId]);
  async function save(patch: Record<string, unknown>) {
    try {
      const next = { ...s, ...patch, company_id: companyId };
      await upd({ data: next });
      setS(next);
      toast.success("Salvo");
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }
  return { s, loading, save };
}

function ReferralTab({ companyId }: { companyId: string }) {
  const { s, loading, save } = useAiSettings(companyId);
  if (loading || !s) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>;
  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-sm">Perguntar se veio por indicação</p>
              <p className="text-xs text-muted-foreground">Para cliente novo desconhecido, a IA pergunta antes de mostrar preço.</p>
            </div>
            <Switch checked={!!s.ask_referral_for_new} onCheckedChange={(v) => save({ ask_referral_for_new: v })} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-sm">Encaminhar humano se indicador não encontrado</p>
              <p className="text-xs text-muted-foreground">Se o cliente diz "fulano me indicou" e não achamos no cadastro, IA passa para humano.</p>
            </div>
            <Switch checked={!!s.escalate_when_referrer_missing} onCheckedChange={(v) => save({ escalate_when_referrer_missing: v })} />
          </div>
          <div>
            <Label>WhatsApp do atendente humano</Label>
            <Input
              placeholder="55 11 99999-9999"
              value={s.human_handoff_number ?? ""}
              onChange={(e) => setStateAndSaveDebounced(s, save, "human_handoff_number", e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">A IA pode citar este contato quando precisar transferir.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GeneralTab({ companyId }: { companyId: string }) {
  const { s, loading, save } = useAiSettings(companyId);
  const [draft, setDraft] = useState<string>("");
  useEffect(() => { if (s) setDraft(s.support_instructions ?? ""); }, [s]);
  if (loading || !s) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>;
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div>
          <Label>Instruções gerais para a IA</Label>
          <Textarea
            rows={8}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ex.: Sempre cumprimente educadamente. Não ofereça teste para quem já é cliente. Encaminhe para humano se mencionar reembolso..."
          />
          <p className="mt-1 text-xs text-muted-foreground">Estas instruções entram no system prompt da IA junto com os planos da tabela escolhida.</p>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => save({ support_instructions: draft })}><Save className="mr-1 h-4 w-4" />Salvar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// debounce simples sem libs externas
let _t: any = null;
function setStateAndSaveDebounced(current: any, save: (p: any) => void, key: string, value: string) {
  current[key] = value;
  if (_t) clearTimeout(_t);
  _t = setTimeout(() => save({ [key]: value }), 600);
}
