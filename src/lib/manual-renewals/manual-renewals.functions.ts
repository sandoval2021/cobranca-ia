// Server functions para renovações manuais.
// Banco é a fonte da verdade. localStorage é apenas cache local enquanto
// os usuários antigos ainda não enviaram o histórico para a nuvem.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ManualRenewalDto = {
  id: string;
  company_id: string;
  customer_id: string;
  service_plan_id: string | null;
  old_due_date: string | null;
  new_due_date: string;
  months_added: number | null;
  amount_cents: number | null;
  payment_method: string | null;
  note: string | null;
  payload: string; // JSON serializado
  created_by: string | null;
  created_at: string;
};

const RenewalInput = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  customerId: z.string().uuid(),
  service_plan_id: z.string().uuid().nullable().optional(),
  old_due_date: z.string().nullable().optional(),
  new_due_date: z.string().min(1),
  months_added: z.number().int().nullable().optional(),
  amount_cents: z.number().int().nullable().optional(),
  payment_method: z.string().max(40).nullable().optional(),
  note: z.string().max(4000).nullable().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

async function assertCompanyAccess(supabase: any, companyId: string) {
  const { data, error } = await supabase.rpc("has_company_access", { _company_id: companyId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("forbidden");
}

function rowToDto(r: any): ManualRenewalDto {
  return {
    id: r.id,
    company_id: r.company_id,
    customer_id: r.customer_id,
    service_plan_id: r.service_plan_id,
    old_due_date: r.old_due_date,
    new_due_date: r.new_due_date,
    months_added: r.months_added,
    amount_cents: r.amount_cents,
    payment_method: r.payment_method,
    note: r.note,
    payload: JSON.stringify(r.payload ?? {}),
    created_by: r.created_by,
    created_at: r.created_at,
  };
}

export const listManualRenewalsDb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("manual_renewals")
      .select(
        "id, company_id, customer_id, service_plan_id, old_due_date, new_due_date, months_added, amount_cents, payment_method, note, payload, created_by, created_at",
      )
      .eq("company_id", data.companyId)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    return (rows ?? []).map(rowToDto);
  });

export const createManualRenewalDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RenewalInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const insert = {
      company_id: data.companyId,
      customer_id: data.customerId,
      service_plan_id: data.service_plan_id ?? null,
      old_due_date: data.old_due_date ?? null,
      new_due_date: data.new_due_date,
      months_added: data.months_added ?? null,
      amount_cents: data.amount_cents ?? null,
      payment_method: data.payment_method ?? null,
      note: data.note ?? null,
      payload: data.payload ?? {},
      created_by: context.userId,
    } as any;
    const q = data.id
      ? supabaseAdmin.from("manual_renewals").upsert({ ...insert, id: data.id }).select("id").single()
      : supabaseAdmin.from("manual_renewals").insert(insert).select("id").single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

export const deleteManualRenewalDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const { error } = await supabaseAdmin
      .from("manual_renewals")
      .delete()
      .eq("id", data.id)
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkUpsertManualRenewalsDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      companyId: z.string().uuid(),
      renewals: z.array(RenewalInput.omit({ companyId: true })).max(2000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    let inserted = 0;
    let updated = 0;
    for (const r of data.renewals) {
      const base = {
        company_id: data.companyId,
        customer_id: r.customerId,
        service_plan_id: r.service_plan_id ?? null,
        old_due_date: r.old_due_date ?? null,
        new_due_date: r.new_due_date,
        months_added: r.months_added ?? null,
        amount_cents: r.amount_cents ?? null,
        payment_method: r.payment_method ?? null,
        note: r.note ?? null,
        payload: r.payload ?? {},
        created_by: context.userId,
      } as any;
      if (r.id) {
        const { error } = await supabaseAdmin
          .from("manual_renewals")
          .upsert({ ...base, id: r.id });
        if (error) throw new Error(error.message);
        updated++;
      } else {
        const { error } = await supabaseAdmin.from("manual_renewals").insert(base);
        if (error) throw new Error(error.message);
        inserted++;
      }
    }
    return { inserted, updated };
  });
