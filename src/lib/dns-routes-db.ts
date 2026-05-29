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

/** Pulls DB into the local cache. Call on admin page mount. */
export async function hydrateDnsFromDb(companyId: string): Promise<void> {
  const [domains, routes] = await Promise.all([
    listDnsDomainsServer({ data: { company_id: companyId } }),
    listDnsRoutesServer({ data: { company_id: companyId } }),
  ]);
  writeCache(DNS_DOMAINS_KEY, (domains as DbDomain[]).map(dbDomainToLocal));
  writeCache(DNS_ROUTES_KEY, (routes as DbRoute[]).map(dbRouteToLocal));
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
