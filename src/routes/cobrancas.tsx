import { createFileRoute } from "@tanstack/react-router";
import { Receipt, Lock } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { EmptyState } from "@/components/ui-premium/EmptyState";
import { ListCardSkeleton } from "@/components/ui-premium/Skeletons";
import { Button } from "@/components/ui/button";
import { useSupabaseList } from "@/lib/use-supabase";
import { flags, STAGING_BLOCK_MESSAGE } from "@/lib/flags";
import { toast } from "sonner";

export const Route = createFileRoute("/cobrancas")({ component: CobrancasPage });

type Row = Record<string, unknown>;
const str = (r: Row, keys: string[]) => {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "number") return String(v);
  }
  return null;
};
const num = (r: Row, keys: string[]) => {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "number") return v;
    if (typeof v === "string" && !isNaN(Number(v))) return Number(v);
  }
  return null;
};
const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const fmtDate = (s: string) => {
  const d = new Date(s);
  return isNaN(+d) ? s : d.toLocaleDateString("pt-BR");
};

function CobrancasPage() {
  const state = useSupabaseList<Row>("customer_charges", {
    limit: 100,
    order: { column: "created_at", ascending: false },
  });

  const blocked = () => toast.message(STAGING_BLOCK_MESSAGE);

  return (
    <PageContainer>
      <SectionHeader
        title="Cobranças"
        subtitle="Histórico de cobranças demonstrativas"
        action={
          <Button
            size="sm"
            disabled={!flags.allowRealPayments}
            onClick={blocked}
            className="gap-1"
          >
            <Lock className="h-3.5 w-3.5" /> Nova cobrança
          </Button>
        }
      />
      {state.status === "loading" && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <ListCardSkeleton key={i} />
          ))}
        </div>
      )}
      {state.status === "not_configured" && (
        <EmptyState icon={Receipt} title="Conexão não configurada" description="Defina as variáveis de ambiente do Supabase." />
      )}
      {state.status === "error" && (
        <EmptyState icon={Receipt} title="Não foi possível carregar" description={state.message} />
      )}
      {state.status === "ready" && state.data.length === 0 && (
        <EmptyState icon={Receipt} title="Sem cobranças demo" description="Crie uma cobrança quando o ambiente real estiver ativo." />
      )}
      {state.status === "ready" && state.data.length > 0 && (
        <div className="space-y-2">
          {state.data.map((row, i) => {
            const status = str(row, ["status", "situacao"]) ?? "pendente";
            const amount = num(row, ["amount", "value", "valor", "total"]);
            const due = str(row, ["due_date", "vencimento", "due_at"]);
            const who =
              str(row, ["customer_name", "customer", "client_name"]) ??
              "Cliente demo";
            return (
              <div
                key={(row.id as string) ?? i}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning-soft text-warning">
                  <Receipt className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{who}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {due ? `Vence em ${fmtDate(due)}` : "Sem data"} · {status}
                  </p>
                </div>
                <div className="shrink-0 text-right text-sm font-semibold">
                  {amount !== null ? fmtBRL(amount) : "—"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
