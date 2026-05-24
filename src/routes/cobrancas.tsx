import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Receipt, Lock } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { EmptyState } from "@/components/ui-premium/EmptyState";
import { ListCardSkeleton } from "@/components/ui-premium/Skeletons";
import { Button } from "@/components/ui/button";
import { useSupabaseList } from "@/lib/use-supabase";
import { supabase, supabaseConfigured } from "@/integrations/supabase/client";
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

type CustomerInfo = { name?: string; whatsapp?: string };

function CobrancasPage() {
  const state = useSupabaseList<Row>("customer_charges", {
    limit: 100,
    order: { column: "created_at", ascending: false },
  });

  const [customers, setCustomers] = useState<Record<string, CustomerInfo>>({});

  useEffect(() => {
    if (state.status !== "ready" || !supabase || !supabaseConfigured) return;
    const ids = Array.from(
      new Set(
        state.data
          .map((r) => r.customer_id)
          .filter((v): v is string => typeof v === "string" && v.length > 0),
      ),
    );
    if (ids.length === 0) {
      setCustomers({});
      return;
    }
    let alive = true;
    (async () => {
      const { data, error } = await supabase!
        .from("customers")
        .select("id,name,nome,full_name,phone,telefone,whatsapp")
        .in("id", ids);
      if (!alive || error || !data) return;
      const map: Record<string, CustomerInfo> = {};
      for (const c of data as Row[]) {
        const id = c.id as string;
        map[id] = {
          name: str(c, ["name", "nome", "full_name"]) ?? undefined,
          whatsapp: str(c, ["whatsapp", "phone", "telefone"]) ?? undefined,
        };
      }
      setCustomers(map);
    })();
    return () => {
      alive = false;
    };
  }, [state]);

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
        <EmptyState icon={Receipt} title="Conexão não configurada" description="Verifique as variáveis do Supabase no ambiente do Lovable." />
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
            const amount = num(row, ["amount", "value", "valor", "total", "amount_cents"]);
            const isCents = num(row, ["amount_cents"]) !== null && amount !== null && amount === num(row, ["amount_cents"]);
            const due = str(row, ["due_date", "vencimento", "due_at", "expires_at"]);
            const customerId = typeof row.customer_id === "string" ? row.customer_id : null;
            const inline = str(row, ["customer_name", "customer", "client_name"]);
            const linked = customerId ? customers[customerId] : undefined;
            const who =
              linked?.name ??
              inline ??
              (customerId ? "Cliente não encontrado" : "Cliente demo");
            const whatsapp = linked?.whatsapp ?? str(row, ["whatsapp", "phone"]);
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
                    {whatsapp ? `${whatsapp} · ` : ""}
                    {due ? `Vence ${fmtDate(due)}` : "Sem data"} · {status}
                  </p>
                </div>
                <div className="shrink-0 text-right text-sm font-semibold">
                  {amount !== null ? fmtBRL(isCents ? amount / 100 : amount) : "—"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
