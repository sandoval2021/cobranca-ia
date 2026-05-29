// Server functions for finance_settings (1 row per company).
// DB is the source of truth. localStorage is only a UI cache/fallback.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

const JsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonSchema),
    z.record(z.string(), JsonSchema),
  ]),
);

const SettingsObject = z.record(z.string(), JsonSchema);

export type FinanceSettingsRow = {
  id: string;
  company_id: string;
  settings: Record<string, Json>;
  created_at: string;
  updated_at: string;
};

export const getFinanceSettingsDb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string }) =>
    z.object({ companyId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
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
  .inputValidator((i: { companyId: string; settings: Record<string, Json> }) =>
    z.object({ companyId: z.string().uuid(), settings: SettingsObject }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const payload = {
      company_id: data.companyId,
      settings: data.settings as unknown as Json,
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
