// Server functions para apps de portal (Bob, IBO, Smarters etc.) e dispositivos MAC/Key.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { encryptSecret, decryptSecret } from "./crypto.server";

export type PortalApp = {
  id: string;
  company_id: string;
  app_name: string;
  panel_url: string | null;
  panel_login: string | null;
  id_type: "mac" | "key" | "both";
  mac_url_template: string | null;
  key_url_template: string | null;
  color: string;
  notes: string | null;
  is_active: boolean;
  sort_order: number;
  has_password: boolean;
};

export type PortalDevice = {
  id: string;
  customer_id: string;
  portal_app_id: string;
  mac: string | null;
  device_key: string | null;
  current_route: string | null;
  notes: string | null;
  last_updated_at: string | null;
  app_name?: string | null;
  customer_name?: string | null;
};

async function assertCompanyAccess(supabase: any, companyId: string) {
  const { data, error } = await supabase.rpc("has_company_access", { _company_id: companyId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("forbidden");
}

const PortalAppInput = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  app_name: z.string().min(1).max(80),
  panel_url: z.string().url().max(500).nullable().optional(),
  panel_login: z.string().max(200).nullable().optional(),
  panel_password: z.string().max(500).nullable().optional(),
  id_type: z.enum(["mac", "key", "both"]).default("mac"),
  mac_url_template: z.string().max(500).nullable().optional(),
  key_url_template: z.string().max(500).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#8b5cf6"),
  notes: z.string().max(1000).nullable().optional(),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(999).default(0),
});

export const listPortalApps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("portal_apps")
      .select("*")
      .eq("company_id", data.companyId)
      .order("sort_order", { ascending: true })
      .order("app_name", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any): PortalApp => ({
      id: r.id,
      company_id: r.company_id,
      app_name: r.app_name,
      panel_url: r.panel_url,
      panel_login: r.panel_login,
      id_type: r.id_type,
      mac_url_template: r.mac_url_template,
      key_url_template: r.key_url_template,
      color: r.color,
      notes: r.notes,
      is_active: r.is_active,
      sort_order: r.sort_order,
      has_password: !!r.panel_password_enc,
    }));
  });

export const upsertPortalApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => PortalAppInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const { panel_password, companyId, id, ...rest } = data;
    if (id) {
      const update: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() };
      if (panel_password !== undefined && panel_password !== null) {
        update.panel_password_enc = panel_password === "" ? null : encryptSecret(panel_password);
      }
      const { error } = await supabaseAdmin.from("portal_apps").update(update as any).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const insert = {
      ...rest,
      company_id: companyId,
      panel_password_enc: panel_password ? encryptSecret(panel_password) : null,
    };
    const { data: row, error } = await supabaseAdmin
      .from("portal_apps")
      .insert(insert as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

export const deletePortalApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const { error } = await context.supabase.from("portal_apps").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revealPortalAppPassword = createServerFn({ method: "POST" })
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
      .from("portal_apps")
      .select("panel_password_enc, company_id")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    if (row.company_id !== data.companyId) throw new Error("forbidden");
    await supabaseAdmin.from("credential_access_log").insert({
      company_id: data.companyId,
      user_id: context.userId,
      target_kind: "portal_app",
      target_id: data.id,
      action: data.action,
    } as any);
    return { password: decryptSecret(row.panel_password_enc as any) ?? "" };
  });

// ============= PORTAL DEVICES =============

const DeviceInput = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  customer_id: z.string().uuid(),
  portal_app_id: z.string().uuid(),
  mac: z.string().max(50).nullable().optional(),
  device_key: z.string().max(200).nullable().optional(),
  current_route: z.string().max(500).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const listCustomerPortalDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { customerId: string; companyId: string }) =>
    z.object({
      customerId: z.string().uuid(),
      companyId: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("customer_portal_devices")
      .select(`id, customer_id, portal_app_id, mac, device_key, current_route, notes, last_updated_at,
               portal_apps ( app_name )`)
      .eq("company_id", data.companyId)
      .eq("customer_id", data.customerId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any): PortalDevice => ({
      id: r.id,
      customer_id: r.customer_id,
      portal_app_id: r.portal_app_id,
      mac: r.mac,
      device_key: r.device_key,
      current_route: r.current_route,
      notes: r.notes,
      last_updated_at: r.last_updated_at,
      app_name: r.portal_apps?.app_name ?? null,
    }));
  });

export const upsertPortalDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DeviceInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const { companyId, id, ...rest } = data;
    if (id) {
      const { error } = await context.supabase
        .from("customer_portal_devices")
        .update({ ...rest, last_updated_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await context.supabase
      .from("customer_portal_devices")
      .insert({ ...rest, company_id: companyId, last_updated_at: new Date().toISOString() } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

export const deletePortalDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const { error } = await context.supabase.from("customer_portal_devices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
