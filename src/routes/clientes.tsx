import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Users, SlidersHorizontal } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { ListCard } from "@/components/ui-premium/ListCard";
import { ListCardSkeleton } from "@/components/ui-premium/Skeletons";
import { EmptyState } from "@/components/ui-premium/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Status } from "@/components/ui-premium/StatusBadge";

export const Route = createFileRoute("/clientes")({
  component: ClientesPage,
});

type Cliente = {
  id: number;
  nome: string;
  plano: string;
  status: Status;
  app: string;
  appNome: string;
  server: string;
  serverNome: string;
};

const dados: Cliente[] = [
  { id: 1, nome: "João da Silva", plano: "Plano Mensal · R$ 35", status: "ativo", app: "#6750e3", appNome: "App A", server: "#16a34a", serverNome: "BR-01" },
  { id: 2, nome: "Maria Souza", plano: "Vence em 3 dias · R$ 45", status: "vencendo", app: "#0ea5e9", appNome: "App B", server: "#f59e0b", serverNome: "BR-02" },
  { id: 3, nome: "Carlos Pereira", plano: "Atrasado 2 dias · R$ 35", status: "atrasado", app: "#ec4899", appNome: "App C", server: "#16a34a", serverNome: "BR-01" },
  { id: 4, nome: "Ana Lima", plano: "Renovado hoje · R$ 70", status: "pago", app: "#6750e3", appNome: "App A", server: "#16a34a", serverNome: "BR-01" },
  { id: 5, nome: "Pedro Costa", plano: "Plano Trimestral · R$ 90", status: "ativo", app: "#0ea5e9", appNome: "App B", server: "#0ea5e9", serverNome: "BR-03" },
  { id: 6, nome: "Lucia Santos", plano: "Novo cliente", status: "novo", app: "#ec4899", appNome: "App C", server: "#f59e0b", serverNome: "BR-02" },
];

const filtros: { label: string; value: "todos" | Status }[] = [
  { label: "Todos", value: "todos" },
  { label: "Ativos", value: "ativo" },
  { label: "Vencendo", value: "vencendo" },
  { label: "Atrasados", value: "atrasado" },
  { label: "Novos", value: "novo" },
];

function ClientesPage() {
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<(typeof filtros)[number]["value"]>("todos");

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  const lista = useMemo(() => {
    return dados.filter((c) => {
      const matchQ = c.nome.toLowerCase().includes(q.toLowerCase());
      const matchF = filtro === "todos" || c.status === filtro;
      return matchQ && matchF;
    });
  }, [q, filtro]);

  return (
    <PageContainer>
      <SectionHeader
        title="Clientes"
        subtitle="Sua base completa, sempre à mão"
        hint="Toque em um cliente para ver detalhes e enviar mensagem."
        action={
          <Button size="sm" className="gap-1">
            <Plus className="h-4 w-4" /> Novo
          </Button>
        }
      />

      <div className="sticky top-[var(--header-height)] z-20 -mx-4 mb-3 bg-background/85 px-4 py-2 backdrop-blur md:-mx-6 md:px-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome..."
            className="h-10 rounded-xl bg-surface pl-9"
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2"
            aria-label="Filtros"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>

        <div className="scrollbar-hide -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1">
          {filtros.map((f) => {
            const active = filtro === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setFiltro(f.value)}
                className={
                  "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                  (active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface text-foreground/70 hover:bg-surface-muted")
                }
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <ListCardSkeleton key={i} />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum cliente encontrado"
          description="Tente outro nome ou troque o filtro."
        />
      ) : (
        <div className="space-y-2">
          {lista.map((c) => (
            <ListCard
              key={c.id}
              title={c.nome}
              subtitle={c.plano}
              status={c.status}
              appColor={c.app}
              serverColor={c.server}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
