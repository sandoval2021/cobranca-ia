// Server functions para customer_extras (email, aniversário, dueDate por cliente).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UUID = z.string().uuid();

const ExtraInput = z.object({
  companyId: UUID,
  customer_id: UUID,
  email: z.string().max(200).nullable().optional(),
  birthday: z.string().nullable().optional(), // YYYY-MM-DD
  due_date: z.string().nullable().optional(),
  extraJson: z.string().max(20000).nullable().optional(),
});

export type CustomerExtraDto = {
  id: string;
  company_id: string;
  customer_id: string;
  email: string | null;
  birthday: string | null;
  due_date: string | null;
  extraJson: string;
  updated_at: string;
};

function rowToDto(r: Record<string, unknown>): CustomerExtraDto {
  return {
    id: r.id as string,
    company_id: r.company_id as string,
    customer_id: r.customer_id as string,
    email: (r.email as string | null) ?? null,
    birthday: (r.birthday as string | null) ?? null,
    due_date: (r.due_date as string | null) ?? null,
    extraJson: JSON.stringify(r.extra ?? {}),
    updated_at: r.updated_at as string,
  };
}

function inputToRow(d: z.infer<typeof ExtraInput>) {
  const { companyId, extraJson, ...rest } = d;
  let extra: unknown = {};
  if (extraJson) { try { extra = JSON.parse(extraJson); } catch { extra = {}; } }
  return { ...rest, extra: extra as never, company_id: companyId };
}

export const listCustomerExtrasDb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: UUID }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("customer_extras")
      .select("*")
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => rowToDto(r as Record<string, unknown>));
  });

export const upsertCustomerExtraDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ExtraInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("customer_extras")
      .upsert(inputToRow(data), { onConflict: "company_id,customer_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToDto(row as Record<string, unknown>);
  });

export const bulkUpsertCustomerExtrasDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      companyId: UUID,
      items: z.array(ExtraInput.omit({ companyId: true })).max(2000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.items.length === 0) return { upserted: 0 };
    const payload = data.items.map((i) =>
      inputToRow({ ...i, companyId: data.companyId }),
    );
    const { error, count } = await context.supabase
      .from("customer_extras")
      .upsert(payload, { onConflict: "company_id,customer_id", count: "exact" });
    if (error) throw new Error(error.message);
    return { upserted: count ?? data.items.length };
  });

export const deleteCustomerExtraDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ companyId: UUID, customer_id: UUID }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("customer_extras")
      .delete()
      .eq("company_id", data.companyId)
      .eq("customer_id", data.customer_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
