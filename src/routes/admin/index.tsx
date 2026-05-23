import { createFileRoute } from "@tanstack/react-router";
import { Building2, TrendingUp, MessageCircle, Sparkles, AlertTriangle, ListTodo } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { StatCard } from "@/components/ui-premium/StatCard";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

function AdminHome() {
  return (
    <PageContainer>
      <SectionHeader
        title="Visão geral"
        subtitle="Plataforma em tempo real"
        hint="Métricas consolidadas de todas as empresas."
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Empresas ativas" value="312" icon={Building2} accent="primary" trend={{ value: "12", up: true }} />
        <StatCard label="Receita do mês" value="R$ 184k" icon={TrendingUp} accent="success" trend={{ value: "9%", up: true }} />
        <StatCard label="Mensagens hoje" value="14.2k" icon={MessageCircle} accent="info" />
        <StatCard label="Uso da IA" value="2.1k" icon={Sparkles} accent="primary" />
        <StatCard label="Filas pendentes" value="38" icon={ListTodo} accent="warning" />
        <StatCard label="Falhas 24h" value="4" icon={AlertTriangle} accent="danger" />
      </div>
    </PageContainer>
  );
}
