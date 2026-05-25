// Storage local (preview-only) para "Telas e aplicativos" de cada cliente.
// Não há backend/RPC para isso ainda — quando existir, trocar este módulo.

export type AppKey =
  | "xciptv"
  | "smarters"
  | "smarters_player"
  | "bob_player"
  | "bob_play"
  | "ibo_player"
  | "ibo_pro"
  | "ibo_mix"
  | "vu_player"
  | "eagle_play"
  | "duplex_play"
  | "set_iptv"
  | "smart_one"
  | "outro";

export type AccessType =
  | "user_pass"
  | "mac"
  | "mac_key"
  | "outro"
  | "nao_informado";

export type AppTier = "gratis" | "pago" | "desconhecido";

export type ScreenStatus =
  | "ativa"
  | "vencendo"
  | "vencida"
  | "pausada"
  | "arquivada";

export type RouteKind = "principal" | "alternativa" | "teste" | "outro";

export const ROUTE_OPTIONS: { value: RouteKind; label: string }[] = [
  { value: "principal", label: "Principal" },
  { value: "alternativa", label: "Alternativa" },
  { value: "teste", label: "Teste" },
  { value: "outro", label: "Outro" },
];

export type AppScreen = {
  id: string;
  customer_id: string;
  name: string;
  app: AppKey;
  tier?: AppTier;
  access_type: AccessType;
  username?: string;
  password?: string;
  server?: string;
  port?: string;
  mac?: string;
  app_key?: string;
  portal_url?: string;
  due_date?: string; // YYYY-MM-DD — vencimento da LISTA
  app_due_date?: string; // YYYY-MM-DD — vencimento da LICENÇA do app pago
  app_renewal_value?: string; // valor da renovação (texto livre)
  status: ScreenStatus;
  route?: RouteKind;
  needs_server_update?: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
};

export const APP_CATALOG: Record<
  AppKey,
  { label: string; access: AccessType; tier: AppTier; badgeClass: string }
> = {
  xciptv:          { label: "XCIPTV",          access: "user_pass", tier: "gratis", badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 border border-blue-300/40" },
  smarters:        { label: "IPTV Smarters",   access: "user_pass", tier: "gratis", badgeClass: "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300 border border-slate-400/40" },
  smarters_player: { label: "Smarters Player", access: "user_pass", tier: "gratis", badgeClass: "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300 border border-slate-400/40" },
  bob_player:      { label: "Bob Player",      access: "mac_key",   tier: "pago",   badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300 border border-purple-300/40" },
  bob_play:        { label: "BobPlay",         access: "mac_key",   tier: "pago",   badgeClass: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300 border border-fuchsia-300/40" },
  ibo_player:      { label: "IBO Player",      access: "mac_key",   tier: "pago",   badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-300/40" },
  ibo_pro:         { label: "IBO Pro",         access: "mac_key",   tier: "pago",   badgeClass: "bg-green-200 text-green-800 dark:bg-green-600/20 dark:text-green-300 border border-green-500/40" },
  ibo_mix:         { label: "IBO Mix",         access: "mac_key",   tier: "pago",   badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300 border border-orange-300/40" },
  vu_player:       { label: "Vu Player",       access: "mac_key",   tier: "pago",   badgeClass: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 border border-red-300/40" },
  eagle_play:      { label: "Eagle Play",      access: "mac_key",   tier: "pago",   badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 border border-amber-300/40" },
  duplex_play:     { label: "Duplex Play",     access: "mac_key",   tier: "pago",   badgeClass: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300 border border-cyan-300/40" },
  set_iptv:        { label: "Set IPTV",        access: "mac_key",   tier: "pago",   badgeClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 border border-indigo-300/40" },
  smart_one:       { label: "SmartOne",        access: "mac_key",   tier: "pago",   badgeClass: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300 border border-teal-300/40" },
  outro:           { label: "Outro",           access: "nao_informado", tier: "desconhecido", badgeClass: "bg-muted text-muted-foreground border border-border" },
};

export const APP_OPTIONS: AppKey[] = [
  "xciptv", "smarters", "smarters_player",
  "bob_player", "bob_play",
  "ibo_player", "ibo_pro", "ibo_mix",
  "vu_player", "eagle_play", "duplex_play",
  "set_iptv", "smart_one", "outro",
];

export const TIER_LABEL: Record<AppTier, string> = {
  gratis: "Grátis",
  pago: "Pago",
  desconhecido: "Desconhecido",
};

export const ACCESS_LABEL: Record<AccessType, string> = {
  user_pass: "Usuário e senha",
  mac: "MAC",
  mac_key: "MAC e Key",
  outro: "Outro",
  nao_informado: "Não informado",
};

// Vencimento da LICENÇA do app pago (somente)
export function appDueDays(s: AppScreen): number | null {
  const tier = s.tier ?? APP_CATALOG[s.app]?.tier ?? "desconhecido";
  if (tier !== "pago") return null;
  return daysUntil(s.app_due_date);
}

const STORAGE_KEY = "cobranca_ia_app_screens_v1";

function readAll(): Record<string, AppScreen[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, AppScreen[]>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent("app-screens:changed"));
  } catch {
    // quota / private mode → silencioso
  }
}

export function listScreens(customerId: string): AppScreen[] {
  const all = readAll();
  return all[customerId] ?? [];
}

export function listAllScreens(): Record<string, AppScreen[]> {
  return readAll();
}

export function upsertScreen(s: AppScreen): void {
  const all = readAll();
  const list = all[s.customer_id] ?? [];
  const idx = list.findIndex((x) => x.id === s.id);
  if (idx >= 0) list[idx] = s;
  else list.push(s);
  all[s.customer_id] = list;
  writeAll(all);
}

export function archiveScreen(customerId: string, id: string): void {
  const all = readAll();
  const list = all[customerId] ?? [];
  all[customerId] = list.map((s) =>
    s.id === id
      ? { ...s, status: "arquivada", updated_at: new Date().toISOString() }
      : s,
  );
  writeAll(all);
}

export function reactivateScreen(customerId: string, id: string): void {
  const all = readAll();
  const list = all[customerId] ?? [];
  all[customerId] = list.map((s) =>
    s.id === id
      ? { ...s, status: "ativa", updated_at: new Date().toISOString() }
      : s,
  );
  writeAll(all);
}

export function clearCustomerScreens(customerId: string): void {
  const all = readAll();
  delete all[customerId];
  writeAll(all);
}

export function replaceAll(data: Record<string, AppScreen[]>): void {
  writeAll(data);
}

export function mergeAll(incoming: Record<string, AppScreen[]>): void {
  const all = readAll();
  for (const [cid, list] of Object.entries(incoming)) {
    const cur = all[cid] ?? [];
    const byId = new Map(cur.map((s) => [s.id, s]));
    for (const s of list) byId.set(s.id, s);
    all[cid] = Array.from(byId.values());
  }
  writeAll(all);
}

export function newId(): string {
  return `scr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ----- vencimento helpers -----

export type Urgency = "hoje" | "3d" | "7d" | "em_dia" | "vencido" | "sem_data";

export function daysUntil(dueDate?: string | null): number | null {
  if (!dueDate) return null;
  const d = new Date(dueDate + "T00:00:00");
  if (isNaN(+d)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((+d - +today) / (1000 * 60 * 60 * 24));
}

export function urgencyFromDays(n: number | null): Urgency {
  if (n == null) return "sem_data";
  if (n < 0) return "vencido";
  if (n === 0) return "hoje";
  if (n <= 3) return "3d";
  if (n <= 7) return "7d";
  return "em_dia";
}

export function urgencyLabel(u: Urgency, days: number | null): string {
  if (u === "hoje") return "Vence hoje";
  if (u === "3d") return `Vence em ${days} ${days === 1 ? "dia" : "dias"}`;
  if (u === "7d") return `Vence em ${days} dias`;
  if (u === "vencido") return `Vencido há ${Math.abs(days ?? 0)} ${Math.abs(days ?? 0) === 1 ? "dia" : "dias"}`;
  if (u === "em_dia") return `Vence em ${days} dias`;
  return "Sem vencimento";
}

export function urgencyClass(u: Urgency): string {
  if (u === "hoje") return "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 border border-red-400/50";
  if (u === "3d") return "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300 border border-orange-400/50";
  if (u === "7d") return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-400/50";
  if (u === "em_dia") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-400/50";
  if (u === "vencido") return "bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-200 border border-red-500/60";
  return "bg-muted text-muted-foreground border border-border";
}

// Próximo vencimento entre due_day (mensal) e telas (data explícita).
// Retorna nº de dias até o vencimento mais próximo (pode ser negativo).
export function nextDueDays(
  dueDay: number | null,
  screens: AppScreen[],
): number | null {
  const candidates: number[] = [];
  if (dueDay != null && dueDay >= 1 && dueDay <= 31) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const y = today.getFullYear();
    const m = today.getMonth();
    const dayThisMonth = Math.min(
      dueDay,
      new Date(y, m + 1, 0).getDate(),
    );
    const candidate = new Date(y, m, dayThisMonth);
    let diff = Math.floor((+candidate - +today) / (1000 * 60 * 60 * 24));
    // Se passou há mais de 7 dias, considera o próximo mês
    if (diff < -7) {
      const nm = new Date(y, m + 1, Math.min(dueDay, new Date(y, m + 2, 0).getDate()));
      diff = Math.floor((+nm - +today) / (1000 * 60 * 60 * 24));
    }
    candidates.push(diff);
  }
  for (const s of screens) {
    if (s.status === "arquivada" || s.status === "pausada") continue;
    const d = daysUntil(s.due_date);
    if (d != null) candidates.push(d);
  }
  if (candidates.length === 0) return null;
  // Pega o menor positivo; se todos negativos, pega o maior (menos vencido)
  const positives = candidates.filter((d) => d >= 0);
  if (positives.length > 0) return Math.min(...positives);
  return Math.max(...candidates);
}

// Texto sensível mascarado (•••• com últimos 2 caracteres)
export function mask(value?: string): string {
  if (!value) return "—";
  if (value.length <= 2) return "••";
  return "•".repeat(Math.max(4, value.length - 2)) + value.slice(-2);
}

// ----- backup helpers -----

export type BackupFile = {
  type: "cobranca-ia/app-screens-backup";
  version: 1;
  generated_at: string;
  customers: { customer_id: string; customer_name?: string; screens: AppScreen[] }[];
};

export function buildBackup(
  customerNames: Record<string, string> = {},
): BackupFile {
  const all = readAll();
  const customers = Object.entries(all).map(([cid, screens]) => ({
    customer_id: cid,
    customer_name: customerNames[cid],
    screens,
  }));
  return {
    type: "cobranca-ia/app-screens-backup",
    version: 1,
    generated_at: new Date().toISOString(),
    customers,
  };
}

export type BackupParseResult =
  | { ok: true; data: Record<string, AppScreen[]>; stats: { customers: number; screens: number; apps: string[] } }
  | { ok: false; error: string };

export function parseBackup(raw: string): BackupParseResult {
  try {
    const json = JSON.parse(raw);
    if (!json || typeof json !== "object") return { ok: false, error: "Arquivo inválido." };
    // Aceita formato oficial OU dicionário {customer_id: [...]} para flexibilidade
    let map: Record<string, AppScreen[]> = {};
    if (json.type === "cobranca-ia/app-screens-backup" && Array.isArray(json.customers)) {
      for (const c of json.customers) {
        if (c && typeof c.customer_id === "string" && Array.isArray(c.screens)) {
          map[c.customer_id] = c.screens.filter(isValidScreen);
        }
      }
    } else if (Object.values(json).every((v) => Array.isArray(v))) {
      for (const [k, v] of Object.entries(json)) {
        if (Array.isArray(v)) map[k] = (v as AppScreen[]).filter(isValidScreen);
      }
    } else {
      return { ok: false, error: "Formato não reconhecido." };
    }
    let screens = 0;
    const apps = new Set<string>();
    for (const list of Object.values(map)) {
      screens += list.length;
      for (const s of list) apps.add(APP_CATALOG[s.app]?.label ?? s.app);
    }
    return {
      ok: true,
      data: map,
      stats: { customers: Object.keys(map).length, screens, apps: Array.from(apps) },
    };
  } catch {
    return { ok: false, error: "JSON inválido." };
  }
}

function isValidScreen(s: unknown): s is AppScreen {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.customer_id === "string" &&
    typeof o.name === "string" &&
    typeof o.app === "string" &&
    typeof o.access_type === "string" &&
    typeof o.status === "string"
  );
}

// ----- copy/format helpers -----

function fmtDate(d?: string): string {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(+dt)) return d;
  return dt.toLocaleDateString("pt-BR");
}

function routeLabel(r?: RouteKind): string | null {
  if (!r) return null;
  return ROUTE_OPTIONS.find((o) => o.value === r)?.label ?? null;
}

export function formatScreenAsText(
  s: AppScreen,
  customerName: string,
  opts: { revealSecrets?: boolean } = {},
): string {
  const lines: string[] = [];
  lines.push(`Cliente: ${customerName}`);
  lines.push(`Tela: ${s.name}`);
  lines.push(`App: ${APP_CATALOG[s.app]?.label ?? s.app}`);
  if (s.access_type === "user_pass") {
    if (s.username) lines.push(`Usuário: ${s.username}`);
    if (s.password) lines.push(`Senha: ${opts.revealSecrets ? s.password : mask(s.password)}`);
    if (s.server) lines.push(`Servidor: ${s.server}`);
    if (s.port) lines.push(`Porta: ${s.port}`);
  } else if (s.access_type === "mac_key") {
    if (s.mac) lines.push(`MAC: ${s.mac}`);
    if (s.app_key) lines.push(`Key: ${opts.revealSecrets ? s.app_key : mask(s.app_key)}`);
  }
  if (s.portal_url) lines.push(`Portal: ${s.portal_url}`);
  const r = routeLabel(s.route);
  if (r) lines.push(`Rota: ${r}`);
  if (s.due_date) lines.push(`Vencimento: ${fmtDate(s.due_date)}`);
  if (s.needs_server_update) lines.push(`⚠ Precisa atualizar servidor`);
  if (s.notes) lines.push(`Observações: ${s.notes}`);
  return lines.join("\n");
}

export function formatCustomerScreensAsText(
  customerName: string,
  screens: AppScreen[],
  opts: { revealSecrets?: boolean } = {},
): string {
  const active = screens.filter((s) => s.status !== "arquivada");
  if (active.length === 0) return `Cliente: ${customerName}\n(sem telas cadastradas)`;
  return active
    .map((s) => formatScreenAsText(s, customerName, opts))
    .join("\n\n---\n\n");
}

// ----- helpers de "app pago" -----
export function isPaidApp(s: AppScreen): boolean {
  const tier = s.tier ?? APP_CATALOG[s.app]?.tier ?? "desconhecido";
  return tier === "pago";
}

export type PaidAppAlert =
  | "vencido"
  | "vence_7d"
  | "vence_30d"
  | "sem_vencimento"
  | "sem_mac_key"
  | "sem_valor";

export function paidAppAlerts(s: AppScreen): PaidAppAlert[] {
  if (!isPaidApp(s) || s.status === "arquivada") return [];
  const out: PaidAppAlert[] = [];
  const d = appDueDays(s);
  if (d == null) {
    out.push("sem_vencimento");
  } else if (d < 0) {
    out.push("vencido");
  } else if (d <= 7) {
    out.push("vence_7d");
  } else if (d <= 30) {
    out.push("vence_30d");
  }
  const at = s.access_type;
  if ((at === "mac" || at === "mac_key") && (!s.mac || (at === "mac_key" && !s.app_key))) {
    out.push("sem_mac_key");
  }
  if (d != null && d <= 30 && !(s.app_renewal_value && s.app_renewal_value.trim())) {
    out.push("sem_valor");
  }
  return out;
}

export const PAID_ALERT_LABEL: Record<PaidAppAlert, string> = {
  vencido: "App vencido",
  vence_7d: "App vence em breve",
  vence_30d: "App vence em 30 dias",
  sem_vencimento: "Sem vencimento do app",
  sem_mac_key: "Sem MAC/Key",
  sem_valor: "Renovação sem valor",
};

export function paidAlertClass(a: PaidAppAlert): string {
  switch (a) {
    case "vencido": return "bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-200 border border-red-500/60";
    case "vence_7d": return "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300 border border-orange-400/50";
    case "vence_30d": return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 border border-amber-400/50";
    case "sem_vencimento": return "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300 border border-slate-400/40";
    case "sem_mac_key": return "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300 border border-violet-400/50";
    case "sem_valor": return "bg-muted text-muted-foreground border border-border";
  }
}
