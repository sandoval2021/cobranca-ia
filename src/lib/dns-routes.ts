// DNS e Rotas (Super Admin) — 100% local/frontend/localStorage.
// Nenhuma chamada a Cloudflare, Registro.br, Hostinger, GoDaddy ou qualquer
// API DNS externa é realizada. Esta tela apenas organiza dados.

import { listAllScreens } from "@/lib/app-screens";

export const DNS_DOMAINS_KEY = "cobranca_ia_dns_domains_v1";
export const DNS_ROUTES_KEY = "cobranca_ia_dns_routes_v1";
export const DNS_HISTORY_KEY = "cobranca_ia_dns_route_history_v1";
export const DNS_ROUTES_EVENT = "cobranca_ia_dns_routes:changed";

export type DnsProvider = "cloudflare" | "registrobr" | "hostinger" | "godaddy" | "outro";
export const DNS_PROVIDERS: { value: DnsProvider; label: string }[] = [
  { value: "cloudflare", label: "Cloudflare" },
  { value: "registrobr", label: "Registro.br" },
  { value: "hostinger", label: "Hostinger" },
  { value: "godaddy", label: "GoDaddy" },
  { value: "outro", label: "Outro" },
];

export type DomainStatus = "ativo" | "em_configuracao" | "pausado" | "erro";
export const DOMAIN_STATUSES: { value: DomainStatus; label: string }[] = [
  { value: "ativo", label: "Ativo" },
  { value: "em_configuracao", label: "Em configuração" },
  { value: "pausado", label: "Pausado" },
  { value: "erro", label: "Erro" },
];

export type DnsRecordType = "A" | "CNAME" | "TXT" | "OUTRO";
export const DNS_RECORD_TYPES: { value: DnsRecordType; label: string }[] = [
  { value: "A", label: "A" },
  { value: "CNAME", label: "CNAME" },
  { value: "TXT", label: "TXT" },
  { value: "OUTRO", label: "Outro" },
];

export type DnsEnvironment = "producao" | "teste" | "reserva";
export const DNS_ENVIRONMENTS: { value: DnsEnvironment; label: string }[] = [
  { value: "producao", label: "Produção" },
  { value: "teste", label: "Teste" },
  { value: "reserva", label: "Reserva" },
];

export type DnsRouteStatus =
  | "ativo"
  | "aguardando_dns"
  | "manutencao"
  | "erro"
  | "desativado";
export const DNS_ROUTE_STATUSES: { value: DnsRouteStatus; label: string }[] = [
  { value: "ativo", label: "Ativo" },
  { value: "aguardando_dns", label: "Aguardando DNS" },
  { value: "manutencao", label: "Em manutenção" },
  { value: "erro", label: "Erro" },
  { value: "desativado", label: "Desativado" },
];

export type DnsDomain = {
  id: string;
  domain: string;
  provider: DnsProvider;
  status: DomainStatus;
  notes?: string;
  archived?: boolean;
  created_at: string;
  updated_at: string;
};

export type DnsRoute = {
  id: string;
  domain_id: string;
  subdomain: string; // pode ser "" para apex
  host: string; // host completo gerado
  server_id?: string;
  record_type: DnsRecordType;
  value: string; // destino atual
  previous_value?: string;
  active: boolean;
  is_primary: boolean;
  is_backup: boolean;
  environment: DnsEnvironment;
  status: DnsRouteStatus;
  notes?: string;
  archived?: boolean;
  created_at: string;
  updated_at: string;
};

export type DnsRouteHistory = {
  id: string;
  at: string;
  domain?: string;
  subdomain?: string;
  host?: string;
  server_id?: string;
  old_value?: string;
  new_value?: string;
  reason?: string;
  responsible?: string;
  status?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readArr<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeArr<T>(key: string, list: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
    window.dispatchEvent(new Event(DNS_ROUTES_EVENT));
  } catch {
    /* noop */
  }
}

export function buildHost(subdomain: string, domain: string): string {
  const sub = (subdomain || "").trim().replace(/^\.+|\.+$/g, "");
  const dom = (domain || "").trim().replace(/^\.+|\.+$/g, "");
  if (!dom) return sub;
  return sub ? `${sub}.${dom}` : dom;
}

// ===== Domains ============================================================

export function listDomains(includeArchived = false): DnsDomain[] {
  const all = readArr<DnsDomain>(DNS_DOMAINS_KEY);
  return includeArchived ? all : all.filter((d) => !d.archived);
}

export function getDomainById(id?: string | null): DnsDomain | null {
  if (!id) return null;
  return readArr<DnsDomain>(DNS_DOMAINS_KEY).find((d) => d.id === id) ?? null;
}

export function saveDomain(input: Partial<DnsDomain> & { domain: string }): DnsDomain {
  const list = readArr<DnsDomain>(DNS_DOMAINS_KEY);
  const t = nowIso();
  if (input.id) {
    const idx = list.findIndex((d) => d.id === input.id);
    if (idx >= 0) {
      const next: DnsDomain = {
        ...list[idx],
        ...input,
        updated_at: t,
      } as DnsDomain;
      list[idx] = next;
      writeArr(DNS_DOMAINS_KEY, list);
      return next;
    }
  }
  const created: DnsDomain = {
    id: newId("dom"),
    domain: input.domain.trim().toLowerCase(),
    provider: (input.provider as DnsProvider) ?? "outro",
    status: (input.status as DomainStatus) ?? "em_configuracao",
    notes: input.notes,
    archived: false,
    created_at: t,
    updated_at: t,
  };
  list.push(created);
  writeArr(DNS_DOMAINS_KEY, list);
  return created;
}

export function updateDomain(id: string, patch: Partial<DnsDomain>): DnsDomain | null {
  const list = readArr<DnsDomain>(DNS_DOMAINS_KEY);
  const idx = list.findIndex((d) => d.id === id);
  if (idx < 0) return null;
  const next: DnsDomain = { ...list[idx], ...patch, updated_at: nowIso() };
  list[idx] = next;
  writeArr(DNS_DOMAINS_KEY, list);
  return next;
}

export function archiveDomain(id: string): void {
  updateDomain(id, { archived: true, status: "pausado" });
}

export function deleteDomain(id: string): void {
  const list = readArr<DnsDomain>(DNS_DOMAINS_KEY).filter((d) => d.id !== id);
  writeArr(DNS_DOMAINS_KEY, list);
}

// ===== Routes =============================================================

export function listDnsRoutes(includeArchived = false): DnsRoute[] {
  const all = readArr<DnsRoute>(DNS_ROUTES_KEY);
  return includeArchived ? all : all.filter((r) => !r.archived);
}

export function getDnsRouteById(id?: string | null): DnsRoute | null {
  if (!id) return null;
  return readArr<DnsRoute>(DNS_ROUTES_KEY).find((r) => r.id === id) ?? null;
}

export type SaveRouteOptions = {
  reason?: string;
  responsible?: string;
  forcePrimaryReplace?: boolean;
};

export function saveDnsRoute(
  input: Partial<DnsRoute> & { domain_id: string; subdomain: string },
  opts: SaveRouteOptions = {},
): { route: DnsRoute; replacedPrimary?: DnsRoute } {
  const list = readArr<DnsRoute>(DNS_ROUTES_KEY);
  const t = nowIso();
  const domain = getDomainById(input.domain_id);
  const host = buildHost(input.subdomain, domain?.domain ?? "");
  let replacedPrimary: DnsRoute | undefined;

  let saved: DnsRoute;

  if (input.id) {
    const idx = list.findIndex((r) => r.id === input.id);
    if (idx >= 0) {
      const prev = list[idx];
      const valueChanged = input.value !== undefined && input.value !== prev.value;
      const next: DnsRoute = {
        ...prev,
        ...input,
        host,
        previous_value: valueChanged ? prev.value : prev.previous_value,
        updated_at: t,
      } as DnsRoute;
      list[idx] = next;
      saved = next;
    } else {
      // fallthrough to create
      saved = createNewRoute(list, input, host, t);
    }
  } else {
    saved = createNewRoute(list, input, host, t);
  }

  // Garantir uma única rota principal ativa por servidor
  if (saved.is_primary && saved.server_id && opts.forcePrimaryReplace) {
    list.forEach((r) => {
      if (
        r.id !== saved.id &&
        r.server_id === saved.server_id &&
        r.is_primary &&
        !r.archived
      ) {
        replacedPrimary = r;
        r.is_primary = false;
        r.is_backup = true;
        r.updated_at = t;
      }
    });
  }

  writeArr(DNS_ROUTES_KEY, list);

  // Histórico
  registerDnsRouteChange({
    domain: domain?.domain,
    subdomain: saved.subdomain,
    host: saved.host,
    server_id: saved.server_id,
    old_value: saved.previous_value,
    new_value: saved.value,
    reason: opts.reason,
    responsible: opts.responsible,
    status: saved.status,
  });

  return { route: saved, replacedPrimary };
}

function createNewRoute(
  list: DnsRoute[],
  input: Partial<DnsRoute> & { domain_id: string; subdomain: string },
  host: string,
  t: string,
): DnsRoute {
  const created: DnsRoute = {
    id: newId("rt"),
    domain_id: input.domain_id,
    subdomain: (input.subdomain || "").trim().toLowerCase(),
    host,
    server_id: input.server_id,
    record_type: (input.record_type as DnsRecordType) ?? "CNAME",
    value: (input.value || "").trim(),
    previous_value: undefined,
    active: input.active ?? true,
    is_primary: input.is_primary ?? false,
    is_backup: input.is_backup ?? false,
    environment: (input.environment as DnsEnvironment) ?? "producao",
    status: (input.status as DnsRouteStatus) ?? "aguardando_dns",
    notes: input.notes,
    archived: false,
    created_at: t,
    updated_at: t,
  };
  list.push(created);
  return created;
}

export function updateDnsRoute(
  id: string,
  patch: Partial<DnsRoute>,
  opts: SaveRouteOptions = {},
): DnsRoute | null {
  const existing = getDnsRouteById(id);
  if (!existing) return null;
  const res = saveDnsRoute({ ...existing, ...patch, id }, opts);
  return res.route;
}

export function archiveDnsRoute(id: string): void {
  updateDnsRoute(id, { archived: true, active: false, status: "desativado" });
}

export function deleteDnsRoute(id: string): void {
  const list = readArr<DnsRoute>(DNS_ROUTES_KEY).filter((r) => r.id !== id);
  writeArr(DNS_ROUTES_KEY, list);
}

export function hasPrimaryConflict(serverId: string, exceptRouteId?: string): DnsRoute | null {
  if (!serverId) return null;
  return (
    listDnsRoutes().find(
      (r) => r.server_id === serverId && r.is_primary && r.active && r.id !== exceptRouteId,
    ) ?? null
  );
}

// ===== Lookups ============================================================

export function getRoutesByServer(serverId: string): DnsRoute[] {
  if (!serverId) return [];
  return listDnsRoutes().filter((r) => r.server_id === serverId);
}

export function getPrimaryRouteForServer(serverId: string): DnsRoute | null {
  return (
    listDnsRoutes().find(
      (r) => r.server_id === serverId && r.is_primary && r.active && !r.archived,
    ) ?? null
  );
}

export function getBackupRoutesForServer(serverId: string): DnsRoute[] {
  return listDnsRoutes().filter(
    (r) => r.server_id === serverId && !r.is_primary && !r.archived,
  );
}

export function buildServerPublicLink(serverId: string): string | null {
  const r = getPrimaryRouteForServer(serverId);
  if (!r) return null;
  const host = r.host || r.value;
  if (!host) return null;
  if (/^https?:\/\//i.test(host)) return host;
  return `https://${host}`;
}

// ===== History ============================================================

export function listRouteHistory(): DnsRouteHistory[] {
  return readArr<DnsRouteHistory>(DNS_HISTORY_KEY).sort((a, b) =>
    b.at.localeCompare(a.at),
  );
}

export function registerDnsRouteChange(entry: Omit<DnsRouteHistory, "id" | "at"> & { at?: string }): DnsRouteHistory {
  const list = readArr<DnsRouteHistory>(DNS_HISTORY_KEY);
  const created: DnsRouteHistory = {
    id: newId("hist"),
    at: entry.at ?? nowIso(),
    domain: entry.domain,
    subdomain: entry.subdomain,
    host: entry.host,
    server_id: entry.server_id,
    old_value: entry.old_value,
    new_value: entry.new_value,
    reason: entry.reason,
    responsible: entry.responsible,
    status: entry.status,
  };
  list.unshift(created);
  // limitar tamanho do histórico
  const trimmed = list.slice(0, 500);
  writeArr(DNS_HISTORY_KEY, trimmed);
  return created;
}

export function clearRouteHistory(): void {
  writeArr(DNS_HISTORY_KEY, []);
}

// ===== Impact simulator ===================================================

export type RouteImpact = {
  serverId?: string;
  affectedCustomers: string[];
  affectedScreens: number;
  currentValue: string;
  previousValue?: string;
};

export function computeRouteImpact(route: DnsRoute): RouteImpact {
  const screensByCustomer = (() => {
    try {
      return listAllScreens();
    } catch {
      return {};
    }
  })();
  const affectedCustomers: string[] = [];
  let affectedScreens = 0;
  if (route.server_id) {
    for (const [customerId, screens] of Object.entries(screensByCustomer)) {
      const hits = (screens || []).filter(
        (s) =>
          s.primary_server_id === route.server_id ||
          (Array.isArray(s.server_ids) && s.server_ids.includes(route.server_id!)),
      );
      if (hits.length > 0) {
        affectedCustomers.push(customerId);
        affectedScreens += hits.length;
      }
    }
  }
  return {
    serverId: route.server_id,
    affectedCustomers,
    affectedScreens,
    currentValue: route.value,
    previousValue: route.previous_value,
  };
}

// ===== Export / Import ====================================================

export type DnsRoutesExport = {
  type: "cobranca-ia/dns-routes";
  version: 1;
  generated_at: string;
  domains: DnsDomain[];
  routes: DnsRoute[];
  history: DnsRouteHistory[];
};

export function exportDnsRoutes(): DnsRoutesExport {
  return {
    type: "cobranca-ia/dns-routes",
    version: 1,
    generated_at: nowIso(),
    domains: readArr<DnsDomain>(DNS_DOMAINS_KEY),
    routes: readArr<DnsRoute>(DNS_ROUTES_KEY),
    history: readArr<DnsRouteHistory>(DNS_HISTORY_KEY),
  };
}

export type DnsRoutesImportResult =
  | { ok: true; data: DnsRoutesExport }
  | { ok: false; error: string };

export function parseDnsRoutesBackup(raw: string): DnsRoutesImportResult {
  try {
    const json = JSON.parse(raw);
    if (!json || typeof json !== "object") return { ok: false, error: "Formato inválido." };
    const domains = Array.isArray(json.domains) ? (json.domains as DnsDomain[]) : [];
    const routes = Array.isArray(json.routes) ? (json.routes as DnsRoute[]) : [];
    const history = Array.isArray(json.history) ? (json.history as DnsRouteHistory[]) : [];
    return {
      ok: true,
      data: {
        type: "cobranca-ia/dns-routes",
        version: 1,
        generated_at: typeof json.generated_at === "string" ? json.generated_at : nowIso(),
        domains,
        routes,
        history,
      },
    };
  } catch {
    return { ok: false, error: "JSON inválido." };
  }
}

export function importDnsRoutes(
  data: DnsRoutesExport,
  mode: "merge" | "replace",
): { domains: number; routes: number; history: number } {
  if (mode === "replace") {
    writeArr(DNS_DOMAINS_KEY, data.domains);
    writeArr(DNS_ROUTES_KEY, data.routes);
    writeArr(DNS_HISTORY_KEY, data.history);
    return {
      domains: data.domains.length,
      routes: data.routes.length,
      history: data.history.length,
    };
  }
  const curDom = readArr<DnsDomain>(DNS_DOMAINS_KEY);
  const curRt = readArr<DnsRoute>(DNS_ROUTES_KEY);
  const curHist = readArr<DnsRouteHistory>(DNS_HISTORY_KEY);
  const mergeBy = <T extends { id: string }>(cur: T[], inc: T[]) => {
    const map = new Map(cur.map((x) => [x.id, x]));
    for (const it of inc) map.set(it.id, { ...map.get(it.id), ...it });
    return Array.from(map.values());
  };
  const nextDom = mergeBy(curDom, data.domains);
  const nextRt = mergeBy(curRt, data.routes);
  const nextHist = mergeBy(curHist, data.history);
  writeArr(DNS_DOMAINS_KEY, nextDom);
  writeArr(DNS_ROUTES_KEY, nextRt);
  writeArr(DNS_HISTORY_KEY, nextHist);
  return {
    domains: data.domains.length,
    routes: data.routes.length,
    history: data.history.length,
  };
}

// ===== Message variables ==================================================

export function getDnsVariablesForServer(serverId?: string | null): {
  dominio: string;
  subdominio: string;
  rota_publica: string;
  servidor_rota: string;
  link_publico: string;
} {
  const NA = "não informado";
  if (!serverId) {
    return {
      dominio: NA,
      subdominio: NA,
      rota_publica: NA,
      servidor_rota: NA,
      link_publico: NA,
    };
  }
  const route = getPrimaryRouteForServer(serverId);
  if (!route) {
    return {
      dominio: NA,
      subdominio: NA,
      rota_publica: NA,
      servidor_rota: NA,
      link_publico: NA,
    };
  }
  const domain = getDomainById(route.domain_id);
  const link = buildServerPublicLink(serverId) ?? NA;
  return {
    dominio: domain?.domain || NA,
    subdominio: route.subdomain || NA,
    rota_publica: route.host || NA,
    servidor_rota: route.host || NA,
    link_publico: link,
  };
}
