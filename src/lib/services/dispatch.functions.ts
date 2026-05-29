// Motor de elegibilidade + auditoria de disparo de mensagens dos planos.
// Banco é a fonte da verdade. Sem envio real ainda — apenas preview/logging.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type EligibleCustomer = {
  customer_id: string;
  customer_name: string;
  phone: string | null;
  due_date: string; // YYYY-MM-DD
  service_plan_id: string;
  service_plan_message_id: string;
  message_label: string;
  message_template: string;
  offset_days: number;
  rendered_message: string;
  cycle_key: string;
  already_sent: boolean;
};

export type MessageEligibilityCount = {
  service_plan_id: string;
  service_plan_message_id: string;
  label: string;
  offset_days: number;
  eligible_count: number;
  already_sent_count: number;
};

function todayIso(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function diffDays(fromIso: string, toIso: string): number | null {
  const a = new Date(fromIso + "T00:00:00");
  const b = new Date(toIso + "T00:00:00");
  if (isNaN(+a) || isNaN(+b)) return null;
  return Math.round((+b - +a) / (1000 * 60 * 60 * 24));
}

function fmtBRL(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
}

function fmtDateBR(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(+d)) return iso;
  return d.toLocaleDateString("pt-BR");
}

function applyTemplate(
  template: string,
  vars: { nome: string; vencimento: string; dias: number; valor: string },
): string {
  return template
    .replace(/\{nome\}/gi, vars.nome)
    .replace(/\{vencimento\}/gi, vars.vencimento)
    .replace(/\{dias\}/gi, String(vars.dias))
    .replace(/\{valor\}/gi, vars.valor);
}

async function computeEligibility(
  companyId: string,
  opts: { onlyDueToday?: boolean; planMessageIds?: string[] | null } = {},
): Promise<EligibleCustomer[]> {
  // 1) Carrega planos + mensagens da empresa
  const { data: plans, error: plansErr } = await supabaseAdmin
    .from("service_plans")
    .select("id, nome, preco_cents, ativo")
    .eq("company_id", companyId)
    .eq("ativo", true);
  if (plansErr) throw new Error(plansErr.message);
  const planIds = (plans ?? []).map((p: any) => p.id);
  if (planIds.length === 0) return [];

  let msgsQuery = supabaseAdmin
    .from("service_plan_messages")
    .select("id, service_plan_id, kind, offset_days, label, template")
    .in("service_plan_id", planIds);
  if (opts.planMessageIds && opts.planMessageIds.length > 0) {
    msgsQuery = msgsQuery.in("id", opts.planMessageIds);
  }
  const { data: messages, error: msgsErr } = await msgsQuery;
  if (msgsErr) throw new Error(msgsErr.message);
  if (!messages || messages.length === 0) return [];

  // 2) Carrega vínculos cliente↔plano + dados dos clientes
  const { data: links, error: linksErr } = await supabaseAdmin
    .from("customer_service_plan")
    .select("customer_id, service_plan_id")
    .eq("company_id", companyId);
  if (linksErr) throw new Error(linksErr.message);
  const customerIds = (links ?? []).map((l: any) => l.customer_id);
  if (customerIds.length === 0) return [];

  const { data: customers, error: cErr } = await supabaseAdmin
    .from("customers")
    .select("id, name, phone, status, due_date, amount_cents")
    .eq("company_id", companyId)
    .in("id", customerIds);
  if (cErr) throw new Error(cErr.message);

  const customerById = new Map<string, any>();
  for (const c of customers ?? []) customerById.set(c.id, c);
  const planById = new Map<string, any>();
  for (const p of plans ?? []) planById.set(p.id, p);

  // 3) Já enviados (para deduplicar). Buscamos só os ciclos vigentes.
  const cycleKeys = Array.from(
    new Set(
      (customers ?? [])
        .map((c: any) => c.due_date)
        .filter((d: string | null) => !!d),
    ),
  );
  const msgIds = messages.map((m: any) => m.id);
  let sentSet = new Set<string>();
  if (cycleKeys.length > 0 && msgIds.length > 0) {
    const { data: sent, error: sErr } = await supabaseAdmin
      .from("service_message_dispatch_log")
      .select("customer_id, service_plan_message_id, cycle_key, status")
      .eq("company_id", companyId)
      .in("service_plan_message_id", msgIds)
      .in("cycle_key", cycleKeys as string[])
      .in("status", ["sent", "planned"]);
    if (sErr) throw new Error(sErr.message);
    for (const r of sent ?? []) {
      sentSet.add(`${r.customer_id}|${r.service_plan_message_id}|${r.cycle_key}`);
    }
  }

  const today = todayIso();
  const out: EligibleCustomer[] = [];

  for (const link of links ?? []) {
    const c = customerById.get(link.customer_id);
    if (!c) continue;
    if (c.status === "arquivado" || c.status === "cancelado") continue;
    if (!c.phone) continue;
    if (!c.due_date) continue;

    const plan = planById.get(link.service_plan_id);
    if (!plan) continue;

    const elapsed = diffDays(c.due_date, today); // dias desde o vencimento (negativo = ainda não venceu)
    if (elapsed == null) continue;

    for (const m of messages) {
      if (m.service_plan_id !== link.service_plan_id) continue;
      const matches = opts.onlyDueToday ? elapsed === m.offset_days : true;
      // Para preview (não onlyDueToday): só faz sentido mostrar quem está dentro
      // da janela do offset OU exatamente nele. Mantemos exato p/ não inflar UI.
      const inWindow = opts.onlyDueToday ? matches : elapsed === m.offset_days;
      if (!inWindow) continue;

      const cycleKey = c.due_date as string;
      const dedupKey = `${c.id}|${m.id}|${cycleKey}`;
      const alreadySent = sentSet.has(dedupKey);

      const rendered = applyTemplate(m.template, {
        nome: c.name,
        vencimento: fmtDateBR(c.due_date),
        dias: Math.abs(m.offset_days),
        valor: fmtBRL(plan.preco_cents ?? c.amount_cents),
      });

      out.push({
        customer_id: c.id,
        customer_name: c.name,
        phone: c.phone,
        due_date: c.due_date,
        service_plan_id: link.service_plan_id,
        service_plan_message_id: m.id,
        message_label: m.label,
        message_template: m.template,
        offset_days: m.offset_days,
        rendered_message: rendered,
        cycle_key: cycleKey,
        already_sent: alreadySent,
      });
    }
  }

  return out;
}

// =============== Server functions exportadas ===============

export const previewServiceDispatchDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        companyId: z.string().uuid(),
        planMessageIds: z.array(z.string().uuid()).max(200).nullable().optional(),
        onlyDueToday: z.boolean().optional().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_company_access", {
      _company_id: data.companyId,
    });
    if (!ok) throw new Error("forbidden");
    return computeEligibility(data.companyId, {
      onlyDueToday: data.onlyDueToday,
      planMessageIds: data.planMessageIds ?? null,
    });
  });

export const getServiceDispatchCountsDb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_company_access", {
      _company_id: data.companyId,
    });
    if (!ok) throw new Error("forbidden");
    const eligible = await computeEligibility(data.companyId, { onlyDueToday: false });
    const map = new Map<string, MessageEligibilityCount>();
    for (const e of eligible) {
      const key = e.service_plan_message_id;
      const cur = map.get(key) ?? {
        service_plan_id: e.service_plan_id,
        service_plan_message_id: e.service_plan_message_id,
        label: e.message_label,
        offset_days: e.offset_days,
        eligible_count: 0,
        already_sent_count: 0,
      };
      cur.eligible_count += 1;
      if (e.already_sent) cur.already_sent_count += 1;
      map.set(key, cur);
    }
    return Array.from(map.values());
  });

export const logServiceDispatchDb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        companyId: z.string().uuid(),
        items: z
          .array(
            z.object({
              customerId: z.string().uuid(),
              servicePlanId: z.string().uuid(),
              servicePlanMessageId: z.string().uuid(),
              cycleKey: z.string().min(1).max(40),
              dispatchType: z.enum(["manual", "auto"]).default("manual"),
              status: z.enum(["planned", "sent", "failed", "skipped"]).default("sent"),
              messageBody: z.string().max(8000).optional(),
              error: z.string().max(2000).optional(),
            }),
          )
          .min(1)
          .max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_company_access", {
      _company_id: data.companyId,
    });
    if (!ok) throw new Error("forbidden");

    const now = new Date().toISOString();
    const rows = data.items.map((i) => ({
      company_id: data.companyId,
      customer_id: i.customerId,
      service_plan_id: i.servicePlanId,
      service_plan_message_id: i.servicePlanMessageId,
      cycle_key: i.cycleKey,
      dispatch_type: i.dispatchType,
      status: i.status,
      message_body: i.messageBody ?? null,
      error: i.error ?? null,
      sent_at: i.status === "sent" ? now : null,
    }));

    // Insere ignorando duplicidade (chave única customer_id+message_id+cycle_key)
    const { data: inserted, error } = await supabaseAdmin
      .from("service_message_dispatch_log")
      .upsert(rows as any, {
        onConflict: "customer_id,service_plan_message_id,cycle_key",
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) throw new Error(error.message);

    return {
      requested: rows.length,
      logged: inserted?.length ?? 0,
      skipped_duplicates: rows.length - (inserted?.length ?? 0),
    };
  });
