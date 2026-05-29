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

        // Recupera jobs travados em 'sending' (worker anterior crashou/timeout).
        // Best-effort: nunca falha o run.
        try {
          await supabaseAdmin.rpc("requeue_stuck_whatsapp_messages" as any, {
            p_stale_minutes: 10,
          });
        } catch (e) {
          console.warn("[wa-dispatch] requeue_stuck failed", (e as any)?.message);
        }

        const workerId = `wa-dispatch:${Math.random().toString(36).slice(2, 10)}`;

        // Claim atômico via RPC com FOR UPDATE SKIP LOCKED + locked_at/locked_by.
        const { data: candidates, error } = await supabaseAdmin.rpc(
          "claim_whatsapp_queue_batch" as any,
          { p_limit: 50, p_worker: workerId },
        );

        if (error) {
          console.error("[wa-dispatch] claim failed", error.message);
          return new Response(error.message, { status: 500 });
        }
        if (!candidates?.length) return Response.json({ ok: true, processed: 0 });

        let processed = 0;
        let failed = 0;
        const perInstanceSent: Record<string, number> = {};

        for (const c of candidates as Array<{
          id: string;
          instance_id: string;
          company_id: string;
          to_phone: string;
          body: string;
          attempts: number;
          max_attempts: number;
        }>) {

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
                locked_at: null,
                locked_by: null,
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
                locked_at: null,
                locked_by: null,
              })
              .eq("id", c.id);
            continue;
          }
          // Rate-limit por instância: in-run + janela de 60s no banco.
          const perMinuteCap = inst.per_minute_limit ?? 10;
          const sentThisRun = perInstanceSent[inst.id] ?? 0;
          let overLimit = sentThisRun >= perMinuteCap;
          if (!overLimit) {
            const since = new Date(Date.now() - 60_000).toISOString();
            const { count: recentCount } = await supabaseAdmin
              .from("whatsapp_message_queue")
              .select("id", { count: "exact", head: true })
              .eq("instance_id", inst.id)
              .eq("status", "sent")
              .gte("sent_at", since);
            if ((recentCount ?? 0) >= perMinuteCap) overLimit = true;
          }
          if (overLimit) {
            await supabaseAdmin
              .from("whatsapp_message_queue")
              .update({
                status: "queued",
                next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
                last_error: "rate_limited",
                locked_at: null,
                locked_by: null,
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
              .update({
                status: "failed",
                last_error: "ref_missing",
                locked_at: null,
                locked_by: null,
                failed_at: new Date().toISOString(),
              })
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
                  locked_at: null,
                  locked_by: null,
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
              const nowIso = new Date().toISOString();
              await supabaseAdmin
                .from("whatsapp_message_queue")
                .update({
                  status: willRetry ? "queued" : "failed",
                  attempts,
                  next_attempt_at: new Date(Date.now() + backoff).toISOString(),
                  last_error: (res.error ?? "send_failed").slice(0, 500),
                  locked_at: null,
                  locked_by: null,
                  failed_at: willRetry ? null : nowIso,
                })
                .eq("id", c.id);
              if (!willRetry) failed++;
            }
          } catch (err: any) {
            // Resultado INCERTO: o request foi disparado contra o provedor mas
            // não obtivemos resposta. Não podemos saber se a mensagem chegou
            // ao cliente. Retry cego duplicaria a mensagem.
            // Política: timeout/abort/network = terminal (failed) com marcador
            // para revisão humana. Sem retry automático.
            const rawMsg = String(err?.message ?? err);
            const isUncertain =
              err?.name === "AbortError" ||
              /timeout|timed out|ETIMEDOUT|ECONNRESET|ENETUNREACH|fetch failed|network/i.test(
                rawMsg,
              );
            const attempts = (c.attempts ?? 0) + 1;
            const willRetry = !isUncertain && attempts < (c.max_attempts ?? 5);
            const backoff = Math.min(60 * 60_000, 30_000 * 2 ** attempts);
            const nowIso = new Date().toISOString();
            const lastError = isUncertain
              ? `send_uncertain:${rawMsg}`.slice(0, 500)
              : rawMsg.slice(0, 500);
            await supabaseAdmin
              .from("whatsapp_message_queue")
              .update({
                status: willRetry ? "queued" : "failed",
                attempts,
                next_attempt_at: new Date(Date.now() + backoff).toISOString(),
                last_error: lastError,
                locked_at: null,
                locked_by: null,
                failed_at: willRetry ? null : nowIso,
              })
              .eq("id", c.id);
            if (!willRetry) failed++;
          }
        }

        return Response.json({ ok: true, processed, failed, worker: workerId });
      },
    },
  },
});
