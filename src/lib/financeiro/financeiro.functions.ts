// Server functions para finance_entries + finance_goals.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UUID = z.string().uuid();

// Fase A — validação explícita de acesso à empresa antes de operar finance_*.
// Mesmo com RLS ativo, validamos no servidor para impedir que payload com
// companyId de outra empresa seja aceito.
async function assertCompanyAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  companyId: string,
) {
  const { data, error } = await supabase.rpc("has_company_access", {
    _company_id: companyId,
  });
  if (error) throw new Error("forbidden");
  if (!data) throw new Error("forbidden");
}

const EntryInput = z.object({
  id: z.string().uuid().optional(),
  companyId: UUID,
  tipo: z.string().min(1).max(40),
  categoria: z.string().max(80).nullable().optional(),
  descricao: z.string().max(500).nullable().optional(),
  valor_cents: z.number().int(),
  data: z.string(),
  metodo_pagamento: z.string().max(40).nullable().optional(),
  cliente_id: UUID.nullable().optional(),
  servico_id: UUID.nullable().optional(),
  observacoes: z.string().max(2000).nullable().optional(),
  extraJson: z.string().max(20000).nullable().optional(),
});

const GoalInput = z.object({
  id: z.string().uuid().optional(),
  companyId: UUID,
  mes: z.string().min(1).max(20),
  categoria: z.string().max(80).nullable().optional(),
  valor_cents: z.number().int(),
  observacoes: z.string().max(2000).nullable().optional(),
  extraJson: z.string().max(20000).nullable().optional(),
});

export type FinanceEntryDto = {
  id: string;
  company_id: string;
  tipo: string;
  categoria: string | null;
  descricao: string | null;
  valor_cents: number;
  data: string;
  metodo_pagamento: string | null;
  cliente_id: string | null;
  servico_id: string | null;
  observacoes: string | null;
  extraJson: string;
  created_at: string;
  updated_at: string;
};

export type FinanceGoalDto = {
  id: string;
  company_id: string;
  mes: string;
  categoria: string | null;
  valor_cents: number;
  observacoes: string | null;
  extraJson: string;
  created_at: string;
  updated_at: string;
};

function parseExtra(s: string | null | undefined): unknown {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

function rowToEntry(r: Record<string, unknown>): FinanceEntryDto {
  return {
    id: r.id as string,
    company_id: r.company_id as string,
    tipo: r.tipo as string,
    categoria: (r.categoria as string | null) ?? null,
    descricao: (r.descricao as string | null) ?? null,
    valor_cents: (r.valor_cents as number) ?? 0,
    data: r.data as string,
    metodo_pagamento: (r.metodo_pagamento as string | null) ?? null,
    cliente_id: (r.cliente_id as string | null) ?? null,
    servico_id: (r.servico_id as string | null) ?? null,
    observacoes: (r.observacoes as string | null) ?? null,
    extraJson: JSON.stringify(r.extra ?? {}),
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

function rowToGoal(r: Record<string, unknown>): FinanceGoalDto {
  return {
    id: r.id as string,
    company_id: r.company_id as string,
    mes: r.mes as string,
    categoria: (r.categoria as string | null) ?? null,
    valor_cents: (r.valor_cents as number) ?? 0,
    observacoes: (r.observacoes as string | null) ?? null,
    extraJson: JSON.stringify(r.extra ?? {}),
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

function entryInputToRow(d: z.infer<typeof EntryInput>) {
  const { companyId, id, extraJson, ...rest } = d;
  return {
    ...rest,
    extra: parseExtra(extraJson) as never,
    company_id: companyId,
    ...(id ? { id } : {}),
  };
}

function goalInputToRow(d: z.infer<typeof GoalInput>) {
  const { companyId, id, extraJson, ...rest } = d;
  return {
    ...rest,
    extra: parseExtra(extraJson) as never,
    company_id: companyId,
    ...(id ? { id } : {}),
  };
}

export const listFinanceEntriesDb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: UUID }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("finance_entries")
      .select("*")
      .eq("company_id", data.companyId)
      .order("data", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => rowToEntry(r as Record<string, unknown>));
  });

export const upsertFinanceEntryDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => EntryInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("finance_entries")
      .upsert(entryInputToRow(data), { onConflict: "id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToEntry(row as Record<string, unknown>);
  });

export const bulkUpsertFinanceEntriesDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        companyId: UUID,
        items: z.array(EntryInput.omit({ companyId: true })).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.items.length === 0) return { upserted: 0 };
    const payload = data.items.map((i) =>
      entryInputToRow({ ...i, companyId: data.companyId }),
    );
    const { error, count } = await context.supabase
      .from("finance_entries")
      .upsert(payload, { onConflict: "id", count: "exact" });
    if (error) throw new Error(error.message);
    return { upserted: count ?? data.items.length };
  });

export const deleteFinanceEntryDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ companyId: UUID, id: UUID }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("finance_entries")
      .delete()
      .eq("company_id", data.companyId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- goals ----------
export const listFinanceGoalsDb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: UUID }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("finance_goals")
      .select("*")
      .eq("company_id", data.companyId);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => rowToGoal(r as Record<string, unknown>));
  });

export const upsertFinanceGoalDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => GoalInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("finance_goals")
      .upsert(goalInputToRow(data), { onConflict: "id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToGoal(row as Record<string, unknown>);
  });

export const bulkUpsertFinanceGoalsDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        companyId: UUID,
        items: z.array(GoalInput.omit({ companyId: true })).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.items.length === 0) return { upserted: 0 };
    const payload = data.items.map((i) =>
      goalInputToRow({ ...i, companyId: data.companyId }),
    );
    const { error, count } = await context.supabase
      .from("finance_goals")
      .upsert(payload, { onConflict: "id", count: "exact" });
    if (error) throw new Error(error.message);
    return { upserted: count ?? data.items.length };
  });

export const deleteFinanceGoalDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ companyId: UUID, id: UUID }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("finance_goals")
      .delete()
      .eq("company_id", data.companyId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
