import { Link } from "@tanstack/react-router";
import { ShieldAlert, Lock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { checkPlanLimit, type LimitKind, type LimitAction } from "@/lib/plan-limits";
import { getRevendaSettings } from "@/lib/revenda-settings";

export function PlanLimitNotice({
  moduleKey,
  action = "criar",
  compact = false,
  className,
}: {
  moduleKey: LimitKind;
  action?: LimitAction;
  compact?: boolean;
  className?: string;
}) {
  const d = checkPlanLimit(moduleKey, action);
  const support = getRevendaSettings().dados.whatsapp_suporte?.replace(/\D/g, "");
  const supportHref = support ? `https://wa.me/${support}` : null;

  // Aviso "perto do limite" quando ainda permitido
  if (d.allowed) {
    if (
      Number.isFinite(d.limit ?? Infinity) &&
      d.used != null &&
      d.limit != null &&
      d.limit - d.used <= 3 &&
      d.limit > 0
    ) {
      return (
        <Card className={cn("mb-3 border-amber-300/60 bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100", className)}>
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Próximo do limite do plano <strong>{d.plan?.nome ?? "atual"}</strong>: {d.used}/{d.limit}.
            </span>
          </div>
        </Card>
      );
    }
    return null;
  }

  const isBlock = d.reason === "limit_reached" || d.reason === "module_locked";
  const Icon = isBlock ? Lock : ShieldAlert;
  const toneCls = isBlock
    ? "border-rose-300/60 bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
    : "border-amber-300/60 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100";

  return (
    <Card className={cn("mb-3 p-3 text-sm", toneCls, className)}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-tight">{d.message ?? "Ação bloqueada."}</p>
          {!compact && d.plan && (
            <p className="mt-0.5 text-xs opacity-80">
              Plano atual: <strong>{d.plan.nome}</strong>
              {d.status ? <> · Status: <strong>{d.status}</strong></> : null}
              {d.used != null && d.limit != null ? <> · Uso: {d.used}/{d.limit}</> : null}
            </p>
          )}
          {!compact && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Link to="/configuracoes-revenda">
                <Button size="sm" variant="outline" className="h-7 text-xs">Ver plano</Button>
              </Link>
              {supportHref && (
                <a href={supportHref} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline" className="h-7 text-xs">Falar com suporte</Button>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
