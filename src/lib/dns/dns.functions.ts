// Server functions for dns_domains and dns_routes (admin/UI).
// DB is the source of truth; admin UI uses these to persist changes.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DomainInput = z.object({
  id: z.string().uuid().optional(),
  domain: z.string().min(1).max(253),
  provider: z.string().min(1).max(32).default("outro"),
  status: z.string().min(1).max(32).default("em_configuracao"),
  notes: z.string().max(2000).nullish(),
  archived: z.boolean().optional(),
});

const RouteInput = z.object({
  id: z.string().uuid().optional(),
  domain_id: z.string().uuid(),
  server_id: z.string().uuid().nullish(),
  subdomain: z.string().max(63).default(""),
  host: z.string().min(1).max(253),
  destination: z.string().max(253).default(""),
  previous_value: z.string().max(253).nullish(),
  record_type: z.string().min(1).max(16).default("CNAME"),
  environment: z.string().min(1).max(16).default("producao"),
  is_active: z.boolean().default(true),
  is_primary: z.boolean().default(false),
  is_backup: z.boolean().default(false),
  status: z.string().min(1).max(32).default("aguardando_dns"),
  notes: z.string().max(2000).nullish(),
  archived: z.boolean().optional(),
});

export const listDnsDomainsServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { company_id: string }) =>
    z.object({ company_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("dns_domains")
      .select("*")
      .eq("company_id", data.company_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertDnsDomainServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { company_id: string; input: z.infer<typeof DomainInput> }) =>
    z.object({ company_id: z.string().uuid(), input: DomainInput }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const payload = {
      company_id: data.company_id,
      domain: data.input.domain.trim().toLowerCase(),
      provider: data.input.provider,
      status: data.input.status,
      notes: data.input.notes ?? null,
      archived: data.input.archived ?? false,
    };
    if (data.input.id) {
      const { data: row, error } = await supabase
        .from("dns_domains")
        .update(payload)
        .eq("id", data.input.id)
        .eq("company_id", data.company_id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await supabase
      .from("dns_domains")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteDnsDomainServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { company_id: string; id: string }) =>
    z.object({ company_id: z.string().uuid(), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("dns_domains")
      .delete()
      .eq("id", data.id)
      .eq("company_id", data.company_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listDnsRoutesServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { company_id: string }) =>
    z.object({ company_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("dns_routes")
      .select("*")
      .eq("company_id", data.company_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertDnsRouteServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { company_id: string; input: z.infer<typeof RouteInput> }) =>
    z.object({ company_id: z.string().uuid(), input: RouteInput }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const payload = {
      company_id: data.company_id,
      domain_id: data.input.domain_id,
      server_id: data.input.server_id ?? null,
      subdomain: (data.input.subdomain || "").trim().toLowerCase(),
      host: data.input.host.trim().toLowerCase(),
      destination: data.input.destination ?? "",
      previous_value: data.input.previous_value ?? null,
      record_type: data.input.record_type,
      environment: data.input.environment,
      is_active: data.input.is_active,
      is_primary: data.input.is_primary,
      is_backup: data.input.is_backup,
      status: data.input.status,
      notes: data.input.notes ?? null,
      archived: data.input.archived ?? false,
    };

    // Garante única rota principal ativa por servidor
    if (payload.is_primary && payload.server_id && !payload.archived) {
      await supabase
        .from("dns_routes")
        .update({ is_primary: false, is_backup: true })
        .eq("company_id", data.company_id)
        .eq("server_id", payload.server_id)
        .eq("is_primary", true)
        .neq("id", data.input.id ?? "00000000-0000-0000-0000-000000000000");
    }

    if (data.input.id) {
      const { data: row, error } = await supabase
        .from("dns_routes")
        .update(payload)
        .eq("id", data.input.id)
        .eq("company_id", data.company_id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await supabase
      .from("dns_routes")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteDnsRouteServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { company_id: string; id: string }) =>
    z.object({ company_id: z.string().uuid(), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("dns_routes")
      .delete()
      .eq("id", data.id)
      .eq("company_id", data.company_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
