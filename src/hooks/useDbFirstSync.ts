// Utilitário compartilhado para hooks DB-first.
// - Hidrata no mount, foco, troca de empresa e a cada 5 min.
// - Realtime via useRealtimeTable.
// - Auto-upload silencioso quando há legado local antes da hidratação.
// - Escrita espelhada imediata (mirror) via eventos locais, fire-and-forget.
// Guardas: anti-loop com Realtime, anti-mistura entre empresas, debounce com
// captura do último estado, retry pelo ciclo periódico de 5 min.
import { useCallback, useEffect, useRef } from "react";
import { getCurrentCompanyId } from "@/lib/companies";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";

const FIVE_MIN = 5 * 60 * 1000;
const MIRROR_DEBOUNCE_MS = 250;
// Janela curta após hidratação onde eventos locais são ignorados para o mirror,
// já que writeArr() dispara CustomEvent inclusive quando o cache é populado a
// partir do banco. Sem isso, hydrate → evento → mirror → DB → realtime → loop.
const POST_HYDRATE_SUPPRESS_MS = 600;

function isUuid(s: string | null | undefined): s is string {
  return !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

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
   * tenta novamente. NUNCA é chamado durante/logo após hidratação para evitar
   * loop com Realtime, nem antes da primeira hidratação da empresa atual.
   */
  mirror?: (companyId: string) => Promise<void>;
  /** Eventos locais que disparam o mirror (ex.: ["trial-leads:changed"]). */
  mirrorEvents?: string[];
}) {
  const { table, hydrate, uploadLegacy, mirror, mirrorEvents } = opts;
  // empresa cuja hidratação já completou (gate para mirror)
  const hydratedCompanyRef = useRef<string | null>(null);
  const uploadedRef = useRef<Set<string>>(new Set());
  // anti-loop: evita que eventos disparados pelo próprio writeArr() durante
  // a hidratação acionem mirror imediato
  const hydratingRef = useRef(false);
  const suppressUntilRef = useRef(0);

  const run = useCallback(async () => {
    const companyId = getCurrentCompanyId();
    if (!isUuid(companyId)) return;
    hydratingRef.current = true;
    try {
      // legado primeiro (para não sobrescrever uploads pendentes)
      if (uploadLegacy && !uploadedRef.current.has(companyId)) {
        uploadedRef.current.add(companyId);
        try {
          await uploadLegacy(companyId);
        } catch (err) {
          if (import.meta.env.DEV) console.warn(`[db-first:${table}] uploadLegacy falhou`, err);
        }
      }
      try {
        await hydrate(companyId);
      } catch (err) {
        if (import.meta.env.DEV) console.warn(`[db-first:${table}] hydrate falhou`, err);
        // mantém cache local intocado — sync periódico retenta
      }
      hydratedCompanyRef.current = companyId;
    } finally {
      hydratingRef.current = false;
      suppressUntilRef.current = Date.now() + POST_HYDRATE_SUPPRESS_MS;
    }
  }, [table, hydrate, uploadLegacy]);

  // mount + intervalo + foco + troca de empresa + volta de offline
  useEffect(() => {
    let cancelled = false;
    void run();
    const onFocus = () => { if (!cancelled) void run(); };
    const onOnline = () => { if (!cancelled) void run(); };
    const onCompany = () => {
      const next = getCurrentCompanyId();
      if (next !== hydratedCompanyRef.current && !cancelled) {
        // troca de empresa: invalida o gate antes do próximo run para
        // bloquear qualquer mirror enquanto a nova hidratação não completa
        hydratedCompanyRef.current = null;
        void run();
      }
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener("cobranca_ia_companies:changed", onCompany);
    const id = window.setInterval(() => { if (!cancelled) void run(); }, FIVE_MIN);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("cobranca_ia_companies:changed", onCompany);
      window.clearInterval(id);
    };
  }, [run]);

  // mirror imediato (debounced) → reflete em outros dispositivos via realtime.
  // Gate em quatro camadas:
  //  1. companyId atual precisa ser UUID válido
  //  2. precisa bater com a empresa cuja hidratação já completou
  //  3. não pode estar hidratando
  //  4. não pode estar dentro da janela pós-hidratação
  // O debounce de 250ms agrupa eventos rápidos em um único upload com o
  // ÚLTIMO estado do cache (uploadAll lê localStorage no momento da chamada).
  useEffect(() => {
    if (!mirror || !mirrorEvents || mirrorEvents.length === 0) return;
    let timer: number | null = null;
    let cancelled = false;
    let mirroring = false;
    const fire = () => {
      if (hydratingRef.current) return;
      if (Date.now() < suppressUntilRef.current) return;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        if (cancelled || mirroring) return;
        const companyId = getCurrentCompanyId();
        if (!isUuid(companyId)) return;
        if (companyId !== hydratedCompanyRef.current) return; // multi-tenant guard
        if (hydratingRef.current) return;
        if (Date.now() < suppressUntilRef.current) return;
        mirroring = true;
        Promise.resolve(mirror(companyId))
          .catch((err) => {
            if (import.meta.env.DEV) console.warn(`[db-first:${table}] mirror falhou`, err);
            // cache local preservado; sync periódico (5 min) ou próximo focus retentam
          })
          .finally(() => { mirroring = false; });
      }, MIRROR_DEBOUNCE_MS);
    };
    for (const ev of mirrorEvents) window.addEventListener(ev, fire);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      for (const ev of mirrorEvents) window.removeEventListener(ev, fire);
    };
  }, [table, mirror, mirrorEvents]);

  // realtime → re-hidrata. hydratingRef + suppressUntilRef impedem que o
  // writeArr() chamado por dentro do hydrate dispare mirror de volta.
  const currentCompany = getCurrentCompanyId();
  useRealtimeTable({
    table,
    companyId: isUuid(currentCompany) ? currentCompany : null,
    onChange: () => { void run(); },
  });
}
