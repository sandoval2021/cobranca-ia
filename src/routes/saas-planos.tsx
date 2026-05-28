import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Save } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  listSaasPlans,
  adminUpsertSaasPlan,
  adminDeleteSaasPlan,
  type SaasPlan,
} from "@/lib/billing-saas/billing-saas.functions";
import { useLocalAuth } from "@/lib/use-local-auth";

export const Route = createFileRoute("/saas-planos")({ component: SaasPlanos });

type Form = Omit<SaasPlan, "id"> & { id?: string };
const empty: Form = {
  slug: "",
  name: "",
  price_cents: 0,
  ai_monthly_limit: 0,
  is_active: true,
  sort_order: 0,
  description: "",
};

function SaasPlanos() {
  const { isSuperAdmin } = useLocalAuth();
  const fetchPlans = useServerFn(listSaasPlans);
  const upsert = useServerFn(adminUpsertSaasPlan);
  const remove = useServerFn(adminDeleteSaasPlan);
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);

  async function reload() {
    try {
      setPlans(await fetchPlans({}));
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar");
    }
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isSuperAdmin) {
    return (
      <PageContainer>
        <Card><CardContent className="p-6 text-sm">Acesso restrito ao Super Admin.</CardContent></Card>
      </PageContainer>
    );
  }

  function openNew() { setForm(empty); setOpen(true); }
  function openEdit(p: SaasPlan) {
    setForm({ ...p, description: p.description ?? "" });
    setOpen(true);
  }
  async function save() {
    try {
      await upsert({ data: {
        ...form,
        price_cents: Number(form.price_cents) || 0,
        ai_monthly_limit: Number(form.ai_monthly_limit) || 0,
        sort_order: Number(form.sort_order) || 0,
        description: form.description || null,
      } as any });
      toast.success("Plano salvo");
      setOpen(false);
      await reload();
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }
  async function del(p: SaasPlan) {
    if (!confirm(`Excluir plano "${p.name}"?`)) return;
    try {
      await remove({ data: { id: p.id } });
      toast.success("Removido");
      await reload();
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }

  return (
    <PageContainer>
      <SectionHeader
        title="Planos SaaS (CobraEasy)"
        subtitle="Catálogo de planos vendidos para os donos de painéis IPTV."
      />
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Novo plano</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
              <CardTitle className="text-base">
                {p.name} <span className="text-xs font-normal text-muted-foreground">/{p.slug}</span>
              </CardTitle>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => del(p)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div>R$ {(p.price_cents/100).toFixed(2)} /mês</div>
              <div>{p.ai_monthly_limit.toLocaleString("pt-BR")} respostas/mês</div>
              <div className="text-xs text-muted-foreground">Ativo: {p.is_active ? "sim" : "não"} · Ordem: {p.sort_order}</div>
              {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? "Editar plano" : "Novo plano"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="essencial" /></div>
              <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Preço (centavos)</Label><Input type="number" value={form.price_cents} onChange={(e) => setForm({ ...form, price_cents: Number(e.target.value) })} /></div>
              <div><Label>Limite IA/mês</Label><Input type="number" value={form.ai_monthly_limit} onChange={(e) => setForm({ ...form, ai_monthly_limit: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Ordem</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
              <div className="flex items-end gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><span className="text-sm">Ativo</span></div>
            </div>
            <div><Label>Descrição</Label><Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}><Save className="mr-1 h-4 w-4" /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
