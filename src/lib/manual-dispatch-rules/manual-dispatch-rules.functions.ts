// Server functions para regras manuais de envio (manual_dispatch_rules).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ManualDispatchRuleDto = {
  id: string;
  company_id: string;
  rule_key: string;
  name: string;
  days_offset: number;
  rule_type: string;
  priority: string;
  tone: string;
  template: string;
  is_active: boolean;
  settings: string; // JSON serializado
  created_at: string;
  updated_at: string;
};

const RuleInput = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  rule_key: z.string().min(1).max(80),
  name: z.string().min(1).max(255),
  days_offset: z.number().int().min(-365).max(365).default(0),
  rule_type: z.string().max(40).default("lembrete"),
  priority: z.string().max(40).default("media"),
  tone: z.string().max(40).default("amigavel"),
  template: z.string().max(4000).default(""),
  is_active: z.boolean().default(true),
  settings: z.record(z.string(), z.unknown()).default({}),
});

async function assertCompanyAccess(supabase: any, companyId: string) {
  const { data, error } = await supabase.rpc("has_company_access", { _company_id: companyId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("forbidden");
}

function rowToDto(r: any): ManualDispatchRuleDto {
  return {
    id: r.id,
    company_id: r.company_id,
    rule_key: r.rule_key,
    name: r.name,
    days_offset: r.days_offset ?? 0,
    rule_type: r.rule_type,
    priority: r.priority,
    tone: r.tone,
    template: r.template ?? "",
    is_active: !!r.is_active,
    settings: JSON.stringify(r.settings ?? {}),
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export const listManualDispatchRulesDb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("manual_dispatch_rules")
      .select("*")
      .eq("company_id", data.companyId)
      .order("days_offset", { ascending: true })
      .limit(2000);
    if (error) throw new Error(error.message);
    return (rows ?? []).map(rowToDto);
  });

export const upsertManualDispatchRuleDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RuleInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const base: any = {
      company_id: data.companyId,
      rule_key: data.rule_key,
      name: data.name,
      days_offset: data.days_offset,
      rule_type: data.rule_type,
      priority: data.priority,
      tone: data.tone,
      template: data.template,
      is_active: data.is_active,
      settings: data.settings,
      created_by: context.userId,
    };
    const { data: row, error } = await supabaseAdmin
      .from("manual_dispatch_rules")
      .upsert(data.id ? { ...base, id: data.id } : base, { onConflict: "company_id,rule_key" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

export const deleteManualDispatchRuleDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const { error } = await supabaseAdmin
      .from("manual_dispatch_rules")
      .delete()
      .eq("id", data.id)
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkUpsertManualDispatchRulesDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      companyId: z.string().uuid(),
      rules: z.array(RuleInput.omit({ companyId: true })).max(500),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    let count = 0;
    for (const r of data.rules) {
      const base: any = {
        company_id: data.companyId,
        rule_key: r.rule_key,
        name: r.name,
        days_offset: r.days_offset,
        rule_type: r.rule_type,
        priority: r.priority,
        tone: r.tone,
        template: r.template,
        is_active: r.is_active,
        settings: r.settings,
        created_by: context.userId,
      };
      const { error } = await supabaseAdmin
        .from("manual_dispatch_rules")
        .upsert(base, { onConflict: "company_id,rule_key" });
      if (error) throw new Error(error.message);
      count++;
    }
    return { count };
  });
