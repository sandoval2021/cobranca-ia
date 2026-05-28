// Webhook Evolution — autenticado por HMAC (header x-evolution-signature)
// usando webhook_secret da VPS.

import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadInstanceRef } from "@/lib/whatsapp/evolution.server";

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
      POST: async ({ request, params }) => {
        const instanceId = params.instance;
        if (!instanceId || !/^[0-9a-f-]{36}$/i.test(instanceId)) {
          return new Response("bad instance", { status: 400 });
        }

        const ref = await loadInstanceRef(instanceId);
        if (!ref) return new Response("not found", { status: 404 });

        const body = await request.text();
        const sig =
          request.headers.get("x-evolution-signature") ||
          request.headers.get("x-hub-signature-256") ||
          "";

        const expected = createHmac("sha256", ref.vps.webhook_secret)
          .update(body)
          .digest("hex");

        const normalized = sig.replace(/^sha256=/, "");
        if (!normalized || !safeEqual(normalized, expected)) {
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

        const patch: Record<string, unknown> = { last_activity_at: now };

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

        return new Response("ok", { status: 200 });
      },
    },
  },
});
