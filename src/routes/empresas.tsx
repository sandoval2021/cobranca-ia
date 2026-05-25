import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { EmptyState } from "@/components/ui-premium/EmptyState";
import { ListCardSkeleton } from "@/components/ui-premium/Skeletons";
import { useCurrentCompany } from "@/lib/rpc-admin";

export const Route = createFileRoute("/empresas")({ component: EmpresasPage });

function EmpresasPage() {
  const state = useCurrentCompany();

  return (
    <PageContainer>
      <SectionHeader
        title="Empresa"
        subtitle="Empresa autorizada para a sua conta"
        hint="Mostra apenas a empresa vinculada à sessão atual."
      />
      {state.status === "loading" && (
        <div className="space-y-2">
          <ListCardSkeleton />
        </div>
      )}
      {state.status === "not_configured" && (
        <EmptyState
          icon={Building2}
          title="Conexão não configurada"
          description="Defina as variáveis de conexão para listar a empresa."
        />
      )}
      {state.status === "unauthenticated" && (
        <EmptyState
          icon={Building2}
          title="Entre na sua conta"
          description="É preciso estar autenticado para ver a empresa."
        />
      )}
      {state.status === "error" && (
        <EmptyState
          icon={Building2}
          title="Não foi possível carregar"
          description={state.message}
        />
      )}
      {state.status === "ready" && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Empresa autorizada</p>
            <p className="truncate text-xs text-muted-foreground">
              Sua conta está vinculada a uma empresa para o ambiente atual.
            </p>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
