// Utilitário compartilhado para hooks DB-first.
// - Hidrata no mount, foco, troca de empresa e a cada 5 min.
// - Realtime via useRealtimeTable.
// - Auto-upload silencioso quando há legado local antes da hidratação.
// - Escrita espelhada imediata (mirror) via eventos locais, fire-and-forget.
import { useCallback, useEffect, useRef } from "react";
import { getCurrentCompanyId } from "@/lib/companies";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";

const FIVE_MIN = 5 * 60 * 1000;
const MIRROR_DEBOUNCE_MS = 250;

export function useDbFirstSync(opts: {
  /** Nome da tabela para realtime (ex.: "auto_templates"). */
  table: string;
  /** Hidrata cache local a partir do banco. */
  hydrate: (companyId: string) => Promise<void>;
  /** Envia legado local silenciosamente. Chamado UMA vez por sessão+empresa. */
  uploadLegacy?: (companyId: string) => Promise<void>;
  /**
   * Espelha imediatamente cache local → banco quando algum dos eventos dispara.
   * Fire-and-forget; falha silenciosa preserva o cache local e o sync periódico
   * tenta novamente.
   */
  mirror?: (companyId: string) => Promise<void>;
  /** Eventos locais que disparam o mirror (ex.: ["trial-leads:changed"]). */
  mirrorEvents?: string[];
}) {
  const { table, hydrate, uploadLegacy, mirror, mirrorEvents } = opts;
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

  // mirror imediato (debounced) → reflete em outros dispositivos via realtime
  useEffect(() => {
    if (!mirror || !mirrorEvents || mirrorEvents.length === 0) return;
    let timer: number | null = null;
    let cancelled = false;
    let mirroring = false;
    const fire = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (cancelled || mirroring) return;
        const companyId = getCurrentCompanyId();
        if (!companyId) return;
        mirroring = true;
        Promise.resolve(mirror(companyId))
          .catch(() => { /* mantém cache local; sync periódico retenta */ })
          .finally(() => { mirroring = false; });
      }, MIRROR_DEBOUNCE_MS);
    };
    for (const ev of mirrorEvents) window.addEventListener(ev, fire);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      for (const ev of mirrorEvents) window.removeEventListener(ev, fire);
    };
  }, [mirror, mirrorEvents]);

  // realtime → re-hidrata
  const companyId = getCurrentCompanyId();
  useRealtimeTable({ table, companyId, onChange: () => { void run(); } });
}
