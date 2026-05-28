import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Copy, Eye, EyeOff, ExternalLink, Plus, Trash2, Pencil,
  RefreshCcw, CheckCircle2, UserRound, AlertTriangle,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getActiveCompanyId } from "@/lib/company-scope";
import {
  listServers, upsertServer, deleteServer, revealServerPassword,
  listRenewalTasks, updateRenewalTaskStatus,
  type ServerRow, type RenewalTask,
} from "@/lib/iptv/iptv.functions";

export const Route = createFileRoute("/renovacoes-paineis")({
  component: RenovacoesPaineis,
});

function copy(value: string, label: string) {
  if (!value) return;
  navigator.clipboard?.writeText(value).then(
    () => toast.success(`${label} copiado`),
    () => toast.error("Falha ao copiar"),
  );
}

function RenovacoesPaineis() {
  const companyId = getActiveCompanyId();

  return (
    <PageContainer>
      <SectionHeader
        title="Renovações e painéis"
        subtitle="Cadastre seus servidores IPTV e atenda a fila de renovações."
      />
      {!companyId ? (
        <Card><CardContent className="py-6 text-sm text-muted-foreground">
          Selecione uma empresa primeiro.
        </CardContent></Card>
      ) : (
        <Tabs defaultValue="renovacoes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="renovacoes">Renovações pendentes</TabsTrigger>
            <TabsTrigger value="servidores">Servidores / painéis</TabsTrigger>
          </TabsList>
          <TabsContent value="renovacoes">
            <RenewalsPanel companyId={companyId} />
          </TabsContent>
          <TabsContent value="servidores">
            <ServersPanel companyId={companyId} />
          </TabsContent>
        </Tabs>
      )}
    </PageContainer>
  );
}

// ============= SERVERS =============

function emptyServer(): Partial<ServerRow> & { panel_password?: string } {
  return {
    name: "",
    color: "#3b82f6",
    panel_url: "",
    panel_username: "",
    panel_password: "",
    panel_type: "outros",
    customer_search_url_template: "",
    notes: "",
    is_active: true,
    sort_order: 0,
  };
}

function ServersPanel({ companyId }: { companyId: string }) {
  const fetchList = useServerFn(listServers);
  const save = useServerFn(upsertServer);
  const remove = useServerFn(deleteServer);
  const reveal = useServerFn(revealServerPassword);
  const [rows, setRows] = useState<ServerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<(Partial<ServerRow> & { panel_password?: string }) | null>(null);
  const [revealedFor, setRevealedFor] = useState<Record<string, string>>({});

  const refresh = useCallback(() => {
    setLoading(true);
    fetchList({ data: { companyId } })
      .then((d) => setRows(d ?? []))
      .catch((e: any) => toast.error(e?.message ?? "Erro ao carregar"))
      .finally(() => setLoading(false));
  }, [fetchList, companyId]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSave = async () => {
    if (!editing?.name) { toast.error("Informe o nome do servidor"); return; }
    try {
      await save({
        data: {
          id: editing.id,
          companyId,
          name: editing.name!,
          color: editing.color ?? "#3b82f6",
          panel_url: editing.panel_url || null,
          panel_username: editing.panel_username || null,
          panel_password: editing.panel_password ?? null,
          panel_type: (editing.panel_type as any) ?? "outros",
          customer_search_url_template: editing.customer_search_url_template || null,
          notes: editing.notes || null,
          is_active: editing.is_active ?? true,
          sort_order: editing.sort_order ?? 0,
        },
      } as any);
      toast.success("Servidor salvo");
      setEditing(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    }
  };

  const handleReveal = async (s: ServerRow) => {
    if (revealedFor[s.id]) {
      setRevealedFor((cur) => { const n = { ...cur }; delete n[s.id]; return n; });
      return;
    }
    try {
      const { password } = await reveal({ data: { id: s.id, companyId, action: "view" } } as any);
      setRevealedFor((cur) => ({ ...cur, [s.id]: password }));
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao revelar");
    }
  };

  const handleCopyPwd = async (s: ServerRow) => {
    try {
      const { password } = await reveal({ data: { id: s.id, companyId, action: "copy" } } as any);
      copy(password, "Senha");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao copiar");
    }
  };

  const handleDelete = async (s: ServerRow) => {
    if (!confirm(`Excluir servidor "${s.name}"?`)) return;
    try {
      await remove({ data: { id: s.id, companyId } } as any);
      toast.success("Excluído");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao excluir");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Servidores cadastrados</CardTitle>
        <Button size="sm" onClick={() => setEditing(emptyServer())}>
          <Plus className="h-4 w-4 mr-1" /> Novo servidor
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum servidor cadastrado ainda.</p>
        ) : (
          rows.map((s) => (
            <div key={s.id} className="rounded-md border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                <span className="font-medium">{s.name}</span>
                <Badge variant="outline" className="text-[10px]">{s.panel_type}</Badge>
                {!s.is_active && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                <div className="ml-auto flex gap-1">
                  {s.panel_url && (
                    <Button size="sm" variant="ghost" onClick={() => window.open(s.panel_url!, "_blank")}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setEditing({ ...s, panel_password: "" })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(s)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                {s.panel_url && (
                  <Row label="Painel" value={s.panel_url} onCopy={() => copy(s.panel_url!, "Link")} />
                )}
                {s.panel_username && (
                  <Row label="Usuário" value={s.panel_username} onCopy={() => copy(s.panel_username!, "Usuário")} />
                )}
                {s.has_password && (
                  <Row
                    label="Senha"
                    value={revealedFor[s.id] ?? "••••••••"}
                    onToggle={() => handleReveal(s)}
                    revealed={!!revealedFor[s.id]}
                    onCopy={() => handleCopyPwd(s)}
                  />
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar servidor" : "Novo servidor"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Field label="Nome">
                <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cor">
                  <Input type="color" value={editing.color ?? "#3b82f6"} onChange={(e) => setEditing({ ...editing, color: e.target.value })} />
                </Field>
                <Field label="Tipo">
                  <Select value={editing.panel_type ?? "outros"} onValueChange={(v) => setEditing({ ...editing, panel_type: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sigma">Sigma</SelectItem>
                      <SelectItem value="xui">XUI</SelectItem>
                      <SelectItem value="xtream">Xtream</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="URL do painel">
                <Input placeholder="https://painel.exemplo.com" value={editing.panel_url ?? ""} onChange={(e) => setEditing({ ...editing, panel_url: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Usuário">
                  <Input value={editing.panel_username ?? ""} onChange={(e) => setEditing({ ...editing, panel_username: e.target.value })} />
                </Field>
                <Field label={editing.id ? "Nova senha (vazio = manter)" : "Senha"}>
                  <Input type="password" value={editing.panel_password ?? ""} onChange={(e) => setEditing({ ...editing, panel_password: e.target.value })} />
                </Field>
              </div>
              <Field label="Template de busca de cliente (opcional)">
                <Input placeholder="https://painel.exemplo.com/users?search={username}" value={editing.customer_search_url_template ?? ""} onChange={(e) => setEditing({ ...editing, customer_search_url_template: e.target.value })} />
              </Field>
              <Field label="Observações">
                <Textarea rows={2} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
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

function Row({
  label, value, onCopy, onToggle, revealed,
}: {
  label: string; value: string;
  onCopy?: () => void; onToggle?: () => void; revealed?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{value}</span>
      {onToggle && (
        <button type="button" onClick={onToggle} className="rounded p-1 hover:bg-muted" aria-label="Toggle">
          {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      )}
      {onCopy && (
        <button type="button" onClick={onCopy} className="rounded p-1 hover:bg-muted" aria-label="Copiar">
          <Copy className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ============= RENEWALS =============

function RenewalsPanel({ companyId }: { companyId: string }) {
  const fetchList = useServerFn(listRenewalTasks);
  const setStatus = useServerFn(updateRenewalTaskStatus);
  const [tasks, setTasks] = useState<RenewalTask[]>([]);
  const [filter, setFilter] = useState<"pending" | "trying" | "renewed" | "failed" | "needs_human" | "all">("pending");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchList({ data: { companyId, status: filter } } as any)
      .then((d) => setTasks(d ?? []))
      .catch((e: any) => toast.error(e?.message ?? "Erro ao carregar"))
      .finally(() => setLoading(false));
  }, [fetchList, companyId, filter]);

  useEffect(() => { refresh(); }, [refresh]);

  const counts = useMemo(() => {
    return tasks.reduce<Record<string, number>>((acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [tasks]);

  const updateStatus = async (id: string, status: RenewalTask["status"]) => {
    try {
      await setStatus({ data: { id, companyId, status } } as any);
      toast.success("Atualizado");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Fila de renovações</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="trying">Em andamento</SelectItem>
              <SelectItem value="needs_human">Precisam humano</SelectItem>
              <SelectItem value="renewed">Renovadas</SelectItem>
              <SelectItem value="failed">Falhas</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={refresh}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {Object.entries(counts).map(([k, v]) => (
            <Badge key={k} variant="secondary">{k}: {v}</Badge>
          ))}
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma renovação {filter === "all" ? "" : `(${filter})`} no momento.
          </p>
        ) : (
          tasks.map((t) => (
            <div key={t.id} className="rounded-md border border-border bg-card p-3 space-y-2">
              <div className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{t.customer_name ?? "Cliente"}</span>
                {t.customer_phone && (
                  <button onClick={() => copy(t.customer_phone!, "Telefone")} className="text-xs text-muted-foreground hover:text-foreground">
                    {t.customer_phone}
                  </button>
                )}
                <Badge variant="outline" className="text-[10px] ml-auto">{t.status}</Badge>
                {t.attempts > 0 && <Badge variant="secondary" className="text-[10px]">tent. {t.attempts}</Badge>}
              </div>
              <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                {t.server_name && <Row label="Servidor" value={t.server_name} />}
                {t.iptv_username && (
                  <Row label="Usuário" value={t.iptv_username} onCopy={() => copy(t.iptv_username!, "Usuário")} />
                )}
                {t.plan_days != null && <Row label="Plano" value={`${t.plan_days} dias`} />}
                {t.last_error && (
                  <div className="flex items-start gap-1 text-amber-600 sm:col-span-2">
                    <AlertTriangle className="h-3 w-3 mt-0.5" />
                    <span>{t.last_error}</span>
                  </div>
                )}
              </div>
              {(t.status === "pending" || t.status === "trying" || t.status === "needs_human") && (
                <div className="flex flex-wrap gap-2">
                  {t.status !== "trying" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(t.id, "trying")}>
                      Iniciar atendimento
                    </Button>
                  )}
                  <Button size="sm" onClick={() => updateStatus(t.id, "renewed")} className="gap-1">
                    <CheckCircle2 className="h-4 w-4" /> Marcar renovado
                  </Button>
                  {t.status !== "needs_human" && (
                    <Button size="sm" variant="ghost" onClick={() => updateStatus(t.id, "needs_human")}>
                      Precisa humano
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => updateStatus(t.id, "failed")}>
                    Marcar falha
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
