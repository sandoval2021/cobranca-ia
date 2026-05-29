// Store local de vencimentos importados, chaveado por WhatsApp E.164.
// Existe porque o backend atual (staging_import_customers_from_rows) só
// persiste due_day — perdemos a data completa (ex.: 19/02/2023). Aqui
// guardamos a data ISO original assim que o usuário importa, para que a
// tela de Clientes possa exibi-la corretamente em vez de cair no fallback
// mensal do due_day (que projetaria para 19/06/2026, p.ex.).

const KEY = "cobranca_ia_imported_due_by_wa_v1";
export const IMPORTED_DUE_EVENT = "cobranca_ia_imported_due:changed";

type Store = Record<string, string>; // whatsapp_e164 -> YYYY-MM-DD

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw);
    return p && typeof p === "object" ? (p as Store) : {};
  } catch {
    return {};
  }
}

function write(s: Store) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
    window.dispatchEvent(new CustomEvent(IMPORTED_DUE_EVENT));
  } catch {
    /* noop */
  }
}

function toIso(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
  const m2 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
  const d = new Date(s);
  if (!isNaN(+d)) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  return null;
}

export function getImportedDueByWhatsapp(wa: string | null | undefined): string | null {
  if (!wa) return null;
  return read()[wa] ?? null;
}

export function setImportedDueByWhatsapp(wa: string, isoOrRaw: string) {
  const iso = toIso(isoOrRaw);
  if (!iso) return;
  const s = read();
  s[wa] = iso;
  write(s);
  // Write-through best-effort para o banco (fonte da verdade).
  void persistImportedDueToDb([{ phone: wa, due_date: iso }]);
}

export function setImportedDueBulk(entries: Array<{ wa: string | null; date: string | null }>) {
  const s = read();
  let changed = false;
  const toPersist: Array<{ phone: string; due_date: string }> = [];
  for (const e of entries) {
    if (!e.wa) continue;
    const iso = toIso(e.date);
    if (!iso) continue;
    if (s[e.wa] !== iso) {
      s[e.wa] = iso;
      changed = true;
    }
    toPersist.push({ phone: e.wa, due_date: iso });
  }
  if (changed) write(s);
  if (toPersist.length > 0) void persistImportedDueToDb(toPersist);
}

async function persistImportedDueToDb(items: Array<{ phone: string; due_date: string }>) {
  try {
    const companyId = getActiveCompanyId();
    if (!companyId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(companyId)) return;
    await bulkUpsertImportedDueDb({
      data: {
        companyId,
        items: items.map((it) => ({ phone: it.phone, due_date: it.due_date, raw_row: { source: "live-set" } })),
      },
    });
  } catch {
    /* falha silenciosa — próximo sync re-tenta via uploadLocalImportedDueDatesToDb */
  }
}

export function clearImportedDueByWhatsapp(wa: string) {
  const s = read();
  delete s[wa];
  write(s);
}

// ============================================================
// Sincronização com o banco (imported_customer_due_dates) — Fase 2E
// ============================================================

import { getActiveCompanyId } from "@/lib/company-scope";
import {
  bulkUpsertImportedDueDb,
  type ImportedDueDto,
} from "@/lib/imports/imports.functions";

export const IMPORTED_DUE_SYNC_EVENT = "cobranca_ia_imported_due:sync";

type ImportedDueSyncState = { loaded: boolean; lastError: string | null; pendingLocal: number };
const importedDueSyncState: ImportedDueSyncState = { loaded: false, lastError: null, pendingLocal: 0 };

function emitImportedDueSync() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(IMPORTED_DUE_SYNC_EVENT, { detail: { ...importedDueSyncState } }),
  );
}

export function getImportedDueDatesSyncState(): ImportedDueSyncState {
  return { ...importedDueSyncState };
}

export function markImportedDueDatesSyncError(message: string) {
  importedDueSyncState.lastError = message;
  emitImportedDueSync();
}

function _isUuid2(v: string | null | undefined): v is string {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export function hydrateImportedDueDatesFromDb(companyId: string, rows: ImportedDueDto[]): void {
  if (typeof window === "undefined") return;
  if (!_isUuid2(companyId)) return;
  const local = read();
  const localKeys = Object.keys(local);
  if (rows.length === 0 && localKeys.length > 0) {
    importedDueSyncState.loaded = true;
    importedDueSyncState.lastError = null;
    importedDueSyncState.pendingLocal = localKeys.length;
    emitImportedDueSync();
    return;
  }
  const next: Store = {};
  for (const r of rows) {
    if (r.phone && r.due_date) next[r.phone] = r.due_date;
  }
  // Preserve local-only keys that DB doesn't know yet, to avoid data loss.
  let pending = 0;
  for (const k of localKeys) {
    if (!(k in next)) {
      next[k] = local[k];
      pending++;
    }
  }
  write(next);
  importedDueSyncState.loaded = true;
  importedDueSyncState.lastError = null;
  importedDueSyncState.pendingLocal = pending;
  emitImportedDueSync();
}

export async function uploadLocalImportedDueDatesToDb(): Promise<{ count: number }> {
  const companyId = getActiveCompanyId();
  if (!companyId) return { count: 0 };
  const local = read();
  const items: Array<{ phone: string; due_date: string; raw_row: Record<string, unknown> }> = [];
  for (const [phone, date] of Object.entries(local)) {
    if (!phone || !date) continue;
    items.push({ phone, due_date: date, raw_row: { source: "local-cache" } });
  }
  if (items.length === 0) return { count: 0 };
  return bulkUpsertImportedDueDb({ data: { companyId, items } });
}
