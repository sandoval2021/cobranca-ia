// Hook que sincroniza o catálogo local de servidores com o banco.
// Garante que todos os dispositivos do mesmo dono vejam a mesma lista.
import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getActiveCompanyId } from "@/lib/company-scope";
import {
  hydrateFromDb,
  markSyncError,
  type ServerEntry,
} from "@/lib/server-catalog";
import { listServersDb, type ServerRowDto } from "@/lib/servers/servers.functions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function dtoToEntry(r: ServerRowDto): ServerEntry {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    panel_url: r.panel_url ?? undefined,
    panel_username: r.panel_username ?? undefined,
    panel_password: r.panel_password ?? undefined,
    notes: r.notes ?? undefined,
    status: r.is_active ? "ativo" : "inativo",
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export function useServersSync() {
  const listFn = useServerFn(listServersDb);
  const lastCompanyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      const companyId = getActiveCompanyId();
      if (!companyId || !UUID_RE.test(companyId)) {
        // Sem empresa válida no banco: não tocar no cache local.
        return;
      }
      try {
        const rows = await listFn({ data: { companyId } });
        if (cancelled) return;
        hydrateFromDb(companyId, rows.map(dtoToEntry));
      } catch (err) {
        if (cancelled) return;
        markSyncError(err instanceof Error ? err.message : "Falha ao sincronizar servidores");
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
    // Re-sync periódico leve (PWA pode ficar aberto por horas).
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
