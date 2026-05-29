// Server functions para indicações (customer_referrals).
// Banco é a fonte da verdade; o localStorage de referrals.ts vira cache.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ReferralDto = {
  id: string;
  company_id: string;
  referrer_customer_id: string | null;
  referred_customer_id: string | null;
  referrer_name: string | null;
  referrer_phone: string | null;
  referred_name: string | null;
  referred_phone: string | null;
  status: string;
  reward_status: string;
  closed_at: string | null;
  reward_applied_at: string | null;
  note: string | null;
  payload: string;
  created_at: string;
  updated_at: string;
};

const ReferralInput = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  referrer_customer_id: z.string().uuid().nullable().optional(),
  referred_customer_id: z.string().uuid().nullable().optional(),
  referrer_name: z.string().max(255).nullable().optional(),
  referrer_phone: z.string().max(40).nullable().optional(),
  referred_name: z.string().max(255).nullable().optional(),
  referred_phone: z.string().max(40).nullable().optional(),
  status: z.string().max(40).default("pending"),
  reward_status: z.string().max(40).default("none"),
  closed_at: z.string().nullable().optional(),
  reward_applied_at: z.string().nullable().optional(),
  note: z.string().max(4000).nullable().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

async function assertCompanyAccess(supabase: any, companyId: string) {
  const { data, error } = await supabase.rpc("has_company_access", { _company_id: companyId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("forbidden");
}

function rowToDto(r: any): ReferralDto {
  return {
    id: r.id,
    company_id: r.company_id,
    referrer_customer_id: r.referrer_customer_id,
    referred_customer_id: r.referred_customer_id,
    referrer_name: r.referrer_name,
    referrer_phone: r.referrer_phone,
    referred_name: r.referred_name,
    referred_phone: r.referred_phone,
    status: r.status,
    reward_status: r.reward_status,
    closed_at: r.closed_at,
    reward_applied_at: r.reward_applied_at,
    note: r.note,
    payload: JSON.stringify(r.payload ?? {}),
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export const listReferralsDb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("customer_referrals")
      .select("*")
      .eq("company_id", data.companyId)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);
    return (rows ?? []).map(rowToDto);
  });

export const upsertReferralDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ReferralInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const base: any = {
      company_id: data.companyId,
      referrer_customer_id: data.referrer_customer_id ?? null,
      referred_customer_id: data.referred_customer_id ?? null,
      referrer_name: data.referrer_name ?? null,
      referrer_phone: data.referrer_phone ?? null,
      referred_name: data.referred_name ?? null,
      referred_phone: data.referred_phone ?? null,
      status: data.status,
      reward_status: data.reward_status,
      closed_at: data.closed_at ?? null,
      reward_applied_at: data.reward_applied_at ?? null,
      note: data.note ?? null,
      payload: data.payload ?? {},
      created_by: context.userId,
    };
    const q = data.id
      ? supabaseAdmin.from("customer_referrals").upsert({ ...base, id: data.id }).select("id").single()
      : supabaseAdmin.from("customer_referrals").insert(base).select("id").single();
    const { data: row, error } = await q;
    if (error) {
      // 23505 = unique_violation: indicação já existe (chave de negócio).
      // Trata como sucesso idempotente devolvendo o id existente.
      if ((error as any).code === "23505" && !data.id) {
        const rp = (data.referrer_phone || "").replace(/\D/g, "");
        const dp = (data.referred_phone || "").replace(/\D/g, "");
        const { data: existing } = await supabaseAdmin
          .from("customer_referrals")
          .select("id, referrer_phone, referred_phone")
          .eq("company_id", data.companyId)
          .limit(500);
        const match = (existing ?? []).find(
          (r: any) =>
            (r.referrer_phone || "").replace(/\D/g, "") === rp &&
            (r.referred_phone || "").replace(/\D/g, "") === dp,
        );
        if (match) return { id: match.id as string };
      }
      throw new Error(error.message);
    }
    return { id: row!.id as string };
  });


export const deleteReferralDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const { error } = await supabaseAdmin
      .from("customer_referrals")
      .delete()
      .eq("id", data.id)
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkUpsertReferralsDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      companyId: z.string().uuid(),
      referrals: z.array(ReferralInput.omit({ companyId: true })).max(2000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    let inserted = 0;
    let updated = 0;
    for (const r of data.referrals) {
      const base: any = {
        company_id: data.companyId,
        referrer_customer_id: r.referrer_customer_id ?? null,
        referred_customer_id: r.referred_customer_id ?? null,
        referrer_name: r.referrer_name ?? null,
        referrer_phone: r.referrer_phone ?? null,
        referred_name: r.referred_name ?? null,
        referred_phone: r.referred_phone ?? null,
        status: r.status,
        reward_status: r.reward_status,
        closed_at: r.closed_at ?? null,
        reward_applied_at: r.reward_applied_at ?? null,
        note: r.note ?? null,
        payload: r.payload ?? {},
        created_by: context.userId,
      };
      if (r.id) {
        const { error } = await supabaseAdmin.from("customer_referrals").upsert({ ...base, id: r.id });
        if (error) throw new Error(error.message);
        updated++;
      } else {
        const { error } = await supabaseAdmin.from("customer_referrals").insert(base);
        if (error) throw new Error(error.message);
        inserted++;
      }
    }
    return { inserted, updated };
  });
