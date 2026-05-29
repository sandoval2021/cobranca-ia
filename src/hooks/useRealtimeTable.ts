// Wrapper único para Supabase Realtime escopado por empresa.
// Cria (ou reutiliza) um channel por (table, companyId) e dispara onChange
// para INSERT/UPDATE/DELETE. Multi-instância segura via refcount.

import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type Entry = {
  channel: RealtimeChannel;
  listeners: Set<() => void>;
};

const channels = new Map<string, Entry>();

function keyOf(table: string, companyId: string) {
  return `${table}::${companyId}`;
}

function ensureChannel(table: string, companyId: string): Entry {
  const key = keyOf(table, companyId);
  const existing = channels.get(key);
  if (existing) return existing;
  const channel = supabase
    .channel(`rt:${key}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        filter: `company_id=eq.${companyId}`,
      },
      () => {
        const e = channels.get(key);
        if (!e) return;
        for (const l of e.listeners) {
          try {
            l();
          } catch {
            /* noop */
          }
        }
      },
    )
    .subscribe();
  const entry: Entry = { channel, listeners: new Set() };
  channels.set(key, entry);
  return entry;
}

export function useRealtimeTable(params: {
  table: string;
  companyId: string | null | undefined;
  onChange: () => void;
}) {
  const { table, companyId, onChange } = params;
  useEffect(() => {
    if (!companyId) return;
    const entry = ensureChannel(table, companyId);
    entry.listeners.add(onChange);
    return () => {
      entry.listeners.delete(onChange);
      if (entry.listeners.size === 0) {
        try {
          supabase.removeChannel(entry.channel);
        } catch {
          /* noop */
        }
        channels.delete(keyOf(table, companyId));
      }
    };
  }, [table, companyId, onChange]);
}
