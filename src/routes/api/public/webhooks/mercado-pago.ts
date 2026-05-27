import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  fetchMpPayment,
  getMercadoPagoConfigStatus,
  sanitizeWebhookPayload,
} from "@/lib/mercado-pago.server";

type AnyDB = any; // eslint-disable-line @typescript-eslint/no-explicit-any
function admin(): AnyDB {
  return supabaseAdmin as unknown as AnyDB;
}

function mpStatusToAttemptStatus(s: string | undefined): string {
  switch ((s || "").toLowerCase()) {
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "refunded":
    case "charged_back":
      return "refunded";
    case "in_process":
    case "pending":
    case "authorized":
      return "pending";
    default:
      return "pending";
  }
}

/**
 * Webhook Mercado Pago — idempotente.
 *
 * - Registra evento sanitizado em payment_webhook_events.
 * - Idempotência via unique index (provider, provider_event_id).
 * - Confirma o status real consultando a API do MP server-side.
 * - Atualiza payment_attempts e owner_subscriptions quando aprovado.
 *
 * Não confia no payload bruto para ativar assinaturas.
 */
export const Route = createFileRoute("/api/public/webhooks/mercado-pago")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ ok: true, phase: 3 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      POST: async ({ request }) => {
        const cfg = getMercadoPagoConfigStatus();
        if (!cfg.configured) {
          return new Response(
            JSON.stringify({ ok: false, reason: "not_configured" }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          );
        }

        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        if (!body || typeof body !== "object") {
          return new Response("Invalid payload", { status: 400 });
        }

        const url = new URL(request.url);
        const eventType: string | undefined =
          body.type || body.action || url.searchParams.get("type") || undefined;
        const providerEventId: string | undefined =
          body.id?.toString?.() ||
          url.searchParams.get("id") ||
          undefined;
        const resourceId: string | undefined =
          body?.data?.id?.toString?.() ||
          body?.resource?.toString?.() ||
          url.searchParams.get("data.id") ||
          undefined;

        const sanitized = sanitizeWebhookPayload(body);
        const db = admin();

        // 1) Registra evento (idempotente via unique index)
        let eventRowId: string | null = null;
        try {
          const { data: ev, error } = await db
            .from("payment_webhook_events")
            .insert({
              provider: "mercado_pago",
              event_type: eventType ?? null,
              provider_event_id: providerEventId ?? null,
              resource_id: resourceId ?? null,
              raw_payload: sanitized,
            })
            .select("id")
            .single();
          if (error) {
            // Duplicado → idempotência: 200 e sai.
            const msg = (error as any)?.message || "";
            if (msg.includes("duplicate") || (error as any)?.code === "23505") {
              return new Response(
                JSON.stringify({ ok: true, duplicate: true }),
                { status: 200, headers: { "Content-Type": "application/json" } },
              );
            }
            console.error("[mp webhook] insert event failed", error);
          } else {
            eventRowId = ev?.id ?? null;
          }
        } catch (e) {
          console.error("[mp webhook] insert event exception", e);
        }

        // 2) Só processamos pagamentos
        const isPaymentEvent =
          (eventType || "").toLowerCase().includes("payment") ||
          !!resourceId;
        if (!isPaymentEvent || !resourceId) {
          if (eventRowId) {
            await db
              .from("payment_webhook_events")
              .update({ processed: true, processed_at: new Date().toISOString() })
              .eq("id", eventRowId);
          }
          return new Response(JSON.stringify({ received: true }), {
            status: 202,
            headers: { "Content-Type": "application/json" },
          });
        }

        // 3) Confirma com a API do MP
        let mp: Awaited<ReturnType<typeof fetchMpPayment>> = null;
        try {
          mp = await fetchMpPayment(resourceId);
        } catch (e) {
          console.error("[mp webhook] fetch payment failed", e);
          if (eventRowId) {
            await db
              .from("payment_webhook_events")
              .update({ error_message: "fetch_failed" })
              .eq("id", eventRowId);
          }
          return new Response(JSON.stringify({ received: true, retry: true }), {
            status: 202,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!mp) {
          if (eventRowId) {
            await db
              .from("payment_webhook_events")
              .update({
                processed: true,
                processed_at: new Date().toISOString(),
                error_message: "payment_not_found",
              })
              .eq("id", eventRowId);
          }
          return new Response(JSON.stringify({ ok: true, missing: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // 4) Localiza o payment_attempt
        const externalRef = mp.external_reference || "";
        const preferenceId = mp.preference_id || "";
        let attempt: any = null;
        if (externalRef) {
          const { data } = await db
            .from("payment_attempts")
            .select("id,company_id,subscription_id,status,amount_cents,currency")
            .eq("id", externalRef)
            .maybeSingle();
          attempt = data;
        }
        if (!attempt && preferenceId) {
          const { data } = await db
            .from("payment_attempts")
            .select("id,company_id,subscription_id,status,amount_cents,currency")
            .eq("provider_preference_id", preferenceId)
            .maybeSingle();
          attempt = data;
        }

        if (!attempt) {
          if (eventRowId) {
            await db
              .from("payment_webhook_events")
              .update({
                processed: true,
                processed_at: new Date().toISOString(),
                error_message: "attempt_not_found",
              })
              .eq("id", eventRowId);
          }
          return new Response(JSON.stringify({ ok: true, orphan: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // 5) Atualiza tentativa (idempotente: se já está no mesmo status final, segue)
        const newStatus = mpStatusToAttemptStatus(mp.status);
        const finalStatuses = new Set([
          "approved",
          "rejected",
          "cancelled",
          "refunded",
        ]);

        if (
          finalStatuses.has(attempt.status) &&
          attempt.status === newStatus
        ) {
          if (eventRowId) {
            await db
              .from("payment_webhook_events")
              .update({ processed: true, processed_at: new Date().toISOString() })
              .eq("id", eventRowId);
          }
          return new Response(JSON.stringify({ ok: true, alreadyProcessed: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        await db
          .from("payment_attempts")
          .update({
            status: newStatus,
            provider_payment_id: String(mp.id),
            method: mp.payment_type_id || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq("id", attempt.id);

        // 6) Se aprovado, ativa assinatura
        if (newStatus === "approved") {
          const now = new Date();
          const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

          const { data: existingSub } = await db
            .from("owner_subscriptions")
            .select("id")
            .eq("company_id", attempt.company_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingSub?.id) {
            await db
              .from("owner_subscriptions")
              .update({
                status: "ativa",
                current_period_start: now.toISOString(),
                current_period_end: periodEnd.toISOString(),
                provider_status: mp.status,
                updated_at: now.toISOString(),
              })
              .eq("id", existingSub.id);
          } else {
            await db.from("owner_subscriptions").insert({
              company_id: attempt.company_id,
              status: "ativa",
              current_period_start: now.toISOString(),
              current_period_end: periodEnd.toISOString(),
              payment_provider: "mercado_pago",
              provider_status: mp.status,
            });
          }
        }

        if (eventRowId) {
          await db
            .from("payment_webhook_events")
            .update({ processed: true, processed_at: new Date().toISOString() })
            .eq("id", eventRowId);
        }

        return new Response(JSON.stringify({ ok: true, status: newStatus }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
