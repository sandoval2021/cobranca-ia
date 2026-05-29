// Server functions para importações de clientes e vencimentos importados.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ImportJobDto = {
  id: string;
  company_id: string;
  filename: string | null;
  status: string;
  total_rows: number;
  imported_rows: number;
  failed_rows: number;
  mapping: string;
  summary: string;
  created_at: string;
  updated_at: string;
};

export type ImportedDueDto = {
  id: string;
  company_id: string;
  customer_id: string | null;
  phone: string | null;
  customer_name: string | null;
  due_date: string;
  source_job_id: string | null;
};

const JobInput = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  filename: z.string().max(255).nullable().optional(),
  status: z.string().max(40).default("pending"),
  total_rows: z.number().int().min(0).default(0),
  imported_rows: z.number().int().min(0).default(0),
  failed_rows: z.number().int().min(0).default(0),
  mapping: z.record(z.string(), z.unknown()).default({}),
  summary: z.record(z.string(), z.unknown()).default({}),
});

const DueInput = z.object({
  companyId: z.string().uuid(),
  customer_id: z.string().uuid().nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  customer_name: z.string().max(255).nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source_job_id: z.string().uuid().nullable().optional(),
  raw_row: z.record(z.string(), z.unknown()).default({}),
});

async function assertCompanyAccess(supabase: any, companyId: string) {
  const { data, error } = await supabase.rpc("has_company_access", { _company_id: companyId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("forbidden");
}

export const listImportJobsDb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("customer_import_jobs")
      .select("*")
      .eq("company_id", data.companyId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (rows ?? []).map(
      (r: any): ImportJobDto => ({
        id: r.id,
        company_id: r.company_id,
        filename: r.filename,
        status: r.status,
        total_rows: r.total_rows,
        imported_rows: r.imported_rows,
        failed_rows: r.failed_rows,
        mapping: JSON.stringify(r.mapping ?? {}),
        summary: JSON.stringify(r.summary ?? {}),
        created_at: r.created_at,
        updated_at: r.updated_at,
      }),
    );
  });

export const createImportJobDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => JobInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const base: any = {
      company_id: data.companyId,
      filename: data.filename ?? null,
      status: data.status,
      total_rows: data.total_rows,
      imported_rows: data.imported_rows,
      failed_rows: data.failed_rows,
      mapping: data.mapping,
      summary: data.summary,
      created_by: context.userId,
    };
    const q = data.id
      ? supabaseAdmin.from("customer_import_jobs").upsert({ ...base, id: data.id }).select("id").single()
      : supabaseAdmin.from("customer_import_jobs").insert(base).select("id").single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

export const listImportedDueDb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("imported_customer_due_dates")
      .select("id, company_id, customer_id, phone, customer_name, due_date, source_job_id")
      .eq("company_id", data.companyId)
      .limit(20000);
    if (error) throw new Error(error.message);
    return (rows ?? []) as ImportedDueDto[];
  });

export const upsertImportedDueDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DueInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const base: any = {
      company_id: data.companyId,
      customer_id: data.customer_id ?? null,
      phone: data.phone ?? null,
      customer_name: data.customer_name ?? null,
      due_date: data.due_date,
      source_job_id: data.source_job_id ?? null,
      raw_row: data.raw_row,
    };
    // dedup por (company_id, phone)
    if (data.phone) {
      const { error } = await supabaseAdmin
        .from("imported_customer_due_dates")
        .upsert(base, { onConflict: "company_id,phone" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("imported_customer_due_dates").insert(base);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const bulkUpsertImportedDueDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      companyId: z.string().uuid(),
      items: z.array(DueInput.omit({ companyId: true })).max(5000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    let count = 0;
    for (const it of data.items) {
      const base: any = {
        company_id: data.companyId,
        customer_id: it.customer_id ?? null,
        phone: it.phone ?? null,
        customer_name: it.customer_name ?? null,
        due_date: it.due_date,
        source_job_id: it.source_job_id ?? null,
        raw_row: it.raw_row,
      };
      if (it.phone) {
        const { error } = await supabaseAdmin
          .from("imported_customer_due_dates")
          .upsert(base, { onConflict: "company_id,phone" });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabaseAdmin.from("imported_customer_due_dates").insert(base);
        if (error) throw new Error(error.message);
      }
      count++;
    }
    return { count };
  });
