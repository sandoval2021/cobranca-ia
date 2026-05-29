// Server functions para trial_leads + trial_followups.
// Banco é a fonte da verdade. Cache local apenas para offline/UX.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UUID = z.string().uuid();

const LeadInput = z.object({
  id: z.string().uuid().optional(),
  companyId: UUID,
  nome: z.string().max(200).nullable().optional(),
  whatsapp: z.string().min(1).max(50),
  origem: z.string().max(80).nullable().optional(),
  status: z.string().max(80).nullable().optional(),
  data_contato: z.string().nullable().optional(),
  data_inicio: z.string().nullable().optional(),
  data_fim: z.string().nullable().optional(),
  app: z.string().max(120).nullable().optional(),
  servidor: z.string().max(160).nullable().optional(),
  servidor_adicional: z.string().max(160).nullable().optional(),
  usuario: z.string().max(160).nullable().optional(),
  senha: z.string().max(160).nullable().optional(),
  valor_cents: z.number().int().nullable().optional(),
  horas_teste: z.number().int().nullable().optional(),
  interesse: z.string().max(20).nullable().optional(),
  observacoes: z.string().max(4000).nullable().optional(),
  extra: z.record(z.string(), z.unknown()).nullable().optional(),
});

const FollowupInput = z.object({
  id: z.string().uuid().optional(),
  companyId: UUID,
  lead_id: UUID,
  tipo: z.string().min(1).max(40),
  data_planejada: z.string(),
  status: z.string().min(1).max(40),
  atualizado_em: z.string().optional(),
});

export type TrialLeadDto = {
  id: string;
  company_id: string;
  nome: string | null;
  whatsapp: string;
  origem: string | null;
  status: string | null;
  data_contato: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  app: string | null;
  servidor: string | null;
  servidor_adicional: string | null;
  usuario: string | null;
  senha: string | null;
  valor_cents: number | null;
  horas_teste: number | null;
  interesse: string | null;
  observacoes: string | null;
  extra: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type TrialFollowupDto = {
  id: string;
  company_id: string;
  lead_id: string;
  tipo: string;
  data_planejada: string;
  status: string;
  atualizado_em: string;
};

export const listTrialLeadsDb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: UUID }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("trial_leads")
      .select("*")
      .eq("company_id", data.companyId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as TrialLeadDto[];
  });

export const upsertTrialLeadDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => LeadInput.parse(input))
  .handler(async ({ data, context }) => {
    const { companyId, id, ...rest } = data;
    const payload = {
      ...rest,
      company_id: companyId,
      ...(id ? { id } : {}),
    };
    const { data: row, error } = await context.supabase
      .from("trial_leads")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as TrialLeadDto;
  });

export const bulkUpsertTrialLeadsDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        companyId: UUID,
        leads: z.array(LeadInput.omit({ companyId: true })).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.leads.length === 0) return { upserted: 0 };
    const payload = data.leads.map((l) => ({ ...l, company_id: data.companyId }));
    const { error, count } = await context.supabase
      .from("trial_leads")
      .upsert(payload, { onConflict: "id", count: "exact" });
    if (error) throw new Error(error.message);
    return { upserted: count ?? data.leads.length };
  });

export const deleteTrialLeadDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ companyId: UUID, id: UUID }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("trial_leads")
      .delete()
      .eq("company_id", data.companyId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- followups ----------
export const listTrialFollowupsDb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: UUID }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("trial_followups")
      .select("*")
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return (rows ?? []) as TrialFollowupDto[];
  });

export const bulkUpsertTrialFollowupsDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        companyId: UUID,
        items: z.array(FollowupInput.omit({ companyId: true })).max(5000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.items.length === 0) return { upserted: 0 };
    const payload = data.items.map((i) => ({ ...i, company_id: data.companyId }));
    const { error, count } = await context.supabase
      .from("trial_followups")
      .upsert(payload, { onConflict: "id", count: "exact" });
    if (error) throw new Error(error.message);
    return { upserted: count ?? data.items.length };
  });

export const deleteTrialFollowupDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ companyId: UUID, id: UUID }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("trial_followups")
      .delete()
      .eq("company_id", data.companyId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
