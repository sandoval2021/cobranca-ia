// Webhook idempotente do Mercado Pago para o fluxo Marketplace
// (pagamentos de clientes do dono — tabela payment_transactions).
//
// NÃO MEXE no webhook /api/public/webhooks/mercado-pago, que cobre o billing SaaS.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  fetchMpPayment,
  getOwnerAccessToken,
  verifyMpSignature,
} from "@/lib/payments/marketplace.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function admin(): any {
  return supabaseAdmin;
}

function mapStatus(s: string | undefined): string {
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
    default:
      return "pending";
  }
}

export const Route = createFileRoute("/api/public/mp/marketplace-webhook")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const rawBody = await request.text();
        let body: Record<string, unknown> = {};
        try {
          body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const dataId =
          ((body.data as Record<string, unknown> | undefined)?.id as string | undefined)?.toString() ||
          url.searchParams.get("data.id") ||
          url.searchParams.get("id") ||
          null;
        const requestId = request.headers.get("x-request-id");
        const signature = request.headers.get("x-signature");
        const signatureValid = verifyMpSignature(signature, requestId, dataId);

        // Fase A — Segurança: webhook só é processado com assinatura válida.
        if (!signatureValid) {
          console.warn("[mp marketplace webhook] invalid signature; rejecting");
          return new Response(JSON.stringify({ ok: false }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const mpEventId =
          (body.id ? String(body.id) : null) ||
          (requestId ? `req_${requestId}_${dataId || ""}` : `evt_${Date.now()}_${Math.random()}`);
        const topic = (body.type as string) || (body.topic as string) || url.searchParams.get("topic") || null;
        const action = (body.action as string) || null;

        const db = admin();

        // 1) Idempotência via UNIQUE(mp_event_id)
        const { error: insErr } = await db.from("mercado_pago_webhook_events").insert({
          mp_event_id: mpEventId,
          mp_topic: topic,
          mp_type: topic,
          mp_action: action,
          mp_resource_id: dataId,
          status: "received",
          raw_payload: body,
          signature_valid: signatureValid,
        });
        if (insErr) {
          // duplicado → 200 sem reprocessar
          const code = (insErr as { code?: string }).code;
          if (code === "23505") {
            return new Response(JSON.stringify({ ok: true, duplicate: true }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
          console.error("[mp marketplace webhook] insert event failed", insErr);
        }

        const isPayment = (topic || "").toLowerCase().includes("payment") && dataId;
        if (!isPayment) {
          await db
            .from("mercado_pago_webhook_events")
            .update({ status: "processed", processed_at: new Date().toISOString() })
            .eq("mp_event_id", mpEventId);
          return new Response(JSON.stringify({ ok: true, ignored: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // 2) Localiza transação pelo mp_payment_id (cobrança Pix já tem) ou pelo external_reference (preference)
        let { data: tx } = await db
          .from("payment_transactions")
          .select("*")
          .eq("mp_payment_id", String(dataId))
          .maybeSingle();

        let companyIdForToken: string | null = tx?.company_id || null;

        if (!tx) {
          // Preference flow: precisamos consultar o pagamento com o token do dono via external_reference.
          // Como não temos a referência, tentamos buscar nos eventos relacionados.
          // Estratégia: consultar com o token da empresa cujo preference está pendente.
          // Para simplificar, buscamos transações pending com mp_preference_id != null e tentamos casar.
          const { data: candidates } = await db
            .from("payment_transactions")
            .select("*")
            .eq("status", "pending")
            .not("mp_preference_id", "is", null)
            .order("created_at", { ascending: false })
            .limit(50);
          for (const c of candidates ?? []) {
            try {
              const token = await getOwnerAccessToken(c.company_id);
              const mp = await fetchMpPayment(String(dataId), token);
              if (mp && String(mp.external_reference || "") === c.external_reference) {
                tx = c;
                companyIdForToken = c.company_id;
                break;
              }
            } catch {
              continue;
            }
          }
        }

        if (!tx || !companyIdForToken) {
          await db
            .from("mercado_pago_webhook_events")
            .update({
              status: "processed",
              processed_at: new Date().toISOString(),
              error: "transaction_not_found",
            })
            .eq("mp_event_id", mpEventId);
          return new Response(JSON.stringify({ ok: true, orphan: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // 3) Confirma status real com a API do MP via token do dono
        let mp: Record<string, unknown> | null = null;
        try {
          const token = await getOwnerAccessToken(companyIdForToken);
          mp = await fetchMpPayment(String(dataId), token);
        } catch (e) {
          console.error("[mp marketplace webhook] fetch payment failed", e);
          await db
            .from("mercado_pago_webhook_events")
            .update({ error: "fetch_failed" })
            .eq("mp_event_id", mpEventId);
          return new Response(JSON.stringify({ ok: true, retry: true }), {
            status: 202,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (!mp) {
          await db
            .from("mercado_pago_webhook_events")
            .update({
              status: "processed",
              processed_at: new Date().toISOString(),
              error: "payment_not_found",
            })
            .eq("mp_event_id", mpEventId);
          return new Response(JSON.stringify({ ok: true, missing: true }), { status: 200 });
        }

        const newStatus = mapStatus(mp.status as string);
        if (tx.status === newStatus && newStatus === "approved") {
          await db
            .from("mercado_pago_webhook_events")
            .update({ status: "processed", processed_at: new Date().toISOString(), transaction_id: tx.id, company_id: tx.company_id })
            .eq("mp_event_id", mpEventId);
          return new Response(JSON.stringify({ ok: true, alreadyApproved: true }), { status: 200 });
        }

        const paidAt =
          newStatus === "approved" ? new Date().toISOString() : tx.paid_at || null;

        await db
          .from("payment_transactions")
          .update({
            status: newStatus,
            mp_payment_id: String(mp.id || dataId),
            paid_at: paidAt,
            raw_response: mp,
            updated_at: new Date().toISOString(),
          })
          .eq("id", tx.id);

        // 4) Pós-pagamento: criar tarefa de renovação assistida quando aprovado.
        // Fase B — Idempotência: UNIQUE(company_id, customer_id, source_payment_id)
        // garante que retry do MP não duplica a renewal_task.
        if (newStatus === "approved" && tx.customer_id) {
          await db.from("renewal_tasks").upsert(
            {
              company_id: tx.company_id,
              customer_id: tx.customer_id,
              source_payment_id: tx.id,
              kind: "iptv",
              status: "pending",
              notes: `Pagamento aprovado via Mercado Pago (ref ${tx.external_reference}).`,
            },
            {
              onConflict: "company_id,customer_id,source_payment_id",
              ignoreDuplicates: true,
            },
          );
        }

        await db
          .from("mercado_pago_webhook_events")
          .update({
            status: "processed",
            processed_at: new Date().toISOString(),
            transaction_id: tx.id,
            company_id: tx.company_id,
          })
          .eq("mp_event_id", mpEventId);

        return new Response(JSON.stringify({ ok: true, status: newStatus }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
