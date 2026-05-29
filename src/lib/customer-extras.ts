// Extras de cliente: email, aniversário, próximo vencimento.
// DB-first: localStorage é cache; `useCustomerExtrasSync` hidrata do banco.
// Escrita: salva local + mirror fire-and-forget no banco.
import { mirror } from "./sync/mirror";
import { upsertCustomerExtraDb } from "./customer-extras.functions";

const KEY = "cobranca_ia_customer_extras_v1";
export const CUSTOMER_EXTRAS_EVENT = "cobranca_ia_customer_extras:changed";

export type CustomerExtras = {
  email?: string;
  birthday?: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD — data completa do próximo vencimento
};

type Store = Record<string, CustomerExtras>;

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
    window.dispatchEvent(new CustomEvent(CUSTOMER_EXTRAS_EVENT));
  } catch {
    /* noop */
  }
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export function getCustomerExtras(customerId: string): CustomerExtras {
  return read()[customerId] ?? {};
}

export function setCustomerExtras(customerId: string, extras: CustomerExtras) {
  const s = read();
  const merged = { ...s[customerId], ...extras };
  s[customerId] = merged;
  write(s);
  if (!isUuid(customerId)) return; // só espelha quando temos UUID real do cliente
  mirror((companyId) =>
    upsertCustomerExtraDb({
      data: {
        companyId,
        customer_id: customerId,
        email: merged.email ?? null,
        birthday: merged.birthday ?? null,
        due_date: merged.dueDate ?? null,
        extraJson: JSON.stringify(merged),
      },
    }),
  );
}

export function fmtBirthdayBR(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(+d)) return iso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
