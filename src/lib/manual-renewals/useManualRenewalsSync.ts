import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getActiveCompanyId } from "@/lib/company-scope";
import {
  hydrateManualRenewalsFromDb,
  markManualRenewalsSyncError,
} from "@/lib/manual-renewals";
import {
  listManualRenewalsDb,
  type ManualRenewalDto,
} from "@/lib/manual-renewals/manual-renewals.functions";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function useManualRenewalsSync() {
  const listFn = useServerFn(listManualRenewalsDb);
  const lastCompanyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      const companyId = getActiveCompanyId();
      if (!companyId || !UUID_RE.test(companyId)) return;
      try {
        const rows = await listFn({ data: { companyId } });
        if (cancelled) return;
        hydrateManualRenewalsFromDb(companyId, rows as ManualRenewalDto[]);
      } catch (err) {
        if (cancelled) return;
        markManualRenewalsSyncError(
          err instanceof Error ? err.message : "Falha ao sincronizar renovações",
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
  }, [listFn]);
}
