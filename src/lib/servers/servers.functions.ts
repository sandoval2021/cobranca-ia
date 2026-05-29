// Server functions para o catálogo de servidores (tabela public.servers).
// Persistência definitiva: banco é fonte da verdade, localStorage só cache.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { encryptSecret, decryptSecret } from "@/lib/iptv/crypto.server";

export type ServerRowDto = {
  id: string;
  company_id: string;
  name: string;
  color: string;
  panel_url: string | null;
  panel_username: string | null;
  panel_password: string | null; // descriptografada para o dono/membro
  notes: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

async function assertCompanyAccess(supabase: any, companyId: string) {
  const { data, error } = await supabase.rpc("has_company_access", { _company_id: companyId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("forbidden");
}

const ServerInput = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  name: z.string().min(1).max(120),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#3b82f6"),
  panel_url: z.string().max(500).nullable().optional(),
  panel_username: z.string().max(200).nullable().optional(),
  panel_password: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(9999).default(0),
});

export const listServersDb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("servers")
      .select(
        "id, company_id, name, color, panel_url, panel_username, panel_password_enc, notes, is_active, sort_order, created_at, updated_at",
      )
      .eq("company_id", data.companyId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any): ServerRowDto => ({
      id: r.id,
      company_id: r.company_id,
      name: r.name,
      color: r.color,
      panel_url: r.panel_url,
      panel_username: r.panel_username,
      panel_password: decryptSecret(r.panel_password_enc),
      notes: r.notes,
      is_active: r.is_active,
      sort_order: r.sort_order,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  });

export const upsertServerDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ServerInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const { panel_password, companyId, id, ...rest } = data;
    const base: Record<string, unknown> = {
      name: rest.name,
      color: rest.color,
      panel_url: rest.panel_url ?? null,
      panel_username: rest.panel_username ?? null,
      notes: rest.notes ?? null,
      is_active: rest.is_active,
      sort_order: rest.sort_order,
    };
    if (panel_password !== undefined) {
      base.panel_password_enc = panel_password
        ? encryptSecret(panel_password)
        : null;
    }

    if (id) {
      const { error } = await supabaseAdmin
        .from("servers")
        .update({ ...base, updated_at: new Date().toISOString() } as any)
        .eq("id", id)
        .eq("company_id", companyId);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("servers")
      .insert({ ...base, company_id: companyId } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

export const setServerActiveDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      companyId: z.string().uuid(),
      is_active: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const { error } = await context.supabase
      .from("servers")
      .update({ is_active: data.is_active, updated_at: new Date().toISOString() } as any)
      .eq("id", data.id)
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteServerDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      companyId: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const { error } = await context.supabase
      .from("servers")
      .delete()
      .eq("id", data.id)
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Migração em lote: envia uma lista de servidores locais para o banco.
// Usado para migrar dados que estavam apenas no localStorage de cada dispositivo.
export const bulkUpsertServersDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      companyId: z.string().uuid(),
      servers: z.array(ServerInput.omit({ companyId: true })).max(200),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    let inserted = 0;
    let updated = 0;
    for (const s of data.servers) {
      const base: Record<string, unknown> = {
        name: s.name,
        color: s.color,
        panel_url: s.panel_url ?? null,
        panel_username: s.panel_username ?? null,
        notes: s.notes ?? null,
        is_active: s.is_active,
        sort_order: s.sort_order,
      };
      if (s.panel_password !== undefined) {
        base.panel_password_enc = s.panel_password
          ? encryptSecret(s.panel_password)
          : null;
      }
      if (s.id) {
        const { error } = await supabaseAdmin
          .from("servers")
          .update({ ...base, updated_at: new Date().toISOString() } as any)
          .eq("id", s.id)
          .eq("company_id", data.companyId);
        if (error) throw new Error(error.message);
        updated += 1;
      } else {
        const { error } = await supabaseAdmin
          .from("servers")
          .insert({ ...base, company_id: data.companyId } as any);
        if (error) throw new Error(error.message);
        inserted += 1;
      }
    }
    return { inserted, updated };
  });
