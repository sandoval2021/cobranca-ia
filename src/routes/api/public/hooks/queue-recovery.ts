// Cron recovery — chama RPCs de requeue para WhatsApp e renewal_tasks.
// Protegido por header `x-cobraeasy-cron-secret` (timing-safe equal).
// Não reenfileira envio incerto: requeue_stuck_whatsapp_messages marca como
// failed (terminal) com last_error contendo "send_uncertain_stuck".

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function checkAuth(request: Request): boolean {
  const provided = request.headers.get("x-cobraeasy-cron-secret") || "";
  const expected = process.env.CRON_HOOK_SECRET || "";
  if (!expected) return false;
  return Boolean(provided) && timingSafeEq(provided, expected);
}

export const Route = createFileRoute("/api/public/hooks/queue-recovery")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!checkAuth(request)) {
          return new Response("unauthorized", { status: 401 });
        }

        let waMarkedUncertain = 0;
        let renewalRequeued = 0;

        try {
          const { data } = await supabaseAdmin.rpc(
            "requeue_stuck_whatsapp_messages" as any,
            { p_stale_minutes: 10 },
          );
          waMarkedUncertain = Number(data ?? 0);
        } catch {
          // ignora — relata 0
        }

        try {
          const { data } = await supabaseAdmin.rpc(
            "requeue_stuck_renewal_tasks" as any,
            { p_stale_minutes: 30 },
          );
          renewalRequeued = Number(data ?? 0);
        } catch {
          // ignora — relata 0
        }

        return Response.json({
          ok: true,
          whatsapp_marked_uncertain: waMarkedUncertain,
          renewal_requeued: renewalRequeued,
        });
      },
    },
  },
});
