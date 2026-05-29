// Server functions for finance_settings (1 row per company).
// DB is the source of truth. localStorage is only a UI cache/fallback.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SettingsInput = z.object({
  companyId: z.string().uuid(),
  settings: z.record(z.string(), z.unknown()),
});

export type FinanceSettingsRow = {
  id: string;
  company_id: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

function assertCompanyAccess(ctx: { userId: string; supabase: import("@supabase/supabase-js").SupabaseClient }, companyId: string) {
  // RLS já valida; chamada extra é defensiva contra companyId passado fora do escopo.
  return ctx.supabase
    .from("company_members")
    .select("company_id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("user_id", ctx.userId);
}

export const getFinanceSettingsDb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string }) =>
    z.object({ companyId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }): Promise<FinanceSettingsRow | null> => {
    const { supabase, userId } = context;
    // defesa em profundidade: super_admin é permitido via RLS, membros via has_company_access
    void assertCompanyAccess({ userId, supabase }, data.companyId);
    const { data: row, error } = await supabase
      .from("finance_settings")
      .select("*")
      .eq("company_id", data.companyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row as FinanceSettingsRow | null) ?? null;
  });

export const upsertFinanceSettingsDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string; settings: Record<string, unknown> }) =>
    SettingsInput.parse(i),
  )
  .handler(async ({ data, context }): Promise<FinanceSettingsRow> => {
    const { supabase } = context;
    const payload = {
      company_id: data.companyId,
      settings: data.settings,
      updated_at: new Date().toISOString(),
    };
    const { data: row, error } = await supabase
      .from("finance_settings")
      .upsert(payload, { onConflict: "company_id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as FinanceSettingsRow;
  });
