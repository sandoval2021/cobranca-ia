// DB sync layer for dns_domains / dns_routes.
// Source of truth = database. localStorage = UI cache for sync read access.
// On hydrate: pull DB → cache. On mutation: push to DB AND update cache.

import {
  DNS_DOMAINS_KEY, DNS_ROUTES_KEY, DNS_ROUTES_EVENT,
  type DnsDomain, type DnsRoute,
} from "@/lib/dns-routes";
import {
  listDnsDomainsServer, listDnsRoutesServer,
  upsertDnsDomainServer, upsertDnsRouteServer,
  deleteDnsDomainServer, deleteDnsRouteServer,
} from "@/lib/dns/dns.functions";

function writeCache<T>(key: string, list: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
    window.dispatchEvent(new Event(DNS_ROUTES_EVENT));
  } catch {/* noop */}
}

type DbDomain = {
  id: string; company_id: string; domain: string; provider: string;
  status: string; notes: string | null; archived: boolean;
  created_at: string; updated_at: string;
};
type DbRoute = {
  id: string; company_id: string; domain_id: string; server_id: string | null;
  subdomain: string; host: string; destination: string; previous_value: string | null;
  record_type: string; environment: string; is_active: boolean;
  is_primary: boolean; is_backup: boolean; status: string; notes: string | null;
  archived: boolean; created_at: string; updated_at: string;
};

function dbDomainToLocal(d: DbDomain): DnsDomain {
  return {
    id: d.id, domain: d.domain, provider: d.provider as DnsDomain["provider"],
    status: d.status as DnsDomain["status"], notes: d.notes ?? undefined,
    archived: d.archived, created_at: d.created_at, updated_at: d.updated_at,
  };
}
function dbRouteToLocal(r: DbRoute): DnsRoute {
  return {
    id: r.id, domain_id: r.domain_id, subdomain: r.subdomain, host: r.host,
    server_id: r.server_id ?? undefined,
    record_type: r.record_type as DnsRoute["record_type"],
    value: r.destination, previous_value: r.previous_value ?? undefined,
    active: r.is_active, is_primary: r.is_primary, is_backup: r.is_backup,
    environment: r.environment as DnsRoute["environment"],
    status: r.status as DnsRoute["status"], notes: r.notes ?? undefined,
    archived: r.archived, created_at: r.created_at, updated_at: r.updated_at,
  };
}

export type HydrateResult = {
  status: "ok" | "pending_local";
  dbDomains: number;
  dbRoutes: number;
  localDomains: number;
  localRoutes: number;
};

function readLocal<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch { return []; }
}

/**
 * Pulls DB into the local cache.
 * Non-destructive: when DB is empty but localStorage has data, returns
 * status "pending_local" WITHOUT overwriting the cache. UI must offer
 * recovery (push local → DB) or explicit discard.
 */
export async function hydrateDnsFromDb(companyId: string): Promise<HydrateResult> {
  const [domains, routes] = await Promise.all([
    listDnsDomainsServer({ data: { company_id: companyId } }),
    listDnsRoutesServer({ data: { company_id: companyId } }),
  ]);
  const dbD = (domains as DbDomain[]).map(dbDomainToLocal);
  const dbR = (routes as DbRoute[]).map(dbRouteToLocal);
  const localD = readLocal<DnsDomain>(DNS_DOMAINS_KEY);
  const localR = readLocal<DnsRoute>(DNS_ROUTES_KEY);

  // Anti-destructive guard
  if (dbD.length === 0 && dbR.length === 0 && (localD.length > 0 || localR.length > 0)) {
    return {
      status: "pending_local",
      dbDomains: 0, dbRoutes: 0,
      localDomains: localD.length, localRoutes: localR.length,
    };
  }

  writeCache(DNS_DOMAINS_KEY, dbD);
  writeCache(DNS_ROUTES_KEY, dbR);
  return {
    status: "ok",
    dbDomains: dbD.length, dbRoutes: dbR.length,
    localDomains: localD.length, localRoutes: localR.length,
  };
}

/** Clears local cache. Used by the explicit "Descartar dados locais" action. */
export function discardLocalDnsCache(): void {
  writeCache(DNS_DOMAINS_KEY, []);
  writeCache(DNS_ROUTES_KEY, []);
}

/**
 * Uploads everything currently in localStorage to the DB for the given
 * company. Skips routes without domain_id or company_id, validates that
 * referenced domains exist, then re-hydrates from the DB.
 */
export async function pushLocalDnsToDb(
  companyId: string,
): Promise<{ domains: number; routes: number; skippedRoutes: number; errors: string[] }> {
  if (!companyId) throw new Error("company_id obrigatório");
  const localD = readLocal<DnsDomain>(DNS_DOMAINS_KEY);
  const localR = readLocal<DnsRoute>(DNS_ROUTES_KEY);
  const errors: string[] = [];

  // map old-id → new-id so routes still link to the right domain after upsert
  const domainIdMap = new Map<string, string>();
  let domainsSaved = 0;
  for (const d of localD) {
    try {
      const saved = await pushDomainToDb(companyId, d);
      domainIdMap.set(d.id, saved.id);
      domainsSaved++;
    } catch (e: unknown) {
      errors.push(`Domínio "${d.domain}": ${(e as Error)?.message ?? String(e)}`);
    }
  }

  let routesSaved = 0;
  let skippedRoutes = 0;
  for (const r of localR) {
    if (!r.domain_id) { skippedRoutes++; continue; }
    const newDomainId = domainIdMap.get(r.domain_id) ?? r.domain_id;
    // ensure target domain exists either by mapping or was already a uuid present
    if (!domainIdMap.has(r.domain_id) && !/^[0-9a-f-]{36}$/i.test(r.domain_id)) {
      skippedRoutes++;
      continue;
    }
    try {
      await pushRouteToDb(companyId, { ...r, domain_id: newDomainId });
      routesSaved++;
    } catch (e: unknown) {
      errors.push(`Rota "${r.host || r.subdomain}": ${(e as Error)?.message ?? String(e)}`);
    }
  }

  // Re-hydrate now that DB has data
  await hydrateDnsFromDb(companyId);

  return { domains: domainsSaved, routes: routesSaved, skippedRoutes, errors };
}


export async function pushDomainToDb(companyId: string, d: DnsDomain): Promise<DnsDomain> {
  const isUuid = /^[0-9a-f-]{36}$/i.test(d.id);
  const row = await upsertDnsDomainServer({
    data: {
      company_id: companyId,
      input: {
        id: isUuid ? d.id : undefined,
        domain: d.domain, provider: d.provider, status: d.status,
        notes: d.notes ?? null, archived: !!d.archived,
      },
    },
  });
  return dbDomainToLocal(row as DbDomain);
}

export async function pushRouteToDb(companyId: string, r: DnsRoute): Promise<DnsRoute> {
  const isUuid = /^[0-9a-f-]{36}$/i.test(r.id);
  const row = await upsertDnsRouteServer({
    data: {
      company_id: companyId,
      input: {
        id: isUuid ? r.id : undefined,
        domain_id: r.domain_id,
        server_id: r.server_id && /^[0-9a-f-]{36}$/i.test(r.server_id) ? r.server_id : null,
        subdomain: r.subdomain || "", host: r.host || "",
        destination: r.value || "", previous_value: r.previous_value ?? null,
        record_type: r.record_type, environment: r.environment,
        is_active: !!r.active, is_primary: !!r.is_primary, is_backup: !!r.is_backup,
        status: r.status, notes: r.notes ?? null, archived: !!r.archived,
      },
    },
  });
  return dbRouteToLocal(row as DbRoute);
}

export async function removeDomainFromDb(companyId: string, id: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await deleteDnsDomainServer({ data: { company_id: companyId, id } });
}
export async function removeRouteFromDb(companyId: string, id: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await deleteDnsRouteServer({ data: { company_id: companyId, id } });
}
