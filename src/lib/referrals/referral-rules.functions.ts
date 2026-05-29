// Server functions para regras de indicação (referral_rules).
// Uma regra por empresa. Banco é fonte da verdade.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ReferralRulesDto = {
  company_id: string;
  meta: number;
  tipo: string;
  descricao: string;
  updated_at: string;
};

const RulesInput = z.object({
  companyId: z.string().uuid(),
  meta: z.number().int().min(1).max(1000),
  tipo: z.string().min(1).max(40),
  descricao: z.string().max(2000).default(""),
});

async function assertCompanyAccess(supabase: any, companyId: string) {
  const { data, error } = await supabase.rpc("has_company_access", { _company_id: companyId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("forbidden");
}

export const getReferralRulesDb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("referral_rules")
      .select("company_id, meta, tipo, descricao, updated_at")
      .eq("company_id", data.companyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row ?? null) as ReferralRulesDto | null;
  });

export const upsertReferralRulesDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RulesInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const { error } = await supabaseAdmin
      .from("referral_rules")
      .upsert(
        {
          company_id: data.companyId,
          meta: data.meta,
          tipo: data.tipo,
          descricao: data.descricao ?? "",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
