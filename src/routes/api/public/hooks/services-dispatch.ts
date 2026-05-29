// Motor diário de mensagens automáticas por plano.
// Chamado por pg_cron 1x/dia. Para cada cliente elegível no dia:
//   1) renderiza a mensagem com variáveis ({nome},{plano},{valor},{vencimento},{pix},{link_pagamento})
//   2) enfileira em whatsapp_message_queue (nunca envia direto)
//   3) registra em service_message_dispatch_log:
//        - status='queued'  -> enfileirado com sucesso
//        - status='failed'  -> sem instância conectada / erro no insert
//        - status='skipped' -> telefone inválido
// Deduplicação garantida pelo índice único (customer_id,service_plan_message_id,cycle_key).
// Se o WhatsApp estiver desconectado, a mensagem fica registrada como failed
// (motivo: whatsapp_disconnected) e pode ser reprocessada no próximo ciclo.
//
// Auth: header `apikey` deve casar com SUPABASE_ANON_KEY.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function fmtDateBR(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(+d)) return iso;
  return d.toLocaleDateString("pt-BR");
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 20) return null;
  return digits;
}

function applyTemplate(
  template: string,
  vars: {
    nome: string;
    plano: string;
    valor: string;
    vencimento: string;
    dias: number;
    pix: string;
    link_pagamento: string;
  },
): string {
  return template
    .replace(/\{nome\}/gi, vars.nome)
    .replace(/\{plano\}/gi, vars.plano)
    .replace(/\{valor\}/gi, vars.valor)
    .replace(/\{vencimento\}/gi, vars.vencimento)
    .replace(/\{dias\}/gi, String(vars.dias))
    .replace(/\{pix\}/gi, vars.pix)
    .replace(/\{link_pagamento\}/gi, vars.link_pagamento);
}

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function checkAuth(request: Request): boolean {
  const provided = request.headers.get("x-cobraeasy-cron-secret") || "";
  const expected = process.env.CRON_HOOK_SECRET || "";
  if (!expected) {
    console.error("[services-dispatch] CRON_HOOK_SECRET not configured");
    return false;
  }
  return Boolean(provided) && timingSafeEq(provided, expected);
}

type ProcessResult = {
  queued: number;
  failed: number;
  skipped: number;
  already_logged: number;
};

async function processCompany(companyId: string, today: string): Promise<ProcessResult> {
  const result: ProcessResult = { queued: 0, failed: 0, skipped: 0, already_logged: 0 };

  // Planos ativos
  const { data: plans } = await supabaseAdmin
    .from("service_plans")
    .select("id, nome, preco_cents")
    .eq("company_id", companyId)
    .eq("ativo", true);
  const planIds = (plans ?? []).map((p: any) => p.id);
  if (planIds.length === 0) return result;
  const planById = new Map<string, any>();
  for (const p of plans ?? []) planById.set(p.id, p);

  // Mensagens
  const { data: messages } = await supabaseAdmin
    .from("service_plan_messages")
    .select("id, service_plan_id, offset_days, label, template")
    .in("service_plan_id", planIds);
  if (!messages?.length) return result;

  // Vínculos cliente↔plano
  const { data: links } = await supabaseAdmin
    .from("customer_service_plan")
    .select("customer_id, service_plan_id")
    .eq("company_id", companyId);
  if (!links?.length) return result;

  const customerIds = Array.from(new Set(links.map((l: any) => l.customer_id)));
  const { data: customers } = await supabaseAdmin
    .from("customers")
    .select("id, name, phone, status, due_date, amount_cents")
    .eq("company_id", companyId)
    .in("id", customerIds);
  const customerById = new Map<string, any>();
  for (const c of customers ?? []) customerById.set(c.id, c);

  // PIX / link da empresa (fonte oficial: company_ai_payment_settings)
  const { data: paySettings } = await supabaseAdmin
    .from("company_ai_payment_settings")
    .select("manual_pix_key")
    .eq("company_id", companyId)
    .maybeSingle();
  const pixKey = (paySettings as any)?.manual_pix_key ?? "";
  const paymentLink = ""; // ainda não há link automático por cliente; futuro: gerar via MP

  // Instância WhatsApp conectada (qualquer uma da empresa)
  const { data: instance } = await supabaseAdmin
    .from("whatsapp_instances")
    .select("id, status")
    .eq("company_id", companyId)
    .eq("status", "connected")
    .order("last_activity_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const instanceId = (instance as any)?.id ?? null;

  // Já registrados neste ciclo (deduplicação no nível de aplicação)
  const cycleKeys = Array.from(
    new Set(
      (customers ?? [])
        .map((c: any) => c.due_date)
        .filter((d: string | null) => !!d),
    ),
  );
  const msgIds = messages.map((m: any) => m.id);
  const alreadyKey = new Set<string>();
  if (cycleKeys.length > 0 && msgIds.length > 0) {
    const { data: existing } = await supabaseAdmin
      .from("service_message_dispatch_log")
      .select("customer_id, service_plan_message_id, cycle_key")
      .eq("company_id", companyId)
      .in("service_plan_message_id", msgIds)
      .in("cycle_key", cycleKeys as string[]);
    for (const r of existing ?? []) {
      alreadyKey.add(`${r.customer_id}|${r.service_plan_message_id}|${r.cycle_key}`);
    }
  }

  // Itera elegibilidade
  for (const link of links) {
    const c = customerById.get(link.customer_id);
    if (!c) continue;
    if (c.status === "arquivado" || c.status === "cancelado") continue;
    if (!c.due_date) continue;
    const plan = planById.get(link.service_plan_id);
    if (!plan) continue;
    const elapsed = diffDays(c.due_date, today);
    if (elapsed == null) continue;

    for (const m of messages) {
      if (m.service_plan_id !== link.service_plan_id) continue;
      if (elapsed !== m.offset_days) continue;

      const dedupKey = `${c.id}|${m.id}|${c.due_date}`;
      if (alreadyKey.has(dedupKey)) {
        result.already_logged += 1;
        continue;
      }

      const valor = fmtBRL(plan.preco_cents ?? c.amount_cents);
      const rendered = applyTemplate(m.template, {
        nome: c.name,
        plano: plan.nome,
        valor,
        vencimento: fmtDateBR(c.due_date),
        dias: Math.abs(m.offset_days),
        pix: pixKey,
        link_pagamento: paymentLink,
      });

      const phone = normalizePhone(c.phone);

      // Telefone inválido — registra skipped e segue
      if (!phone) {
        await supabaseAdmin
          .from("service_message_dispatch_log")
          .upsert(
            {
              company_id: companyId,
              customer_id: c.id,
              service_plan_id: link.service_plan_id,
              service_plan_message_id: m.id,
              cycle_key: c.due_date,
              dispatch_type: "auto",
              status: "skipped",
              message_body: rendered,
              error: "phone_invalid",
            },
            {
              onConflict: "customer_id,service_plan_message_id,cycle_key",
              ignoreDuplicates: true,
            },
          );
        result.skipped += 1;
        continue;
      }

      // Sem instância conectada — registra failed (tratável: reprocessa amanhã)
      if (!instanceId) {
        await supabaseAdmin
          .from("service_message_dispatch_log")
          .upsert(
            {
              company_id: companyId,
              customer_id: c.id,
              service_plan_id: link.service_plan_id,
              service_plan_message_id: m.id,
              cycle_key: c.due_date,
              dispatch_type: "auto",
              status: "failed",
              message_body: rendered,
              error: "whatsapp_disconnected",
            },
            {
              onConflict: "customer_id,service_plan_message_id,cycle_key",
              ignoreDuplicates: true,
            },
          );
        result.failed += 1;
        continue;
      }

      // Enfileira no WhatsApp e registra queued.
      const { data: queueRow, error: qErr } = await supabaseAdmin
        .from("whatsapp_message_queue")
        .insert({
          company_id: companyId,
          instance_id: instanceId,
          to_phone: phone,
          body: rendered.slice(0, 4000),
          status: "queued",
        } as any)
        .select("id")
        .single();

      if (qErr || !queueRow) {
        await supabaseAdmin
          .from("service_message_dispatch_log")
          .upsert(
            {
              company_id: companyId,
              customer_id: c.id,
              service_plan_id: link.service_plan_id,
              service_plan_message_id: m.id,
              cycle_key: c.due_date,
              dispatch_type: "auto",
              status: "failed",
              message_body: rendered,
              error: `enqueue_failed:${qErr?.message ?? "unknown"}`.slice(0, 2000),
            },
            {
              onConflict: "customer_id,service_plan_message_id,cycle_key",
              ignoreDuplicates: true,
            },
          );
        result.failed += 1;
        continue;
      }

      await supabaseAdmin
        .from("service_message_dispatch_log")
        .upsert(
          {
            company_id: companyId,
            customer_id: c.id,
            service_plan_id: link.service_plan_id,
            service_plan_message_id: m.id,
            cycle_key: c.due_date,
            dispatch_type: "auto",
            status: "queued",
            message_body: rendered,
            queue_id: (queueRow as any).id,
          } as any,
          {
            onConflict: "customer_id,service_plan_message_id,cycle_key",
            ignoreDuplicates: true,
          },
        );
      result.queued += 1;
    }
  }

  return result;
}

export const Route = createFileRoute("/api/public/hooks/services-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!checkAuth(request)) {
          return new Response("unauthorized", { status: 401 });
        }
        const today = todayIso();

        const { data: companies, error: cErr } = await supabaseAdmin
          .from("service_plans")
          .select("company_id")
          .eq("ativo", true);
        if (cErr) return new Response(cErr.message, { status: 500 });

        const companyIds = Array.from(
          new Set((companies ?? []).map((r: any) => r.company_id)),
        );

        let totals = { queued: 0, failed: 0, skipped: 0, already_logged: 0 };
        for (const companyId of companyIds) {
          try {
            const r = await processCompany(companyId, today);
            totals.queued += r.queued;
            totals.failed += r.failed;
            totals.skipped += r.skipped;
            totals.already_logged += r.already_logged;
          } catch (e: any) {
            console.error("services-dispatch company error", companyId, e?.message);
          }
        }

        return Response.json({
          ok: true,
          date: today,
          companies: companyIds.length,
          ...totals,
        });
      },
    },
  },
});
