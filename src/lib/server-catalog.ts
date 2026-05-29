// Catálogo de servidores — banco é a fonte da verdade (tabela public.servers).
// localStorage é apenas cache local para resposta instantânea no boot e
// trabalho offline. Toda mutação tenta gravar no banco; o cache é
// hidratado pelo hook `useServersSync` em src/lib/servers/useServersSync.ts.

import { toast } from "sonner";
import {
  upsertServerDb,
  setServerActiveDb,
  deleteServerDb,
  bulkUpsertServersDb,
} from "@/lib/servers/servers.functions";

export type ServerStatus = "ativo" | "inativo";

export type ServerEntry = {
  id: string;
  name: string;
  color: string;
  panel_url?: string;
  panel_username?: string;
  panel_password?: string;
  notes?: string;
  status: ServerStatus;
  created_at: string;
  updated_at: string;
};

const STORAGE_KEY_LEGACY = "cobranca_ia_server_catalog_v1";
export const SERVER_CATALOG_EVENT = "cobranca_ia_server_catalog:changed";
export const SERVER_CATALOG_SYNC_EVENT = "cobranca_ia_server_catalog:sync";

const DEFAULT_COLORS = [
  "#6366f1",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#a855f7",
  "#64748b",
];

export const SUGGESTED_SERVER_COLORS = DEFAULT_COLORS;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SyncState = {
  loaded: boolean; // já recebeu primeira resposta do banco neste boot?
  lastError: string | null;
};
const syncState: SyncState = { loaded: false, lastError: null };

function nowIso() {
  return new Date().toISOString();
}

function genUuid(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  // Fallback (não deveria ocorrer em navegadores modernos).
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ (Math.random() * 16) & (15 >> (Number(c) / 4))).toString(16),
  );
}

export function newServerId(): string {
  return genUuid();
}

function activeCompanyId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const cid = window.localStorage.getItem("cobranca_ia_active_company_id");
    if (!cid || cid === "null" || cid === "undefined") return null;
    return cid;
  } catch {
    return null;
  }
}

function isValidCompanyUuid(id: string | null): id is string {
  return !!id && UUID_RE.test(id);
}

function activeStorageKey(): string {
  const cid = activeCompanyId();
  if (cid) return `cobranca_ia_server_catalog_v2__${cid}`;
  return STORAGE_KEY_LEGACY;
}

function readRaw(): ServerEntry[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(activeStorageKey());
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
    window.localStorage.setItem(activeStorageKey(), JSON.stringify(list));
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

// ---------- Leitura (síncrona, lê do cache local) ----------

export function listServers(): ServerEntry[] {
  const cur = readRaw();
  if (cur) return cur;
  return [];
}

export function listActiveServers(): ServerEntry[] {
  return listServers().filter((s) => s.status === "ativo");
}

export function getServerById(id?: string | null): ServerEntry | null {
  if (!id) return null;
  return listServers().find((s) => s.id === id) ?? null;
}

// ---------- Mutações: cache local + persistência no banco ----------

function persistInBackground(
  fn: () => Promise<unknown>,
  failureMessage: string,
) {
  void (async () => {
    try {
      await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "erro";
      console.error("[server-catalog]", failureMessage, err);
      toast.error(`${failureMessage}. ${msg}`);
      markSyncError(msg);
    }
  })();
}

export function saveServer(s: ServerEntry): void {
  const cid = activeCompanyId();
  const list = listServers();
  const idx = list.findIndex((x) => x.id === s.id);
  const t = nowIso();
  // Garantir UUID válido — IDs legados (srv_xxx) não funcionam no banco.
  const id = UUID_RE.test(s.id) ? s.id : newServerId();
  const next: ServerEntry = { ...s, id, updated_at: t, created_at: s.created_at || t };
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  writeRaw(list);

  if (isValidCompanyUuid(cid)) {
    persistInBackground(
      () =>
        upsertServerDb({
          data: {
            id: UUID_RE.test(s.id) ? id : undefined, // novo no banco se ID era local
            companyId: cid,
            name: next.name,
            color: next.color,
            panel_url: next.panel_url ?? null,
            panel_username: next.panel_username ?? null,
            panel_password: next.panel_password ?? null,
            notes: next.notes ?? null,
            is_active: next.status === "ativo",
            sort_order: 0,
          },
        }),
      "Não foi possível salvar o servidor no servidor",
    );
  }
}

export function archiveServer(id: string): void {
  const cid = activeCompanyId();
  const list = listServers().map((s) =>
    s.id === id ? { ...s, status: "inativo" as const, updated_at: nowIso() } : s,
  );
  writeRaw(list);

  if (isValidCompanyUuid(cid) && UUID_RE.test(id)) {
    persistInBackground(
      () => setServerActiveDb({ data: { id, companyId: cid, is_active: false } }),
      "Não foi possível inativar o servidor",
    );
  }
}

export function reactivateServer(id: string): void {
  const cid = activeCompanyId();
  const list = listServers().map((s) =>
    s.id === id ? { ...s, status: "ativo" as const, updated_at: nowIso() } : s,
  );
  writeRaw(list);

  if (isValidCompanyUuid(cid) && UUID_RE.test(id)) {
    persistInBackground(
      () => setServerActiveDb({ data: { id, companyId: cid, is_active: true } }),
      "Não foi possível reativar o servidor",
    );
  }
}

export function deleteServer(id: string): void {
  const cid = activeCompanyId();
  const list = listServers().filter((s) => s.id !== id);
  writeRaw(list);

  if (isValidCompanyUuid(cid) && UUID_RE.test(id)) {
    persistInBackground(
      () => deleteServerDb({ data: { id, companyId: cid } }),
      "Não foi possível excluir o servidor",
    );
  }
}

export function restoreDefaultServers(): void {
  // Desativado: não há defaults globais. Cada empresa cadastra os seus.
}

// ---------- Sincronização com o banco ----------

/**
 * Hidrata o cache local com a lista vinda do banco.
 * Se o banco estiver vazio mas o cache tiver dados, NÃO sobrescreve —
 * apenas marca o estado como "carregado" para que a UI possa oferecer
 * migração dos dados locais. O usuário decide enviar via UI.
 */
export function hydrateFromDb(companyId: string, rows: ServerEntry[]): void {
  if (typeof window === "undefined") return;
  if (!isValidCompanyUuid(companyId)) return;
  const key = `cobranca_ia_server_catalog_v2__${companyId}`;
  const local = (() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return [] as ServerEntry[];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed.filter(isValid) as ServerEntry[]) : [];
    } catch {
      return [] as ServerEntry[];
    }
  })();

  if (rows.length === 0 && local.length > 0) {
    // Banco vazio + cache com dados → preserva cache, sinaliza pendência.
    syncState.loaded = true;
    syncState.lastError = null;
    window.dispatchEvent(
      new CustomEvent(SERVER_CATALOG_SYNC_EVENT, {
        detail: { loaded: true, pendingLocal: local.length, error: null },
      }),
    );
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(rows));
  } catch {
    /* noop */
  }
  syncState.loaded = true;
  syncState.lastError = null;
  window.dispatchEvent(new CustomEvent(SERVER_CATALOG_EVENT));
  window.dispatchEvent(
    new CustomEvent(SERVER_CATALOG_SYNC_EVENT, {
      detail: { loaded: true, pendingLocal: 0, error: null },
    }),
  );
}

export function markSyncError(message: string): void {
  syncState.lastError = message;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(SERVER_CATALOG_SYNC_EVENT, {
        detail: { loaded: syncState.loaded, error: message },
      }),
    );
  }
}

export function getSyncState(): SyncState {
  return { ...syncState };
}

/**
 * Envia os servidores que estão apenas no cache local para o banco.
 * Usado quando a primeira sync mostra banco vazio + dados locais.
 */
export async function uploadLocalServersToDb(): Promise<{ inserted: number; updated: number }> {
  const cid = activeCompanyId();
  if (!isValidCompanyUuid(cid)) throw new Error("Empresa inválida");
  const local = listServers();
  if (local.length === 0) return { inserted: 0, updated: 0 };
  const payload = local.map((s) => ({
    id: UUID_RE.test(s.id) ? s.id : undefined,
    name: s.name,
    color: s.color,
    panel_url: s.panel_url ?? null,
    panel_username: s.panel_username ?? null,
    panel_password: s.panel_password ?? null,
    notes: s.notes ?? null,
    is_active: s.status === "ativo",
    sort_order: 0,
  }));
  return bulkUpsertServersDb({ data: { companyId: cid, servers: payload } });
}

// ---------- Export / import / helpers ----------

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
  const cid = activeCompanyId();
  if (mode === "replace") {
    writeRaw(servers);
  } else {
    const cur = listServers();
    const byId = new Map(cur.map((s) => [s.id, s]));
    for (const s of servers) byId.set(s.id, s);
    writeRaw(Array.from(byId.values()));
  }
  // Após import, replica para o banco também.
  if (isValidCompanyUuid(cid)) {
    persistInBackground(
      () => uploadLocalServersToDb(),
      "Falha ao enviar servidores importados para o banco",
    );
  }
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

export function serverIdsFromScreens(
  screens: { server_ids?: string[] }[],
): string[] {
  const set = new Set<string>();
  for (const s of screens) for (const id of s.server_ids ?? []) set.add(id);
  return Array.from(set);
}

export function serversFromScreens(
  screens: { server_ids?: string[] }[],
): ServerLite[] {
  const ids = serverIdsFromScreens(screens);
  return ids
    .map((id) => getServerById(id))
    .filter((s): s is ServerEntry => !!s)
    .map((s) => ({ id: s.id, name: s.name }));
}

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
