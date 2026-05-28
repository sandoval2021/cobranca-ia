import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getActiveCompanyId } from "@/lib/company-scope";
import { listPaymentTransactions } from "@/lib/payments/payments.functions";

export const Route = createFileRoute("/pagamentos/historico")({ component: HistoricoPage });

function brl(c: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100);
}

function HistoricoPage() {
  const companyId = getActiveCompanyId();
  const list = useServerFn(listPaymentTransactions);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    if (!companyId) return;
    list({ data: { companyId, limit: 50 } }).then((r) => setRows(r as Array<Record<string, unknown>>)).catch(() => setRows([]));
  }, [companyId, list]);

  if (!companyId) {
    return (
      <PageContainer>
        <SectionHeader title="Histórico de pagamentos" />
        <Card><CardContent className="p-4 text-sm text-muted-foreground">Selecione uma empresa.</CardContent></Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <SectionHeader title="Histórico de pagamentos" subtitle="Cobranças geradas via Mercado Pago." />
      <div className="space-y-2">
        {rows.length === 0 ? (
          <Card><CardContent className="p-4 text-sm text-muted-foreground">Nenhuma cobrança ainda.</CardContent></Card>
        ) : rows.map((r) => (
          <Card key={String(r.id)}>
            <CardContent className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{String(r.description || "Cobrança")}</div>
                <div className="text-xs text-muted-foreground">
                  {String(r.payment_method)} · {new Date(String(r.created_at)).toLocaleString("pt-BR")}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{brl(Number(r.total_amount_cents))}</div>
                <Badge variant={r.status === "approved" ? "default" : r.status === "pending" ? "secondary" : "destructive"}>
                  {String(r.status)}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
