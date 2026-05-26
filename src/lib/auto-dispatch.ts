// Configuração e cancelamentos de disparos automáticos (100% client-side).

export type AmountSchedule = {
  amountCents: number; // valor exato (em centavos) para casar
  sendHour: string;    // "HH:MM"
};

export type AutoDispatchConfig = {
  enabled: boolean;
  sendHour: string;        // "HH:MM" — horário padrão
  intervalSeconds: number; // intervalo entre uma mensagem e outra
  maxPerDay: number;       // limite diário de envios automáticos
  allowedDays: ("dom" | "seg" | "ter" | "qua" | "qui" | "sex" | "sab")[];
  batchSize: number;       // a cada N mensagens, aplica uma pausa maior
  batchPauseSeconds: number; // duração da pausa entre lotes (em segundos)
  amountSchedules: AmountSchedule[]; // horários customizados por valor
};

const CFG_KEY = "cobranca_ia_auto_dispatch_cfg_v1";
const CANCEL_KEY = "cobranca_ia_auto_dispatch_cancel_v1";
const SENT_KEY = "cobranca_ia_auto_dispatch_sent_v1";
export const AUTO_DISPATCH_EVENT = "cobranca_ia_auto_dispatch:changed";

export function defaultAutoDispatchConfig(): AutoDispatchConfig {
  return {
    enabled: false,
    sendHour: "09:00",
    intervalSeconds: 30,
    maxPerDay: 40,
    allowedDays: ["seg", "ter", "qua", "qui", "sex", "sab"],
    batchSize: 5,
    batchPauseSeconds: 300,
    amountSchedules: [],
  };
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(AUTO_DISPATCH_EVENT));
  } catch { /* noop */ }
}

export function getAutoDispatchConfig(): AutoDispatchConfig {
  return { ...defaultAutoDispatchConfig(), ...read<Partial<AutoDispatchConfig>>(CFG_KEY, {}) };
}
export function saveAutoDispatchConfig(cfg: AutoDispatchConfig) {
  write(CFG_KEY, cfg);
}

// ---- cancelamentos por dia ----
// estrutura: { "YYYY-MM-DD": ["customerId", ...] }
type DayMap = Record<string, string[]>;

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getCancelled(date = todayKey()): Set<string> {
  const all = read<DayMap>(CANCEL_KEY, {});
  return new Set(all[date] ?? []);
}
export function setCancelled(customerId: string, cancelled: boolean, date = todayKey()) {
  const all = read<DayMap>(CANCEL_KEY, {});
  const list = new Set(all[date] ?? []);
  if (cancelled) list.add(customerId); else list.delete(customerId);
  all[date] = Array.from(list);
  // limpeza: mantém só os últimos 14 dias
  const keys = Object.keys(all).sort();
  while (keys.length > 14) { delete all[keys.shift()!]; }
  write(CANCEL_KEY, all);
}

export function getSent(date = todayKey()): Set<string> {
  const all = read<DayMap>(SENT_KEY, {});
  return new Set(all[date] ?? []);
}
export function markSent(customerId: string, date = todayKey()) {
  const all = read<DayMap>(SENT_KEY, {});
  const list = new Set(all[date] ?? []);
  list.add(customerId);
  all[date] = Array.from(list);
  const keys = Object.keys(all).sort();
  while (keys.length > 14) { delete all[keys.shift()!]; }
  write(SENT_KEY, all);
}

export function dayKeyOf(d: Date): AutoDispatchConfig["allowedDays"][number] {
  return (["dom","seg","ter","qua","qui","sex","sab"] as const)[d.getDay()];
}

export function isDayAllowed(cfg: AutoDispatchConfig, d = new Date()): boolean {
  return cfg.allowedDays.includes(dayKeyOf(d));
}

export function computeScheduleTime(cfg: AutoDispatchConfig, index: number, base = new Date()): Date {
  const [hh, mm] = cfg.sendHour.split(":").map((n) => parseInt(n, 10) || 0);
  const dt = new Date(base);
  dt.setHours(hh, mm, 0, 0);
  dt.setSeconds(dt.getSeconds() + index * cfg.intervalSeconds);
  return dt;
}

export function fmtHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
