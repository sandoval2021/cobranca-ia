// Server functions para planos SaaS, assinaturas e contador de IA.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type SaasPlan = {
  id: string;
  slug: string;
  name: string;
  price_cents: number;
  ai_monthly_limit: number;
  is_active: boolean;
  sort_order: number;
  description: string | null;
};

export type SaasExtraPack = {
  id: string;
  slug: string;
  name: string;
  ai_extra_responses: number;
  price_cents: number;
  is_active: boolean;
  sort_order: number;
};

export type AiQuotaStatus = {
  plan: SaasPlan | null;
  subscription: {
    status: string;
    current_period_start: string;
    current_period_end: string;
    days_left: number;
  } | null;
  cycle: {
    base_limit: number;
    extra_limit: number;
    used_count: number;
    total: number;
    remaining: number;
    percent: number;
  };
  thresholds: { warn70: boolean; warn90: boolean; blocked: boolean };
};

export const getAiQuotaStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Confirma acesso à empresa via RLS
    const { data: sub, error: subErr } = await supabase
      .from("company_subscriptions")
      .select("*, saas_plans(*)")
      .eq("company_id", data.companyId)
      .maybeSingle();
    if (subErr) throw new Error(subErr.message);

    // Garante ciclo via admin (RPC SECURITY DEFINER)
    const { data: cycleData } = await supabaseAdmin.rpc("get_or_create_current_ai_cycle", {
      _company_id: data.companyId,
    });
    const cycle = (cycleData as any) ?? null;

    const plan: SaasPlan | null = sub?.saas_plans
      ? {
          id: (sub.saas_plans as any).id,
          slug: (sub.saas_plans as any).slug,
          name: (sub.saas_plans as any).name,
          price_cents: (sub.saas_plans as any).price_cents,
          ai_monthly_limit: (sub.saas_plans as any).ai_monthly_limit,
          is_active: (sub.saas_plans as any).is_active,
          sort_order: (sub.saas_plans as any).sort_order,
          description: (sub.saas_plans as any).description ?? null,
        }
      : null;

    const base = cycle?.base_limit ?? plan?.ai_monthly_limit ?? 0;
    const extra = cycle?.extra_limit ?? 0;
    const used = cycle?.used_count ?? 0;
    const total = base + extra;
    const remaining = Math.max(0, total - used);
    const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
    const daysLeft = sub?.current_period_end
      ? Math.max(0, Math.ceil((new Date(sub.current_period_end).getTime() - Date.now()) / 86400000))
      : 0;

    const status: AiQuotaStatus = {
      plan,
      subscription: sub
        ? {
            status: sub.status,
            current_period_start: sub.current_period_start,
            current_period_end: sub.current_period_end,
            days_left: daysLeft,
          }
        : null,
      cycle: { base_limit: base, extra_limit: extra, used_count: used, total, remaining, percent },
      thresholds: { warn70: percent >= 70, warn90: percent >= 90, blocked: percent >= 100 },
    };
    return status;
  });

export const listSaasPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("saas_plans")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as SaasPlan[];
  });

export const listSaasExtraPacks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("saas_extra_packs")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as SaasExtraPack[];
  });

// ===== Super admin: gerencia catálogo =====
const PlanInput = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(80),
  price_cents: z.number().int().min(0).max(10_000_000),
  ai_monthly_limit: z.number().int().min(0).max(10_000_000),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0).max(999),
  description: z.string().max(500).nullable().optional(),
});

export const adminUpsertSaasPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => PlanInput.parse(input))
  .handler(async ({ data, context }) => {
    // verifica super_admin
    const { data: isSa } = await context.supabase.rpc("is_super_admin");
    if (!isSa) throw new Error("forbidden");
    const payload = { ...data, updated_at: new Date().toISOString() };
    const { error } = await supabaseAdmin.from("saas_plans").upsert(payload as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteSaasPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isSa } = await context.supabase.rpc("is_super_admin");
    if (!isSa) throw new Error("forbidden");
    const { error } = await supabaseAdmin.from("saas_plans").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminAssignPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        companyId: z.string().uuid(),
        planId: z.string().uuid(),
        status: z.enum(["trial", "active", "past_due", "canceled", "paused_limit"]).default("active"),
        periodDays: z.number().int().min(1).max(365).default(30),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isSa } = await context.supabase.rpc("is_super_admin");
    if (!isSa) throw new Error("forbidden");
    const start = new Date();
    const end = new Date(start.getTime() + data.periodDays * 86400000);
    const { error } = await supabaseAdmin.from("company_subscriptions").upsert(
      {
        company_id: data.companyId,
        plan_id: data.planId,
        status: data.status,
        current_period_start: start.toISOString(),
        current_period_end: end.toISOString(),
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "company_id" },
    );
    if (error) throw new Error(error.message);
    // força recriação do ciclo
    await supabaseAdmin
      .from("company_ai_usage_cycle")
      .delete()
      .eq("company_id", data.companyId)
      .gte("cycle_end", new Date().toISOString());
    return { ok: true };
  });
