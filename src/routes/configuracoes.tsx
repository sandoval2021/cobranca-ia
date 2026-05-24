import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, MessageCircle, Sparkles, Lock } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { flags } from "@/lib/flags";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/configuracoes")({ component: ConfiguracoesPage });

function Block({
  icon: Icon,
  title,
  desc,
  active,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  active: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-muted text-foreground/60">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
      <span
        className={
          "shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium " +
          (active ? "bg-success-soft text-success" : "bg-danger-soft text-danger")
        }
      >
        <Lock className="h-3 w-3" />
        {active ? "Ativo" : "Bloqueado"}
      </span>
    </div>
  );
}

function ConfiguracoesPage() {
  return (
    <PageContainer>
      <SectionHeader
        title="Configurações"
        subtitle="Estado das integrações no ambiente de testes"
      />
      <div className="space-y-2">
        <Block
          icon={CreditCard}
          title="Pagamentos reais"
          desc="Bloqueado nesta etapa. Nenhuma cobrança é enviada para gateways reais."
          active={flags.allowRealPayments}
        />
        <Block
          icon={MessageCircle}
          title="WhatsApp real"
          desc="Bloqueado nesta etapa. Nenhuma mensagem real é enviada."
          active={flags.allowRealWhatsapp}
        />
        <Block
          icon={Sparkles}
          title="IA real livre"
          desc="Bloqueada nesta etapa. A IA não envia chamadas externas."
          active={flags.allowRealAi}
        />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Para liberar as integrações reais, ajuste as variáveis de ambiente
        correspondentes no Lovable.
      </p>
    </PageContainer>
  );
}
