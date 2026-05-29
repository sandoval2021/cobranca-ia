// Server functions para "Telas e aplicativos" do cliente.
// Banco é a fonte da verdade (customer_iptv_credentials), localStorage é só cache.
// Campos extras do AppScreen (status, route, plan_name, app_due_date, etc.)
// são armazenados na coluna jsonb "extras".
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { encryptSecret, decryptSecret } from "@/lib/iptv/crypto.server";

export type ScreenDto = {
  id: string;
  company_id: string;
  customer_id: string;
  server_id: string | null;
  iptv_username: string | null;
  iptv_password: string | null; // descriptografada
  mac: string | null;
  device_key: string | null;
  app_used: string | null;
  expires_at: string | null;
  plan_days: number | null;
  notes: string | null;
  extras: string; // JSON serializado para passar pelo limite de serialização do TanStack
  created_at: string;
  updated_at: string;
};

async function assertCompanyAccess(supabase: any, companyId: string) {
  const { data, error } = await supabase.rpc("has_company_access", { _company_id: companyId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("forbidden");
}

const ScreenInput = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  customerId: z.string().uuid(),
  server_id: z.string().uuid().nullable().optional(),
  iptv_username: z.string().max(300).nullable().optional(),
  iptv_password: z.string().max(500).nullable().optional(),
  mac: z.string().max(120).nullable().optional(),
  device_key: z.string().max(500).nullable().optional(),
  app_used: z.string().max(120).nullable().optional(),
  expires_at: z.string().nullable().optional(),
  plan_days: z.number().int().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  extras: z.record(z.string(), z.unknown()).default({}),
});

function rowToDto(r: any): ScreenDto {
  return {
    id: r.id,
    company_id: r.company_id,
    customer_id: r.customer_id,
    server_id: r.server_id,
    iptv_username: r.iptv_username,
    iptv_password: decryptSecret(r.iptv_password_enc),
    mac: r.mac,
    device_key: r.device_key,
    app_used: r.app_used,
    expires_at: r.expires_at,
    plan_days: r.plan_days,
    notes: r.notes,
    extras: r.extras ?? {},
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export const listScreensDb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("customer_iptv_credentials")
      .select(
        "id, company_id, customer_id, server_id, iptv_username, iptv_password_enc, mac, device_key, app_used, expires_at, plan_days, notes, extras, created_at, updated_at",
      )
      .eq("company_id", data.companyId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map(rowToDto);
  });

export const upsertScreenDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ScreenInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const { id, companyId, customerId, iptv_password, ...rest } = data;
    const base: Record<string, unknown> = {
      server_id: rest.server_id ?? null,
      iptv_username: rest.iptv_username ?? null,
      mac: rest.mac ?? null,
      device_key: rest.device_key ?? null,
      app_used: rest.app_used ?? null,
      expires_at: rest.expires_at ?? null,
      plan_days: rest.plan_days ?? null,
      notes: rest.notes ?? null,
      extras: rest.extras ?? {},
    };
    if (iptv_password !== undefined) {
      base.iptv_password_enc = iptv_password ? encryptSecret(iptv_password) : null;
    }

    if (id) {
      const { error } = await supabaseAdmin
        .from("customer_iptv_credentials")
        .update({ ...base, updated_at: new Date().toISOString() } as any)
        .eq("id", id)
        .eq("company_id", companyId);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("customer_iptv_credentials")
      .insert({ ...base, company_id: companyId, customer_id: customerId } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

export const deleteScreenDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const { error } = await supabaseAdmin
      .from("customer_iptv_credentials")
      .delete()
      .eq("id", data.id)
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkUpsertScreensDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      companyId: z.string().uuid(),
      screens: z.array(ScreenInput.omit({ companyId: true })).max(500),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    let inserted = 0;
    let updated = 0;
    for (const s of data.screens) {
      const { id, customerId, iptv_password, ...rest } = s;
      const base: Record<string, unknown> = {
        server_id: rest.server_id ?? null,
        iptv_username: rest.iptv_username ?? null,
        mac: rest.mac ?? null,
        device_key: rest.device_key ?? null,
        app_used: rest.app_used ?? null,
        expires_at: rest.expires_at ?? null,
        plan_days: rest.plan_days ?? null,
        notes: rest.notes ?? null,
        extras: rest.extras ?? {},
      };
      if (iptv_password !== undefined) {
        base.iptv_password_enc = iptv_password ? encryptSecret(iptv_password) : null;
      }
      if (id) {
        const { error } = await supabaseAdmin
          .from("customer_iptv_credentials")
          .upsert({ ...base, id, company_id: data.companyId, customer_id: customerId } as any)
          .eq("company_id", data.companyId);
        if (error) throw new Error(error.message);
        updated++;
      } else {
        const { error } = await supabaseAdmin
          .from("customer_iptv_credentials")
          .insert({ ...base, company_id: data.companyId, customer_id: customerId } as any);
        if (error) throw new Error(error.message);
        inserted++;
      }
    }
    return { inserted, updated };
  });
