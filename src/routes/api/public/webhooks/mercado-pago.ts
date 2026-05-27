import { createFileRoute } from "@tanstack/react-router";
import {
  getMercadoPagoConfigStatus,
  sanitizeWebhookPayload,
} from "@/lib/mercado-pago.server";

/**
 * Placeholder de webhook Mercado Pago (Fase 1).
 *
 * - Não processa status real de pagamento.
 * - Não chama Mercado Pago.
 * - Não expõe secrets.
 * - Apenas valida estrutura básica e responde 200/202.
 * - Quando a tabela payment_webhook_events estiver aplicada no banco,
 *   o registro do evento (com payload higienizado) deverá ser feito aqui
 *   usando supabaseAdmin server-side.
 */
export const Route = createFileRoute("/api/public/webhooks/mercado-pago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cfg = getMercadoPagoConfigStatus();
        if (!cfg.configured) {
          return new Response(
            JSON.stringify({ ok: false, reason: "not_configured" }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          );
        }

        let body: unknown = null;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        if (!body || typeof body !== "object") {
          return new Response("Invalid payload", { status: 400 });
        }

        // Higieniza antes de qualquer log/persistência futura.
        const _sanitized = sanitizeWebhookPayload(body);
        void _sanitized;

        // Fase 1: aceitar e ignorar.
        return new Response(JSON.stringify({ received: true, phase: 1 }), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () =>
        new Response(JSON.stringify({ ok: true, phase: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    },
  },
});
