import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { EmptyState } from "@/components/ui-premium/EmptyState";
import { ListCardSkeleton } from "@/components/ui-premium/Skeletons";
import { useSupabaseList } from "@/lib/use-supabase";

export const Route = createFileRoute("/empresas")({ component: EmpresasPage });

type Row = Record<string, unknown>;

function pick(r: Row, keys: string[]): string | null {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "number") return String(v);
  }
  return null;
}

function EmpresasPage() {
  const state = useSupabaseList<Row>("companies", { limit: 100 });

  return (
    <PageContainer>
      <SectionHeader
        title="Empresas"
        subtitle="Empresas cadastradas no ambiente"
        hint="Lista direta da base demonstrativa."
      />
      {state.status === "loading" && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <ListCardSkeleton key={i} />
          ))}
        </div>
      )}
      {state.status === "not_configured" && (
        <EmptyState icon={Building2} title="Conexão não configurada" description="Defina as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY." />
      )}
      {state.status === "error" && (
        <EmptyState icon={Building2} title="Não foi possível carregar" description={state.message} />
      )}
      {state.status === "ready" && state.data.length === 0 && (
        <EmptyState icon={Building2} title="Sem empresas demo" description="Quando uma empresa for criada, ela aparece aqui." />
      )}
      {state.status === "ready" && state.data.length > 0 && (
        <div className="space-y-2">
          {state.data.map((row, i) => {
            const name =
              pick(row, ["name", "nome", "razao_social", "fantasia", "company_name"]) ??
              "Empresa";
            const sub =
              pick(row, ["email", "phone", "telefone", "document", "cnpj", "slug"]) ??
              "Sem detalhes adicionais";
            return (
              <div
                key={(row.id as string) ?? i}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{name}</p>
                  <p className="truncate text-xs text-muted-foreground">{sub}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
