import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, X, Sparkles } from "lucide-react";

import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

import {
  listServices, saveService, updateService, deleteService, formatBRL,
  seedDefaultPlansIfEmpty,
  SERVICES_EVENT, type ServiceItem,
} from "@/lib/services-catalog";

export const Route = createFileRoute("/cadastros-servicos")({
  component: CadastrosServicosPage,
});

const TPL_COBRANCA_DEFAULT =
  "Olá {nome}, tudo bem? Passando para lembrar do seu plano *{plano}* ({telas} tela(s) · {meses} mês(es)) no valor de *{valor}*. Vencimento: {vencimento}. Posso te enviar o pagamento?";
const TPL_ACOMP_DEFAULT =
  "Oi {nome}! Tudo certo com o seu plano *{plano}* ({telas} tela/s)? Qualquer coisa estou por aqui.";

type FormState = {
  nome: string;
  valor: string;
  telas: string;
  meses: string;
  mensagem_cobranca: string;
  mensagem_acompanhamento: string;
};

const emptyForm = (): FormState => ({
  nome: "",
  valor: "",
  telas: "1",
  meses: "1",
  mensagem_cobranca: TPL_COBRANCA_DEFAULT,
  mensagem_acompanhamento: TPL_ACOMP_DEFAULT,
});

function CadastrosServicosPage() {
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const reload = () => setItems(listServices());

  useEffect(() => {
    reload();
    const h = () => reload();
    window.addEventListener(SERVICES_EVENT, h);
    return () => window.removeEventListener(SERVICES_EVENT, h);
  }, []);

  function set<K extends keyof FormState>(key: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [key]: v }));
  }

  function openNew() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }
  function openEdit(s: ServiceItem) {
    setEditing(s);
    setForm({
      nome: s.nome,
      valor: (s.preco_cents / 100).toFixed(2).replace(".", ","),
      telas: String(s.telas),
      meses: String(s.meses),
      mensagem_cobranca: s.mensagem_cobranca || TPL_COBRANCA_DEFAULT,
      mensagem_acompanhamento: s.mensagem_acompanhamento || TPL_ACOMP_DEFAULT,
    });
    setOpen(true);
  }

  function submit() {
    const n = form.nome.trim();
    if (!n) { toast.error("Informe o nome do plano."); return; }
    const num = Number((form.valor || "").replace(/\./g, "").replace(",", "."));
    if (!isFinite(num) || num < 0) { toast.error("Informe um valor válido."); return; }
    const telas = Math.max(1, Math.round(Number(form.telas) || 1));
    const meses = Math.max(1, Math.round(Number(form.meses) || 1));
    const preco_cents = Math.round(num * 100);
    const payload = {
      nome: n,
      preco_cents,
      telas,
      meses,
      mensagem_cobranca: form.mensagem_cobranca.trim() || TPL_COBRANCA_DEFAULT,
      mensagem_acompanhamento: form.mensagem_acompanhamento.trim() || TPL_ACOMP_DEFAULT,
    };
    if (editing) {
      updateService(editing.id, payload);
      toast.success("Plano atualizado");
    } else {
      saveService(payload);
      toast.success("Plano cadastrado");
    }
    setOpen(false);
    reload();
  }

  function toggleAtivo(s: ServiceItem) {
    updateService(s.id, { ativo: !s.ativo });
    reload();
  }

  function remove(s: ServiceItem) {
    if (!confirm(`Excluir o plano "${s.nome}"?`)) return;
    deleteService(s.id);
    toast.success("Plano excluído");
    reload();
  }

  function seed() {
    const n = seedDefaultPlansIfEmpty();
    if (n > 0) toast.success(`${n} planos criados`);
    else toast.info("Catálogo já possui planos. Apague-os primeiro para semear.");
    reload();
  }

  return (
    <PageContainer>
      <SectionHeader
        title="Cadastros · Serviços / Planos"
        subtitle="Cada plano tem seu valor, nº de telas, duração e mensagens próprias de cobrança e acompanhamento. A renovação usa uma mensagem global única."
        action={
          <div className="flex gap-2">
            {items.length === 0 && (
              <Button variant="outline" onClick={seed} className="gap-2">
                <Sparkles className="h-4 w-4" /> Usar planos sugeridos
              </Button>
            )}
            <Button onClick={openNew} className="gap-2">
              <Plus className="h-4 w-4" /> Novo plano
            </Button>
          </div>
        }
      />

      <div className="space-y-2">
        {items.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Nenhum plano cadastrado. Cadastre seus planos (ex.: 1 tela · 1 mês · R$ 12) — cada cliente vai receber a mensagem do plano dele.
          </Card>
        )}
        {items.map((s) => (
          <Card key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="font-medium">{s.nome}</p>
              <p className="text-sm text-muted-foreground">
                {formatBRL(s.preco_cents)} · {s.telas} tela{s.telas > 1 ? "s" : ""} · {s.meses} {s.meses === 1 ? "mês" : "meses"} ·{" "}
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar plano" : "Novo plano"}</DialogTitle>
            <DialogDescription>
              Variáveis disponíveis nas mensagens: <code>{"{nome}"}</code>, <code>{"{plano}"}</code>, <code>{"{valor}"}</code>, <code>{"{telas}"}</code>, <code>{"{meses}"}</code>, <code>{"{vencimento}"}</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome do plano</Label>
              <Input
                value={form.nome}
                onChange={(e) => set("nome", e.target.value)}
                placeholder="Ex.: 1 Tela · 1 Mês"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Telas</Label>
                <Input
                  type="number" min={1} max={10}
                  value={form.telas}
                  onChange={(e) => set("telas", e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Meses</Label>
                <Input
                  type="number" min={1} max={24}
                  value={form.meses}
                  onChange={(e) => set("meses", e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Valor (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={form.valor}
                  onChange={(e) => set("valor", e.target.value)}
                  placeholder="12,00"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Mensagem de cobrança</Label>
              <Textarea
                rows={4}
                value={form.mensagem_cobranca}
                onChange={(e) => set("mensagem_cobranca", e.target.value)}
                placeholder={TPL_COBRANCA_DEFAULT}
              />
            </div>
            <div>
              <Label className="text-xs">Mensagem de acompanhamento</Label>
              <Textarea
                rows={3}
                value={form.mensagem_acompanhamento}
                onChange={(e) => set("mensagem_acompanhamento", e.target.value)}
                placeholder={TPL_ACOMP_DEFAULT}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              A mensagem de <strong>renovação</strong> é única para todos os clientes (sem valor) e fica configurada em Mensagens, não aqui.
            </p>
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
