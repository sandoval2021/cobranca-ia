import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchSaasPayment } from "@/lib/billing-saas/saas-checkout.server";
import { verifyMpSignature } from "@/lib/payments/marketplace.server";

/**
 * Webhook do Mercado Pago para pagamentos de plano SaaS (CobraEasy → cliente final dono).
 * O MP envia notificações de payment. Validamos a assinatura, buscamos o pagamento e
 * confirmamos via external_reference que aponta para uma linha em saas_checkout_sessions.
 *
 * Fase A — Segurança: rejeita 401 se assinatura ausente/ inválida. Nenhuma ativação
 * de assinatura SaaS pode acontecer sem assinatura válida.
 */
export const Route = createFileRoute("/api/public/mp/saas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let bodyText = "";
        try {
          bodyText = await request.text();
        } catch {
          return new Response("bad body", { status: 400 });
        }
        let payload: Record<string, unknown> = {};
        try {
          payload = bodyText ? JSON.parse(bodyText) : {};
        } catch {
          payload = {};
        }
        const url = new URL(request.url);
        const topic =
          url.searchParams.get("type") ||
          url.searchParams.get("topic") ||
          (payload as { type?: string }).type ||
          "";
        const idFromQuery = url.searchParams.get("id") || url.searchParams.get("data.id");
        const dataObj = (payload as { data?: { id?: string | number } }).data;
        const paymentId = String(idFromQuery ?? dataObj?.id ?? "");

        // Fase A — Validação obrigatória da assinatura do Mercado Pago.
        const requestId = request.headers.get("x-request-id");
        const signature = request.headers.get("x-signature");
        const signatureValid = verifyMpSignature(signature, requestId, paymentId || null);
        if (!signatureValid) {
          console.warn("[mp saas webhook] invalid signature; rejecting");
          return new Response("unauthorized", { status: 401 });
        }

        if (!paymentId || !/payment/i.test(topic)) {
          return new Response("ignored", { status: 200 });
        }

        // Fase B — Idempotência: registra evento ANTES de processar.
        // UNIQUE(provider, data_id, event_type). Se duplicado, retorna 200
        // sem reprocessar ativação de assinatura.
        const { data: evRow, error: evErr } = await supabaseAdmin
          .from("saas_webhook_events")
          .insert({
            provider: "mercado_pago",
            data_id: paymentId,
            event_type: "payment",
            status: "received",
            raw_reference: { topic, payment_id: paymentId } as any,
          })
          .select("id")
          .single();

        if (evErr) {
          const code = (evErr as { code?: string }).code;
          if (code === "23505") {
            return new Response("duplicate", { status: 200 });
          }
          console.error("[saas webhook] insert event failed", evErr);
          // Falha ao registrar evento — não processa mutação financeira.
          return new Response("event_log_failed", { status: 500 });
        }

        const eventRowId = (evRow as { id: string }).id;

        const payment = await fetchSaasPayment(paymentId);
        if (!payment) {
          await supabaseAdmin
            .from("saas_webhook_events")
            .update({
              status: "processed",
              processed_at: new Date().toISOString(),
              error_message: "payment_not_found",
            })
            .eq("id", eventRowId);
          return new Response("not_found", { status: 200 });
        }

        const ext = payment.external_reference ?? "";
        if (!ext.startsWith("saas_")) {
          await supabaseAdmin
            .from("saas_webhook_events")
            .update({
              status: "processed",
              processed_at: new Date().toISOString(),
              error_message: "external_reference_ignored",
              external_reference: ext || null,
            })
            .eq("id", eventRowId);
          return new Response("ignored", { status: 200 });
        }

        // localiza sessão
        const { data: sess } = await supabaseAdmin
          .from("saas_checkout_sessions")
          .select("*")
          .eq("external_reference", ext)
          .maybeSingle();
        if (!sess) {
          await supabaseAdmin
            .from("saas_webhook_events")
            .update({
              status: "processed",
              processed_at: new Date().toISOString(),
              error_message: "session_not_found",
              external_reference: ext,
            })
            .eq("id", eventRowId);
          return new Response("session_not_found", { status: 200 });
        }

        const companyIdSess = (sess as { company_id: string }).company_id;

        // atualiza sempre o registro
        await supabaseAdmin
          .from("saas_checkout_sessions")
          .update({
            mp_payment_id: String(payment.id),
            status: payment.status,
            paid_at: payment.status === "approved" ? new Date().toISOString() : null,
            raw_response: payment as any,
            updated_at: new Date().toISOString(),
          })
          .eq("id", (sess as { id: string }).id);

        if (payment.status === "approved") {
          await supabaseAdmin.rpc("activate_saas_subscription", {
            _company_id: companyIdSess,
            _plan_id: (sess as { plan_id: string }).plan_id,
            _period_days: 30,
          });
        }

        await supabaseAdmin
          .from("saas_webhook_events")
          .update({
            status: "processed",
            processed_at: new Date().toISOString(),
            external_reference: ext,
            company_id: companyIdSess,
          })
          .eq("id", eventRowId);

        return new Response("ok", { status: 200 });
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
