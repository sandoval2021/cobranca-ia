import { useEffect, useState } from "react";
import { useRouterState, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import { getActiveCompanyId } from "@/lib/company-scope";
import { getAiQuotaStatus } from "@/lib/billing-saas/billing-saas.functions";
import { useLocalAuth } from "@/lib/use-local-auth";

const ALLOWED_WHEN_BLOCKED = new Set<string>([
  "/minha-assinatura",
  "/meus-dados",
  "/login",
  "/auth",
  "/reset-password",
  "/acesso-restrito",
]);

function isAllowedPath(path: string): boolean {
  if (ALLOWED_WHEN_BLOCKED.has(path)) return true;
  if (path.startsWith("/pagar/")) return true;
  if (path.startsWith("/api/")) return true;
  return false;
}

/**
 * Bloqueia qualquer rota fora da lista permitida quando o trial acabou ou o plano
 * está em past_due/canceled. Super admin nunca é bloqueado.
 */
export function TrialGuard({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { isSuperAdmin } = useLocalAuth();
  const companyId = getActiveCompanyId();
  const fetchQuota = useServerFn(getAiQuotaStatus);
  const [blocked, setBlocked] = useState<null | { reason: string }>(null);

  useEffect(() => {
    if (isSuperAdmin || !companyId) {
      setBlocked(null);
      return;
    }
    let cancelled = false;
    fetchQuota({ data: { companyId } })
      .then((q) => {
        if (cancelled) return;
        const sub = q?.subscription;
        if (!sub) {
          setBlocked(null);
          return;
        }
        const expired = (sub.days_left ?? 0) <= 0;
        const status = sub.status;
        if (status === "canceled" || status === "past_due") {
          setBlocked({ reason: "Sua assinatura está suspensa. Escolha um plano para continuar." });
        } else if (status === "trial" && expired) {
          setBlocked({ reason: "Seu período de teste acabou. Escolha um plano para continuar." });
        } else {
          setBlocked(null);
        }
      })
      .catch(() => setBlocked(null));
    return () => {
      cancelled = true;
    };
  }, [companyId, isSuperAdmin, pathname, fetchQuota]);

  useEffect(() => {
    if (blocked && !isAllowedPath(pathname)) {
      navigate({ to: "/minha-assinatura" });
    }
  }, [blocked, pathname, navigate]);

  return (
    <>
      {blocked && (
        <div className="sticky top-0 z-50 flex items-center gap-2 border-b border-amber-500/40 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{blocked.reason}</span>
        </div>
      )}
      {children}
    </>
  );
}
