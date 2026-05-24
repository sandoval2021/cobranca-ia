import { createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  Users,
  Receipt,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { StatCard } from "@/components/ui-premium/StatCard";
import { StatCardSkeleton } from "@/components/ui-premium/Skeletons";
import { useSupabaseCount } from "@/lib/use-supabase";
import { supabaseConfigured } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({ component: Dashboard });

function CountCard({
  table,
  label,
  icon,
  accent,
}: {
  table: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "primary" | "success" | "warning" | "danger" | "info";
}) {
  const s = useSupabaseCount(table);
  if (s.status === "loading") return <StatCardSkeleton />;
  const value =
    s.status === "ready"
      ? String(s.count)
      : s.status === "not_configured"
        ? "—"
        : "!";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <StatCard label={label} value={value} icon={icon as any} accent={accent} />;
}

function Dashboard() {
  return (
    <PageContainer>
      <div className="mb-5 rounded-2xl border border-border bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground shadow-pop md:p-6">
        <p className="text-xs font-medium uppercase tracking-wide opacity-80">
          Ambiente de testes
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">
          Visão geral do seu painel
        </h1>
        <p className="mt-1 text-sm opacity-90">
          Os números abaixo são apenas dados demonstrativos.
        </p>
      </div>

      <SectionHeader
        title="Resumo dos dados demo"
        subtitle="Conectado ao ambiente de teste"
        hint="Cada cartão lê diretamente da base demonstrativa."
      />

      {!supabaseConfigured && (
        <div className="mb-3 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
          Conexão não configurada. Defina <code>SUPABASE_URL</code> e{" "}
          <code>SUPABASE_ANON_KEY</code> para ver os dados.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <CountCard table="companies" label="Empresas" icon={Building2} accent="primary" />
        <CountCard table="customers" label="Clientes" icon={Users} accent="info" />
        <CountCard table="customer_charges" label="Cobranças" icon={Receipt} accent="warning" />
        <CountCard table="messages" label="Mensagens" icon={MessageCircle} accent="success" />
        <CountCard table="ai_messages" label="Mensagens da IA" icon={Sparkles} accent="primary" />
      </div>
    </PageContainer>
  );
}
