import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getActiveCompanyId } from "@/lib/company-scope";
import {
  getMarketplaceStatus,
  getMpAuthorizeUrl,
  disconnectMarketplace,
  getPaymentSettings,
  updatePaymentSettings,
} from "@/lib/payments/payments.functions";

export const Route = createFileRoute("/pagamentos/mercado-pago")({
  component: MercadoPagoPage,
  validateSearch: (s: Record<string, unknown>) => ({
    mp: typeof s.mp === "string" ? s.mp : undefined,
    reason: typeof s.reason === "string" ? s.reason : undefined,
  }),
});

function brl(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function MercadoPagoPage() {
  const companyId = getActiveCompanyId();
  const search = Route.useSearch();

  const getStatus = useServerFn(getMarketplaceStatus);
  const getAuth = useServerFn(getMpAuthorizeUrl);
  const disconnect = useServerFn(disconnectMarketplace);
  const getSettings = useServerFn(getPaymentSettings);
  const saveSettings = useServerFn(updatePaymentSettings);

  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [feeMode, setFeeMode] = useState<"customer_pays" | "owner_pays">("customer_pays");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    getStatus({ data: { companyId } }).then(setStatus).catch(() => setStatus(null));
    getSettings({ data: { companyId } })
      .then((s) => setFeeMode(((s as { fee_mode?: string })?.fee_mode as "customer_pays" | "owner_pays") || "customer_pays"))
      .catch(() => undefined);
  }, [companyId, getStatus, getSettings]);

  if (!companyId) {
    return (
      <PageContainer>
        <SectionHeader title="Mercado Pago" subtitle="Conecte sua conta para receber pagamentos online." />
        <Card><CardContent className="p-4 text-sm text-muted-foreground">Selecione uma empresa.</CardContent></Card>
      </PageContainer>
    );
  }

  const connected = (status?.status as string) === "connected";

  async function handleConnect() {
    if (!companyId) return;
    setLoading(true);
    try {
      const r = await getAuth({ data: { companyId } });
      window.location.href = (r as { url: string }).url;
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    if (!companyId) return;
    setLoading(true);
    try {
      await disconnect({ data: { companyId } });
      const s = await getStatus({ data: { companyId } });
      setStatus(s);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(mode: "customer_pays" | "owner_pays") {
    if (!companyId) return;
    setFeeMode(mode);
    await saveSettings({ data: { companyId, feeMode: mode } });
  }

  // Exemplo de cálculo com cobrança de R$ 100,00
  const exampleAmt = 10000;
  const exampleFee = 100;

  return (
    <PageContainer>
      <SectionHeader title="Mercado Pago" subtitle="Conecte sua conta e configure quem paga a taxa de processamento." />

      {search.mp === "connected" && (
        <Card className="mb-3 border-green-500/40 bg-green-500/5">
          <CardContent className="p-3 text-sm">Conta Mercado Pago conectada com sucesso.</CardContent>
        </Card>
      )}
      {search.mp === "error" && (
        <Card className="mb-3 border-destructive/40 bg-destructive/5">
          <CardContent className="p-3 text-sm">Falha ao conectar Mercado Pago{search.reason ? ` (${search.reason})` : ""}.</CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Status da conexão
            <Badge variant={connected ? "default" : "secondary"}>{connected ? "Conectado" : "Desconectado"}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {connected ? (
            <>
              <div className="text-sm text-muted-foreground">
                ID Mercado Pago: <span className="font-mono">{String(status?.mp_user_id || "—")}</span>
              </div>
              <Button variant="outline" disabled={loading} onClick={handleDisconnect}>
                Desconectar conta
              </Button>
            </>
          ) : (
            <Button disabled={loading} onClick={handleConnect}>
              Conectar Mercado Pago
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quem paga a taxa de processamento (1%)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => handleSave("customer_pays")}
              className={`rounded-lg border p-3 text-left ${feeMode === "customer_pays" ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <div className="text-sm font-semibold">Cliente paga a taxa</div>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li>Cobrança: {brl(exampleAmt)}</li>
                <li>Taxa de processamento: {brl(exampleFee)}</li>
                <li>Cliente paga: <b>{brl(exampleAmt + exampleFee)}</b></li>
                <li>Sua empresa recebe: <b>{brl(exampleAmt)}</b></li>
              </ul>
            </button>
            <button
              type="button"
              onClick={() => handleSave("owner_pays")}
              className={`rounded-lg border p-3 text-left ${feeMode === "owner_pays" ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <div className="text-sm font-semibold">Minha empresa assume a taxa</div>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li>Cobrança: {brl(exampleAmt)}</li>
                <li>Taxa de processamento: {brl(exampleFee)}</li>
                <li>Cliente paga: <b>{brl(exampleAmt)}</b></li>
                <li>Sua empresa recebe: <b>{brl(exampleAmt - exampleFee)}</b></li>
              </ul>
            </button>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
