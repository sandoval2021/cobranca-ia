// Endpoint diário para o motor de mensagens automáticas por plano.
// CHAMADO POR pg_cron 1x/dia. Por ora, apenas registra os elegíveis como
// "planned" no audit log (não envia WhatsApp). O envio real será conectado
// numa fase futura.
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

function checkAuth(request: Request): boolean {
  const key =
    request.headers.get("apikey") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  const expected =
    process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
  return Boolean(key && expected && key === expected);
}

export const Route = createFileRoute("/api/public/hooks/services-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!checkAuth(request)) {
          return new Response("unauthorized", { status: 401 });
        }
        const today = todayIso();

        // Para cada empresa com planos ativos, computa elegibilidade do dia
        // e grava como 'planned' no audit log (deduplicado pela unique key).
        const { data: companies, error: cErr } = await supabaseAdmin
          .from("service_plans")
          .select("company_id")
          .eq("ativo", true);
        if (cErr) return new Response(cErr.message, { status: 500 });

        const companyIds = Array.from(
          new Set((companies ?? []).map((r: any) => r.company_id)),
        );
        let totalPlanned = 0;

        for (const companyId of companyIds) {
          const { data: plans } = await supabaseAdmin
            .from("service_plans")
            .select("id")
            .eq("company_id", companyId)
            .eq("ativo", true);
          const planIds = (plans ?? []).map((p: any) => p.id);
          if (planIds.length === 0) continue;

          const { data: messages } = await supabaseAdmin
            .from("service_plan_messages")
            .select("id, service_plan_id, offset_days, template, label")
            .in("service_plan_id", planIds);
          if (!messages?.length) continue;

          const { data: links } = await supabaseAdmin
            .from("customer_service_plan")
            .select("customer_id, service_plan_id")
            .eq("company_id", companyId);
          if (!links?.length) continue;

          const customerIds = links.map((l: any) => l.customer_id);
          const { data: customers } = await supabaseAdmin
            .from("customers")
            .select("id, name, phone, status, due_date")
            .eq("company_id", companyId)
            .in("id", customerIds);
          const byId = new Map<string, any>();
          for (const c of customers ?? []) byId.set(c.id, c);

          const rows: any[] = [];
          for (const link of links) {
            const c = byId.get(link.customer_id);
            if (!c) continue;
            if (c.status === "arquivado" || c.status === "cancelado") continue;
            if (!c.phone || !c.due_date) continue;
            const elapsed = diffDays(c.due_date, today);
            if (elapsed == null) continue;
            for (const m of messages) {
              if (m.service_plan_id !== link.service_plan_id) continue;
              if (elapsed !== m.offset_days) continue;
              rows.push({
                company_id: companyId,
                customer_id: c.id,
                service_plan_id: link.service_plan_id,
                service_plan_message_id: m.id,
                cycle_key: c.due_date,
                dispatch_type: "auto",
                status: "planned",
                message_body: m.template,
              });
            }
          }

          if (rows.length > 0) {
            const { error: insErr } = await supabaseAdmin
              .from("service_message_dispatch_log")
              .upsert(rows, {
                onConflict: "customer_id,service_plan_message_id,cycle_key",
                ignoreDuplicates: true,
              });
            if (insErr) {
              console.error("services-dispatch insert error", insErr.message);
              continue;
            }
            totalPlanned += rows.length;
          }
        }

        return Response.json({
          ok: true,
          date: today,
          companies: companyIds.length,
          planned: totalPlanned,
        });
      },
    },
  },
});
