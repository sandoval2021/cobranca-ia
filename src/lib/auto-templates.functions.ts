// Server functions para auto_templates (cobrança, renovação, app, teste).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UUID = z.string().uuid();

const TemplateInput = z.object({
  id: z.string().uuid().optional(),
  companyId: UUID,
  /** chave estável do template (ex.: default-cob_d0 ou custom-xxx) */
  template_id: z.string().min(1).max(120),
  categoria: z.string().min(1).max(40),
  ativo: z.boolean(),
  body: z.string().max(8000).nullable().optional(),
  /** canais e janela horária como JSON string para cruzar boundary */
  channelsJson: z.string().max(2000).nullable().optional(),
  timeWindowJson: z.string().max(1000).nullable().optional(),
  extraJson: z.string().max(20000).nullable().optional(),
});

export type AutoTemplateDto = {
  id: string;
  company_id: string;
  template_id: string;
  categoria: string;
  ativo: boolean;
  body: string | null;
  channelsJson: string;
  timeWindowJson: string;
  extraJson: string;
  updated_at: string;
};

function parseJson(s: string | null | undefined): unknown {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

function rowToDto(r: Record<string, unknown>): AutoTemplateDto {
  return {
    id: r.id as string,
    company_id: r.company_id as string,
    template_id: r.template_id as string,
    categoria: r.categoria as string,
    ativo: Boolean(r.ativo),
    body: (r.body as string | null) ?? null,
    channelsJson: JSON.stringify(r.channels ?? null),
    timeWindowJson: JSON.stringify(r.time_window ?? null),
    extraJson: JSON.stringify(r.extra ?? {}),
    updated_at: r.updated_at as string,
  };
}

function inputToRow(d: z.infer<typeof TemplateInput>) {
  const { companyId, id, channelsJson, timeWindowJson, extraJson, ...rest } = d;
  return {
    ...rest,
    channels: parseJson(channelsJson) as never,
    time_window: parseJson(timeWindowJson) as never,
    extra: (parseJson(extraJson) ?? {}) as never,
    company_id: companyId,
    ...(id ? { id } : {}),
  };
}

export const listAutoTemplatesDb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: UUID }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("auto_templates")
      .select("*")
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => rowToDto(r as Record<string, unknown>));
  });

export const upsertAutoTemplateDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => TemplateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("auto_templates")
      .upsert(inputToRow(data), { onConflict: "company_id,template_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToDto(row as Record<string, unknown>);
  });

export const bulkUpsertAutoTemplatesDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      companyId: UUID,
      items: z.array(TemplateInput.omit({ companyId: true })).max(500),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.items.length === 0) return { upserted: 0 };
    const payload = data.items.map((i) =>
      inputToRow({ ...i, companyId: data.companyId }),
    );
    const { error, count } = await context.supabase
      .from("auto_templates")
      .upsert(payload, { onConflict: "company_id,template_id", count: "exact" });
    if (error) throw new Error(error.message);
    return { upserted: count ?? data.items.length };
  });

export const deleteAutoTemplateDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ companyId: UUID, template_id: z.string().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("auto_templates")
      .delete()
      .eq("company_id", data.companyId)
      .eq("template_id", data.template_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
