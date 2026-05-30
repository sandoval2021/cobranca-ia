// Server functions para Planos do dono + Mensagens + Vínculo cliente↔plano.
// Banco é a fonte da verdade (service_plans, service_plan_messages, customer_service_plan).
// localStorage continua existindo apenas como cache síncrono.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ServicePlanMessageDto = {
  id: string;
  service_plan_id: string;
  kind: "cobranca" | "acompanhamento";
  offset_days: number;
  label: string;
  template: string;
};

export type ServicePlanDto = {
  id: string;
  company_id: string;
  nome: string;
  preco_cents: number;
  telas: number;
  meses: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  messages: ServicePlanMessageDto[];
};

export type CustomerPlanLinkDto = {
  customer_id: string;
  service_plan_id: string;
  updated_at: string;
};

async function assertCompanyAccess(supabase: any, companyId: string) {
  const { data, error } = await supabase.rpc("has_company_access", { _company_id: companyId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("forbidden");
}

const PlanMessageInput = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(["cobranca", "acompanhamento"]),
  offset_days: z.number().int(),
  label: z.string().min(1).max(200),
  template: z.string().min(1).max(4000),
});

const PlanInput = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  nome: z.string().min(1).max(200),
  preco_cents: z.number().int().min(0),
  telas: z.number().int().min(1).max(100),
  meses: z.number().int().min(1).max(120),
  ativo: z.boolean().default(true),
  messages: z.array(PlanMessageInput).max(50).default([]),
});

export const listServicePlansDb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: plans, error } = await context.supabase
      .from("service_plans")
      .select("id, company_id, nome, preco_cents, telas, meses, ativo, created_at, updated_at")
      .eq("company_id", data.companyId)
      .order("preco_cents", { ascending: true });
    if (error) throw new Error(error.message);

    const planIds = (plans ?? []).map((p: any) => p.id);
    let messagesByPlan = new Map<string, ServicePlanMessageDto[]>();
    if (planIds.length > 0) {
      const { data: msgs, error: mErr } = await context.supabase
        .from("service_plan_messages")
        .select("id, service_plan_id, kind, offset_days, label, template")
        .in("service_plan_id", planIds);
      if (mErr) throw new Error(mErr.message);
      for (const m of msgs ?? []) {
        const arr = messagesByPlan.get(m.service_plan_id) ?? [];
        arr.push(m as ServicePlanMessageDto);
        messagesByPlan.set(m.service_plan_id, arr);
      }
    }

    const out: ServicePlanDto[] = (plans ?? []).map((p: any) => ({
      ...p,
      messages: (messagesByPlan.get(p.id) ?? []).sort(
        (a, b) => a.offset_days - b.offset_days,
      ),
    }));
    return out;
  });

export const upsertServicePlanDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => PlanInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const { id, companyId, messages, ...rest } = data;
    const planRow: Record<string, unknown> = { ...rest };

    let planId: string;
    if (id) {
      // Upsert por PK: insere se não existir, atualiza se existir.
      // Evita FK violation em service_plan_messages quando o id veio do cliente
      // (UUID local) e o plano ainda não estava persistido.
      const { data: row, error } = await supabaseAdmin
        .from("service_plans")
        .upsert(
          { ...planRow, id, company_id: companyId, updated_at: new Date().toISOString() } as any,
          { onConflict: "id" },
        )
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      planId = (row?.id as string) ?? id;
    } else {
      const { data: row, error } = await supabaseAdmin
        .from("service_plans")
        .insert({ ...planRow, company_id: companyId } as any)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      planId = row!.id as string;
    }

    // Sync messages: estratégia simples — apaga tudo e re-insere.
    const { error: dErr } = await supabaseAdmin
      .from("service_plan_messages")
      .delete()
      .eq("service_plan_id", planId)
      .eq("company_id", companyId);
    if (dErr) throw new Error(dErr.message);

    if (messages.length > 0) {
      const rows = messages.map((m) => ({
        id: m.id,
        service_plan_id: planId,
        company_id: companyId,
        kind: m.kind,
        offset_days: m.offset_days,
        label: m.label,
        template: m.template,
      }));
      const { error: iErr } = await supabaseAdmin
        .from("service_plan_messages")
        .insert(rows as any);
      if (iErr) throw new Error(iErr.message);
    }

    return { id: planId };
  });

export const deleteServicePlanDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const { error } = await supabaseAdmin
      .from("service_plans")
      .delete()
      .eq("id", data.id)
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkUpsertServicePlansDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      companyId: z.string().uuid(),
      plans: z.array(PlanInput.omit({ companyId: true })).max(500),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    let inserted = 0;
    let updated = 0;
    for (const p of data.plans) {
      const { id, messages, ...rest } = p;
      const planRow: Record<string, unknown> = { ...rest };
      let planId: string;
      if (id) {
        const { error } = await supabaseAdmin
          .from("service_plans")
          .upsert({ ...planRow, id, company_id: data.companyId } as any)
          .eq("company_id", data.companyId);
        if (error) throw new Error(error.message);
        planId = id;
        updated++;
      } else {
        const { data: row, error } = await supabaseAdmin
          .from("service_plans")
          .insert({ ...planRow, company_id: data.companyId } as any)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        planId = row!.id as string;
        inserted++;
      }
      // Refresh messages
      const { error: dErr } = await supabaseAdmin
        .from("service_plan_messages")
        .delete()
        .eq("service_plan_id", planId)
        .eq("company_id", data.companyId);
      if (dErr) throw new Error(dErr.message);
      if (messages.length > 0) {
        const rows = messages.map((m) => ({
          id: m.id,
          service_plan_id: planId,
          company_id: data.companyId,
          kind: m.kind,
          offset_days: m.offset_days,
          label: m.label,
          template: m.template,
        }));
        const { error: iErr } = await supabaseAdmin
          .from("service_plan_messages")
          .insert(rows as any);
        if (iErr) throw new Error(iErr.message);
      }
    }
    return { inserted, updated };
  });

// ----- Vínculo cliente ↔ plano -----

export const listCustomerPlanLinksDb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("customer_service_plan")
      .select("customer_id, service_plan_id, updated_at")
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return (rows ?? []) as CustomerPlanLinkDto[];
  });

export const setCustomerPlanDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      companyId: z.string().uuid(),
      customerId: z.string().uuid(),
      servicePlanId: z.string().uuid().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    if (data.servicePlanId == null) {
      const { error } = await supabaseAdmin
        .from("customer_service_plan")
        .delete()
        .eq("customer_id", data.customerId)
        .eq("company_id", data.companyId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await supabaseAdmin
      .from("customer_service_plan")
      .upsert({
        customer_id: data.customerId,
        company_id: data.companyId,
        service_plan_id: data.servicePlanId,
        updated_at: new Date().toISOString(),
      } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkUpsertCustomerPlanLinksDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      companyId: z.string().uuid(),
      links: z.array(
        z.object({
          customerId: z.string().uuid(),
          servicePlanId: z.string().uuid(),
        }),
      ).max(2000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    if (data.links.length === 0) return { upserted: 0 };
    const rows = data.links.map((l) => ({
      customer_id: l.customerId,
      company_id: data.companyId,
      service_plan_id: l.servicePlanId,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabaseAdmin
      .from("customer_service_plan")
      .upsert(rows as any);
    if (error) throw new Error(error.message);
    return { upserted: rows.length };
  });
