import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, TrendingUp, Users, DollarSign } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { StatCard } from "@/components/ui-premium/StatCard";
import { EmptyState } from "@/components/ui-premium/EmptyState";

export const Route = createFileRoute("/resultados")({
  component: ResultadosPage,
});

function ResultadosPage() {
  return (
    <PageContainer>
      <SectionHeader
        title="Resultados"
        subtitle="Os números do seu negócio"
        hint="Atualizado em tempo real."
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Receita do mês" value="R$ 12.430" icon={DollarSign} accent="success" trend={{ value: "18%", up: true }} />
        <StatCard label="Novos clientes" value="24" icon={Users} accent="primary" trend={{ value: "6", up: true }} />
        <StatCard label="Renovações" value="89%" icon={TrendingUp} accent="info" />
        <StatCard label="Cancelamentos" value="3" icon={BarChart3} accent="warning" trend={{ value: "1", up: false }} />
      </div>
      <div className="mt-6">
        <EmptyState
          icon={BarChart3}
          title="Gráficos chegando"
          description="Em breve você verá a evolução mensal com gráficos visuais."
        />
      </div>
    </PageContainer>
  );
}
