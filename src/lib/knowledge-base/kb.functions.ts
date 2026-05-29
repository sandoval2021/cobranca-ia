// Server functions para base de conhecimento da IA (ai_knowledge_entries).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type KbEntryDto = {
  id: string;
  company_id: string;
  title: string;
  category: string;
  app: string | null;
  keywords: string[];
  short_text: string;
  full_text: string;
  when_to_use: string | null;
  when_not_to_use: string | null;
  needs_human: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};

const KbInput = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  title: z.string().min(1).max(255),
  category: z.string().max(40).default("regra"),
  app: z.string().max(80).nullable().optional(),
  keywords: z.array(z.string().max(80)).max(50).default([]),
  short_text: z.string().max(4000).default(""),
  full_text: z.string().max(8000).default(""),
  when_to_use: z.string().max(4000).nullable().optional(),
  when_not_to_use: z.string().max(4000).nullable().optional(),
  needs_human: z.boolean().default(false),
  active: z.boolean().default(true),
});

async function assertCompanyAccess(supabase: any, companyId: string) {
  const { data, error } = await supabase.rpc("has_company_access", { _company_id: companyId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("forbidden");
}

function rowToDto(r: any): KbEntryDto {
  return {
    id: r.id,
    company_id: r.company_id,
    title: r.title,
    category: r.category,
    app: r.app,
    keywords: Array.isArray(r.keywords) ? r.keywords : [],
    short_text: r.short_text ?? "",
    full_text: r.full_text ?? "",
    when_to_use: r.when_to_use,
    when_not_to_use: r.when_not_to_use,
    needs_human: !!r.needs_human,
    active: !!r.active,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export const listKbEntriesDb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("ai_knowledge_entries")
      .select("*")
      .eq("company_id", data.companyId)
      .limit(5000);
    if (error) throw new Error(error.message);
    return (rows ?? []).map(rowToDto);
  });

export const upsertKbEntryDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => KbInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const base: any = {
      company_id: data.companyId,
      title: data.title,
      category: data.category,
      app: data.app ?? null,
      keywords: data.keywords,
      short_text: data.short_text,
      full_text: data.full_text,
      when_to_use: data.when_to_use ?? null,
      when_not_to_use: data.when_not_to_use ?? null,
      needs_human: data.needs_human,
      active: data.active,
    };
    const q = data.id
      ? supabaseAdmin.from("ai_knowledge_entries").upsert({ ...base, id: data.id }).select("id").single()
      : supabaseAdmin.from("ai_knowledge_entries").insert(base).select("id").single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

export const deleteKbEntryDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const { error } = await supabaseAdmin
      .from("ai_knowledge_entries")
      .delete()
      .eq("id", data.id)
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkUpsertKbEntriesDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      companyId: z.string().uuid(),
      entries: z.array(KbInput.omit({ companyId: true })).max(2000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    let inserted = 0;
    let updated = 0;
    for (const e of data.entries) {
      const base: any = {
        company_id: data.companyId,
        title: e.title,
        category: e.category,
        app: e.app ?? null,
        keywords: e.keywords,
        short_text: e.short_text,
        full_text: e.full_text,
        when_to_use: e.when_to_use ?? null,
        when_not_to_use: e.when_not_to_use ?? null,
        needs_human: e.needs_human,
        active: e.active,
      };
      if (e.id) {
        const { error } = await supabaseAdmin.from("ai_knowledge_entries").upsert({ ...base, id: e.id });
        if (error) throw new Error(error.message);
        updated++;
      } else {
        const { error } = await supabaseAdmin.from("ai_knowledge_entries").insert(base);
        if (error) throw new Error(error.message);
        inserted++;
      }
    }
    return { inserted, updated };
  });
