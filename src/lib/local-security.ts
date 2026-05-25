// Segurança Local (frontend/localStorage). Não substitui segurança real de backend.
// PIN nunca é salvo em texto puro: hashing via Web Crypto (SHA-256) + salt.

const STORAGE_KEY = "cobranca_ia_local_security_v1";
export const LOCAL_SECURITY_EVENT = "cobranca_ia_local_security:changed";
const UNLOCK_KEY = "cobranca_ia_local_security_unlock_v1";

export type LocalSecuritySettings = {
  enabled: boolean;
  pin_hash?: string;
  pin_salt?: string;
  require_pin_on_sensitive_actions: boolean;
  require_pin_on_backup: boolean;
  require_pin_on_finance: boolean;
  require_pin_on_server_password: boolean;
  require_pin_on_app_key: boolean;
  require_pin_on_delete: boolean;
  auto_lock_minutes: number;
  last_unlock_at?: string;
  protected_mode: boolean;
  hide_sensitive_by_default: boolean;
};

export const DEFAULT_LOCAL_SECURITY: LocalSecuritySettings = {
  enabled: false,
  require_pin_on_sensitive_actions: true,
  require_pin_on_backup: true,
  require_pin_on_finance: false,
  require_pin_on_server_password: true,
  require_pin_on_app_key: true,
  require_pin_on_delete: true,
  auto_lock_minutes: 15,
  protected_mode: false,
  hide_sensitive_by_default: false,
};

export type ProtectedActionKind =
  | "backup"
  | "finance"
  | "server_password"
  | "app_key"
  | "delete"
  | "sensitive";

function readStorage(): LocalSecuritySettings {
  if (typeof window === "undefined") return DEFAULT_LOCAL_SECURITY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LOCAL_SECURITY;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_LOCAL_SECURITY, ...parsed };
  } catch {
    return DEFAULT_LOCAL_SECURITY;
  }
}

function writeStorage(s: LocalSecuritySettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  window.dispatchEvent(new Event(LOCAL_SECURITY_EVENT));
}

export function getLocalSecuritySettings(): LocalSecuritySettings {
  return readStorage();
}

export function saveLocalSecuritySettings(patch: Partial<LocalSecuritySettings>) {
  const next = { ...readStorage(), ...patch };
  writeStorage(next);
  return next;
}

// --- Hash helpers ---------------------------------------------------------

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", data);
    return toHex(buf);
  }
  // Fallback simples (apenas se Web Crypto indisponível). Não é seguro,
  // mas suficiente para travar curiosos no mesmo navegador.
  let h = 0;
  const str = `${salt}:${pin}`;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return `fallback_${(h >>> 0).toString(16)}`;
}

function randomSalt(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return toHex(arr.buffer);
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// --- PIN lifecycle --------------------------------------------------------

export async function setupPin(pin: string): Promise<void> {
  if (!pin || pin.length < 4) throw new Error("PIN deve ter ao menos 4 dígitos.");
  const salt = randomSalt();
  const hash = await hashPin(pin, salt);
  saveLocalSecuritySettings({
    enabled: true,
    pin_hash: hash,
    pin_salt: salt,
    last_unlock_at: new Date().toISOString(),
  });
  setUnlockTimestamp(Date.now());
}

export async function verifyPin(pin: string): Promise<boolean> {
  const s = readStorage();
  if (!s.pin_hash || !s.pin_salt) return false;
  const hash = await hashPin(pin, s.pin_salt);
  return hash === s.pin_hash;
}

export async function changePin(oldPin: string, newPin: string): Promise<void> {
  const ok = await verifyPin(oldPin);
  if (!ok) throw new Error("PIN atual incorreto.");
  await setupPin(newPin);
}

export function disablePinProtection() {
  saveLocalSecuritySettings({
    enabled: false,
    pin_hash: undefined,
    pin_salt: undefined,
    protected_mode: false,
  });
  clearUnlock();
}

// --- Lock state -----------------------------------------------------------

function setUnlockTimestamp(ts: number) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(UNLOCK_KEY, String(ts));
  saveLocalSecuritySettings({ last_unlock_at: new Date(ts).toISOString() });
}

function getUnlockTimestamp(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(UNLOCK_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function clearUnlock() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(UNLOCK_KEY);
  window.dispatchEvent(new Event(LOCAL_SECURITY_EVENT));
}

export function isUnlocked(): boolean {
  const s = readStorage();
  if (!s.enabled || !s.pin_hash) return true;
  const ts = getUnlockTimestamp();
  if (!ts) return false;
  if (s.auto_lock_minutes > 0) {
    const elapsed = Date.now() - ts;
    if (elapsed > s.auto_lock_minutes * 60 * 1000) return false;
  }
  return true;
}

export async function unlockWithPin(pin: string): Promise<boolean> {
  const ok = await verifyPin(pin);
  if (!ok) return false;
  setUnlockTimestamp(Date.now());
  window.dispatchEvent(new Event(LOCAL_SECURITY_EVENT));
  return true;
}

export function lockNow() {
  clearUnlock();
}

export function touchSecuritySession() {
  if (isUnlocked()) setUnlockTimestamp(Date.now());
}

// --- Action guard ---------------------------------------------------------

export function requirePinForAction(kind: ProtectedActionKind): boolean {
  const s = readStorage();
  if (!s.enabled || !s.pin_hash) return false;
  switch (kind) {
    case "backup":
      return s.require_pin_on_backup;
    case "finance":
      return s.require_pin_on_finance;
    case "server_password":
      return s.require_pin_on_server_password;
    case "app_key":
      return s.require_pin_on_app_key;
    case "delete":
      return s.require_pin_on_delete;
    case "sensitive":
    default:
      return s.require_pin_on_sensitive_actions;
  }
}

// --- Masking --------------------------------------------------------------

export function shouldHideSensitive(): boolean {
  const s = readStorage();
  return s.enabled && (s.protected_mode || s.hide_sensitive_by_default);
}

export function maskSensitiveValue(value: string | null | undefined): string {
  if (!value) return "";
  const v = String(value);
  if (v.length <= 2) return "•".repeat(v.length);
  if (v.length <= 6) return v[0] + "•".repeat(v.length - 2) + v[v.length - 1];
  return v.slice(0, 2) + "•".repeat(Math.min(8, v.length - 4)) + v.slice(-2);
}

export function isProtectedModeActive(): boolean {
  const s = readStorage();
  return s.enabled && s.protected_mode;
}
