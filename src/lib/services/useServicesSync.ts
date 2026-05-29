// Hook que sincroniza o cache local de Planos do dono + vínculos cliente↔plano
// com o banco. Garante que os valores e mensagens de cobrança apareçam iguais
// em desktop, celular e PWA.
import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getActiveCompanyId } from "@/lib/company-scope";
import {
  hydrateServicesFromDb,
  markServicesSyncError,
  getServicesSyncState,
  uploadLocalServicesToDb,
} from "@/lib/services-catalog";
import {
  hydrateCustomerPlansFromDb,
} from "@/lib/customer-plans";
import {
  listServicePlansDb,
  listCustomerPlanLinksDb,
  type ServicePlanDto,
  type CustomerPlanLinkDto,
} from "@/lib/services/services.functions";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function useServicesSync() {
  const listPlans = useServerFn(listServicePlansDb);
  const listLinks = useServerFn(listCustomerPlanLinksDb);
  const lastCompanyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      const companyId = getActiveCompanyId();
      if (!companyId || !UUID_RE.test(companyId)) return;
      try {
        const [plans, links] = await Promise.all([
          listPlans({ data: { companyId } }),
          listLinks({ data: { companyId } }),
        ]);
        if (cancelled) return;
        hydrateServicesFromDb(companyId, plans as ServicePlanDto[]);
        hydrateCustomerPlansFromDb(companyId, links as CustomerPlanLinkDto[]);

        // Auto-upload: se o banco está vazio mas existem planos locais
        // pendentes desta empresa, envia para a nuvem automaticamente
        // (evita que planos "sumam" entre dispositivos / após limpar cache).
        const state = getServicesSyncState();
        if (state.pendingLocal > 0) {
          try {
            await uploadLocalServicesToDb();
            // Re-sincroniza para confirmar
            const refreshed = await listPlans({ data: { companyId } });
            if (!cancelled) hydrateServicesFromDb(companyId, refreshed as ServicePlanDto[]);
          } catch (err) {
            if (!cancelled) {
              markServicesSyncError(
                err instanceof Error ? err.message : "Falha ao enviar planos para a nuvem",
              );
            }
          }
        }
      } catch (err) {
        if (cancelled) return;
        markServicesSyncError(
          err instanceof Error ? err.message : "Falha ao sincronizar planos",
        );
      }
    }

    void sync();
    lastCompanyRef.current = getActiveCompanyId();

    const onFocus = () => void sync();
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    const onCompanyChange = () => {
      const next = getActiveCompanyId();
      if (next !== lastCompanyRef.current) {
        lastCompanyRef.current = next;
        void sync();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("cobranca_ia_companies:changed", onCompanyChange);
    const interval = window.setInterval(() => void sync(), 5 * 60 * 1000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("cobranca_ia_companies:changed", onCompanyChange);
      window.clearInterval(interval);
    };
  }, [listPlans, listLinks]);
}
