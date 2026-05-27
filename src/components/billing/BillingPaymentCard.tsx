import { useEffect, useState } from "react";
import { CreditCard, QrCode, RefreshCw, Lock, Info, ExternalLink, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Company } from "@/lib/companies";
import { getCompanyStatus, getPlanById } from "@/lib/companies";
import {
  createBillingCheckout,
  getBillingPublicConfig,
  getLastPaymentAttempt,
} from "@/lib/billing.functions";

interface Props {
  company: Company | null;
}

const STATUS_LABEL: Record<string, string> = {
  ativa: "Ativa",
  teste: "Em teste grátis",
  vencida: "Conta vencida",
  suspensa: "Conta suspensa",
  cancelada: "Conta cancelada",
};

const ATTEMPT_LABEL: Record<string, { text: string; tone: string }> = {
  pending: { text: "Pagamento pendente", tone: "text-amber-700" },
  approved: { text: "Pagamento aprovado", tone: "text-emerald-700" },
  rejected: { text: "Pagamento recusado", tone: "text-red-700" },
  cancelled: { text: "Pagamento cancelado", tone: "text-muted-foreground" },
  refunded: { text: "Pagamento reembolsado", tone: "text-muted-foreground" },
  failed: { text: "Falha ao iniciar pagamento", tone: "text-red-700" },
  expired: { text: "Pagamento expirado", tone: "text-muted-foreground" },
};

const TERMS_VERSION = "v1";

export function BillingPaymentCard({ company }: Props) {
  const status = company ? getCompanyStatus(company) : "ativa";
  const plan = company?.plano_id ? getPlanById(company.plano_id) : null;

  const fetchConfig = useServerFn(getBillingPublicConfig);
  const fetchLast = useServerFn(getLastPaymentAttempt);
  const startCheckout = useServerFn(createBillingCheckout);

  const [configured, setConfigured] = useState<boolean | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetchConfig();
        if (alive) setConfigured(Boolean(r?.configured));
      } catch {
        if (alive) setConfigured(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [fetchConfig]);

  useEffect(() => {
    let alive = true;
    if (!company?.id || !configured) return;
    (async () => {
      try {
        const r = await fetchLast({ data: { companyId: company.id } });
        if (alive) setLastAttempt(r?.attempt ?? null);
      } catch {
        /* silencioso */
      }
    })();
    return () => {
      alive = false;
    };
  }, [company?.id, configured, fetchLast]);

  async function handlePay() {
    if (!company?.id || !plan?.id) {
      toast.error("Plano não definido.");
      return;
    }
    if (!accepted) {
      toast.error("É necessário aceitar os termos.");
      return;
    }
    setBusy(true);
    try {
      const r = await startCheckout({
        data: {
          companyId: company.id,
          planId: plan.id,
          termsAccepted: true,
          termsVersion: TERMS_VERSION,
          termsSnapshot: `Aceito termos de pagamento ${TERMS_VERSION} em ${new Date().toISOString()}`,
        },
      });
      if (!r?.ok) {
        toast.error(r?.message || "Não foi possível iniciar o pagamento.");
        return;
      }
      if (r.checkoutUrl) {
        toast.success("Redirecionando para o Mercado Pago…");
        window.open(r.checkoutUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      toast.error("Não foi possível iniciar o pagamento agora.");
    } finally {
      setBusy(false);
    }
  }

  const attemptLabel = lastAttempt?.status
    ? ATTEMPT_LABEL[lastAttempt.status]
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4" />
          Pagamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Plano atual</span>
            <span className="font-medium">{plan?.nome ?? "—"}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-muted-foreground">Valor</span>
            <span className="font-medium">
              {plan && plan.preco_mensal > 0
                ? `R$ ${plan.preco_mensal.toFixed(2).replace(".", ",")}`
                : "—"}
            </span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className="font-medium">{STATUS_LABEL[status] ?? status}</span>
          </div>
        </div>

        {configured === false && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Pagamento online ainda não está configurado.</p>
            </div>
          </div>
        )}

        {configured && (
          <>
            {attemptLabel && (
              <div className="rounded-lg border bg-background p-3 text-sm">
                <span className={`font-medium ${attemptLabel.tone}`}>
                  {attemptLabel.text}
                </span>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-lg border bg-background p-3">
              <Checkbox
                id="mp-terms"
                checked={accepted}
                onCheckedChange={(v) => setAccepted(Boolean(v))}
              />
              <Label htmlFor="mp-terms" className="text-xs leading-relaxed">
                Li e aceito os termos de pagamento e a política de cobrança via
                Mercado Pago.
              </Label>
            </div>

            <Button
              onClick={handlePay}
              disabled={busy || !accepted || !plan?.id}
              className="w-full"
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              Pagar agora
            </Button>

            <p className="text-xs text-muted-foreground">
              Você será direcionado para o ambiente seguro do Mercado Pago.
            </p>
          </>
        )}

        {configured === null && (
          <Button disabled className="w-full">
            <Lock className="mr-2 h-4 w-4" />
            Verificando…
          </Button>
        )}

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Formas de pagamento aceitas
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center gap-1 rounded-lg border bg-background p-3 text-center">
              <QrCode className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs">Pix</span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-lg border bg-background p-3 text-center">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs">Cartão</span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-lg border bg-background p-3 text-center opacity-50">
              <RefreshCw className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs">Recorrente (em breve)</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
