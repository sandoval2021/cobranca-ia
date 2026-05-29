// Server functions para override manual da data de vencimento do cliente.
// Banco é a fonte da verdade. 1 override ativo por cliente (unique).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type CustomerDueOverrideDto = {
  id: string;
  company_id: string;
  customer_id: string;
  due_date: string;
  source: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const OverrideInput = z.object({
  companyId: z.string().uuid(),
  customerId: z.string().uuid(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.string().max(40).optional(),
  note: z.string().max(2000).nullable().optional(),
});

async function assertCompanyAccess(supabase: any, companyId: string) {
  const { data, error } = await supabase.rpc("has_company_access", { _company_id: companyId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("forbidden");
}

export const listCustomerDueOverridesDb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("customer_due_overrides")
      .select("id, company_id, customer_id, due_date, source, note, created_by, created_at, updated_at")
      .eq("company_id", data.companyId)
      .limit(5000);
    if (error) throw new Error(error.message);
    return (rows ?? []) as CustomerDueOverrideDto[];
  });

export const upsertCustomerDueOverrideDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => OverrideInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const { error } = await supabaseAdmin
      .from("customer_due_overrides")
      .upsert(
        {
          company_id: data.companyId,
          customer_id: data.customerId,
          due_date: data.due_date,
          source: data.source ?? "manual",
          note: data.note ?? null,
          created_by: context.userId,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "company_id,customer_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCustomerDueOverrideDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ companyId: z.string().uuid(), customerId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const { error } = await supabaseAdmin
      .from("customer_due_overrides")
      .delete()
      .eq("company_id", data.companyId)
      .eq("customer_id", data.customerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkUpsertCustomerDueOverridesDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      companyId: z.string().uuid(),
      overrides: z.array(OverrideInput.omit({ companyId: true })).max(5000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    if (data.overrides.length === 0) return { upserted: 0 };
    const rows = data.overrides.map((o) => ({
      company_id: data.companyId,
      customer_id: o.customerId,
      due_date: o.due_date,
      source: o.source ?? "manual",
      note: o.note ?? null,
      created_by: context.userId,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabaseAdmin
      .from("customer_due_overrides")
      .upsert(rows as any, { onConflict: "company_id,customer_id" });
    if (error) throw new Error(error.message);
    return { upserted: rows.length };
  });
