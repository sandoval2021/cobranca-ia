// Override local da próxima data de vencimento do cliente (full date).
// Fonte da verdade: tabela `customer_due_overrides` no banco.
// localStorage é apenas cache para acesso instantâneo / offline.

import { getActiveCompanyId } from "@/lib/company-scope";
import {
  bulkUpsertCustomerDueOverridesDb,
  upsertCustomerDueOverrideDb,
  deleteCustomerDueOverrideDb,
  type CustomerDueOverrideDto,
} from "@/lib/customer-due-overrides/due-overrides.functions";

const KEY = "cobranca_ia_customer_due_override_v1";
export const CUSTOMER_DUE_OVERRIDE_EVENT = "cobranca_ia_customer_due_override:changed";
export const DUE_OVERRIDES_SYNC_EVENT = "cobranca_ia_due_overrides:sync";

type Store = Record<string, string>; // customer_id -> YYYY-MM-DD

type SyncState = { loaded: boolean; lastError: string | null; pendingLocal: number };
const syncState: SyncState = { loaded: false, lastError: null, pendingLocal: 0 };

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw);
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function write(s: Store) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
    window.dispatchEvent(new CustomEvent(CUSTOMER_DUE_OVERRIDE_EVENT));
  } catch {
    /* noop */
  }
}

export function getCustomerDueOverride(customerId: string): string | null {
  return read()[customerId] ?? null;
}

export function setCustomerDueOverride(customerId: string, isoDate: string) {
  const s = read();
  s[customerId] = isoDate;
  write(s);
  // best-effort persist no banco
  const companyId = getActiveCompanyId();
  if (companyId) {
    void upsertCustomerDueOverrideDb({
      data: { companyId, customerId, due_date: isoDate, source: "manual" },
    }).catch(() => {
      /* falha silenciosa — sync vai tentar novamente */
    });
  }
}

export function clearCustomerDueOverride(customerId: string) {
  const s = read();
  delete s[customerId];
  write(s);
  const companyId = getActiveCompanyId();
  if (companyId) {
    void deleteCustomerDueOverrideDb({ data: { companyId, customerId } }).catch(() => {});
  }
}

export function fmtDateBRFromISO(iso?: string | null): string {
  if (!iso) return "—";
  const dt = new Date(iso + "T00:00:00");
  if (isNaN(+dt)) return iso;
  return dt.toLocaleDateString("pt-BR");
}

export function daysFromOverride(iso?: string | null): number | null {
  if (!iso) return null;
  const dt = new Date(iso + "T00:00:00");
  if (isNaN(+dt)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((+dt - +today) / (1000 * 60 * 60 * 24));
}

// ------------------- sync helpers -------------------

function emit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(DUE_OVERRIDES_SYNC_EVENT, {
      detail: { ...syncState },
    }),
  );
}

export function getDueOverridesSyncState(): SyncState {
  return { ...syncState };
}

export function markDueOverridesSyncError(message: string) {
  syncState.lastError = message;
  emit();
}

/**
 * Hidrata cache local com lista do banco.
 * Se banco vazio + cache local com dados → preserva cache e sinaliza pendência.
 */
export function hydrateDueOverridesFromDb(rows: CustomerDueOverrideDto[]) {
  if (typeof window === "undefined") return;
  const cur = read();
  const localCount = Object.keys(cur).length;

  if (rows.length === 0 && localCount > 0) {
    syncState.loaded = true;
    syncState.lastError = null;
    syncState.pendingLocal = localCount;
    emit();
    return;
  }

  const next: Store = {};
  for (const r of rows) next[r.customer_id] = r.due_date;
  write(next);
  syncState.loaded = true;
  syncState.lastError = null;
  syncState.pendingLocal = 0;
  emit();
}

/**
 * Envia ao banco os overrides que estão apenas no cache local.
 */
export async function uploadLocalDueOverridesToDb(): Promise<{ upserted: number }> {
  const companyId = getActiveCompanyId();
  if (!companyId) return { upserted: 0 };
  const s = read();
  const overrides = Object.entries(s)
    .filter(([_, d]) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .map(([customerId, d]) => ({ customerId, due_date: d, source: "manual" as const }));
  if (overrides.length === 0) return { upserted: 0 };
  const res = await bulkUpsertCustomerDueOverridesDb({ data: { companyId, overrides } });
  return res;
}
