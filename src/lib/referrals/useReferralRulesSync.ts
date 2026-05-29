// Sync hook: regras de indicação (referral_rules).
// Hidrata DB-first; se banco vazio e existe regra local não-default, sobe.
import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getActiveCompanyId } from "@/lib/company-scope";
import {
  hydrateReferralRulesFromDb,
  getLocalReferralRules,
  markReferralRulesUploaded,
  hasLocalReferralRulesPending,
} from "@/lib/referrals";
import {
  getReferralRulesDb,
  upsertReferralRulesDb,
} from "@/lib/referrals/referral-rules.functions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function useReferralRulesSync() {
  const getFn = useServerFn(getReferralRulesDb);
  const upsertFn = useServerFn(upsertReferralRulesDb);
  const lastRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function sync() {
      const companyId = getActiveCompanyId();
      if (!companyId || !UUID_RE.test(companyId)) return;
      try {
        const row = await getFn({ data: { companyId } });
        if (cancelled) return;
        if (row) {
          hydrateReferralRulesFromDb(companyId, {
            meta: Number(row.meta),
            tipo: String(row.tipo),
            descricao: String(row.descricao ?? ""),
          });
        } else if (hasLocalReferralRulesPending(companyId)) {
          // Banco vazio + regra local não-default → sobe.
          const local = getLocalReferralRules();
          await upsertFn({
            data: {
              companyId,
              meta: Math.max(1, Number(local.meta) || 2),
              tipo: String(local.tipo || "1mes"),
              descricao: String(local.descricao || ""),
            },
          });
          markReferralRulesUploaded(companyId);
        }
      } catch {
        // mantém cache; próximo ciclo retenta
      }
    }
    void sync();
    lastRef.current = getActiveCompanyId();
    const onFocus = () => void sync();
    const onCompany = () => {
      const next = getActiveCompanyId();
      if (next !== lastRef.current) { lastRef.current = next; void sync(); }
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("cobranca_ia_companies:changed", onCompany);
    const interval = window.setInterval(() => void sync(), 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("cobranca_ia_companies:changed", onCompany);
      window.clearInterval(interval);
    };
  }, [getFn, upsertFn]);
}
