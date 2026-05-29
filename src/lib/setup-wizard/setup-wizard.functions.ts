// Server functions para progresso do setup wizard (company_setup_progress).
// Fonte da verdade: banco. localStorage = cache instantâneo.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type SetupProgressDto = {
  company_id: string;
  steps: Record<string, unknown>;
  updated_at: string;
};

async function assertCompanyAccess(supabase: any, companyId: string) {
  const { data, error } = await supabase.rpc("has_company_access", { _company_id: companyId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("forbidden");
}

export const getSetupProgressDb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("company_setup_progress")
      .select("company_id, steps, updated_at")
      .eq("company_id", data.companyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null as SetupProgressDto | null;
    return {
      company_id: row.company_id,
      steps: (row.steps ?? {}) as Record<string, unknown>,
      updated_at: row.updated_at,
    } satisfies SetupProgressDto;
  });

export const upsertSetupProgressDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      companyId: z.string().uuid(),
      steps: z.record(z.string().max(80), z.unknown()).default({}),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const { error } = await supabaseAdmin
      .from("company_setup_progress")
      .upsert(
        { company_id: data.companyId, steps: data.steps, updated_at: new Date().toISOString() },
        { onConflict: "company_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
