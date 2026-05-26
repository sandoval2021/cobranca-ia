import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { UserCog, Save } from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLocalAuth } from "@/lib/use-local-auth";
import {
  COMPANIES_EVENT,
  ensureLocalAccount,
  getCompanyForUser,
  saveCompany,
  slugify,
  type Company,
} from "@/lib/companies";

export const Route = createFileRoute("/meus-dados")({ component: MeusDadosPage });

function MeusDadosPage() {
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
    // Garante que a base exista automaticamente — sem ação manual do dono.
    return ensureLocalAccount(user?.email, user?.nome, user?.whatsapp);
  }, [user?.email, user?.nome, user?.whatsapp]);

  const [form, setForm] = useState(() => ({
    nome: company?.nome ?? "",
    dono_nome: company?.dono_nome ?? user?.nome ?? "",
    dono_email: company?.dono_email ?? user?.email ?? "",
    dono_whatsapp: company?.dono_whatsapp ?? user?.whatsapp ?? "",
    observacao: company?.observacao ?? "",
  }));

  useEffect(() => {
    if (!company) return;
    setForm({
      nome: company.nome,
      dono_nome: company.dono_nome,
      dono_email: company.dono_email,
      dono_whatsapp: company.dono_whatsapp,
      observacao: company.observacao ?? "",
    });
  }, [company?.id]);

  function handleSave() {
    if (!company) {
      toast.error("Não foi possível preparar sua conta automaticamente. Saia e entre novamente.");
      return;
    }
    if (!form.nome.trim()) return toast.error("Informe o nome da sua base.");
    if (!form.dono_email.trim()) return toast.error("Informe seu e-mail.");
    saveCompany({
      ...company,
      ...form,
      slug: company.slug || slugify(form.nome),
    });
    toast.success("Dados atualizados.");
  }

  return (
    <PageContainer>
      <SectionHeader
        title="Meus dados"
        subtitle="Suas informações cadastrais. Você já pode usar o painel normalmente."
        hint="Edite quando quiser."
      />

      <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
        <UserCog className="mr-1 inline h-4 w-4" />
        Sua conta está pronta para uso. Estes dados aparecem em mensagens e relatórios.
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nome da base / revenda</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex.: Minha Revenda"
            />
          </div>
          <div>
            <Label>Responsável</Label>
            <Input
              value={form.dono_nome}
              onChange={(e) => setForm((f) => ({ ...f, dono_nome: e.target.value }))}
              placeholder="Seu nome"
            />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input
              type="email"
              value={form.dono_email}
              onChange={(e) => setForm((f) => ({ ...f, dono_email: e.target.value }))}
              placeholder="voce@exemplo.com"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>WhatsApp</Label>
            <Input
              value={form.dono_whatsapp}
              onChange={(e) => setForm((f) => ({ ...f, dono_whatsapp: e.target.value }))}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Observações</Label>
            <Textarea
              value={form.observacao}
              onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
              rows={3}
              placeholder="Notas internas, segmento, horários…"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={handleSave}>
            <Save className="h-4 w-4" />
            Salvar
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
