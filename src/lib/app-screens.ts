// Storage local (preview-only) para "Telas e aplicativos" de cada cliente.
// Não há backend/RPC para isso ainda — quando existir, trocar este módulo.

export type AppKey =
  | "xciptv"
  | "bob_player"
  | "bob_play"
  | "ibo_player"
  | "ibo_pro"
  | "ibo_mix"
  | "vu_player"
  | "smarters"
  | "outro";

export type AccessType = "user_pass" | "mac_key" | "outro";

export type ScreenStatus =
  | "ativa"
  | "vencendo"
  | "vencida"
  | "pausada"
  | "arquivada";

export type AppScreen = {
  id: string;
  customer_id: string;
  name: string;
  app: AppKey;
  access_type: AccessType;
  username?: string;
  password?: string;
  server?: string;
  port?: string;
  mac?: string;
  app_key?: string;
  portal_url?: string;
  due_date?: string; // YYYY-MM-DD
  status: ScreenStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
};

export const APP_CATALOG: Record<
  AppKey,
  { label: string; access: AccessType; badgeClass: string }
> = {
  xciptv:     { label: "XCIPTV",      access: "user_pass", badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 border border-blue-300/40" },
  bob_player: { label: "Bob Player",  access: "mac_key",   badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300 border border-purple-300/40" },
  bob_play:   { label: "BobPlay",     access: "mac_key",   badgeClass: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300 border border-fuchsia-300/40" },
  ibo_player: { label: "IBO Player",  access: "mac_key",   badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-300/40" },
  ibo_pro:    { label: "IBO Pro",     access: "mac_key",   badgeClass: "bg-green-200 text-green-800 dark:bg-green-600/20 dark:text-green-300 border border-green-500/40" },
  ibo_mix:    { label: "IBO Mix",     access: "mac_key",   badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300 border border-orange-300/40" },
  vu_player:  { label: "Vu Player",   access: "mac_key",   badgeClass: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 border border-red-300/40" },
  smarters:   { label: "Smarters",    access: "user_pass", badgeClass: "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300 border border-slate-400/40" },
  outro:      { label: "Outro",       access: "outro",     badgeClass: "bg-muted text-muted-foreground border border-border" },
};

export const APP_OPTIONS: AppKey[] = [
  "xciptv", "bob_player", "bob_play", "ibo_player", "ibo_pro",
  "ibo_mix", "vu_player", "smarters", "outro",
];

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
