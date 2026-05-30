import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, AlertTriangle, ShieldAlert, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { getAiQuotaStatus, type AiQuotaStatus } from "@/lib/billing-saas/billing-saas.functions";

function fmtNumber(n: number) {
  return new Intl.NumberFormat("pt-BR").format(n);
}

export function AiQuotaCard({ companyId, compact = false }: { companyId: string; compact?: boolean }) {
  const fetchStatus = useServerFn(getAiQuotaStatus);
  const [data, setData] = useState<AiQuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    fetchStatus({ data: { companyId } })
      .then((r) => !cancel && setData(r))
      .catch(() => !cancel && setData(null))
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, [companyId, fetchStatus]);

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-4 text-sm text-muted-foreground">Carregando uso da IA…</CardContent>
      </Card>
    );
  }
  if (!data) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Não foi possível carregar o uso da IA.
        </CardContent>
      </Card>
    );
  }

  const { plan, subscription, cycle, thresholds } = data;
  const tone = thresholds.blocked
    ? "border-rose-300 bg-rose-50 dark:bg-rose-950/30"
    : thresholds.warn90
      ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30"
      : thresholds.warn70
        ? "border-amber-200 bg-amber-50/40 dark:bg-amber-950/10"
        : "";

  return (
    <Card className={tone}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            IA do mês{plan ? ` · ${plan.name}` : ""}
          </CardTitle>
          {subscription?.status && (
            <Badge variant={subscription.status === "paused_limit" ? "destructive" : "secondary"}>
              {subscription.status === "trial" ? "Teste" :
               subscription.status === "active" ? "Ativa" :
               subscription.status === "paused_limit" ? "Pausada (limite)" :
               subscription.status}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm">
          Você usou <strong>{fmtNumber(cycle.used_count)}</strong> de{" "}
          <strong>{fmtNumber(cycle.total)}</strong> respostas IA
          {cycle.total > 0 ? <> ({cycle.percent}%)</> : null}.
        </div>
        <Progress value={cycle.percent} className="h-2" />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {subscription
              ? <>Ciclo termina em <strong>{subscription.days_left}</strong> dia(s)</>
              : "Sem assinatura ativa"}
          </span>
          {cycle.extra_limit > 0 && (
            <span>+{fmtNumber(cycle.extra_limit)} via pacotes extras</span>
          )}
        </div>

        {thresholds.blocked && (
          <div className="flex items-start gap-2 rounded-md bg-rose-100 p-2 text-xs text-rose-900 dark:bg-rose-950/50 dark:text-rose-100">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              Limite atingido. A IA está pausada até o próximo ciclo ou compra de pacote extra.
            </div>
          </div>
        )}
        {!thresholds.blocked && thresholds.warn90 && (
          <div className="flex items-start gap-2 rounded-md bg-amber-100 p-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>Restam menos de 10%. Considere comprar um pacote extra.</div>
          </div>
        )}

        {!compact && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Link to="/minha-assinatura" search={{ saas: undefined }}>
              <Button size="sm" variant="outline">Ver assinatura</Button>
            </Link>
            <Link to="/minha-assinatura" search={{ saas: undefined }}>
              <Button size="sm" variant="secondary">
                <Plus className="mr-1 h-3.5 w-3.5" /> Pacote extra
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
