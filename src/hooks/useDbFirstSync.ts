// Utilitário compartilhado para hooks DB-first.
// - Hidrata no mount, foco, troca de empresa e a cada 5 min.
// - Realtime via useRealtimeTable.
// - Auto-upload silencioso quando há legado local antes da hidratação.
import { useCallback, useEffect, useRef } from "react";
import { getCurrentCompanyId } from "@/lib/companies";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";

const FIVE_MIN = 5 * 60 * 1000;

export function useDbFirstSync(opts: {
  /** Nome da tabela para realtime (ex.: "auto_templates"). */
  table: string;
  /** Hidrata cache local a partir do banco. */
  hydrate: (companyId: string) => Promise<void>;
  /** Envia legado local silenciosamente. Chamado UMA vez por sessão+empresa. */
  uploadLegacy?: (companyId: string) => Promise<void>;
}) {
  const { table, hydrate, uploadLegacy } = opts;
  const lastCompanyRef = useRef<string | null>(null);
  const uploadedRef = useRef<Set<string>>(new Set());

  const run = useCallback(async () => {
    const companyId = getCurrentCompanyId();
    if (!companyId) return;
    // legado primeiro (para não sobrescrever uploads pendentes)
    if (uploadLegacy && !uploadedRef.current.has(companyId)) {
      uploadedRef.current.add(companyId);
      try { await uploadLegacy(companyId); } catch { /* silencioso */ }
    }
    try { await hydrate(companyId); } catch { /* mantém cache local */ }
    lastCompanyRef.current = companyId;
  }, [hydrate, uploadLegacy]);

  // mount + intervalo + foco + troca de empresa
  useEffect(() => {
    let cancelled = false;
    void run();
    const onFocus = () => { if (!cancelled) void run(); };
    const onCompany = () => {
      const next = getCurrentCompanyId();
      if (next !== lastCompanyRef.current && !cancelled) void run();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("cobranca_ia_companies:changed", onCompany);
    const id = window.setInterval(() => { if (!cancelled) void run(); }, FIVE_MIN);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("cobranca_ia_companies:changed", onCompany);
      window.clearInterval(id);
    };
  }, [run]);

  // realtime → re-hidrata
  const companyId = getCurrentCompanyId();
  useRealtimeTable({ table, companyId, onChange: () => { void run(); } });
}
