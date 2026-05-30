// Server functions para finance_entries + finance_goals.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chunkedOrderedUpsert } from "@/lib/sync/chunked-upsert";

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
  idempotencyKey: z.string().min(8).max(128).nullable().optional(),
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
  const { companyId, id, extraJson, idempotencyKey, ...rest } = d;
  return {
    ...rest,
    extra: parseExtra(extraJson) as never,
    company_id: companyId,
    ...(id ? { id } : {}),
    ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
  } as never;
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

// Fase C — paginação segura.
// `limit` default = 1000 (igual ao limite implícito do PostgREST); cap em 5000
// para evitar payload gigante. `offset` opcional. Callers existentes que
// não passam limit/offset continuam funcionando.
export const listFinanceEntriesDb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    companyId: string;
    limit?: number;
    offset?: number;
  }) =>
    z
      .object({
        companyId: UUID,
        limit: z.number().int().min(1).max(5000).optional(),
        offset: z.number().int().min(0).max(1_000_000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const limit = data.limit ?? 1000;
    const offset = data.offset ?? 0;
    const { data: rows, error } = await context.supabase
      .from("finance_entries")
      .select("*")
      .eq("company_id", data.companyId)
      .order("data", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => rowToEntry(r as Record<string, unknown>));
  });

export const upsertFinanceEntryDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => EntryInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);

    // Fase B — Idempotência completa para finance_entries.
    // Se o caller fornecer idempotencyKey e NÃO houver id explícito
    // (= criação), tenta localizar lançamento já existente por
    // (company_id, idempotency_key). Se existir, devolve a linha sem
    // criar novo lançamento. Evita lançamento duplicado em retry / duplo clique.
    if (data.idempotencyKey && !data.id) {
      const { data: existing } = await context.supabase
        .from("finance_entries")
        .select("*")
        .eq("company_id", data.companyId)
        .eq("idempotency_key", data.idempotencyKey)
        .maybeSingle();
      if (existing) {
        return rowToEntry(existing as Record<string, unknown>);
      }
    }

    const { data: row, error } = await context.supabase
      .from("finance_entries")
      .upsert(entryInputToRow(data), { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      // Fase B — trata violação do índice único parcial
      // uq_finance_entries_company_idem como sucesso idempotente:
      // refetcha a linha existente e devolve sem criar duplicata.
      const code = (error as { code?: string }).code;
      if (code === "23505" && data.idempotencyKey) {
        const { data: existing2 } = await context.supabase
          .from("finance_entries")
          .select("*")
          .eq("company_id", data.companyId)
          .eq("idempotency_key", data.idempotencyKey)
          .maybeSingle();
        if (existing2) {
          return rowToEntry(existing2 as Record<string, unknown>);
        }
      }
      throw new Error(error.message);
    }
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
    await assertCompanyAccess(context.supabase, data.companyId);
    if (data.items.length === 0) return { upserted: 0 };
    const payload = data.items.map((i) =>
      entryInputToRow({ ...i, companyId: data.companyId }),
    );
    // chunked + ordered evita deadlock quando dois dispositivos sincronizam
    // finance_entries ao mesmo tempo (mirror dispara em todo FINANCE_EVENT).
    const upserted = await chunkedOrderedUpsert(
      context.supabase,
      "finance_entries",
      payload as unknown as Array<Record<string, unknown>>,
      { onConflict: "id", sortKeys: ["id"] },
    );
    return { upserted };
  });

export const deleteFinanceEntryDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ companyId: UUID, id: UUID }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
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
    await assertCompanyAccess(context.supabase, data.companyId);
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
    await assertCompanyAccess(context.supabase, data.companyId);
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
    await assertCompanyAccess(context.supabase, data.companyId);
    if (data.items.length === 0) return { upserted: 0 };
    const payload = data.items.map((i) =>
      goalInputToRow({ ...i, companyId: data.companyId }),
    );
    const upserted = await chunkedOrderedUpsert(
      context.supabase,
      "finance_goals",
      payload as unknown as Array<Record<string, unknown>>,
      { onConflict: "id", sortKeys: ["id"] },
    );
    return { upserted };
  });

export const deleteFinanceGoalDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ companyId: UUID, id: UUID }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, data.companyId);
    const { error } = await context.supabase
      .from("finance_goals")
      .delete()
      .eq("company_id", data.companyId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
