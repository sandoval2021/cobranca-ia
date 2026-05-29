import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AiQuotaCard } from "@/components/billing-saas/AiQuotaCard";
import { getActiveCompanyId } from "@/lib/company-scope";
import {
  listSaasPlans,
  listSaasExtraPacks,
  createSaasCheckout,
  type SaasPlan,
  type SaasExtraPack,
} from "@/lib/billing-saas/billing-saas.functions";

export const Route = createFileRoute("/minha-assinatura")({
  component: MinhaAssinatura,
  validateSearch: (s: Record<string, unknown>) => ({
    saas: typeof s.saas === "string" ? s.saas : undefined,
  }),
});

function brl(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
function fmtN(n: number) {
  return new Intl.NumberFormat("pt-BR").format(n);
}

function MinhaAssinatura() {
  const companyId = getActiveCompanyId();
  const search = Route.useSearch();
  const fetchPlans = useServerFn(listSaasPlans);
  const fetchPacks = useServerFn(listSaasExtraPacks);
  const checkout = useServerFn(createSaasCheckout);
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [packs, setPacks] = useState<SaasExtraPack[]>([]);
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans({}).then((d) => setPlans(d ?? [])).catch(() => setPlans([]));
    fetchPacks({}).then((d) => setPacks(d ?? [])).catch(() => setPacks([]));
  }, [fetchPlans, fetchPacks]);

  useEffect(() => {
    if (search.saas === "success") {
      toast.success("Pagamento confirmado! Seu plano será ativado em instantes.");
    } else if (search.saas === "pending") {
      toast.message("Pagamento pendente. Assim que confirmado, seu plano será ativado.");
    } else if (search.saas === "failure") {
      toast.error("Pagamento não aprovado. Tente novamente.");
    }
  }, [search.saas]);

  async function handleSubscribe(plan: SaasPlan) {
    if (!companyId) return;
    setLoadingPlanId(plan.id);
    try {
      const r = await checkout({ data: { companyId, planId: plan.id } });
      const url = (r as { init_point?: string }).init_point;
      if (!url) throw new Error("checkout_url_missing");
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao iniciar pagamento.");
      setLoadingPlanId(null);
    }
  }

  return (
    <PageContainer>
      <SectionHeader title="Minha assinatura" subtitle="Plano CobraEasy, consumo de IA e pacotes extras." />

      {companyId ? (
        <div className="mb-4">
          <AiQuotaCard companyId={companyId} />
        </div>
      ) : (
        <Card className="mb-4"><CardContent className="p-4 text-sm text-muted-foreground">Sem empresa ativa.</CardContent></Card>
      )}

      <h3 className="mb-2 mt-6 text-sm font-semibold">Planos disponíveis</h3>
      <div className="grid gap-3 md:grid-cols-3">
        {plans.filter(p => p.is_active).map((p) => (
          <Card key={p.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{p.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-2xl font-semibold">{brl(p.price_cents)}<span className="text-xs font-normal text-muted-foreground">/mês</span></div>
              <div className="text-sm text-muted-foreground">{fmtN(p.ai_monthly_limit)} respostas IA/mês</div>
              {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
              <Button
                className="w-full"
                disabled={!companyId || loadingPlanId === p.id || p.price_cents <= 0}
                onClick={() => handleSubscribe(p)}
              >
                {loadingPlanId === p.id ? "Abrindo pagamento…" : "Assinar este plano"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <h3 className="mb-2 mt-6 text-sm font-semibold">Pacotes extras</h3>
      <div className="grid gap-3 md:grid-cols-3">
        {packs.filter(p => p.is_active).map((p) => (
          <Card key={p.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{p.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-xl font-semibold">{brl(p.price_cents)}</div>
              <div className="text-xs text-muted-foreground">+{fmtN(p.ai_extra_responses)} respostas no ciclo atual</div>
              <Badge variant="secondary" className="mt-1">Em breve</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Pagamento processado pelo Mercado Pago. Saldo do plano não acumula entre meses.
      </p>
    </PageContainer>
  );
}
