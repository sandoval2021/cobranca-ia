import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AiQuotaCard } from "@/components/billing-saas/AiQuotaCard";
import { getActiveCompanyId } from "@/lib/company-scope";
import {
  listSaasPlans,
  listSaasExtraPacks,
  type SaasPlan,
  type SaasExtraPack,
} from "@/lib/billing-saas/billing-saas.functions";

export const Route = createFileRoute("/minha-assinatura")({ component: MinhaAssinatura });

function brl(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
function fmtN(n: number) {
  return new Intl.NumberFormat("pt-BR").format(n);
}

function MinhaAssinatura() {
  const companyId = getActiveCompanyId();
  const fetchPlans = useServerFn(listSaasPlans);
  const fetchPacks = useServerFn(listSaasExtraPacks);
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [packs, setPacks] = useState<SaasExtraPack[]>([]);

  useEffect(() => {
    fetchPlans({}).then((d) => setPlans(d ?? [])).catch(() => setPlans([]));
    fetchPacks({}).then((d) => setPacks(d ?? [])).catch(() => setPacks([]));
  }, [fetchPlans, fetchPacks]);

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
            <CardContent className="space-y-2">
              <div className="text-2xl font-semibold">{brl(p.price_cents)}<span className="text-xs font-normal text-muted-foreground">/mês</span></div>
              <div className="text-sm text-muted-foreground">{fmtN(p.ai_monthly_limit)} respostas IA/mês</div>
              {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
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
        Saldo do plano não acumula entre meses. Pacotes extras somam ao ciclo atual.
      </p>
    </PageContainer>
  );
}
