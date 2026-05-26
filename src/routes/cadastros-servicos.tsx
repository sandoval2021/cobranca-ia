import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";

import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

import {
  listServices, saveService, updateService, deleteService, formatBRL,
  SERVICES_EVENT, type ServiceItem,
} from "@/lib/services-catalog";

export const Route = createFileRoute("/cadastros-servicos")({
  component: CadastrosServicosPage,
});

function CadastrosServicosPage() {
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceItem | null>(null);
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");

  const reload = () => setItems(listServices());

  useEffect(() => {
    reload();
    const h = () => reload();
    window.addEventListener(SERVICES_EVENT, h);
    return () => window.removeEventListener(SERVICES_EVENT, h);
  }, []);

  function openNew() {
    setEditing(null);
    setNome("");
    setValor("");
    setOpen(true);
  }
  function openEdit(s: ServiceItem) {
    setEditing(s);
    setNome(s.nome);
    setValor((s.preco_cents / 100).toFixed(2).replace(".", ","));
    setOpen(true);
  }

  function submit() {
    const n = nome.trim();
    if (!n) { toast.error("Informe o nome do serviço."); return; }
    const num = Number((valor || "").replace(/\./g, "").replace(",", "."));
    if (!isFinite(num) || num < 0) { toast.error("Informe um valor válido."); return; }
    const preco_cents = Math.round(num * 100);
    if (editing) {
      updateService(editing.id, { nome: n, preco_cents });
      toast.success("Serviço atualizado");
    } else {
      saveService({ nome: n, preco_cents });
      toast.success("Serviço cadastrado");
    }
    setOpen(false);
    reload();
  }

  function toggleAtivo(s: ServiceItem) {
    updateService(s.id, { ativo: !s.ativo });
    reload();
  }

  function remove(s: ServiceItem) {
    if (!confirm(`Excluir o serviço "${s.nome}"?`)) return;
    deleteService(s.id);
    toast.success("Serviço excluído");
    reload();
  }

  return (
    <PageContainer>
      <SectionHeader
        title="Cadastros · Serviços"
        subtitle="Cadastre seus planos (ex.: 1 tela R$ 12, 2 telas R$ 25). Usado em Testes e nas suas cobranças."
        action={
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> Novo serviço
          </Button>
        }
      />

      <div className="space-y-2">
        {items.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Nenhum serviço cadastrado. Crie pelo menos um para usar na tela de Testes.
          </Card>
        )}
        {items.map((s) => (
          <Card key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div>
              <p className="font-medium">{s.nome}</p>
              <p className="text-sm text-muted-foreground">
                {formatBRL(s.preco_cents)} ·{" "}
                <span className={s.ativo ? "text-success" : "text-muted-foreground"}>
                  {s.ativo ? "Ativo" : "Inativo"}
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => toggleAtivo(s)} className="gap-1">
                {s.ativo ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                {s.ativo ? "Inativar" : "Ativar"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => openEdit(s)} className="gap-1">
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(s)} className="gap-1 text-destructive">
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar serviço" : "Novo serviço"}</DialogTitle>
            <DialogDescription>Defina o nome e o valor mensal do serviço.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: 1 tela, 2 telas, App + Tela…" />
            </div>
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="12,00" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
