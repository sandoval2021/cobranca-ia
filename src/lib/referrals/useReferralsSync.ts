// Sync hook: indicações (customer_referrals).
import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getActiveCompanyId } from "@/lib/company-scope";
import { hydrateReferralsFromDb, markReferralsSyncError } from "@/lib/referrals";
import { listReferralsDb, type ReferralDto } from "@/lib/referrals/referrals.functions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function useReferralsSync() {
  const listFn = useServerFn(listReferralsDb);
  const lastRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function sync() {
      const companyId = getActiveCompanyId();
      if (!companyId || !UUID_RE.test(companyId)) return;
      try {
        const rows = await listFn({ data: { companyId } });
        if (cancelled) return;
        hydrateReferralsFromDb(companyId, rows as ReferralDto[]);
      } catch (err) {
        if (cancelled) return;
        markReferralsSyncError(err instanceof Error ? err.message : "Falha ao sincronizar indicações");
      }
    }
    void sync();
    lastRef.current = getActiveCompanyId();
    const onFocus = () => void sync();
    const onVis = () => { if (document.visibilityState === "visible") void sync(); };
    const onCompany = () => {
      const next = getActiveCompanyId();
      if (next !== lastRef.current) { lastRef.current = next; void sync(); }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("cobranca_ia_companies:changed", onCompany);
    const interval = window.setInterval(() => void sync(), 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("cobranca_ia_companies:changed", onCompany);
      window.clearInterval(interval);
    };
  }, [listFn]);
}
