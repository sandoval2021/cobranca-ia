import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getAdminMarketplaceOverview,
  type AdminMarketplaceRow,
} from "@/lib/payments/admin-marketplace.functions";

export const Route = createFileRoute("/admin/marketplace")({
  component: AdminMarketplacePage,
});

function brl(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (cents || 0) / 100,
  );
}

function AdminMarketplacePage() {
  const fn = useServerFn(getAdminMarketplaceOverview);
  const [rows, setRows] = useState<AdminMarketplaceRow[]>([]);
  const [webhookErrors, setWebhookErrors] = useState(0);
  const [splitErrors, setSplitErrors] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fn({})
      .then((d) => {
        const r = d as {
          rows: AdminMarketplaceRow[];
          webhook_errors: number;
          split_errors: number;
        };
        setRows(r.rows);
        setWebhookErrors(r.webhook_errors);
        setSplitErrors(r.split_errors);
      })
      .catch((e: Error) => setError(e.message || "Erro"));
  }, [fn]);

  const filtered = rows.filter(
    (r) =>
      (!statusFilter || r.status === statusFilter) &&
      (!companyFilter ||
        (r.company_name || "").toLowerCase().includes(companyFilter.toLowerCase())),
  );

  const totalVolume = filtered.reduce((s, r) => s + r.volume_cents, 0);
  const totalFees = filtered.reduce((s, r) => s + r.fee_cents, 0);
  const totalApproved = filtered.reduce((s, r) => s + r.approved_count, 0);
  const totalPending = filtered.reduce((s, r) => s + r.pending_count, 0);

  if (error === "forbidden") {
    return (
      <PageContainer>
        <SectionHeader title="Marketplace" subtitle="Acesso restrito ao super admin." />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <SectionHeader
        title="Marketplace · Mercado Pago"
        subtitle="Visão consolidada de todas as empresas conectadas."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Volume processado</p>
            <p className="text-xl font-bold">{brl(totalVolume)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Taxa CobraEasy</p>
            <p className="text-xl font-bold">{brl(totalFees)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Aprovados</p>
            <p className="text-xl font-bold">{totalApproved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pendentes</p>
            <p className="text-xl font-bold">{totalPending}</p>
          </CardContent>
        </Card>
      </div>

      {(webhookErrors > 0 || splitErrors > 0) && (
        <Card className="mb-4 border-destructive">
          <CardContent className="p-4 flex gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Erros de webhook</p>
              <p className="text-lg font-bold text-destructive">{webhookErrors}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Erros de split</p>
              <p className="text-lg font-bold text-destructive">{splitErrors}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Empresas conectadas</CardTitle>
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Filtrar por empresa"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="max-w-xs"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 rounded border bg-background text-sm"
            >
              <option value="">Todos status</option>
              <option value="connected">Conectado</option>
              <option value="disconnected">Desconectado</option>
              <option value="error">Erro</option>
              <option value="expired">Expirado</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aprovados</TableHead>
                <TableHead className="text-right">Pendentes</TableHead>
                <TableHead className="text-right">Volume</TableHead>
                <TableHead className="text-right">Taxa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.company_id}>
                  <TableCell className="font-medium">
                    {r.company_name || r.company_id.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === "connected" ? "default" : "secondary"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{r.approved_count}</TableCell>
                  <TableCell className="text-right">{r.pending_count}</TableCell>
                  <TableCell className="text-right">{brl(r.volume_cents)}</TableCell>
                  <TableCell className="text-right">{brl(r.fee_cents)}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Nenhuma empresa encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
