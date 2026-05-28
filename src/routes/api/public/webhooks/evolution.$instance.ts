// Webhook Evolution — autenticado por HMAC (header x-evolution-signature)
// usando webhook_secret da VPS.

import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadInstanceRef } from "@/lib/whatsapp/evolution.server";
import { handleInboundForAiReply } from "@/lib/whatsapp/ai-reply.server";
import { logWhatsAppAutomation, payloadSummary } from "@/lib/whatsapp/automation-log.server";

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function mapState(s: unknown): "connected" | "disconnected" | "awaiting_qr" | "blocked" | "error" {
  const v = String(s ?? "").toLowerCase();
  if (["open", "connected"].includes(v)) return "connected";
  if (["connecting", "qr", "awaiting_qr"].includes(v)) return "awaiting_qr";
  if (["close", "closed", "disconnected", "logout"].includes(v)) return "disconnected";
  if (["banned", "blocked"].includes(v)) return "blocked";
  return "error";
}

export const Route = createFileRoute("/api/public/webhooks/evolution/$instance")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const instanceId = params.instance;
        if (!instanceId || !/^[0-9a-f-]{36}$/i.test(instanceId)) {
          return new Response("bad instance", { status: 400 });
        }
        const ref = await loadInstanceRef(instanceId);
        if (!ref) return new Response("not found", { status: 404 });
        return Response.json({ ok: true, instance: ref.id, provider_instance: ref.provider_instance_id });
      },
      POST: async ({ request, params }) => {
        const instanceId = params.instance;
        if (!instanceId || !/^[0-9a-f-]{36}$/i.test(instanceId)) {
          return new Response("bad instance", { status: 400 });
        }

        const ref = await loadInstanceRef(instanceId);
        if (!ref) return new Response("not found", { status: 404 });

        const body = await request.text();
        const url = new URL(request.url);
        const secretParam = url.searchParams.get("secret") || "";
        const sig =
          request.headers.get("x-evolution-signature") ||
          request.headers.get("x-hub-signature-256") ||
          "";

        const expected = createHmac("sha256", ref.vps.webhook_secret)
          .update(body)
          .digest("hex");

        const normalized = sig.replace(/^sha256=/, "");
        const hasValidSignature = Boolean(normalized && safeEqual(normalized, expected));
        const hasValidSecretParam = Boolean(secretParam && safeEqual(secretParam, ref.vps.webhook_secret));
        if (!hasValidSignature && !hasValidSecretParam) {
          console.error("[wa-webhook] invalid signature", { instanceId, hasSignature: Boolean(sig), hasSecretParam: Boolean(secretParam) });
          return new Response("invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("invalid json", { status: 400 });
        }

        const event = String(payload?.event || payload?.type || "").toLowerCase();
        const now = new Date().toISOString();

        console.info("[wa-webhook] hit", { instanceId, event, providerInstance: payload?.instance ?? null });
        await logWhatsAppAutomation({
          instance_id: ref.id,
          company_id: ref.company_id,
          event_type: "webhook_hit",
          status: "ok",
          provider_event: event || null,
          provider_instance: payload?.instance ?? ref.provider_instance_id,
          details: payloadSummary(payload),
        });

        const patch: any = { last_activity_at: now };

        if (event.includes("connection") || event === "connection_update") {
          const state = payload?.data?.state || payload?.state;
          patch.status = mapState(state);
          if (patch.status === "connected") {
            patch.qr_code = null;
            patch.qr_expires_at = null;
            const phone = payload?.data?.wuid || payload?.data?.number;
            if (phone) patch.phone_number = String(phone);
          }
        } else if (event.includes("qrcode")) {
          const qr = payload?.data?.qrcode?.base64 || payload?.data?.qrcode || null;
          patch.status = "awaiting_qr";
          patch.qr_code = qr;
          patch.qr_expires_at = new Date(Date.now() + 45_000).toISOString();
        } else if (event.includes("logout") || event.includes("disconnect")) {
          patch.status = "disconnected";
          patch.qr_code = null;
          patch.qr_expires_at = null;
        } else if (event.includes("banned") || event.includes("blocked")) {
          patch.status = "blocked";
        }

        await supabaseAdmin
          .from("whatsapp_instances")
          .update(patch)
          .eq("id", ref.id);

        // Mensagens recebidas → resposta automática por IA (se ativada).
        if (event.includes("messages.upsert") || event.includes("message")) {
          try {
            const result = await handleInboundForAiReply(ref, payload);
            console.info("[wa-webhook] ai-reply result", result);
          } catch (err) {
            console.error("[wa-webhook] ai-reply error", err);
            await logWhatsAppAutomation({
              instance_id: ref.id,
              company_id: ref.company_id,
              event_type: "webhook_handler_error",
              status: "error",
              provider_event: event || null,
              provider_instance: payload?.instance ?? ref.provider_instance_id,
              error: String((err as any)?.message ?? err),
            });
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
