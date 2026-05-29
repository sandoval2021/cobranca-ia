// Server functions para revenda_settings (1 linha por empresa, jsonb).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UUID = z.string().uuid();

export type RevendaSettingsDto = {
  company_id: string;
  /** JSON serializado das configurações completas */
  dataJson: string;
  updated_at: string | null;
};

export const getRevendaSettingsDb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: UUID }).parse(input),
  )
  .handler(async ({ data, context }): Promise<RevendaSettingsDto | null> => {
    const { data: row, error } = await context.supabase
      .from("revenda_settings")
      .select("*")
      .eq("company_id", data.companyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return {
      company_id: row.company_id,
      dataJson: JSON.stringify(row.data ?? {}),
      updated_at: row.updated_at ?? null,
    };
  });

export const saveRevendaSettingsDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      companyId: UUID,
      dataJson: z.string().max(100_000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    let parsed: unknown = {};
    try { parsed = JSON.parse(data.dataJson); } catch { parsed = {}; }
    const { data: row, error } = await context.supabase
      .from("revenda_settings")
      .upsert(
        { company_id: data.companyId, data: parsed as never },
        { onConflict: "company_id" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return {
      company_id: row.company_id,
      dataJson: JSON.stringify(row.data ?? {}),
      updated_at: row.updated_at ?? null,
    } satisfies RevendaSettingsDto;
  });
