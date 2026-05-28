// Server functions para servidores IPTV, credenciais de cliente e renovações assistidas.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { encryptSecret, decryptSecret } from "./crypto.server";

export type ServerRow = {
  id: string;
  company_id: string;
  name: string;
  color: string;
  panel_url: string | null;
  panel_username: string | null;
  panel_type: string;
  customer_search_url_template: string | null;
  notes: string | null;
  is_active: boolean;
  sort_order: number;
  has_password: boolean;
};

export type RenewalTask = {
  id: string;
  company_id: string;
  customer_id: string;
  server_id: string | null;
  credential_id: string | null;
  status: "pending" | "trying" | "renewed" | "failed" | "needs_human";
  kind: string;
  attempts: number;
  last_error: string | null;
  plan_days: number | null;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  server_name?: string | null;
  iptv_username?: string | null;
};

async function assertCompanyAccess(supabase: any, companyId: string) {
  const { data, error } = await supabase.rpc("has_company_access", { _company_id: companyId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("forbidden");
}

// ============= SERVERS =============

export const listServers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("servers")
      .select("*")
      .eq("company_id", data.companyId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any): ServerRow => ({
      id: r.id,
      company_id: r.company_id,
      name: r.name,
      color: r.color,
      panel_url: r.panel_url,
      panel_username: r.panel_username,
      panel_type: r.panel_type,
      customer_search_url_template: r.customer_search_url_template,
      notes: r.notes,
      is_active: r.is_active,
      sort_order: r.sort_order,
      has_password: !!r.panel_password_enc,
    }));
  });

const ServerInput = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  name: z.string().min(1).max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#3b82f6"),
  panel_url: z.string().url().max(500).nullable().optional(),
  panel_username: z.string().max(200).nullable().optional(),
  panel_password: z.string().max(500).nullable().optional(),
  panel_type: z.enum(["sigma", "xui", "xtream", "outros"]).default("outros"),
  customer_search_url_template: z.string().max(500).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(999).default(0),
});

export const upsertServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ServerInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const { panel_password, companyId, id, ...rest } = data;

    if (id) {
      const update: Record<string, unknown> = {
        ...rest,
        updated_at: new Date().toISOString(),
      };
      if (panel_password !== undefined && panel_password !== null) {
        update.panel_password_enc = panel_password === "" ? null : encryptSecret(panel_password);
      }
      const { error } = await supabaseAdmin.from("servers").update(update as any).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const insert = {
      ...rest,
      company_id: companyId,
      panel_password_enc: panel_password ? encryptSecret(panel_password) : null,
    };
    const { data: row, error } = await supabaseAdmin
      .from("servers")
      .insert(insert as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

export const deleteServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const { error } = await context.supabase.from("servers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revealServerPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        companyId: z.string().uuid(),
        action: z.enum(["view", "copy"]).default("view"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const { data: row, error } = await supabaseAdmin
      .from("servers")
      .select("panel_password_enc, company_id")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    if (row.company_id !== data.companyId) throw new Error("forbidden");
    // log
    await supabaseAdmin.from("credential_access_log").insert({
      company_id: data.companyId,
      user_id: context.userId,
      target_kind: "server",
      target_id: data.id,
      action: data.action,
    } as any);
    return { password: decryptSecret(row.panel_password_enc as any) ?? "" };
  });

// ============= CUSTOMER IPTV CREDENTIALS =============

const CredInput = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  customer_id: z.string().uuid(),
  server_id: z.string().uuid().nullable().optional(),
  iptv_username: z.string().max(200).nullable().optional(),
  iptv_password: z.string().max(500).nullable().optional(),
  mac: z.string().max(50).nullable().optional(),
  device_key: z.string().max(200).nullable().optional(),
  app_used: z.string().max(80).nullable().optional(),
  plan_days: z.number().int().min(1).max(3650).nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const listCustomerCredentials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { customerId: string; companyId: string }) =>
    z.object({
      customerId: z.string().uuid(),
      companyId: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("customer_iptv_credentials")
      .select("id, server_id, iptv_username, mac, device_key, app_used, plan_days, expires_at, notes, iptv_password_enc")
      .eq("company_id", data.companyId)
      .eq("customer_id", data.customerId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      server_id: r.server_id,
      iptv_username: r.iptv_username,
      mac: r.mac,
      device_key: r.device_key,
      app_used: r.app_used,
      plan_days: r.plan_days,
      expires_at: r.expires_at,
      notes: r.notes,
      has_password: !!r.iptv_password_enc,
    }));
  });

export const upsertCustomerCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CredInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const { iptv_password, companyId, id, ...rest } = data;
    if (id) {
      const update: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() };
      if (iptv_password !== undefined && iptv_password !== null) {
        update.iptv_password_enc = iptv_password === "" ? null : encryptSecret(iptv_password);
      }
      const { error } = await supabaseAdmin
        .from("customer_iptv_credentials")
        .update(update as any)
        .eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const insert = {
      ...rest,
      company_id: companyId,
      iptv_password_enc: iptv_password ? encryptSecret(iptv_password) : null,
    };
    const { data: row, error } = await supabaseAdmin
      .from("customer_iptv_credentials")
      .insert(insert as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

export const revealCustomerCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      companyId: z.string().uuid(),
      action: z.enum(["view", "copy"]).default("view"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const { data: row, error } = await supabaseAdmin
      .from("customer_iptv_credentials")
      .select("iptv_password_enc, company_id")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    if (row.company_id !== data.companyId) throw new Error("forbidden");
    await supabaseAdmin.from("credential_access_log").insert({
      company_id: data.companyId,
      user_id: context.userId,
      target_kind: "customer_iptv",
      target_id: data.id,
      action: data.action,
    } as any);
    return { password: decryptSecret(row.iptv_password_enc as any) ?? "" };
  });

// ============= RENEWAL TASKS =============

export const listRenewalTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string; status?: string }) =>
    z.object({
      companyId: z.string().uuid(),
      status: z.enum(["pending", "trying", "renewed", "failed", "needs_human", "all"]).default("pending"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("renewal_tasks")
      .select(`
        id, company_id, customer_id, server_id, credential_id, status, kind,
        attempts, last_error, plan_days, notes, created_at, completed_at,
        customers ( name, phone ),
        servers ( name ),
        customer_iptv_credentials ( iptv_username )
      `)
      .eq("company_id", data.companyId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any): RenewalTask => ({
      id: r.id,
      company_id: r.company_id,
      customer_id: r.customer_id,
      server_id: r.server_id,
      credential_id: r.credential_id,
      status: r.status,
      kind: r.kind,
      attempts: r.attempts,
      last_error: r.last_error,
      plan_days: r.plan_days,
      notes: r.notes,
      created_at: r.created_at,
      completed_at: r.completed_at,
      customer_name: r.customers?.name ?? null,
      customer_phone: r.customers?.phone ?? null,
      server_name: r.servers?.name ?? null,
      iptv_username: r.customer_iptv_credentials?.iptv_username ?? null,
    }));
  });

export const createRenewalTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      companyId: z.string().uuid(),
      customer_id: z.string().uuid(),
      server_id: z.string().uuid().nullable().optional(),
      credential_id: z.string().uuid().nullable().optional(),
      plan_days: z.number().int().min(1).max(3650).nullable().optional(),
      notes: z.string().max(500).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const { companyId, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("renewal_tasks")
      .insert({ ...rest, company_id: companyId, status: "pending" } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

export const updateRenewalTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      companyId: z.string().uuid(),
      status: z.enum(["pending", "trying", "renewed", "failed", "needs_human"]),
      last_error: z.string().max(1000).nullable().optional(),
      notes: z.string().max(1000).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const update: Record<string, unknown> = {
      status: data.status,
      updated_at: new Date().toISOString(),
    };
    if (data.last_error !== undefined) update.last_error = data.last_error;
    if (data.notes !== undefined) update.notes = data.notes;
    if (data.status === "renewed" || data.status === "failed") {
      update.completed_at = new Date().toISOString();
    }
    if (data.status === "trying") {
      // incrementa tentativas
      const { data: cur } = await context.supabase
        .from("renewal_tasks")
        .select("attempts")
        .eq("id", data.id)
        .single();
      update.attempts = ((cur?.attempts as number) ?? 0) + 1;
    }
    const { error } = await context.supabase
      .from("renewal_tasks")
      .update(update)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
