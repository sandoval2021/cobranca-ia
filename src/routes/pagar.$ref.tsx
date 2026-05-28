import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { getPublicPayment } from "@/lib/payments/payments.functions";

export const Route = createFileRoute("/pagar/$ref")({
  component: PublicPayPage,
});

function brl(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (cents || 0) / 100,
  );
}

type Tx = {
  external_reference: string;
  description?: string | null;
  amount_cents: number;
  processing_fee_cents: number;
  total_amount_cents: number;
  fee_mode: "customer_pays" | "owner_pays";
  payment_method: string;
  status: string;
  qr_code?: string | null;
  qr_code_base64?: string | null;
  ticket_url?: string | null;
  init_point?: string | null;
  expires_at?: string | null;
  paid_at?: string | null;
};

function PublicPayPage() {
  const { ref } = Route.useParams();
  const getTx = useServerFn(getPublicPayment);

  const [tx, setTx] = useState<Tx | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await getTx({ data: { externalReference: ref } });
      setTx((data as Tx) || null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  async function handleCopy() {
    if (!tx?.qr_code) return;
    await navigator.clipboard.writeText(tx.qr_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (loading && !tx) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tx) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-2">
            <h1 className="text-lg font-semibold">Cobrança não encontrada</h1>
            <p className="text-sm text-muted-foreground">
              Verifique o link recebido ou entre em contato com o atendimento.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPaid = tx.status === "approved" || !!tx.paid_at;
  const showFee = tx.fee_mode === "customer_pays" && tx.processing_fee_cents > 0;

  return (
    <div className="min-h-screen bg-background py-6 px-4">
      <div className="max-w-md mx-auto space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg">Pagamento</CardTitle>
              <Badge variant={isPaid ? "default" : "secondary"}>
                {isPaid ? "Pago" : tx.status === "pending" ? "Aguardando" : tx.status}
              </Badge>
            </div>
            {tx.description ? (
              <p className="text-sm text-muted-foreground mt-1">{tx.description}</p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor do serviço</span>
              <span className="font-medium">{brl(tx.amount_cents)}</span>
            </div>
            {showFee ? (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taxa de processamento</span>
                <span className="font-medium">{brl(tx.processing_fee_cents)}</span>
              </div>
            ) : null}
            <div className="border-t pt-3 flex justify-between">
              <span className="font-semibold">Total a pagar</span>
              <span className="text-lg font-bold">{brl(tx.total_amount_cents)}</span>
            </div>
          </CardContent>
        </Card>

        {isPaid ? (
          <Card>
            <CardContent className="p-6 text-center space-y-2">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
              <h2 className="text-lg font-semibold">Pagamento confirmado</h2>
              <p className="text-sm text-muted-foreground">
                Obrigado! Em instantes seu atendimento será atualizado.
              </p>
            </CardContent>
          </Card>
        ) : tx.payment_method === "pix" && tx.qr_code ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Pague com Pix</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tx.qr_code_base64 ? (
                <div className="flex justify-center">
                  <img
                    src={`data:image/png;base64,${tx.qr_code_base64}`}
                    alt="QR Code Pix"
                    className="w-56 h-56 rounded border"
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Pix copia e cola</p>
                <div className="rounded border bg-muted/40 p-2 text-xs break-all font-mono max-h-32 overflow-auto">
                  {tx.qr_code}
                </div>
                <Button onClick={handleCopy} className="w-full" size="lg">
                  <Copy className="h-4 w-4 mr-2" />
                  {copied ? "Copiado!" : "Copiar código Pix"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : tx.init_point || tx.ticket_url ? (
          <Card>
            <CardContent className="p-4">
              <Button asChild className="w-full" size="lg">
                <a href={tx.init_point || tx.ticket_url!} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Pagar agora
                </a>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <p className="text-[10px] text-center text-muted-foreground">
          Esta página é atualizada automaticamente quando o pagamento é confirmado.
        </p>
      </div>
    </div>
  );
}
