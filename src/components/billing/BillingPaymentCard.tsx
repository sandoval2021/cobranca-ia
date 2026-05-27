import { CreditCard, QrCode, RefreshCw, Lock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Company } from "@/lib/companies";
import { getCompanyStatus, getPlanById } from "@/lib/companies";

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

export function BillingPaymentCard({ company }: Props) {
  const status = company ? getCompanyStatus(company) : "ativa";
  const plan = company?.plano_id ? getPlanById(company.plano_id) : null;

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
            <span className="text-muted-foreground">Status</span>
            <span className="font-medium">{STATUS_LABEL[status] ?? status}</span>
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Pagamento online ainda não está ativo. Em breve você poderá pagar
              direto pelo app.
            </p>
          </div>
        </div>

        <Button disabled className="w-full">
          <Lock className="mr-2 h-4 w-4" />
          Pagar agora (em preparação)
        </Button>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Formas de pagamento previstas
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
            <div className="flex flex-col items-center gap-1 rounded-lg border bg-background p-3 text-center">
              <RefreshCw className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs">Cartão recorrente</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Comprovante de pagamento será gerado aqui assim que o pagamento online
          for ativado.
        </p>
      </CardContent>
    </Card>
  );
}
