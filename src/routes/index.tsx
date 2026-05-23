import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Users,
  Receipt,
  MessageCircle,
  TrendingUp,
  CalendarClock,
  ArrowUpRight,
  Plus,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { StatCard } from "@/components/ui-premium/StatCard";
import { StatCardSkeleton, ListCardSkeleton } from "@/components/ui-premium/Skeletons";
import { ListCard } from "@/components/ui-premium/ListCard";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Index,
});

const mockClientes = [
  { nome: "João da Silva", plano: "Plano Mensal", status: "ativo" as const, app: "#6750e3", server: "#16a34a" },
  { nome: "Maria Souza", plano: "Vence em 3 dias", status: "vencendo" as const, app: "#0ea5e9", server: "#f59e0b" },
  { nome: "Carlos Pereira", plano: "Atrasado 2 dias", status: "atrasado" as const, app: "#ec4899", server: "#16a34a" },
  { nome: "Ana Lima", plano: "Renovado hoje", status: "pago" as const, app: "#6750e3", server: "#16a34a" },
];

function Index() {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <PageContainer>
      <div className="mb-5 rounded-2xl border border-border bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground shadow-pop md:p-6">
        <p className="text-xs font-medium uppercase tracking-wide opacity-80">Olá 👋</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">
          Tudo certo por aqui hoje.
        </h1>
        <p className="mt-1 text-sm opacity-90">
          Você tem 3 clientes vencendo nos próximos dias.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" className="gap-1">
            <Plus className="h-4 w-4" /> Novo cliente
          </Button>
          <Button size="sm" variant="ghost" className="gap-1 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground">
            Ver vencimentos <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <SectionHeader
        title="Resumo de hoje"
        subtitle="Números rápidos do seu negócio"
        hint="Atualiza automaticamente ao longo do dia."
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard label="Clientes ativos" value="128" icon={Users} accent="primary" trend={{ value: "4", up: true }} />
            <StatCard label="Vencendo" value="9" icon={CalendarClock} accent="warning" hint="Vencem nos próximos 7 dias." />
            <StatCard label="Recebido hoje" value="R$ 1.240" icon={TrendingUp} accent="success" trend={{ value: "12%", up: true }} />
            <StatCard label="Mensagens" value="47" icon={MessageCircle} accent="info" />
          </>
        )}
      </div>

      <div className="mt-6">
        <SectionHeader
          title="Atividade recente"
          subtitle="Últimos clientes movimentados"
          action={
            <Button size="sm" variant="ghost" className="gap-1">
              Ver todos <ArrowUpRight className="h-4 w-4" />
            </Button>
          }
        />
        <div className="space-y-2">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <ListCardSkeleton key={i} />)
            : mockClientes.map((c) => (
                <ListCard
                  key={c.nome}
                  title={c.nome}
                  subtitle={c.plano}
                  status={c.status}
                  appColor={c.app}
                  serverColor={c.server}
                />
              ))}
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Próximas cobranças</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            9 cobranças programadas para os próximos 7 dias.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-info" />
            <h3 className="text-sm font-semibold">WhatsApp conectado</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Mensagens automáticas funcionando normalmente.
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
