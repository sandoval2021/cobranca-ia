// Operational panel server functions — WhatsApp queue + renewal_tasks.
// Multi-tenant: every call validates company_id against the caller.
// Reads use supabaseAdmin but always filter by company_id explicitly.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const STALE_MINUTES = 10;

async function assertCompanyAccess(
  supabase: any,
  userId: string,
  companyId: string,
): Promise<void> {
  const { data: isSuper } = await supabase.rpc("is_super_admin");
  if (isSuper) return;
  const { data: owner } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (owner) return;
  const { data: member } = await supabase
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) throw new Error("forbidden");
  if (!["owner", "admin"].includes(String(member.role))) throw new Error("forbidden");
}

function sanitizeError(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = String(raw).slice(0, 240);
  // Remove possíveis tokens (sequências longas alfanuméricas).
  s = s.replace(/[A-Za-z0-9_-]{32,}/g, "[oculto]");
  // Remove URLs com query string.
  s = s.replace(/https?:\/\/\S+/g, "[link]");
  return s;
}

// ---- view classification ----
// Categorias visíveis ao operador (sem termos técnicos):
//   aguardando | enviando | enviado | falhou | incerto | travado
function classifyWa(row: {
  status: string;
  last_error: string | null;
  locked_at: string | null;
}): "aguardando" | "enviando" | "enviado" | "falhou" | "incerto" | "travado" {
  const err = row.last_error ?? "";
  if (row.status === "sent") return "enviado";
  if (row.status === "queued") return "aguardando";
  if (row.status === "sending") {
    if (row.locked_at) {
      const ageMin = (Date.now() - new Date(row.locked_at).getTime()) / 60_000;
      if (ageMin > STALE_MINUTES) return "travado";
    }
    return "enviando";
  }
  if (row.status === "failed") {
    if (/send_uncertain/i.test(err)) return "incerto";
    return "falhou";
  }
  return "falhou";
}

// =========================================================================
// LIST: WhatsApp message queue (paginated)
// =========================================================================
export const listWhatsAppQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        company_id: z.string().uuid(),
        view: z
          .enum([
            "todos",
            "aguardando",
            "enviando",
            "enviado",
            "falhou",
            "incerto",
            "travado",
          ])
          .default("todos"),
        search: z.string().trim().max(80).optional(),
        page: z.number().int().min(1).max(500).default(1),
        page_size: z.number().int().min(5).max(100).default(25),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, context.userId, data.company_id);

    const from = (data.page - 1) * data.page_size;
    const to = from + data.page_size - 1;

    let q = supabaseAdmin
      .from("whatsapp_message_queue")
      .select(
        "id, status, to_phone, body, attempts, max_attempts, next_attempt_at, last_error, scheduled_for, sent_at, failed_at, locked_at, created_at, updated_at",
        { count: "exact" },
      )
      .eq("company_id", data.company_id)
      .order("created_at", { ascending: false });

    if (data.view === "aguardando") q = q.eq("status", "queued");
    else if (data.view === "enviando")
      q = q
        .eq("status", "sending")
        .gte("locked_at", new Date(Date.now() - STALE_MINUTES * 60_000).toISOString());
    else if (data.view === "travado")
      q = q
        .eq("status", "sending")
        .lt("locked_at", new Date(Date.now() - STALE_MINUTES * 60_000).toISOString());
    else if (data.view === "enviado") q = q.eq("status", "sent");
    else if (data.view === "falhou")
      q = q.eq("status", "failed").not("last_error", "ilike", "%send_uncertain%");
    else if (data.view === "incerto")
      q = q.eq("status", "failed").ilike("last_error", "%send_uncertain%");

    if (data.search) {
      const term = data.search.replace(/\D/g, "");
      if (term.length >= 4) q = q.ilike("to_phone", `%${term}%`);
    }

    const { data: rows, error, count } = await q.range(from, to);
    if (error) throw new Error("Não foi possível carregar a fila.");

    const items = (rows ?? []).map((r: any) => ({
      id: r.id as string,
      view: classifyWa(r),
      to_phone: r.to_phone as string,
      preview: String(r.body ?? "").slice(0, 120),
      attempts: r.attempts as number,
      max_attempts: r.max_attempts as number,
      next_attempt_at: r.next_attempt_at as string | null,
      scheduled_for: r.scheduled_for as string | null,
      sent_at: r.sent_at as string | null,
      failed_at: r.failed_at as string | null,
      created_at: r.created_at as string,
      last_error: sanitizeError(r.last_error),
      is_uncertain:
        r.status === "failed" && /send_uncertain/i.test(r.last_error ?? ""),
      can_reprocess: r.status === "failed",
    }));

    return { items, total: count ?? 0, page: data.page, page_size: data.page_size };
  });

// =========================================================================
// COUNTS: badges por categoria
// =========================================================================
export const getQueueCounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ company_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, context.userId, data.company_id);

    const staleIso = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();
    const base = () =>
      supabaseAdmin
        .from("whatsapp_message_queue")
        .select("id", { count: "exact", head: true })
        .eq("company_id", data.company_id);

    const [aguardando, enviando, travado, enviado, falhou, incerto] = await Promise.all([
      base().eq("status", "queued"),
      base().eq("status", "sending").gte("locked_at", staleIso),
      base().eq("status", "sending").lt("locked_at", staleIso),
      base().eq("status", "sent"),
      base().eq("status", "failed").not("last_error", "ilike", "%send_uncertain%"),
      base().eq("status", "failed").ilike("last_error", "%send_uncertain%"),
    ]);

    const renewalBase = () =>
      supabaseAdmin
        .from("renewal_tasks")
        .select("id", { count: "exact", head: true })
        .eq("company_id", data.company_id);
    const renewalStaleIso = new Date(Date.now() - 30 * 60_000).toISOString();
    const [rtPending, rtStuck, rtFailed] = await Promise.all([
      renewalBase().eq("status", "pending"),
      renewalBase().eq("status", "trying").lt("locked_at", renewalStaleIso),
      renewalBase().in("status", ["failed", "needs_human"]),
    ]);

    return {
      whatsapp: {
        aguardando: aguardando.count ?? 0,
        enviando: enviando.count ?? 0,
        travado: travado.count ?? 0,
        enviado: enviado.count ?? 0,
        falhou: falhou.count ?? 0,
        incerto: incerto.count ?? 0,
      },
      renewal: {
        pendente: rtPending.count ?? 0,
        travado: rtStuck.count ?? 0,
        falhou: rtFailed.count ?? 0,
      },
    };
  });

// =========================================================================
// LIST: renewal_tasks (paginated)
// =========================================================================
export const listRenewalQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        company_id: z.string().uuid(),
        view: z.enum(["pendente", "travado", "falhou"]).default("pendente"),
        page: z.number().int().min(1).max(500).default(1),
        page_size: z.number().int().min(5).max(100).default(25),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, context.userId, data.company_id);

    const from = (data.page - 1) * data.page_size;
    const to = from + data.page_size - 1;

    let q = supabaseAdmin
      .from("renewal_tasks")
      .select(
        "id, status, kind, attempts, max_attempts, last_error, next_attempt_at, locked_at, failed_at, dead_at, created_at, customers(name, phone)",
        { count: "exact" },
      )
      .eq("company_id", data.company_id)
      .order("created_at", { ascending: false });

    const staleIso = new Date(Date.now() - 30 * 60_000).toISOString();
    if (data.view === "pendente") q = q.eq("status", "pending");
    else if (data.view === "travado")
      q = q.eq("status", "trying").lt("locked_at", staleIso);
    else q = q.in("status", ["failed", "needs_human"]);

    const { data: rows, error, count } = await q.range(from, to);
    if (error) throw new Error("Não foi possível carregar as renovações.");

    const items = (rows ?? []).map((r: any) => ({
      id: r.id as string,
      status: r.status as string,
      kind: r.kind as string,
      attempts: r.attempts as number,
      max_attempts: r.max_attempts as number,
      next_attempt_at: r.next_attempt_at as string | null,
      created_at: r.created_at as string,
      failed_at: r.failed_at as string | null,
      last_error: sanitizeError(r.last_error),
      customer_name: (r.customers?.name as string) ?? null,
    }));

    return { items, total: count ?? 0, page: data.page, page_size: data.page_size };
  });

// =========================================================================
// REPROCESS: WhatsApp message
// =========================================================================
export const reprocessWhatsAppMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        company_id: z.string().uuid(),
        id: z.string().uuid(),
        confirm_uncertain: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, context.userId, data.company_id);

    const { data: row, error: readErr } = await supabaseAdmin
      .from("whatsapp_message_queue")
      .select("id, status, last_error, company_id")
      .eq("id", data.id)
      .eq("company_id", data.company_id)
      .maybeSingle();

    if (readErr || !row) throw new Error("Mensagem não encontrada.");

    if (row.status === "sent") {
      throw new Error("Esta mensagem já foi enviada e não pode ser reprocessada.");
    }
    if (row.status !== "failed") {
      throw new Error("Só é possível reprocessar mensagens com falha.");
    }

    const uncertain = /send_uncertain/i.test(String(row.last_error ?? ""));
    if (uncertain && !data.confirm_uncertain) {
      throw new Error(
        "Essa mensagem pode já ter sido enviada. Confirme antes de reenviar.",
      );
    }

    const ts = new Date().toISOString().slice(0, 16).replace("T", " ");
    const actor = String(context.userId ?? "").slice(0, 8);
    const note = uncertain
      ? `|manual_reprocess_after_uncertain@${ts}_by_${actor}`
      : `|manual_reprocess@${ts}_by_${actor}`;
    const { error: updErr } = await supabaseAdmin
      .from("whatsapp_message_queue")
      .update({
        status: "queued",
        locked_at: null,
        locked_by: null,
        failed_at: null,
        next_attempt_at: new Date().toISOString(),
        last_error: (String(row.last_error ?? "") + note).slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("company_id", data.company_id)
      .eq("status", "failed"); // guarda contra corrida

    if (updErr) throw new Error("Não foi possível reprocessar agora.");
    return { ok: true };
  });

// =========================================================================
// REPROCESS: renewal_task
// =========================================================================
export const reprocessRenewalTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        company_id: z.string().uuid(),
        id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, context.userId, data.company_id);

    const { data: row, error: readErr } = await supabaseAdmin
      .from("renewal_tasks")
      .select("id, status")
      .eq("id", data.id)
      .eq("company_id", data.company_id)
      .maybeSingle();
    if (readErr || !row) throw new Error("Tarefa não encontrada.");
    if (row.status === "renewed") {
      throw new Error("Esta renovação já foi concluída.");
    }

    const { error } = await supabaseAdmin
      .from("renewal_tasks")
      .update({
        status: "pending",
        locked_at: null,
        locked_by: null,
        failed_at: null,
        next_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("company_id", data.company_id);
    if (error) throw new Error("Não foi possível reprocessar agora.");
    return { ok: true };
  });

// =========================================================================
// DETALHES da renewal_task para painel manual assistido (sem senha/token).
// =========================================================================
export const getRenewalTaskDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        company_id: z.string().uuid(),
        id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, context.userId, data.company_id);

    const { data: task, error } = await supabaseAdmin
      .from("renewal_tasks")
      .select(
        "id, status, kind, attempts, max_attempts, plan_days, last_error, created_at, completed_at, server_id, credential_id, customer_id",
      )
      .eq("id", data.id)
      .eq("company_id", data.company_id)
      .maybeSingle();
    if (error || !task) throw new Error("Tarefa não encontrada.");

    const [customerRes, serverRes, credRes, planRes] = await Promise.all([
      supabaseAdmin
        .from("customers")
        .select("id, name, phone, due_date, due_day")
        .eq("id", task.customer_id)
        .eq("company_id", data.company_id)
        .maybeSingle(),
      task.server_id
        ? supabaseAdmin
            .from("servers")
            .select("id, name, panel_url, panel_type")
            .eq("id", task.server_id)
            .eq("company_id", data.company_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      task.credential_id
        ? supabaseAdmin
            .from("customer_iptv_credentials")
            .select("id, iptv_username, plan_days, expires_at")
            .eq("id", task.credential_id)
            .eq("company_id", data.company_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseAdmin
        .from("customer_service_plan")
        .select("service_plan_id, service_plans(nome, telas, meses)")
        .eq("customer_id", task.customer_id)
        .eq("company_id", data.company_id)
        .maybeSingle(),
    ]);

    const customer = (customerRes as any)?.data ?? null;
    const server = (serverRes as any)?.data ?? null;
    const cred = (credRes as any)?.data ?? null;
    const planRow = (planRes as any)?.data ?? null;
    const plan = planRow?.service_plans ?? null;

    // Sugerir nova data: vencimento atual + meses do plano (ou plan_days da task).
    const baseDate = customer?.due_date
      ? new Date(customer.due_date + "T12:00:00Z")
      : new Date();
    const suggested = new Date(baseDate);
    if (plan?.meses) {
      suggested.setMonth(suggested.getMonth() + Number(plan.meses));
    } else if (task.plan_days) {
      suggested.setDate(suggested.getDate() + Number(task.plan_days));
    } else {
      suggested.setMonth(suggested.getMonth() + 1);
    }
    const suggestedIso = suggested.toISOString().slice(0, 10);

    return {
      id: task.id as string,
      status: task.status as string,
      attempts: task.attempts as number,
      max_attempts: task.max_attempts as number,
      last_error: sanitizeError(task.last_error),
      created_at: task.created_at as string,
      completed_at: (task.completed_at as string | null) ?? null,
      customer: customer
        ? {
            name: customer.name as string,
            whatsapp: (customer.phone as string | null) ?? null,
            current_due_date: (customer.due_date as string | null) ?? null,
          }
        : null,
      server: server
        ? {
            name: server.name as string,
            panel_url: (server.panel_url as string | null) ?? null,
            panel_type: (server.panel_type as string | null) ?? null,
          }
        : null,
      credential: cred
        ? {
            iptv_username: (cred.iptv_username as string | null) ?? null,
            expires_at: (cred.expires_at as string | null) ?? null,
          }
        : null,
      plan: plan
        ? {
            name: plan.nome as string,
            telas: plan.telas as number,
            meses: plan.meses as number,
          }
        : null,
      suggested_new_due_date: suggestedIso,
      reason:
        sanitizeError(task.last_error) ||
        "Renovação precisa ser confirmada manualmente.",
    };
  });

// =========================================================================
// CONFIRMAÇÃO MANUAL — needs_human → renewed (somente após ação humana).
// Idempotente por renewal_task_id em manual_renewals.payload.
// Não cria finance_entries nem payment_transactions.
// =========================================================================
export const confirmManualSigmaRenewal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        company_id: z.string().uuid(),
        id: z.string().uuid(),
        new_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        note: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCompanyAccess(context.supabase, context.userId, data.company_id);

    // 1) Lê task (filtra por company).
    const { data: task, error: readErr } = await supabaseAdmin
      .from("renewal_tasks")
      .select(
        "id, company_id, customer_id, status, credential_id, plan_days",
      )
      .eq("id", data.id)
      .eq("company_id", data.company_id)
      .maybeSingle();
    if (readErr || !task) throw new Error("Tarefa não encontrada.");

    // 2) Idempotência: já existe manual_renewals para esta task?
    const { data: existing } = await supabaseAdmin
      .from("manual_renewals")
      .select("id, new_due_date")
      .eq("company_id", data.company_id)
      .eq("customer_id", task.customer_id)
      .filter("payload->>renewal_task_id", "eq", task.id)
      .maybeSingle();

    if (task.status === "renewed" || existing) {
      // Já confirmado — resposta idempotente.
      return {
        ok: true,
        idempotent: true,
        new_due_date: (existing?.new_due_date as string | null) ?? data.new_due_date,
      };
    }

    if (task.status !== "needs_human") {
      throw new Error(
        "Esta tarefa não está aguardando confirmação manual no momento.",
      );
    }

    // 3) Claim condicional needs_human → trying.
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from("renewal_tasks")
      .update({
        status: "trying",
        locked_at: new Date().toISOString(),
        locked_by: `manual:${String(context.userId).slice(0, 8)}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", task.id)
      .eq("company_id", data.company_id)
      .eq("status", "needs_human")
      .select("id")
      .maybeSingle();
    if (claimErr || !claimed) {
      // Outro operador pegou a task ou status mudou.
      throw new Error(
        "Essa tarefa foi atualizada por outro usuário. Recarregue a página.",
      );
    }

    // 4) Lê cliente atual para old_due_date e plano.
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id, due_date")
      .eq("id", task.customer_id)
      .eq("company_id", data.company_id)
      .maybeSingle();
    const oldDueDate = (customer?.due_date as string | null) ?? null;

    const { data: planRow } = await supabaseAdmin
      .from("customer_service_plan")
      .select("service_plan_id, service_plans(meses)")
      .eq("customer_id", task.customer_id)
      .eq("company_id", data.company_id)
      .maybeSingle();
    const servicePlanId =
      (planRow as any)?.service_plan_id ?? null;
    const months = (planRow as any)?.service_plans?.meses ?? null;

    // 5) Histórico antes da atualização (registro confirma a intenção).
    const { error: histErr } = await supabaseAdmin
      .from("manual_renewals")
      .insert({
        company_id: data.company_id,
        customer_id: task.customer_id,
        service_plan_id: servicePlanId,
        old_due_date: oldDueDate,
        new_due_date: data.new_due_date,
        months_added: months,
        amount_cents: null,
        payment_method: null,
        note: data.note ?? "Confirmação manual via painel de filas.",
        payload: {
          renewal_task_id: task.id,
          provider: "sigma",
        },
        created_by: context.userId,
      });
    if (histErr) {
      // Reverte claim para needs_human para permitir nova tentativa.
      await supabaseAdmin
        .from("renewal_tasks")
        .update({
          status: "needs_human",
          locked_at: null,
          locked_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.id)
        .eq("company_id", data.company_id);
      throw new Error("Não foi possível registrar o histórico. Tente novamente.");
    }

    // 6) Atualiza vencimento do cliente (somente após histórico salvo).
    const newDay = Number(data.new_due_date.slice(8, 10));
    await supabaseAdmin
      .from("customers")
      .update({
        due_date: data.new_due_date,
        due_day: newDay,
        status: "em_dia",
        updated_at: new Date().toISOString(),
      })
      .eq("id", task.customer_id)
      .eq("company_id", data.company_id);

    // 7) Atualiza expires_at da credencial, se houver.
    if (task.credential_id) {
      await supabaseAdmin
        .from("customer_iptv_credentials")
        .update({
          expires_at: data.new_due_date + "T23:59:59Z",
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.credential_id)
        .eq("company_id", data.company_id);
    }

    // 8) Marca task renewed e limpa lock.
    await supabaseAdmin
      .from("renewal_tasks")
      .update({
        status: "renewed",
        locked_at: null,
        locked_by: null,
        completed_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", task.id)
      .eq("company_id", data.company_id);

    return { ok: true, idempotent: false, new_due_date: data.new_due_date };
  });
