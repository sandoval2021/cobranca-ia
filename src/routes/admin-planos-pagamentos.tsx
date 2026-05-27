import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Package, Plus, Pencil, ShieldAlert, Info } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocalAuth } from "@/lib/use-local-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/admin-planos-pagamentos")({
  component: AdminPlanosPage,
});

interface VisualPlan {
  id: string;
  nome: string;
  descricao: string;
  valor: number;
  trialDays: number;
  ativo: boolean;
  recursos: string[];
}

const SEED_PLANS: VisualPlan[] = [
  {
    id: "starter",
    nome: "Starter",
    descricao: "Plano inicial para começar.",
    valor: 49.9,
    trialDays: 7,
    ativo: true,
    recursos: ["Clientes ilimitados", "Cobranças manuais", "Importação PDF/Excel"],
  },
  {
    id: "pro",
    nome: "Pro",
    descricao: "Para quem já cobra todo mês.",
    valor: 99.9,
    trialDays: 7,
    ativo: true,
    recursos: ["Tudo do Starter", "Automação básica", "Relatórios completos"],
  },
];

function AdminPlanosPage() {
  const { isSuperAdmin } = useLocalAuth();
  const [plans, setPlans] = useState<VisualPlan[]>(SEED_PLANS);
  const [editing, setEditing] = useState<VisualPlan | null>(null);

  if (!isSuperAdmin) {
    return (
      <PageContainer>
        <div className="mx-auto flex max-w-md flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-xl font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta área é exclusiva do Super Admin.
          </p>
          <Link to="/" className="mt-6">
            <Button>Voltar</Button>
          </Link>
        </div>
      </PageContainer>
    );
  }

  function openNew() {
    setEditing({
      id: "",
      nome: "",
      descricao: "",
      valor: 0,
      trialDays: 7,
      ativo: true,
      recursos: [],
    });
  }

  function save() {
    if (!editing) return;
    if (!editing.nome.trim()) {
      toast.error("Informe um nome para o plano.");
      return;
    }
    setPlans((prev) => {
      const exists = prev.find((p) => p.id === editing.id);
      if (exists) return prev.map((p) => (p.id === editing.id ? editing : p));
      const id = editing.id || editing.nome.toLowerCase().replace(/\s+/g, "-");
      return [...prev, { ...editing, id }];
    });
    setEditing(null);
    toast.success("Plano salvo localmente (cobrança real ainda não ativa).");
  }

  return (
    <PageContainer>
      <SectionHeader
        title="Planos e pagamentos"
        subtitle="Configuração visual dos planos. Pagamento online ainda não está ativo."
        action={
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            Novo plano
          </Button>
        }
      />

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Esta tela é visual. Nada é cobrado. A integração real com Mercado Pago
          será ativada em fase posterior.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((p) => (
          <Card key={p.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <CardTitle className="text-base">{p.nome}</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="text-2xl font-semibold">
                R$ {p.valor.toFixed(2).replace(".", ",")}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  /mês
                </span>
              </div>
              <p className="text-muted-foreground">{p.descricao || "—"}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-muted px-2 py-0.5">
                  {p.trialDays} dias grátis
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 ${
                    p.ativo ? "bg-emerald-100 text-emerald-800" : "bg-muted"
                  }`}
                >
                  {p.ativo ? "Ativo" : "Inativo"}
                </span>
              </div>
              {p.recursos.length > 0 && (
                <ul className="ml-4 list-disc text-xs text-muted-foreground">
                  {p.recursos.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar plano" : "Novo plano"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input
                  value={editing.nome}
                  onChange={(e) =>
                    setEditing({ ...editing, nome: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  rows={2}
                  value={editing.descricao}
                  onChange={(e) =>
                    setEditing({ ...editing, descricao: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editing.valor}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        valor: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Dias grátis</Label>
                  <Input
                    type="number"
                    value={editing.trialDays}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        trialDays: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Recursos (1 por linha)</Label>
                <Textarea
                  rows={3}
                  value={editing.recursos.join("\n")}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      recursos: e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-2">
                <Label className="m-0">Plano ativo</Label>
                <Switch
                  checked={editing.ativo}
                  onCheckedChange={(v) => setEditing({ ...editing, ativo: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
