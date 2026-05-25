// Backup geral local — 100% frontend/localStorage.
// Nenhum dado é enviado para servidor. Nenhuma API externa.

export type BackupModule = {
  key: string;
  label: string;
  isList?: boolean; // true => espera-se um array para contar itens
};

export const BACKUP_VERSION = 1;
export const SYSTEM_NAME = "Cobrança IA";

export const BACKUP_MODULES: BackupModule[] = [
  { key: "cobranca_ia_app_screens_v1", label: "Telas e aplicativos", isList: true },
  { key: "cobranca_ia_server_catalog_v1", label: "Catálogo de servidores", isList: true },
  { key: "cobranca_ia_manual_renewal_history_v1", label: "Histórico de renovações", isList: true },
  { key: "cobranca_ia_trial_leads_v1", label: "Testes/leads", isList: true },
  { key: "cobranca_ia_trial_followups_v1", label: "Follow-ups de testes", isList: true },
  { key: "cobranca_ia_referrals_v1", label: "Indicações", isList: true },
  { key: "cobranca_ia_referral_rules_v1", label: "Regras de indicação", isList: true },
  { key: "cobranca_ia_finance_settings_v1", label: "Configurações financeiras" },
  { key: "cobranca_ia_finance_entries_v1", label: "Entradas financeiras", isList: true },
  { key: "cobranca_ia_finance_goals_v1", label: "Objetivos financeiros", isList: true },
  { key: "cobranca_ia_finance_draft_v1", label: "Rascunho financeiro" },
  { key: "cobranca_ia_import_schedule_items_v1", label: "Agenda da importação", isList: true },
  { key: "cobranca_ia_import_schedule_status_v1", label: "Status da agenda" },
  { key: "cobranca_ia_manual_dispatch_rules_v1", label: "Regras de disparo", isList: true },
  { key: "cobranca_ia_manual_dispatch_limits_v1", label: "Limites de disparo" },
  { key: "cobranca_ia_kb_v1", label: "Base da IA", isList: true },
  { key: "cobranca_ia_quick_support_history_v1", label: "Histórico de atendimento rápido", isList: true },
  { key: "cobranca_ia_campaign_copied_v1", label: "Campanhas copiadas" },
  { key: "cobranca_ia_pending_resolved_v1", label: "Pendências resolvidas" },
  { key: "cobranca_ia_revenda_settings_v1", label: "Configurações da revenda" },
  { key: "cobranca_ia_dns_domains_v1", label: "DNS e Rotas — Domínios", isList: true },
  { key: "cobranca_ia_dns_routes_v1", label: "DNS e Rotas — Rotas", isList: true },
  { key: "cobranca_ia_dns_route_history_v1", label: "DNS e Rotas — Histórico", isList: true },
  { key: "cobranca_ia_companies_v1", label: "Empresas e Planos — Empresas", isList: true },
  { key: "cobranca_ia_company_members_v1", label: "Empresas e Planos — Membros", isList: true },
  { key: "cobranca_ia_company_plans_v1", label: "Empresas e Planos — Planos", isList: true },
  { key: "cobranca_ia_current_company_v1", label: "Empresas e Planos — Empresa atual" },
];

const EVENTS_AFTER_RESTORE = [
  "app-screens:changed",
  "cobranca_ia_import_schedule:changed",
  "cobranca_ia_manual_renewal:changed",
  "cobranca_ia_finance:changed",
  "cobranca_ia_server_catalog:changed",
  "cobranca_ia_manual_rules:changed",
  "cobranca_ia_trial_leads:changed",
  "cobranca_ia_referrals:changed",
  "cobranca_ia_revenda_settings:changed",
  "cobranca_ia_dns_routes:changed",
];

export type RestoreMode = "merge" | "replace";

export type ModuleSummary = {
  key: string;
  label: string;
  present: boolean;
  count: number; // 0 quando não-lista; quantidade quando lista
  raw?: unknown;
};

export type BackupFile = {
  system: string;
  version: number;
  exportedAt: string; // ISO
  modules: string[]; // chaves incluídas
  data: Record<string, unknown>;
  summary: { key: string; label: string; count: number; present: boolean }[];
  notice: string;
};

function readKey(key: string): unknown | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = window.localStorage.getItem(key);
  if (raw == null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw; // mantém valor cru se não for JSON
  }
}

function writeKey(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    if (value === undefined || value === null) {
      window.localStorage.removeItem(key);
    } else if (typeof value === "string") {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // silencioso — quota/erro
  }
}

export function getLocalDataHealth(): {
  status: "ok" | "warning" | "review";
  issues: { level: "info" | "warning" | "review"; message: string }[];
  totals: Record<string, number>;
} {
  const issues: { level: "info" | "warning" | "review"; message: string }[] = [];
  const totals: Record<string, number> = {};

  const screens = (readKey("cobranca_ia_app_screens_v1") as any[]) || [];
  const servers = (readKey("cobranca_ia_server_catalog_v1") as any[]) || [];
  const finance = (readKey("cobranca_ia_finance_entries_v1") as any[]) || [];
  const goals = (readKey("cobranca_ia_finance_goals_v1") as any[]) || [];
  const leads = (readKey("cobranca_ia_trial_leads_v1") as any[]) || [];
  const refs = (readKey("cobranca_ia_referrals_v1") as any[]) || [];
  const agenda = (readKey("cobranca_ia_import_schedule_items_v1") as any[]) || [];
  const agendaStatus = (readKey("cobranca_ia_import_schedule_status_v1") as any) || {};

  totals.telas = Array.isArray(screens) ? screens.length : 0;
  totals.servidores = Array.isArray(servers) ? servers.length : 0;
  totals.financeiro = Array.isArray(finance) ? finance.length : 0;
  totals.objetivos = Array.isArray(goals) ? goals.length : 0;
  totals.leads = Array.isArray(leads) ? leads.length : 0;
  totals.indicacoes = Array.isArray(refs) ? refs.length : 0;
  totals.agenda = Array.isArray(agenda) ? agenda.length : 0;

  if (Array.isArray(screens)) {
    const semCliente = screens.filter((s) => !s?.cliente_id && !s?.client_id && !s?.cliente).length;
    const semApp = screens.filter((s) => !s?.app && !s?.app_id && !s?.aplicativo).length;
    const semId = screens.filter((s) => !s?.id && !s?.local_id).length;
    if (semCliente > 0) issues.push({ level: "warning", message: `${semCliente} tela(s) sem cliente vinculado.` });
    if (semApp > 0) issues.push({ level: "warning", message: `${semApp} tela(s) sem app definido.` });
    if (semId > 0) issues.push({ level: "review", message: `${semId} tela(s) sem identificador local.` });

    if (Array.isArray(servers)) {
      const ativos = new Set(servers.filter((s) => s?.ativo !== false).map((s) => s?.id));
      const usadosInativos = screens.filter(
        (s) => s?.servidor_id && !ativos.has(s.servidor_id),
      ).length;
      if (usadosInativos > 0) issues.push({ level: "warning", message: `${usadosInativos} tela(s) usam servidor inativo/inexistente.` });
    }
  }

  if (Array.isArray(finance)) {
    const semValor = finance.filter((e) => !e?.valor && !e?.amount).length;
    if (semValor > 0) issues.push({ level: "warning", message: `${semValor} entrada(s) financeira(s) sem valor.` });
  }
  if (Array.isArray(goals)) {
    const zerados = goals.filter((g) => !g?.valor_alvo && !g?.target_amount).length;
    if (zerados > 0) issues.push({ level: "warning", message: `${zerados} objetivo(s) com valor alvo zerado.` });
  }
  if (Array.isArray(leads)) {
    const semWpp = leads.filter((l) => !l?.whatsapp && !l?.telefone).length;
    if (semWpp > 0) issues.push({ level: "warning", message: `${semWpp} lead(s) sem WhatsApp.` });
  }
  if (Array.isArray(refs)) {
    const semInd = refs.filter((r) => !r?.indicador_id && !r?.indicador_whatsapp && !r?.indicador).length;
    if (semInd > 0) issues.push({ level: "warning", message: `${semInd} indicação(ões) sem indicador identificado.` });
  }
  if (Array.isArray(agenda) && agenda.length > 0) {
    const semStatus = agenda.filter((a) => {
      const id = a?.id || a?.local_id;
      if (!id) return false;
      return !agendaStatus?.[id];
    }).length;
    if (semStatus > 0) issues.push({ level: "info", message: `${semStatus} item(ns) da agenda sem status definido.` });
  }

  // chaves inválidas (JSON quebrado): readKey já tolera, mas se valor for string esperando lista, sinaliza.
  for (const mod of BACKUP_MODULES) {
    const v = readKey(mod.key);
    if (v === undefined) continue;
    if (mod.isList && !Array.isArray(v)) {
      issues.push({ level: "review", message: `Chave "${mod.label}" não parece estar no formato esperado (lista).` });
    }
  }

  const hasReview = issues.some((i) => i.level === "review");
  const hasWarn = issues.some((i) => i.level === "warning");
  const status: "ok" | "warning" | "review" = hasReview ? "review" : hasWarn ? "warning" : "ok";

  return { status, issues, totals };
}

export function getModuleSummaries(): ModuleSummary[] {
  return BACKUP_MODULES.map((mod) => {
    const raw = readKey(mod.key);
    const present = raw !== undefined;
    let count = 0;
    if (Array.isArray(raw)) count = raw.length;
    else if (raw && typeof raw === "object") count = Object.keys(raw as object).length;
    return { key: mod.key, label: mod.label, present, count, raw };
  });
}

export function buildFullBackup(): BackupFile {
  const summaries = getModuleSummaries();
  const data: Record<string, unknown> = {};
  const modules: string[] = [];
  for (const s of summaries) {
    if (s.present) {
      data[s.key] = s.raw;
      modules.push(s.key);
    }
  }
  return {
    system: SYSTEM_NAME,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    modules,
    data,
    summary: summaries.map((s) => ({ key: s.key, label: s.label, count: s.count, present: s.present })),
    notice:
      "Backup local. Estes dados estavam salvos apenas no navegador. Guarde este arquivo em local seguro.",
  };
}

function downloadBlob(filename: string, content: string, mime: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function todayStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function exportFullBackup() {
  const backup = buildFullBackup();
  const json = JSON.stringify(backup, null, 2);
  downloadBlob(`backup-geral-cobranca-ia-${todayStamp()}.json`, json, "application/json");
  return backup;
}

export type BackupValidation =
  | { ok: true; data: BackupFile; warnings: string[] }
  | { ok: false; error: string };

export function validateFullBackup(data: unknown): BackupValidation {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Arquivo vazio ou inválido." };
  }
  const obj = data as Partial<BackupFile> & Record<string, unknown>;
  if (!("data" in obj) || typeof obj.data !== "object" || obj.data == null) {
    return { ok: false, error: "Este arquivo não parece ser um backup geral válido do sistema." };
  }
  if (obj.system && typeof obj.system === "string" && !obj.system.toLowerCase().includes("cobrança") && !obj.system.toLowerCase().includes("cobranca")) {
    // permite, mas avisa
  }
  const warnings: string[] = [];
  const known = new Set(BACKUP_MODULES.map((m) => m.key));
  const dataObj = obj.data as Record<string, unknown>;
  const incomingKeys = Object.keys(dataObj);
  const unknownKeys = incomingKeys.filter((k) => !known.has(k));
  if (unknownKeys.length > 0) {
    warnings.push(`${unknownKeys.length} chave(s) desconhecida(s) serão ignoradas na restauração.`);
  }
  if (incomingKeys.length === 0) {
    return { ok: false, error: "O backup não contém módulos para restaurar." };
  }
  const file: BackupFile = {
    system: (obj.system as string) || SYSTEM_NAME,
    version: (obj.version as number) || 0,
    exportedAt: (obj.exportedAt as string) || "",
    modules: (obj.modules as string[]) || incomingKeys,
    data: dataObj,
    summary: (obj.summary as BackupFile["summary"]) || [],
    notice: (obj.notice as string) || "",
  };
  return { ok: true, data: file, warnings };
}

export async function parseFullBackup(file: File): Promise<BackupValidation> {
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    return validateFullBackup(json);
  } catch {
    return { ok: false, error: "Não foi possível ler o arquivo. Verifique se é um JSON válido." };
  }
}

function dispatchRestoreEvents() {
  if (typeof window === "undefined") return;
  for (const name of EVENTS_AFTER_RESTORE) {
    try {
      window.dispatchEvent(new CustomEvent(name));
    } catch {
      // ignorado
    }
  }
}

export function restoreFullBackup(
  data: BackupFile,
  mode: RestoreMode,
): { restored: number; skipped: number } {
  if (typeof window === "undefined") return { restored: 0, skipped: 0 };
  const known = new Set(BACKUP_MODULES.map((m) => m.key));
  let restored = 0;
  let skipped = 0;

  for (const key of Object.keys(data.data)) {
    if (!known.has(key)) {
      skipped++;
      continue;
    }
    const incoming = data.data[key];
    if (mode === "replace") {
      writeKey(key, incoming);
      restored++;
      continue;
    }
    // merge
    const current = readKey(key);
    if (current === undefined) {
      writeKey(key, incoming);
      restored++;
      continue;
    }
    if (Array.isArray(current) && Array.isArray(incoming)) {
      const map = new Map<string, unknown>();
      const keyOf = (item: any, idx: number) =>
        String(item?.id ?? item?.local_id ?? item?.uuid ?? `__idx_${idx}`);
      current.forEach((it, i) => map.set(keyOf(it, i), it));
      incoming.forEach((it, i) => map.set(keyOf(it, i), it));
      writeKey(key, Array.from(map.values()));
      restored++;
    } else if (
      current && typeof current === "object" && !Array.isArray(current) &&
      incoming && typeof incoming === "object" && !Array.isArray(incoming)
    ) {
      writeKey(key, { ...(current as object), ...(incoming as object) });
      restored++;
    } else {
      writeKey(key, incoming);
      restored++;
    }
  }

  dispatchRestoreEvents();
  return { restored, skipped };
}

export function buildHealthReportText(): string {
  const health = getLocalDataHealth();
  const summaries = getModuleSummaries();
  const lines: string[] = [];
  lines.push(`Relatório de Backup Geral — ${SYSTEM_NAME}`);
  lines.push(`Data: ${new Date().toLocaleString("pt-BR")}`);
  lines.push("");
  lines.push("Módulos encontrados:");
  for (const s of summaries) {
    lines.push(`  - ${s.label}: ${s.present ? `${s.count} item(ns)` : "vazio"}`);
  }
  lines.push("");
  lines.push(`Saúde dos dados: ${
    health.status === "ok" ? "Tudo certo" : health.status === "warning" ? "Atenção" : "Precisa revisar"
  }`);
  if (health.issues.length === 0) {
    lines.push("  Sem alertas.");
  } else {
    for (const i of health.issues) {
      lines.push(`  [${i.level.toUpperCase()}] ${i.message}`);
    }
  }
  lines.push("");
  lines.push("Recomendações:");
  lines.push("  - Faça backup geral antes de trocar de aparelho ou limpar cache.");
  lines.push("  - Guarde o arquivo JSON em local seguro (nuvem pessoal/pen drive).");
  lines.push("  - Revise itens marcados como Atenção/Precisa revisar antes de operar.");
  lines.push("");
  lines.push("Aviso: estes dados estão salvos apenas neste navegador.");
  return lines.join("\n");
}

export function exportHealthReportTxt() {
  const txt = buildHealthReportText();
  downloadBlob(`relatorio-backup-geral-cobranca-ia-${todayStamp()}.txt`, txt, "text/plain;charset=utf-8");
}
