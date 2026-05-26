// Catálogo local de servidores/painéis (preview-only, localStorage).
// Nenhuma chamada externa. Não faz login automático em painel.

export type ServerStatus = "ativo" | "inativo";

export type ServerEntry = {
  id: string;
  name: string;
  color: string; // hex ou token
  panel_url?: string;
  panel_username?: string;
  panel_password?: string;
  notes?: string;
  status: ServerStatus;
  created_at: string;
  updated_at: string;
};

const STORAGE_KEY = "cobranca_ia_server_catalog_v1";
export const SERVER_CATALOG_EVENT = "cobranca_ia_server_catalog:changed";

const DEFAULT_COLORS = [
  "#6366f1", // indigo - Lunar
  "#f59e0b", // amber - Solar
  "#10b981", // emerald - Principal
  "#3b82f6", // blue - Alternativo
  "#a855f7", // purple - Teste
  "#64748b", // slate - Outro
];

const DEFAULTS: { name: string; color: string }[] = [
  { name: "Lunar", color: DEFAULT_COLORS[0] },
  { name: "Solar", color: DEFAULT_COLORS[1] },
  { name: "Principal", color: DEFAULT_COLORS[2] },
  { name: "Alternativo", color: DEFAULT_COLORS[3] },
  { name: "Teste", color: DEFAULT_COLORS[4] },
  { name: "Outro", color: DEFAULT_COLORS[5] },
];

function nowIso() {
  return new Date().toISOString();
}

export function newServerId(): string {
  return `srv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readRaw(): ServerEntry[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(isValid);
  } catch {
    return null;
  }
}

function writeRaw(list: ServerEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(SERVER_CATALOG_EVENT));
  } catch {
    /* noop */
  }
}

function isValid(s: unknown): s is ServerEntry {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.color === "string" &&
    (o.status === "ativo" || o.status === "inativo")
  );
}

function buildDefaults(): ServerEntry[] {
  const t = nowIso();
  return DEFAULTS.map((d) => ({
    id: newServerId(),
    name: d.name,
    color: d.color,
    status: "ativo" as const,
    created_at: t,
    updated_at: t,
  }));
}

export function listServers(): ServerEntry[] {
  const cur = readRaw();
  if (cur) return cur;
  const defaults = buildDefaults();
  writeRaw(defaults);
  return defaults;
}

export function listActiveServers(): ServerEntry[] {
  return listServers().filter((s) => s.status === "ativo");
}

export function getServerById(id?: string | null): ServerEntry | null {
  if (!id) return null;
  return listServers().find((s) => s.id === id) ?? null;
}

export function saveServer(s: ServerEntry): void {
  const list = listServers();
  const idx = list.findIndex((x) => x.id === s.id);
  const t = nowIso();
  const next = { ...s, updated_at: t, created_at: s.created_at || t };
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  writeRaw(list);
}

export function archiveServer(id: string): void {
  const list = listServers().map((s) =>
    s.id === id ? { ...s, status: "inativo" as const, updated_at: nowIso() } : s,
  );
  writeRaw(list);
}

export function reactivateServer(id: string): void {
  const list = listServers().map((s) =>
    s.id === id ? { ...s, status: "ativo" as const, updated_at: nowIso() } : s,
  );
  writeRaw(list);
}

export function deleteServer(id: string): void {
  const list = listServers().filter((s) => s.id !== id);
  writeRaw(list);
}

export function restoreDefaultServers(): void {
  const cur = listServers();
  const byName = new Map(cur.map((s) => [s.name.toLowerCase(), s]));
  const t = nowIso();
  for (const d of DEFAULTS) {
    const exist = byName.get(d.name.toLowerCase());
    if (!exist) {
      cur.push({
        id: newServerId(),
        name: d.name,
        color: d.color,
        status: "ativo",
        created_at: t,
        updated_at: t,
      });
    } else if (exist.status === "inativo") {
      exist.status = "ativo";
      exist.updated_at = t;
    }
  }
  writeRaw(cur);
}

export type ServerBackupFile = {
  type: "cobranca-ia/server-catalog";
  version: 1;
  generated_at: string;
  servers: ServerEntry[];
};

export function exportServers(): ServerBackupFile {
  return {
    type: "cobranca-ia/server-catalog",
    version: 1,
    generated_at: nowIso(),
    servers: listServers(),
  };
}

export type ServerImportResult =
  | { ok: true; servers: ServerEntry[] }
  | { ok: false; error: string };

export function parseServerBackup(raw: string): ServerImportResult {
  try {
    const json = JSON.parse(raw);
    if (json && Array.isArray(json.servers)) {
      const servers = (json.servers as unknown[]).filter(isValid) as ServerEntry[];
      return { ok: true, servers };
    }
    if (Array.isArray(json)) {
      const servers = (json as unknown[]).filter(isValid) as ServerEntry[];
      return { ok: true, servers };
    }
    return { ok: false, error: "Formato não reconhecido." };
  } catch {
    return { ok: false, error: "JSON inválido." };
  }
}

export function importServers(
  servers: ServerEntry[],
  mode: "merge" | "replace",
): void {
  if (mode === "replace") {
    writeRaw(servers);
    return;
  }
  const cur = listServers();
  const byId = new Map(cur.map((s) => [s.id, s]));
  for (const s of servers) byId.set(s.id, s);
  writeRaw(Array.from(byId.values()));
}

// Helpers para badge
export function serverBadgeStyle(color: string): {
  backgroundColor: string;
  color: string;
  borderColor: string;
} {
  return {
    backgroundColor: color + "22",
    color: color,
    borderColor: color + "66",
  };
}

export function maskSecret(value?: string): string {
  if (!value) return "—";
  if (value.length <= 2) return "••";
  return "•".repeat(Math.max(4, value.length - 2)) + value.slice(-2);
}

export function formatServerAsText(
  s: ServerEntry,
  opts: { revealSecrets?: boolean } = {},
): string {
  const lines = [
    `Servidor: ${s.name}`,
    s.panel_url ? `Painel: ${s.panel_url}` : null,
    s.panel_username ? `Usuário: ${s.panel_username}` : null,
    s.panel_password
      ? `Senha: ${opts.revealSecrets ? s.panel_password : maskSecret(s.panel_password)}`
      : null,
    s.notes ? `Observações: ${s.notes}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

// ----- helpers para integração com Telas/Campanhas -----

export type ServerLite = { id: string; name: string };

/** IDs únicos de servidores presentes nas telas (ativas/arquivadas inclusive). */
export function serverIdsFromScreens(
  screens: { server_ids?: string[] }[],
): string[] {
  const set = new Set<string>();
  for (const s of screens) for (const id of s.server_ids ?? []) set.add(id);
  return Array.from(set);
}

/** Lista resumida (nome+id) dos servidores referenciados pelas telas. */
export function serversFromScreens(
  screens: { server_ids?: string[] }[],
): ServerLite[] {
  const ids = serverIdsFromScreens(screens);
  return ids
    .map((id) => getServerById(id))
    .filter((s): s is ServerEntry => !!s)
    .map((s) => ({ id: s.id, name: s.name }));
}

/** True se as telas têm pelo menos um vínculo com o servidor `id`. */
export function screensHaveServer(
  screens: { server_ids?: string[] }[],
  id: string,
): boolean {
  if (id === "__none__") {
    return screens.some((s) => (s.server_ids ?? []).length === 0);
  }
  return screens.some((s) => (s.server_ids ?? []).includes(id));
}

export type ServerTemplateVars = {
  servidor: string;
  painel: string;
  usuario_painel: string;
  senha_painel: string;
  link_lista: string;
  usuario_lista: string;
  senha_lista: string;
};

/**
 * Variáveis de servidor para uma tela específica.
 * Usa o `primary_server_id` (ou o primeiro de `server_ids`) como contexto.
 * Senhas voltam mascaradas por padrão — só revele com confirmação do usuário.
 */
export function buildServerVarsForScreen(
  screen: {
    server_ids?: string[];
    primary_server_id?: string;
    list_server_url?: string;
    list_username?: string;
    list_password?: string;
  },
  opts: { revealSecrets?: boolean } = {},
): ServerTemplateVars {
  const reveal = !!opts.revealSecrets;
  const id =
    screen.primary_server_id ||
    (screen.server_ids && screen.server_ids[0]) ||
    "";
  const s = id ? getServerById(id) : null;
  return {
    servidor: s?.name ?? "",
    painel: s?.panel_url ?? "",
    usuario_painel: s?.panel_username ?? "",
    senha_painel: s?.panel_password
      ? (reveal ? s.panel_password : maskSecret(s.panel_password))
      : "",
    link_lista: screen.list_server_url ?? "",
    usuario_lista: screen.list_username ?? "",
    senha_lista: screen.list_password
      ? (reveal ? screen.list_password : maskSecret(screen.list_password))
      : "",
  };
}
