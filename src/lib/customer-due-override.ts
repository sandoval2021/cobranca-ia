// Override local da próxima data de vencimento do cliente (full date).
// Usado quando a renovação é registrada e o cliente não tem telas
// (ou queremos persistir a data completa além do due_day mensal).

const KEY = "cobranca_ia_customer_due_override_v1";
export const CUSTOMER_DUE_OVERRIDE_EVENT = "cobranca_ia_customer_due_override:changed";

type Store = Record<string, string>; // customer_id -> YYYY-MM-DD

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
}

export function clearCustomerDueOverride(customerId: string) {
  const s = read();
  delete s[customerId];
  write(s);
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
