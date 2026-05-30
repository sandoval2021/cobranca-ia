// Sync DB-first para customer_extras (email, aniversário, dueDate por cliente).
// Chave local é customer_id (UUID), o que casa direto com a constraint do DB.
import { useCallback } from "react";
import { useDbFirstSync } from "@/hooks/useDbFirstSync";
import {
  listCustomerExtrasDb,
  bulkUpsertCustomerExtrasDb,
} from "@/lib/customer-extras.functions";
import { CUSTOMER_EXTRAS_EVENT, type CustomerExtras } from "@/lib/customer-extras";
import { withTimeout } from "@/lib/sync/with-timeout";

const KEY = "cobranca_ia_customer_extras_v1";
const UPLOADED_FLAG = "cobraeasy.customer_extras.synced";

function readLocal(): Record<string, CustomerExtras> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw);
    return p && typeof p === "object" ? p : {};
  } catch { return {}; }
}

function writeLocal(s: Record<string, CustomerExtras>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent(CUSTOMER_EXTRAS_EVENT));
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export function useCustomerExtrasSync() {
  const hydrate = useCallback(async (companyId: string) => {
    const rows = await listCustomerExtrasDb({ data: { companyId } });
    if (!rows || rows.length === 0) return;
    const map: Record<string, CustomerExtras> = {};
    for (const r of rows) {
      map[r.customer_id] = {
        email: r.email ?? undefined,
        birthday: r.birthday ?? undefined,
        dueDate: r.due_date ?? undefined,
      };
    }
    // mescla com cache local para não perder entradas que ainda não subiram
    const local = readLocal();
    writeLocal({ ...local, ...map });
  }, []);

  const uploadAll = useCallback(async (companyId: string) => {
    if (typeof window === "undefined") return;
    const local = readLocal();
    const items = Object.entries(local)
      .filter(([cid, v]) => isUuid(cid) && (v.email || v.birthday || v.dueDate))
      .map(([cid, v]) => ({
        customer_id: cid,
        email: v.email ?? null,
        birthday: v.birthday ?? null,
        due_date: v.dueDate ?? null,
      }));
    if (items.length === 0) return;
    await bulkUpsertCustomerExtrasDb({ data: { companyId, items } });
  }, []);

  const uploadLegacy = useCallback(async (companyId: string) => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(UPLOADED_FLAG + ":" + companyId) === "1") return;
    await uploadAll(companyId);
    localStorage.setItem(UPLOADED_FLAG + ":" + companyId, "1");
  }, [uploadAll]);

  useDbFirstSync({
    table: "customer_extras",
    hydrate,
    uploadLegacy,
    mirror: uploadAll,
    mirrorEvents: [CUSTOMER_EXTRAS_EVENT],
  });
}
