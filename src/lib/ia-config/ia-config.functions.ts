// Server functions de configuração da IA (grupos de preço, planos, apps, settings).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

// ---------- Price groups ----------
const PriceGroupInput = z.object({
  id: uuid.optional(),
  company_id: uuid,
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional().nullable(),
  is_default: z.boolean().optional(),
  is_active: z.boolean().optional(),
  ai_notes: z.string().trim().max(1000).optional().nullable(),
  priority: z.number().int().min(0).max(1000).optional(),
});

export const listPriceGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string }) => z.object({ companyId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: groups, error } = await supabase
      .from("price_groups")
      .select("*")
      .eq("company_id", data.companyId)
      .order("priority", { ascending: false })
      .order("name");
    if (error) throw new Error(error.message);
    const ids = (groups ?? []).map((g) => g.id);
    let plans: any[] = [];
    if (ids.length) {
      const { data: ps, error: e2 } = await supabase
        .from("price_group_plans")
        .select("*")
        .in("price_group_id", ids)
        .order("price_cents");
      if (e2) throw new Error(e2.message);
      plans = ps ?? [];
    }
    return { groups: groups ?? [], plans };
  });

export const upsertPriceGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PriceGroupInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.is_default) {
      // limpa default antigo
      await supabase
        .from("price_groups")
        .update({ is_default: false })
        .eq("company_id", data.company_id)
        .neq("id", data.id ?? "00000000-0000-0000-0000-000000000000");
    }
    const { data: row, error } = await supabase
      .from("price_groups")
      .upsert(data, { onConflict: "id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { group: row };
  });

export const deletePriceGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("price_groups").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Plans ----------
const PlanInput = z.object({
  id: uuid.optional(),
  company_id: uuid,
  price_group_id: uuid,
  name: z.string().trim().min(1).max(80),
  screens: z.number().int().min(1).max(20),
  duration_days: z.number().int().min(1).max(3650),
  price_cents: z.number().int().min(0).max(100_000_00),
  allow_installments: z.boolean().optional(),
  notes: z.string().trim().max(500).optional().nullable(),
  is_active: z.boolean().optional(),
});

export const upsertPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PlanInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("price_group_plans")
      .upsert(data, { onConflict: "id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { plan: row };
  });

export const deletePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("price_group_plans").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Apps KB ----------
const AppInput = z.object({
  id: uuid.optional(),
  company_id: uuid,
  app_name: z.string().trim().min(1).max(80),
  login_type: z.enum(["user_pass", "mac_key", "other"]),
  is_paid: z.boolean().optional(),
  stability_level: z.enum(["stable", "medium", "unstable"]),
  how_to_update: z.string().trim().max(1000).optional().nullable(),
  how_to_change_route: z.string().trim().max(1000).optional().nullable(),
  common_issues: z.string().trim().max(2000).optional().nullable(),
  default_reply: z.string().trim().max(2000).optional().nullable(),
  escalate_when: z.string().trim().max(1000).optional().nullable(),
  is_active: z.boolean().optional(),
});

export const listApps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string }) => z.object({ companyId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("app_support_kb")
      .select("*")
      .eq("company_id", data.companyId)
      .order("app_name");
    if (error) throw new Error(error.message);
    return { apps: rows ?? [] };
  });

export const upsertApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AppInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("app_support_kb")
      .upsert(data, { onConflict: "id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { app: row };
  });

export const deleteApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("app_support_kb").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- AI settings ----------
const SettingsInput = z.object({
  company_id: uuid,
  support_instructions: z.string().trim().max(4000).optional().nullable(),
  ask_referral_for_new: z.boolean().optional(),
  escalate_when_referrer_missing: z.boolean().optional(),
  human_handoff_number: z.string().trim().max(30).optional().nullable(),
});

export const getAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string }) => z.object({ companyId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ai_company_settings")
      .select("*")
      .eq("company_id", data.companyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      settings: row ?? {
        company_id: data.companyId,
        support_instructions: null,
        ask_referral_for_new: true,
        escalate_when_referrer_missing: true,
        human_handoff_number: null,
      },
    };
  });

export const updateAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SettingsInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ai_company_settings")
      .upsert(data, { onConflict: "company_id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { settings: row };
  });
