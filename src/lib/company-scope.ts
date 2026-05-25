// Escopo local por empresa — 100% frontend.
// Marca registros com company_id para preparar migração futura.
// NÃO substitui RLS. Isolamento real só com Supabase + policies.

import {
  getCompanyForUser,
  getCurrentCompany,
  getCurrentCompanyId,
  type Company,
} from "@/lib/companies";
import { getCurrentLocalUser, getCurrentRole } from "@/lib/local-auth";

const HISTORY_KEY = "cobranca_ia_company_scope_migration_history_v1";

export type ScopeRecord = { company_id?: string | null } & Record<string, unknown>;

export type ScopeModule = {
  key: string;
  label: string;
  globalByDefault?: boolean; // true => não vincular automaticamente
};

export const SCOPE_MODULES: ScopeModule[] = [
  { key: "cobranca_ia_app_screens_v1", label: "Telas e aplicativos" },
  { key: "cobranca_ia_trial_leads_v1", label: "Testes/leads" },
  { key: "cobranca_ia_referrals_v1", label: "Indicações" },
  { key: "cobranca_ia_finance_entries_v1", label: "Entradas financeiras" },
  { key: "cobranca_ia_finance_goals_v1", label: "Objetivos financeiros" },
  { key: "cobranca_ia_import_schedule_items_v1", label: "Agenda da importação" },
  { key: "cobranca_ia_manual_renewal_history_v1", label: "Histórico de renovações" },
  { key: "cobranca_ia_quick_support_history_v1", label: "Atendimento rápido" },
  { key: "cobranca_ia_campaign_copied_v1", label: "Campanhas copiadas" },
  { key: "cobranca_ia_pending_resolved_v1", label: "Pendências resolvidas" },
  { key: "cobranca_ia_revenda_settings_v1", label: "Minha Revenda" },
  { key: "cobranca_ia_manual_dispatch_rules_v1", label: "Regras de disparo" },
  { key: "cobranca_ia_server_catalog_v1", label: "Servidores", globalByDefault: true },
  { key: "cobranca_ia_dns_routes_v1", label: "DNS e Rotas", globalByDefault: true },
];

// ---------- IO ----------
function read<T>(key: string, fb: T): T {
  if (typeof window === "undefined") return fb;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fb;
    return JSON.parse(raw) as T;
  } catch {
    return fb;
  }
}
function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* noop */
  }
}

// ---------- Empresa ativa ----------

export function getActiveCompanyId(): string | null {
  const role = getCurrentRole();
  const user = getCurrentLocalUser();
  if (role === "owner") {
    return getCompanyForUser(user?.email)?.id ?? null;
  }
  return getCurrentCompanyId();
}

export function getActiveCompany(): Company | null {
  const role = getCurrentRole();
  const user = getCurrentLocalUser();
  if (role === "owner") return getCompanyForUser(user?.email);
  return getCurrentCompany();
}

export function requireActiveCompany(): Company {
  const c = getActiveCompany();
  if (!c) throw new Error("Nenhuma empresa ativa.");
  return c;
}

// ---------- Records helpers ----------

export function addCompanyIdToRecord<T extends ScopeRecord>(record: T, companyId: string): T {
  return { ...record, company_id: companyId };
}

export function recordBelongsToActiveCompany(record: ScopeRecord | null | undefined): boolean {
  if (!record) return false;
  const active = getActiveCompanyId();
  if (!active) return true; // super_admin visão global
  if (!record.company_id) return false;
  return record.company_id === active;
}

export function filterByActiveCompany<T extends ScopeRecord>(records: T[]): T[] {
  const role = getCurrentRole();
  const active = getActiveCompanyId();
  if (role === "super_admin" && !active) return records; // visão global
  if (!active) return [];
  return records.filter((r) => r?.company_id === active);
}

export function getUnscopedRecords<T extends ScopeRecord>(records: T[]): T[] {
  return records.filter((r) => !r?.company_id);
}

// ---------- Migração local ----------

export type MigrationPreviewItem = {
  key: string;
  label: string;
  total: number;
  com_empresa: number;
  sem_empresa: number;
  globalByDefault?: boolean;
};

export function getMigrationPreview(): MigrationPreviewItem[] {
  const out: MigrationPreviewItem[] = [];
  for (const mod of SCOPE_MODULES) {
    const raw = read<unknown>(mod.key, null);
    let arr: ScopeRecord[] = [];
    if (Array.isArray(raw)) arr = raw as ScopeRecord[];
    else if (raw && typeof raw === "object") arr = [raw as ScopeRecord];
    const com = arr.filter((r) => !!(r && (r as ScopeRecord).company_id)).length;
    out.push({
      key: mod.key,
      label: mod.label,
      total: arr.length,
      com_empresa: com,
      sem_empresa: arr.length - com,
      globalByDefault: mod.globalByDefault,
    });
  }
  return out;
}

export function assignRecordsToCompany(
  storageKey: string,
  companyId: string,
  options: { onlyUnscoped?: boolean } = { onlyUnscoped: true },
): { updated: number; total: number } {
  const raw = read<unknown>(storageKey, null);
  if (raw === null) return { updated: 0, total: 0 };
  if (Array.isArray(raw)) {
    let updated = 0;
    const next = (raw as ScopeRecord[]).map((r) => {
      if (!r || typeof r !== "object") return r;
      if (options.onlyUnscoped && r.company_id) return r;
      updated += 1;
      return { ...r, company_id: companyId };
    });
    write(storageKey, next);
    return { updated, total: (raw as unknown[]).length };
  }
  if (raw && typeof raw === "object") {
    const r = raw as ScopeRecord;
    if (options.onlyUnscoped && r.company_id) return { updated: 0, total: 1 };
    write(storageKey, { ...r, company_id: companyId });
    return { updated: 1, total: 1 };
  }
  return { updated: 0, total: 0 };
}

// ---------- Histórico de migração ----------

export type MigrationHistoryEntry = {
  id: string;
  at: string;
  company_id: string;
  company_nome?: string;
  user_email?: string;
  modules: { key: string; label: string; updated: number; total: number }[];
  observacao?: string;
};

export function listMigrationHistory(): MigrationHistoryEntry[] {
  return read<MigrationHistoryEntry[]>(HISTORY_KEY, []);
}

export function saveMigrationHistoryEntry(entry: Omit<MigrationHistoryEntry, "id" | "at">) {
  const list = listMigrationHistory();
  const e: MigrationHistoryEntry = {
    ...entry,
    id: `mig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
  };
  write(HISTORY_KEY, [e, ...list].slice(0, 200));
  return e;
}

// ---------- Resumo / relatório ----------

export function getCompanyScopeSummary() {
  const preview = getMigrationPreview();
  const totalSemEmpresa = preview.reduce((acc, p) => acc + p.sem_empresa, 0);
  const totalComEmpresa = preview.reduce((acc, p) => acc + p.com_empresa, 0);
  const modulosComPendencia = preview.filter((p) => p.sem_empresa > 0 && !p.globalByDefault).length;
  return {
    totalSemEmpresa,
    totalComEmpresa,
    modulosComPendencia,
    preview,
  };
}

export function exportCompanyScopeReport(): string {
  const s = getCompanyScopeSummary();
  const lines: string[] = [];
  lines.push("RELATÓRIO LOCAL DE ESCOPO POR EMPRESA");
  lines.push(`Gerado em: ${new Date().toLocaleString()}`);
  lines.push(`Registros sem empresa: ${s.totalSemEmpresa}`);
  lines.push(`Registros com empresa: ${s.totalComEmpresa}`);
  lines.push("");
  for (const p of s.preview) {
    lines.push(`- ${p.label}: total=${p.total}, com=${p.com_empresa}, sem=${p.sem_empresa}${p.globalByDefault ? " (global por padrão)" : ""}`);
  }
  lines.push("");
  lines.push("Isolamento real exige backend (Supabase + RLS + policies).");
  return lines.join("\n");
}
