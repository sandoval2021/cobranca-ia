import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, ExternalLink, Plus, Trash2, Pencil, Smartphone } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getActiveCompanyId } from "@/lib/company-scope";
import {
  listPortalApps, upsertPortalApp, deletePortalApp, revealPortalAppPassword,
  type PortalApp,
} from "@/lib/iptv/portal-apps.functions";

export const Route = createFileRoute("/apps-portal")({
  component: AppsPortalPage,
});

function copy(value: string, label: string) {
  if (!value) return;
  navigator.clipboard?.writeText(value).then(
    () => toast.success(`${label} copiado`),
    () => toast.error("Falha ao copiar"),
  );
}

type FormState = {
  id?: string;
  app_name: string;
  panel_url: string;
  panel_login: string;
  panel_password: string;
  id_type: "mac" | "key" | "both";
  mac_url_template: string;
  key_url_template: string;
  color: string;
  notes: string;
  is_active: boolean;
  sort_order: number;
};

const empty: FormState = {
  app_name: "",
  panel_url: "",
  panel_login: "",
  panel_password: "",
  id_type: "mac",
  mac_url_template: "",
  key_url_template: "",
  color: "#8b5cf6",
  notes: "",
  is_active: true,
  sort_order: 0,
};

function AppsPortalPage() {
  const companyId = getActiveCompanyId();
  const list = useServerFn(listPortalApps);
  const upsert = useServerFn(upsertPortalApp);
  const del = useServerFn(deletePortalApp);
  const reveal = useServerFn(revealPortalAppPassword);

  const [apps, setApps] = useState<PortalApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [revealed, setRevealed] = useState<Record<string, string | undefined>>({});

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const rows = await list({ data: { companyId } });
      setApps(rows);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  }, [companyId, list]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm(empty); setOpen(true); };
  const openEdit = (a: PortalApp) => {
    setForm({
      id: a.id,
      app_name: a.app_name,
      panel_url: a.panel_url ?? "",
      panel_login: a.panel_login ?? "",
      panel_password: "",
      id_type: a.id_type,
      mac_url_template: a.mac_url_template ?? "",
      key_url_template: a.key_url_template ?? "",
      color: a.color,
      notes: a.notes ?? "",
      is_active: a.is_active,
      sort_order: a.sort_order,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!companyId) return;
    if (!form.app_name.trim()) { toast.error("Nome do app é obrigatório"); return; }
    try {
      await upsert({ data: {
        id: form.id,
        companyId,
        app_name: form.app_name.trim(),
        panel_url: form.panel_url.trim() || null,
        panel_login: form.panel_login.trim() || null,
        panel_password: form.panel_password ? form.panel_password : undefined,
        id_type: form.id_type,
        mac_url_template: form.mac_url_template.trim() || null,
        key_url_template: form.key_url_template.trim() || null,
        color: form.color,
        notes: form.notes.trim() || null,
        is_active: form.is_active,
        sort_order: form.sort_order,
      } as any });
      toast.success(form.id ? "App atualizado" : "App cadastrado");
      setOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    }
  };

  const onDelete = async (a: PortalApp) => {
    if (!companyId) return;
    if (!confirm(`Remover ${a.app_name}?`)) return;
    try {
      await del({ data: { id: a.id, companyId } });
      toast.success("Removido");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao remover");
    }
  };

  const onReveal = async (a: PortalApp) => {
    if (!companyId) return;
    if (revealed[a.id]) {
      setRevealed((s) => ({ ...s, [a.id]: undefined }));
      return;
    }
    try {
      const { password } = await reveal({ data: { id: a.id, companyId, action: "view" } });
      setRevealed((s) => ({ ...s, [a.id]: password }));
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao revelar");
    }
  };

  const onCopyPwd = async (a: PortalApp) => {
    if (!companyId) return;
    try {
      const { password } = await reveal({ data: { id: a.id, companyId, action: "copy" } });
      copy(password, "Senha");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao copiar");
    }
  };

  return (
    <PageContainer>
      <SectionHeader
        title="Apps de portal (MAC/Key)"
        subtitle="Bob, IBO, Smarters, VU e outros: cadastre painéis e modelos de URL para localizar dispositivos."
        action={
          <Button onClick={openNew} disabled={!companyId}>
            <Plus className="h-4 w-4 mr-1" /> Novo app
          </Button>
        }
      />

      {!companyId ? (
        <Card><CardContent className="py-6 text-sm text-muted-foreground">
          Selecione uma empresa primeiro.
        </CardContent></Card>
      ) : loading ? (
        <Card><CardContent className="py-6 text-sm text-muted-foreground">Carregando…</CardContent></Card>
      ) : apps.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          Nenhum app cadastrado. Clique em <strong>Novo app</strong> para começar.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {apps.map((a) => (
            <Card key={a.id} className="overflow-hidden">
              <div className="h-1.5" style={{ background: a.color }} />
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{a.app_name}</span>
                      {!a.is_active && <Badge variant="outline">Inativo</Badge>}
                      <Badge variant="secondary" className="uppercase text-[10px]">
                        {a.id_type === "both" ? "MAC + Key" : a.id_type}
                      </Badge>
                    </div>
                    {a.panel_url && (
                      <a href={a.panel_url} target="_blank" rel="noreferrer"
                         className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1">
                        <ExternalLink className="h-3 w-3" /> Abrir painel
                      </a>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(a)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => onDelete(a)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {(a.panel_login || a.has_password) && (
                  <div className="rounded-md border p-2 text-xs space-y-1.5">
                    {a.panel_login && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">Login</span>
                        <span className="font-mono flex items-center gap-1">
                          {a.panel_login}
                          <Button size="icon" variant="ghost" className="h-6 w-6"
                                  onClick={() => copy(a.panel_login!, "Login")}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </span>
                      </div>
                    )}
                    {a.has_password && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">Senha</span>
                        <span className="font-mono flex items-center gap-1">
                          {revealed[a.id] ?? "••••••••"}
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onReveal(a)}>
                            {revealed[a.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onCopyPwd(a)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {(a.mac_url_template || a.key_url_template) && (
                  <div className="text-[11px] text-muted-foreground space-y-0.5">
                    {a.mac_url_template && <div>MAC: <span className="font-mono">{a.mac_url_template}</span></div>}
                    {a.key_url_template && <div>Key: <span className="font-mono">{a.key_url_template}</span></div>}
                  </div>
                )}
                {a.notes && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{a.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar app" : "Novo app de portal"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome do app *</Label>
                <Input value={form.app_name} onChange={(e) => setForm({ ...form, app_name: e.target.value })} placeholder="Bob Player" />
              </div>
              <div>
                <Label>Tipo de ID</Label>
                <Select value={form.id_type} onValueChange={(v: any) => setForm({ ...form, id_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mac">MAC</SelectItem>
                    <SelectItem value="key">Key / Device Key</SelectItem>
                    <SelectItem value="both">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>URL do painel</Label>
              <Input value={form.panel_url} onChange={(e) => setForm({ ...form, panel_url: e.target.value })} placeholder="https://painel.bobplayer.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Login do painel</Label>
                <Input value={form.panel_login} onChange={(e) => setForm({ ...form, panel_login: e.target.value })} />
              </div>
              <div>
                <Label>Senha do painel</Label>
                <Input type="password" placeholder={form.id ? "(manter atual)" : ""}
                       value={form.panel_password}
                       onChange={(e) => setForm({ ...form, panel_password: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Modelo URL para MAC</Label>
              <Input value={form.mac_url_template} onChange={(e) => setForm({ ...form, mac_url_template: e.target.value })}
                     placeholder="https://painel/...?mac={mac}" />
            </div>
            <div>
              <Label>Modelo URL para Key</Label>
              <Input value={form.key_url_template} onChange={(e) => setForm({ ...form, key_url_template: e.target.value })}
                     placeholder="https://painel/...?key={key}" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Cor</Label>
                <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              </div>
              <div>
                <Label>Ordem</Label>
                <Input type="number" value={form.sort_order}
                       onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })} />
              </div>
              <div className="flex items-end gap-2">
                <label className="text-sm flex items-center gap-2">
                  <input type="checkbox" checked={form.is_active}
                         onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                  Ativo
                </label>
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{form.id ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
