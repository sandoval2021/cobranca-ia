// Autenticação local apenas para protótipo. Produção precisa Supabase Auth/backend.
// Não envia e-mail real, não chama API externa, não substitui RLS.

export type LocalRole = "super_admin" | "owner";
export type LocalUserStatus = "pendente_confirmacao" | "ativo" | "bloqueado";

export type LocalUser = {
  id: string;
  nome: string;
  email: string;
  whatsapp: string;
  senha_hash: string;
  role: LocalRole;
  status: LocalUserStatus;
  email_confirmed: boolean;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
};

export type LocalSession = {
  user_id: string;
  started_at: string;
};

export type PendingCode = {
  email: string;
  code: string;
  kind: "signup" | "reset";
  created_at: string;
};

const USERS_KEY = "cobranca_ia_auth_users_v1";
const SESSION_KEY = "cobranca_ia_auth_session_v1";
const CODES_KEY = "cobranca_ia_auth_pending_codes_v1";

export const LOCAL_AUTH_EVENT = "cobranca-local-auth-changed";

function emitChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(LOCAL_AUTH_EVENT));
  }
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

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* noop */
  }
}

// Hash simples para protótipo. Não é seguro para produção.
async function hashPassword(plain: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = new TextEncoder().encode(plain);
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // fallback: base64
  return typeof btoa !== "undefined" ? btoa(plain) : plain;
}

export function listLocalUsers(): LocalUser[] {
  return read<LocalUser[]>(USERS_KEY, []);
}

function saveUsers(users: LocalUser[]) {
  write(USERS_KEY, users);
  emitChange();
}

export function generateLocalConfirmationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function listCodes(): PendingCode[] {
  return read<PendingCode[]>(CODES_KEY, []);
}

function saveCodes(codes: PendingCode[]) {
  write(CODES_KEY, codes);
}

export function getPendingCode(email: string, kind: "signup" | "reset"): string | null {
  const c = listCodes().find(
    (x) => x.email.toLowerCase() === email.toLowerCase() && x.kind === kind,
  );
  return c?.code ?? null;
}

export type RegisterInput = {
  nome: string;
  email: string;
  whatsapp: string;
  senha: string;
  role?: LocalRole;
};

export type RegisterResult =
  | { ok: true; user: LocalUser; confirmation_code: string }
  | { ok: false; error: string };

export async function registerLocalUser(input: RegisterInput): Promise<RegisterResult> {
  const email = input.email.trim().toLowerCase();
  const nome = input.nome.trim();
  const whatsapp = input.whatsapp.trim();
  if (!nome) return { ok: false, error: "Nome obrigatório." };
  if (!email || !/.+@.+\..+/.test(email)) return { ok: false, error: "E-mail inválido." };
  if (!whatsapp) return { ok: false, error: "WhatsApp obrigatório." };
  if (!input.senha || input.senha.length < 6)
    return { ok: false, error: "Senha mínima de 6 caracteres." };

  const users = listLocalUsers();
  if (users.some((u) => u.email.toLowerCase() === email)) {
    return { ok: false, error: "Este e-mail já está cadastrado." };
  }

  const now = new Date().toISOString();
  const hash = await hashPassword(input.senha);
  const user: LocalUser = {
    id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    nome,
    email,
    whatsapp,
    senha_hash: hash,
    // Cadastro público SEMPRE vira owner. Mesmo que `input.role` venha
    // como "super_admin" (por engano ou abuso), ignoramos aqui. Super
    // admin só existe no backend (is_super_admin / user_roles) — nunca
    // pode ser concedido por chamada de cliente.
    role: "owner",
    status: "pendente_confirmacao",
    email_confirmed: false,
    created_at: now,
    updated_at: now,
  };
  saveUsers([...users, user]);

  const code = generateLocalConfirmationCode();
  const codes = listCodes().filter(
    (c) => !(c.email.toLowerCase() === email && c.kind === "signup"),
  );
  codes.push({ email, code, kind: "signup", created_at: now });
  saveCodes(codes);
  return { ok: true, user, confirmation_code: code };
}

export function confirmSignupCodeLocal(email: string, code: string): { ok: boolean; error?: string } {
  const e = email.trim().toLowerCase();
  const codes = listCodes();
  const found = codes.find(
    (c) => c.email.toLowerCase() === e && c.kind === "signup" && c.code === code.trim(),
  );
  if (!found) return { ok: false, error: "Código inválido." };
  const users = listLocalUsers();
  const next = users.map((u) =>
    u.email.toLowerCase() === e
      ? { ...u, email_confirmed: true, status: "ativo" as const, updated_at: new Date().toISOString() }
      : u,
  );
  saveUsers(next);
  saveCodes(codes.filter((c) => c !== found));
  return { ok: true };
}

export async function loginLocalUser(
  email: string,
  senha: string,
): Promise<{ ok: boolean; error?: string; user?: LocalUser }> {
  const e = email.trim().toLowerCase();
  const users = listLocalUsers();
  const user = users.find((u) => u.email.toLowerCase() === e);
  if (!user) return { ok: false, error: "E-mail ou senha incorretos." };
  if (user.status === "bloqueado") return { ok: false, error: "Conta bloqueada." };
  if (!user.email_confirmed)
    return { ok: false, error: "Confirme seu cadastro antes de entrar." };
  const hash = await hashPassword(senha);
  if (hash !== user.senha_hash) return { ok: false, error: "E-mail ou senha incorretos." };

  const updated: LocalUser = { ...user, last_login_at: new Date().toISOString() };
  saveUsers(users.map((u) => (u.id === user.id ? updated : u)));
  write<LocalSession>(SESSION_KEY, { user_id: user.id, started_at: new Date().toISOString() });
  emitChange();
  return { ok: true, user: updated };
}

export function logoutLocalUser() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_KEY);
  }
  emitChange();
}

// Cache em memória do usuário "bridged" (sessão Supabase + role resolvida pelo backend).
// Preenchido por useLocalAuth para que chamadas estáticas (getCurrentRole/isSuperAdmin)
// também enxerguem a role correta — evita falso "owner sem empresa" em super_admin.
let bridgedUser: LocalUser | null = null;

export function setBridgedLocalUser(user: LocalUser | null) {
  const prev = bridgedUser;
  bridgedUser = user;
  const changed =
    (prev?.id ?? null) !== (user?.id ?? null) ||
    (prev?.role ?? null) !== (user?.role ?? null);
  if (changed) emitChange();
}

export function getCurrentLocalUser(): LocalUser | null {
  if (bridgedUser) return bridgedUser;
  const session = read<LocalSession | null>(SESSION_KEY, null);
  if (!session) return null;
  return listLocalUsers().find((u) => u.id === session.user_id) ?? null;
}

export function isAuthenticated(): boolean {
  return !!getCurrentLocalUser();
}

export function getCurrentRole(): LocalRole {
  // Cadastro público nunca cria super_admin: o padrão seguro é "owner".
  // Super admin é determinado por allowlist de e-mail (ver super-admin.ts)
  // e aplicado em useLocalAuth ao bridge com a sessão Supabase.
  return getCurrentLocalUser()?.role ?? "owner";
}

export function isSuperAdmin(): boolean {
  return getCurrentRole() === "super_admin";
}

export function isOwner(): boolean {
  return getCurrentRole() === "owner";
}

export function requestPasswordResetLocal(email: string): { ok: boolean; code?: string; error?: string } {
  const e = email.trim().toLowerCase();
  const user = listLocalUsers().find((u) => u.email.toLowerCase() === e);
  if (!user) return { ok: false, error: "E-mail não encontrado." };
  const code = generateLocalConfirmationCode();
  const codes = listCodes().filter(
    (c) => !(c.email.toLowerCase() === e && c.kind === "reset"),
  );
  codes.push({ email: e, code, kind: "reset", created_at: new Date().toISOString() });
  saveCodes(codes);
  return { ok: true, code };
}

export async function updateLocalPassword(
  email: string,
  code: string,
  newSenha: string,
): Promise<{ ok: boolean; error?: string }> {
  const e = email.trim().toLowerCase();
  if (!newSenha || newSenha.length < 6)
    return { ok: false, error: "Senha mínima de 6 caracteres." };
  const codes = listCodes();
  const found = codes.find(
    (c) => c.email.toLowerCase() === e && c.kind === "reset" && c.code === code.trim(),
  );
  if (!found) return { ok: false, error: "Código inválido." };
  const users = listLocalUsers();
  const user = users.find((u) => u.email.toLowerCase() === e);
  if (!user) return { ok: false, error: "Usuário não encontrado." };
  const hash = await hashPassword(newSenha);
  saveUsers(
    users.map((u) =>
      u.id === user.id
        ? { ...u, senha_hash: hash, updated_at: new Date().toISOString() }
        : u,
    ),
  );
  saveCodes(codes.filter((c) => c !== found));
  return { ok: true };
}

// Apenas para protótipo: trocar perfil da sessão atual.
export function setSessionRoleLocal(role: LocalRole) {
  const user = getCurrentLocalUser();
  if (!user) {
    // criar/ativar usuário "demo" para permitir teste sem cadastro
    const users = listLocalUsers();
    const demo: LocalUser = {
      id: `local_demo_${role}`,
      nome: role === "super_admin" ? "Admin Demo" : "Dono Demo",
      email: `${role}@demo.local`,
      whatsapp: "—",
      senha_hash: "",
      role,
      status: "ativo",
      email_confirmed: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const exists = users.find((u) => u.id === demo.id);
    const nextUsers = exists ? users.map((u) => (u.id === demo.id ? demo : u)) : [...users, demo];
    saveUsers(nextUsers);
    write<LocalSession>(SESSION_KEY, { user_id: demo.id, started_at: new Date().toISOString() });
  } else {
    const users = listLocalUsers();
    saveUsers(
      users.map((u) => (u.id === user.id ? { ...u, role, updated_at: new Date().toISOString() } : u)),
    );
  }
  emitChange();
}
