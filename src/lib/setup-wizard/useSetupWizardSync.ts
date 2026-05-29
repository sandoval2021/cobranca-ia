// Hidrata company_setup_progress do banco no boot/troca de empresa.
import { useEffect } from "react";
import { useActiveCompanyId } from "@/lib/company-scope";
import { getSetupProgressDb } from "@/lib/setup-wizard/setup-wizard.functions";
import { hydrateSetupProgressFromDb, getLocalSetupWizardData } from "@/lib/setup-wizard";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useSetupWizardSync() {
  const companyId = useActiveCompanyId();
  useEffect(() => {
    if (!companyId || !UUID_RE.test(companyId)) return;
    let cancelled = false;
    (async () => {
      try {
        const row = await getSetupProgressDb({ data: { companyId } });
        if (cancelled) return;
        if (row && row.steps && Object.keys(row.steps).length > 0) {
          hydrateSetupProgressFromDb(companyId, row.steps);
        } else {
          // Banco vazio: promove local atual (se houver) sem apagar nada.
          const local = getLocalSetupWizardData();
          if (local.steps && Object.keys(local.steps).length > 0) {
            const { upsertSetupProgressDb } = await import(
              "@/lib/setup-wizard/setup-wizard.functions"
            );
            await upsertSetupProgressDb({
              data: { companyId, steps: local.steps as Record<string, any> },
            }).catch(() => { /* ignore */ });
          }
        }
      } catch {
        /* hook periódico/manual retenta */
      }
    })();
    return () => { cancelled = true; };
  }, [companyId]);
}
