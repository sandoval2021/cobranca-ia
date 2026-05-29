// Helper central para migrar dados locais escopados por empresa quando
// o ID local (ex.: "co_xxxx") é substituído pelo UUID real do Supabase.
//
// Nunca apaga dados, nunca duplica. Apenas troca company_id antigo pelo novo
// em todos os arrays/objetos locais conhecidos, e dispara os eventos para
// que as telas/hook de sync revalidem.

type ArrayModule = {
  key: string;
  event?: string;
  /** Quando o item tem outro company_id real e diferente, não mexer. */
  keepOtherIds?: boolean;
};

/** Arrays cujos itens carregam o campo `company_id`. */
const ARRAY_MODULES: ArrayModule[] = [
  { key: "cobranca_ia_trial_leads_v1", event: "trial-leads:changed" },
  // followups são vinculados por lead_id (não têm company_id) — não precisam relink
  { key: "cobranca_ia_finance_entries_v1", event: "cobranca_ia_finance:changed" },
  { key: "cobranca_ia_finance_goals_v1", event: "cobranca_ia_finance:changed" },
  { key: "cobranca_ia_customer_plans_v1", event: "cobranca_ia_customer_plans:changed" },
  { key: "cobranca_ia_services_catalog_v1", event: "cobranca_ia_services:changed" },
  { key: "cobranca_ia_app_screens_v1", event: "app-screens:changed" },
  { key: "cobranca_ia_manual_renewal_history_v1", event: "cobranca_ia_manual_renewal:changed" },
  { key: "cobranca_ia_referrals_v1", event: "referrals:changed" },
  { key: "cobranca_ia_import_schedule_items_v1", event: "cobranca_ia_import_schedule:changed" },
];

/**
 * server-catalog usa chaves por empresa:
 *   cobranca_ia_server_catalog_v2__{companyId}
 * Aqui renomeamos a chave; se já existir a nova, fazemos merge sem duplicar (por id).
 */
const PER_COMPANY_KEY_PREFIXES: { prefix: string; event?: string }[] = [
  { prefix: "cobranca_ia_server_catalog_v2__", event: "cobranca_ia_server_catalog:changed" },
];

export type RelinkReport = {
  oldId: string;
  newId: string;
  modules: { key: string; updated: number; kept: number }[];
  renamedKeys: { from: string; to: string; merged: number }[];
};

function readArray(key: string): unknown[] | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function emit(name?: string) {
  if (!name) return;
  try {
    window.dispatchEvent(new CustomEvent(name));
  } catch {
    /* noop */
  }
}

export function relinkScopedLocalStorageData(
  oldId: string,
  newId: string,
): RelinkReport {
  const report: RelinkReport = { oldId, newId, modules: [], renamedKeys: [] };
  if (typeof window === "undefined") return report;
  if (!oldId || !newId || oldId === newId) return report;

  // 1) Arrays com campo company_id
  const eventsToEmit = new Set<string>();
  for (const mod of ARRAY_MODULES) {
    const list = readArray(mod.key);
    if (!list) continue;
    let updated = 0;
    let kept = 0;
    const next = list.map((item) => {
      if (!item || typeof item !== "object") return item;
      const obj = item as Record<string, unknown>;
      const cid = obj.company_id;
      if (cid === oldId) {
        updated++;
        return { ...obj, company_id: newId };
      }
      if (cid != null && cid !== newId) kept++;
      return item;
    });
    if (updated > 0) {
      try {
        window.localStorage.setItem(mod.key, JSON.stringify(next));
        if (mod.event) eventsToEmit.add(mod.event);
      } catch {
        /* noop */
      }
    }
    report.modules.push({ key: mod.key, updated, kept });
  }

  // 2) Chaves por empresa (renomeação)
  try {
    for (const { prefix, event } of PER_COMPANY_KEY_PREFIXES) {
      const from = `${prefix}${oldId}`;
      const to = `${prefix}${newId}`;
      const rawOld = window.localStorage.getItem(from);
      if (!rawOld) continue;
      const rawNew = window.localStorage.getItem(to);
      let merged = 0;
      if (!rawNew) {
        window.localStorage.setItem(to, rawOld);
        window.localStorage.removeItem(from);
      } else {
        // merge por id, sem duplicar
        try {
          const a = JSON.parse(rawOld);
          const b = JSON.parse(rawNew);
          if (Array.isArray(a) && Array.isArray(b)) {
            const byId = new Map<string, unknown>();
            for (const it of b) {
              const id = (it as { id?: string })?.id;
              if (id) byId.set(id, it);
            }
            for (const it of a) {
              const id = (it as { id?: string })?.id;
              if (id && !byId.has(id)) {
                byId.set(id, it);
                merged++;
              }
            }
            window.localStorage.setItem(to, JSON.stringify(Array.from(byId.values())));
            window.localStorage.removeItem(from);
          }
        } catch {
          /* mantém ambos em caso de parse falho */
        }
      }
      if (event) eventsToEmit.add(event);
      report.renamedKeys.push({ from, to, merged });
    }
  } catch {
    /* noop */
  }

  // 3) Disparar eventos para revalidar telas/hook de sync
  for (const ev of eventsToEmit) emit(ev);

  return report;
}
