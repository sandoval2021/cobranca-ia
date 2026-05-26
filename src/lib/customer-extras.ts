// Extras de cliente armazenados localmente (campos que ainda não existem na RPC):
// email, data de aniversário. Persistidos em localStorage por customer_id.

const KEY = "cobranca_ia_customer_extras_v1";
export const CUSTOMER_EXTRAS_EVENT = "cobranca_ia_customer_extras:changed";

export type CustomerExtras = {
  email?: string;
  birthday?: string; // YYYY-MM-DD
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

export function getCustomerExtras(customerId: string): CustomerExtras {
  return read()[customerId] ?? {};
}

export function setCustomerExtras(customerId: string, extras: CustomerExtras) {
  const s = read();
  s[customerId] = { ...s[customerId], ...extras };
  write(s);
}

export function fmtBirthdayBR(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(+d)) return iso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
