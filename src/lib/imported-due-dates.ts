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
}

export function setImportedDueBulk(entries: Array<{ wa: string | null; date: string | null }>) {
  const s = read();
  let changed = false;
  for (const e of entries) {
    if (!e.wa) continue;
    const iso = toIso(e.date);
    if (!iso) continue;
    if (s[e.wa] !== iso) {
      s[e.wa] = iso;
      changed = true;
    }
  }
  if (changed) write(s);
}

export function clearImportedDueByWhatsapp(wa: string) {
  const s = read();
  delete s[wa];
  write(s);
}
