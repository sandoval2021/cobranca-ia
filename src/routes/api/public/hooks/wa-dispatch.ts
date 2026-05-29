// Worker fila WhatsApp — chamado por pg_cron a cada minuto.
// Autenticação via apikey (Supabase anon).

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { evolutionProvider, loadInstanceRef } from "@/lib/whatsapp/evolution.server";

const JITTER_MIN_MS = 4000;
const JITTER_MAX_MS = 12000;
const NIGHT_START_H = 22;
const NIGHT_END_H = 7;

function isNight(d = new Date()): boolean {
  const h = d.getUTCHours(); // ideal seria fuso da empresa; UTC por enquanto
  return h >= NIGHT_START_H || h < NIGHT_END_H;
}

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function checkAuth(request: Request): boolean {
  const provided = request.headers.get("x-cobraeasy-cron-secret") || "";
  const expected = process.env.CRON_HOOK_SECRET || "";
  if (!expected) {
    console.error("[wa-dispatch] CRON_HOOK_SECRET not configured");
    return false;
  }
  return Boolean(provided) && timingSafeEq(provided, expected);
}

export const Route = createFileRoute("/api/public/hooks/wa-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!checkAuth(request)) {
          return new Response("unauthorized", { status: 401 });
        }
        if (isNight()) {
          return Response.json({ ok: true, skipped: "night_window" });
        }

        const now = new Date().toISOString();
        // Busca lote pronto (FOR UPDATE SKIP LOCKED via RPC futura; por ora claim atômico)
        const { data: candidates, error } = await supabaseAdmin
          .from("whatsapp_message_queue")
          .select("id, instance_id, company_id, to_phone, body, attempts, max_attempts")
          .eq("status", "queued")
          .lte("next_attempt_at", now)
          .order("next_attempt_at", { ascending: true })
          .limit(50);

        if (error) return new Response(error.message, { status: 500 });
        if (!candidates?.length) return Response.json({ ok: true, processed: 0 });

        let processed = 0;
        let failed = 0;
        const perInstanceSent: Record<string, number> = {};

        for (const c of candidates) {
          // Claim atômico: muda queued -> sending somente se ainda for queued
          const { data: claimed } = await supabaseAdmin
            .from("whatsapp_message_queue")
            .update({ status: "sending", updated_at: new Date().toISOString() })
            .eq("id", c.id)
            .eq("status", "queued")
            .select("id")
            .maybeSingle();
          if (!claimed) continue;

          // Carrega instância + limites
          const { data: inst } = await supabaseAdmin
            .from("whatsapp_instances")
            .select("id, status, daily_limit, daily_sent_count, per_minute_limit")
            .eq("id", c.instance_id)
            .maybeSingle();

          if (!inst || inst.status !== "connected") {
            await supabaseAdmin
              .from("whatsapp_message_queue")
              .update({
                status: "queued",
                next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
                last_error: `instance_not_ready:${inst?.status ?? "missing"}`,
              })
              .eq("id", c.id);
            continue;
          }
          if ((inst.daily_sent_count ?? 0) >= (inst.daily_limit ?? 300)) {
            await supabaseAdmin
              .from("whatsapp_message_queue")
              .update({
                status: "queued",
                next_attempt_at: new Date(Date.now() + 30 * 60_000).toISOString(),
                last_error: "daily_limit_reached",
              })
              .eq("id", c.id);
            continue;
          }
          const sentThisRun = perInstanceSent[inst.id] ?? 0;
          if (sentThisRun >= (inst.per_minute_limit ?? 15)) {
            await supabaseAdmin
              .from("whatsapp_message_queue")
              .update({
                status: "queued",
                next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
              })
              .eq("id", c.id);
            continue;
          }

          // Jitter
          const jitter =
            JITTER_MIN_MS + Math.floor(Math.random() * (JITTER_MAX_MS - JITTER_MIN_MS));
          await new Promise((r) => setTimeout(r, jitter));

          const ref = await loadInstanceRef(c.instance_id);
          if (!ref) {
            await supabaseAdmin
              .from("whatsapp_message_queue")
              .update({ status: "failed", last_error: "ref_missing" })
              .eq("id", c.id);
            failed++;
            continue;
          }

          try {
            const res = await evolutionProvider.sendText(ref, c.to_phone, c.body);
            if (res.ok) {
              await supabaseAdmin
                .from("whatsapp_message_queue")
                .update({
                  status: "sent",
                  sent_at: new Date().toISOString(),
                  provider_msg_id: res.provider_msg_id ?? null,
                  last_error: null,
                })
                .eq("id", c.id);
              await supabaseAdmin
                .from("whatsapp_instances")
                .update({
                  daily_sent_count: (inst.daily_sent_count ?? 0) + 1,
                  last_activity_at: new Date().toISOString(),
                })
                .eq("id", inst.id);
              perInstanceSent[inst.id] = sentThisRun + 1;
              processed++;
            } else {
              const attempts = (c.attempts ?? 0) + 1;
              const willRetry = attempts < (c.max_attempts ?? 5);
              const backoff = Math.min(60 * 60_000, 30_000 * 2 ** attempts);
              await supabaseAdmin
                .from("whatsapp_message_queue")
                .update({
                  status: willRetry ? "queued" : "failed",
                  attempts,
                  next_attempt_at: new Date(Date.now() + backoff).toISOString(),
                  last_error: res.error ?? "send_failed",
                })
                .eq("id", c.id);
              if (!willRetry) failed++;
            }
          } catch (err: any) {
            const attempts = (c.attempts ?? 0) + 1;
            const willRetry = attempts < (c.max_attempts ?? 5);
            const backoff = Math.min(60 * 60_000, 30_000 * 2 ** attempts);
            await supabaseAdmin
              .from("whatsapp_message_queue")
              .update({
                status: willRetry ? "queued" : "failed",
                attempts,
                next_attempt_at: new Date(Date.now() + backoff).toISOString(),
                last_error: String(err?.message ?? err).slice(0, 500),
              })
              .eq("id", c.id);
            if (!willRetry) failed++;
          }
        }

        return Response.json({ ok: true, processed, failed });
      },
    },
  },
});
