import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadInstanceRef } from "./evolution.server";
import { handleInboundForAiReply } from "./ai-reply.server";
import { logWhatsAppAutomation, payloadSummary } from "./automation-log.server";

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function webhookRequestDetails(request: Request, reason: string, instanceId: string | null): Record<string, unknown> {
  const url = new URL(request.url);
  if (url.searchParams.has("secret")) url.searchParams.set("secret", "[redacted]");
  const headerNames = [
    "content-type",
    "user-agent",
    "x-evolution-signature",
    "x-hub-signature-256",
    "x-cobraeasy-webhook-secret",
    "x-forwarded-for",
    "cf-connecting-ip",
  ];
  return {
    reason,
    instanceId,
    method: request.method,
    url: url.toString(),
    headers: Object.fromEntries(
      headerNames.map((name) => [name, request.headers.has(name) ? "present" : "missing"]),
    ),
  };
}

function mapState(s: unknown): "connected" | "disconnected" | "awaiting_qr" | "blocked" | "error" {
  const v = String(s ?? "").toLowerCase();
  if (["open", "connected"].includes(v)) return "connected";
  if (["connecting", "qr", "awaiting_qr"].includes(v)) return "awaiting_qr";
  if (["close", "closed", "disconnected", "logout"].includes(v)) return "disconnected";
  if (["banned", "blocked"].includes(v)) return "blocked";
  return "error";
}

function resolveInstanceId(request: Request, pathInstance?: string): string | null {
  const queryInstance = new URL(request.url).searchParams.get("instance_id");
  const value = pathInstance || queryInstance || "";
  return /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

export async function handleEvolutionWebhookGet(request: Request, pathInstance?: string): Promise<Response> {
  const instanceId = resolveInstanceId(request, pathInstance);
  if (!instanceId) return jsonResponse({ ok: false, error: "bad_instance" }, 400);
  const ref = await loadInstanceRef(instanceId);
  if (!ref) return jsonResponse({ ok: false, error: "instance_not_found" }, 404);
  return Response.json({ ok: true, instance: ref.id, provider_instance: ref.provider_instance_id });
}

export async function handleEvolutionWebhookPost(request: Request, pathInstance?: string): Promise<Response> {
  const instanceId = resolveInstanceId(request, pathInstance);
  if (!instanceId) {
    console.error("[wa-webhook] blocked", webhookRequestDetails(request, "bad_instance", null));
    return jsonResponse({ ok: false, error: "bad_instance" }, 400);
  }

  const ref = await loadInstanceRef(instanceId);
  if (!ref) {
    console.error("[wa-webhook] blocked", webhookRequestDetails(request, "instance_not_found", instanceId));
    return jsonResponse({ ok: false, error: "instance_not_found" }, 404);
  }

  const body = await request.text();
  const url = new URL(request.url);
  const secretParam = url.searchParams.get("secret") || "";
  const secretHeader = request.headers.get("x-cobraeasy-webhook-secret") || "";
  const sig = request.headers.get("x-evolution-signature") || request.headers.get("x-hub-signature-256") || "";
  const expected = createHmac("sha256", ref.vps.webhook_secret).update(body).digest("hex");
  const normalized = sig.replace(/^sha256=/, "");
  const hasValidSignature = Boolean(normalized && safeEqual(normalized, expected));
  const hasValidSecretParam = Boolean(secretParam && safeEqual(secretParam, ref.vps.webhook_secret));
  const hasValidSecretHeader = Boolean(secretHeader && safeEqual(secretHeader, ref.vps.webhook_secret));
  if (!hasValidSignature && !hasValidSecretParam && !hasValidSecretHeader) {
    const details = {
      ...webhookRequestDetails(request, "invalid_secret_or_signature", instanceId),
      instanceFound: true,
      hasSignature: Boolean(sig),
      hasSecretParam: Boolean(secretParam),
      hasSecretHeader: Boolean(secretHeader),
      signatureValid: hasValidSignature,
      secretParamValid: hasValidSecretParam,
      secretHeaderValid: hasValidSecretHeader,
    };
    console.error("[wa-webhook] blocked", details);
    await logWhatsAppAutomation({
      instance_id: ref.id,
      company_id: ref.company_id,
      event_type: "webhook_blocked",
      status: "error",
      provider_instance: ref.provider_instance_id,
      error: "invalid_secret_or_signature",
      details,
    });
    return jsonResponse({ ok: false, error: "invalid_secret_or_signature" }, 401);
  }

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const event = String(payload?.event || payload?.type || "").toLowerCase();
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

  const patch: any = { last_activity_at: new Date().toISOString() };
  if (event.includes("connection") || event === "connection_update") {
    patch.status = mapState(payload?.data?.state || payload?.state);
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

  await supabaseAdmin.from("whatsapp_instances").update(patch).eq("id", ref.id);

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

  return jsonResponse({ ok: true }, 200);
}