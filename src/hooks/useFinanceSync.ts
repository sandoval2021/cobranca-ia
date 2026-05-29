// Sync DB-first para finance_entries + finance_goals.
// Forma local (FinanceEntry/FinanceGoal) é preservada no campo `extra` jsonb.
import { useCallback } from "react";
import { useDbFirstSync } from "@/hooks/useDbFirstSync";
import {
  listFinanceEntriesDb,
  bulkUpsertFinanceEntriesDb,
  listFinanceGoalsDb,
  bulkUpsertFinanceGoalsDb,
} from "@/lib/financeiro/financeiro.functions";
import type { FinanceEntry, FinanceGoal } from "@/lib/financeiro-local";
import { FINANCE_EVENT } from "@/lib/financeiro-local";

const ENTRIES_KEY = "cobranca_ia_finance_entries_v1";
const GOALS_KEY = "cobranca_ia_finance_goals_v1";
const UPLOADED_FLAG = "cobraeasy.finance.synced";

function isBrowser() { return typeof window !== "undefined"; }
function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "00000000-0000-4000-8000-" + Math.random().toString(16).slice(2, 14).padEnd(12, "0");
}
function readArr<T>(key: string): T[] {
  if (!isBrowser()) return [];
  try { const r = localStorage.getItem(key); const p = r ? JSON.parse(r) : []; return Array.isArray(p) ? p : []; }
  catch { return []; }
}
function writeArr<T>(key: string, items: T[]) {
  if (!isBrowser()) return;
  localStorage.setItem(key, JSON.stringify(items));
  try { window.dispatchEvent(new CustomEvent(FINANCE_EVENT)); } catch { /* noop */ }
}

function entryDtoToLocal(d: {
  id: string; tipo: string; descricao: string | null; valor_cents: number;
  data: string; metodo_pagamento: string | null; observacoes: string | null;
  cliente_id: string | null; extraJson: string; updated_at: string;
}): FinanceEntry {
  let extra: Partial<FinanceEntry> = {};
  try { extra = JSON.parse(d.extraJson) as Partial<FinanceEntry>; } catch { /* noop */ }
  return {
    id: d.id,
    date: d.data,
    customer_name: extra.customer_name,
    customer_whatsapp: extra.customer_whatsapp,
    screen_label: extra.screen_label,
    app_label: extra.app_label,
    server_ids: extra.server_ids,
    amount_received: typeof extra.amount_received === "number" ? extra.amount_received : d.valor_cents / 100,
    method: (extra.method as FinanceEntry["method"]) ?? (d.metodo_pagamento as FinanceEntry["method"]) ?? "outro",
    type: (extra.type as FinanceEntry["type"]) ?? (d.tipo as FinanceEntry["type"]) ?? "outro",
    cost_screen: extra.cost_screen ?? 0,
    cost_server: extra.cost_server ?? 0,
    cost_app: extra.cost_app ?? 0,
    cost_fixed: extra.cost_fixed ?? 0,
    reserve: extra.reserve ?? 0,
    net_profit: extra.net_profit ?? 0,
    goal_id: extra.goal_id,
    note: extra.note ?? d.descricao ?? undefined,
    created_at: extra.created_at ?? d.updated_at,
    updated_at: extra.updated_at ?? d.updated_at,
  };
}

function entryLocalToDb(e: FinanceEntry) {
  return {
    id: isUuid(e.id) ? e.id : undefined,
    tipo: e.type,
    categoria: null,
    descricao: e.note ?? null,
    valor_cents: Math.round((e.amount_received ?? 0) * 100),
    data: e.date,
    metodo_pagamento: e.method ?? null,
    cliente_id: null,
    servico_id: null,
    observacoes: null,
    extraJson: JSON.stringify(e),
  };
}

function goalDtoToLocal(d: {
  id: string; mes: string; valor_cents: number; observacoes: string | null;
  extraJson: string; updated_at: string;
}): FinanceGoal {
  let extra: Partial<FinanceGoal> = {};
  try { extra = JSON.parse(d.extraJson) as Partial<FinanceGoal>; } catch { /* noop */ }
  return {
    id: d.id,
    name: extra.name ?? d.mes,
    target: extra.target ?? d.valor_cents / 100,
    reserved: extra.reserved ?? 0,
    deadline: extra.deadline,
    status: (extra.status as FinanceGoal["status"]) ?? "ativo",
    description: extra.description ?? d.observacoes ?? undefined,
    created_at: extra.created_at ?? d.updated_at,
    updated_at: extra.updated_at ?? d.updated_at,
  };
}

function goalLocalToDb(g: FinanceGoal) {
  return {
    id: isUuid(g.id) ? g.id : undefined,
    mes: g.deadline ?? g.name,
    categoria: null,
    valor_cents: Math.round((g.target ?? 0) * 100),
    observacoes: g.description ?? null,
    extraJson: JSON.stringify(g),
  };
}

export function useFinanceSync() {
  const hydrate = useCallback(async (companyId: string) => {
    try {
      const rows = await listFinanceEntriesDb({ data: { companyId } });
      if (rows && rows.length > 0) {
        const local = readArr<FinanceEntry>(ENTRIES_KEY);
        const fromDb = rows.map(entryDtoToLocal);
        const seen = new Set(fromDb.map((e) => e.id));
        // preserva entradas locais com id não-UUID que ainda não subiram
        const pending = local.filter((e) => !isUuid(e.id) && !seen.has(e.id));
        writeArr(ENTRIES_KEY, [...fromDb, ...pending]);
      }
    } catch { /* noop */ }
    try {
      const goals = await listFinanceGoalsDb({ data: { companyId } });
      if (goals && goals.length > 0) {
        const local = readArr<FinanceGoal>(GOALS_KEY);
        const fromDb = goals.map(goalDtoToLocal);
        const seen = new Set(fromDb.map((g) => g.id));
        const pending = local.filter((g) => !isUuid(g.id) && !seen.has(g.id));
        writeArr(GOALS_KEY, [...fromDb, ...pending]);
      }
    } catch { /* noop */ }
  }, []);

  const uploadAll = useCallback(async (companyId: string) => {
    if (!isBrowser()) return;
    const entries = readArr<FinanceEntry>(ENTRIES_KEY);
    const goals = readArr<FinanceGoal>(GOALS_KEY);
    let mutated = false;
    const remappedE = entries.map((e) => {
      if (isUuid(e.id)) return e;
      mutated = true;
      return { ...e, id: newId() };
    });
    const remappedG = goals.map((g) => {
      if (isUuid(g.id)) return g;
      mutated = true;
      return { ...g, id: newId() };
    });
    if (mutated) {
      writeArr(ENTRIES_KEY, remappedE);
      writeArr(GOALS_KEY, remappedG);
    }
    if (remappedE.length > 0) {
      try { await bulkUpsertFinanceEntriesDb({ data: { companyId, items: remappedE.map(entryLocalToDb) } }); }
      catch { /* noop */ }
    }
    if (remappedG.length > 0) {
      try { await bulkUpsertFinanceGoalsDb({ data: { companyId, items: remappedG.map(goalLocalToDb) } }); }
      catch { /* noop */ }
    }
  }, []);

  const uploadLegacy = useCallback(async (companyId: string) => {
    if (!isBrowser()) return;
    if (localStorage.getItem(UPLOADED_FLAG + ":" + companyId) === "1") return;
    await uploadAll(companyId);
    localStorage.setItem(UPLOADED_FLAG + ":" + companyId, "1");
  }, [uploadAll]);

  useDbFirstSync({
    table: "finance_entries",
    hydrate,
    uploadLegacy,
    mirror: uploadAll,
    mirrorEvents: [FINANCE_EVENT],
  });
}
