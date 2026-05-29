import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchSaasPayment } from "@/lib/billing-saas/saas-checkout.server";

/**
 * Webhook do Mercado Pago para pagamentos de plano SaaS (CobraEasy → cliente final dono).
 * O MP envia notificações de payment. Buscamos o pagamento, validamos via external_reference
 * que aponta para uma linha em saas_checkout_sessions, e ativamos a assinatura.
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

        if (!paymentId || !/payment/i.test(topic)) {
          return new Response("ignored", { status: 200 });
        }

        const payment = await fetchSaasPayment(paymentId);
        if (!payment) return new Response("not_found", { status: 200 });

        const ext = payment.external_reference ?? "";
        if (!ext.startsWith("saas_")) {
          return new Response("ignored", { status: 200 });
        }

        // localiza sessão
        const { data: sess } = await supabaseAdmin
          .from("saas_checkout_sessions")
          .select("*")
          .eq("external_reference", ext)
          .maybeSingle();
        if (!sess) return new Response("session_not_found", { status: 200 });

        // atualiza sempre o registro
        await supabaseAdmin
          .from("saas_checkout_sessions")
          .update({
            mp_payment_id: String(payment.id),
            status: payment.status,
            paid_at: payment.status === "approved" ? new Date().toISOString() : null,
            raw_response: payment as unknown as Record<string, unknown>,
            updated_at: new Date().toISOString(),
          })
          .eq("id", (sess as { id: string }).id);

        if (payment.status === "approved") {
          await supabaseAdmin.rpc("activate_saas_subscription", {
            _company_id: (sess as { company_id: string }).company_id,
            _plan_id: (sess as { plan_id: string }).plan_id,
            _period_days: 30,
          });
        }

        return new Response("ok", { status: 200 });
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
