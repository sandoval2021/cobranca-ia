// Server-only: gera e envia resposta automática via IA quando chega
// uma mensagem no webhook do WhatsApp. Inclui memória curta, anti-loop,
// cooldown, limite/hora e handoff humano.

import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { evolutionProvider } from "./evolution.server";
import { openaiChat } from "@/lib/openai.server";
import { logWhatsAppAutomation } from "./automation-log.server";
import { buildAiContext, buildPromptFromContext, type ConvoMemory } from "./ai-context.server";
import { isLowSignal } from "./intent";
import { ensureAiQuota, incrementAiUsage, markPausedByLimit } from "@/lib/billing-saas/quota.server";
import type { WAInstanceRef } from "./provider";
import {
  detectPaymentRequest,
  generateWhatsAppPaymentCharge,
  formatChargeReply,
  type SimplePlan,
} from "@/lib/payments/whatsapp-charge.server";

const COOLDOWN_MS = 8_000;
const HOURLY_LIMIT = 20;
const MAX_MEMORY_MESSAGES = 20;
const MUTE_ON_HUMAN_MS = 12 * 60 * 60 * 1000; // 12h
const MUTE_ON_LOOP_MS = 30 * 60 * 1000; // 30min

function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/@s\.whatsapp\.net|@c\.us|\D/g, "");
  return digits.length >= 8 ? digits : null;
}

function extractText(message: any): string | null {
  if (!message) return null;
  const candidates = [
    message?.conversation,
    message?.extendedTextMessage?.text,
    message?.message?.conversation,
    message?.message?.extendedTextMessage?.text,
    message?.imageMessage?.caption,
    message?.videoMessage?.caption,
    message?.documentMessage?.caption,
    message?.buttonsResponseMessage?.selectedDisplayText,
    message?.listResponseMessage?.title,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

type InboundParts = {
  providerMsgId: string;
  fromPhone: string;
  text: string;
  ageSeconds?: number | null;
};

function parseInbound(payload: any): InboundParts | null {
  const data = payload?.data ?? payload;
  const items = Array.isArray(data?.messages)
    ? data.messages
    : Array.isArray(payload?.messages)
      ? payload.messages
      : [data];
  for (const item of items) {
    if (!item) continue;
    const key = item?.key ?? {};
    if (key?.fromMe) continue;
    if (item?.broadcast || key?.remoteJid === "status@broadcast") continue;
    const remoteJid: string = key?.remoteJid ?? "";
    if (remoteJid.endsWith("@broadcast")) continue;
    if (remoteJid.endsWith("@g.us")) continue; // grupos
    const phone = normalizePhone(remoteJid) ?? normalizePhone(item?.from) ?? normalizePhone(item?.remoteJid);
    const text = extractText(item?.message ?? item);
    const id = key?.id ?? item?.id ?? item?.messageId ?? item?.key?.id;
    const rawTs = Number(item?.messageTimestamp ?? item?.timestamp ?? 0);
    const tsMs = rawTs > 10_000_000_000 ? rawTs : rawTs * 1000;
    const ageSeconds = tsMs > 0 ? Math.floor((Date.now() - tsMs) / 1000) : null;
    if (ageSeconds !== null && ageSeconds > 300) continue;
    if (!phone || !text || !id) continue;
    return { providerMsgId: String(id), fromPhone: phone, text, ageSeconds };
  }
  return null;
}

type ConvoStateRow = {
  id: string;
  last_messages: ConvoMemory["last_messages"];
  summary: string | null;
  flags: Record<string, unknown>;
  classification: string | null;
  needs_human: boolean;
  muted_until: string | null;
  responses_hour_window: string[];
  last_response_hash: string | null;
  last_response_at: string | null;
  human_notified_at: string | null;
  total_messages_in: number;
  total_messages_out: number;
};

async function loadOrCreateConvoState(
  companyId: string,
  instanceId: string,
  fromPhone: string,
): Promise<ConvoStateRow> {
  const { data: existing } = await supabaseAdmin
    .from("whatsapp_conversation_state")
    .select("*")
    .eq("instance_id", instanceId)
    .eq("from_phone", fromPhone)
    .maybeSingle();
  if (existing) return existing as unknown as ConvoStateRow;
  const { data: inserted, error } = await supabaseAdmin
    .from("whatsapp_conversation_state")
    .insert({ company_id: companyId, instance_id: instanceId, from_phone: fromPhone })
    .select("*")
    .single();
  if (error) throw error;
  return inserted as unknown as ConvoStateRow;
}

function pruneHourWindow(window: string[] | null | undefined): string[] {
  const cutoff = Date.now() - 60 * 60 * 1000;
  return (window ?? []).filter((iso) => {
    const t = Date.parse(iso);
    return Number.isFinite(t) && t >= cutoff;
  });
}

function hashText(t: string): string {
  return createHash("sha1").update(t.trim().toLowerCase()).digest("hex").slice(0, 16);
}

async function notifyHuman(ref: WAInstanceRef, handoffNumber: string, fromPhone: string, reason: string, snippet: string) {
  try {
    const msg = `⚠️ IA pausada com ${fromPhone}\nMotivo: ${reason}\nÚltima mensagem: "${snippet.slice(0, 200)}"`;
    await evolutionProvider.sendText(ref, handoffNumber, msg);
  } catch (err) {
    console.error("[ai-reply] notifyHuman failed", err);
  }
}

export async function handleInboundForAiReply(
  ref: WAInstanceRef,
  payload: any,
): Promise<{ handled: boolean; reason?: string }> {
  const parts = parseInbound(payload);
  if (!parts) {
    await logWhatsAppAutomation({
      instance_id: ref.id,
      company_id: ref.company_id,
      event_type: "message_ignored",
      status: "skipped",
      provider_event: payload?.event ?? payload?.type ?? null,
      provider_instance: payload?.instance ?? ref.provider_instance_id,
      details: { reason: "no_valid_inbound" },
    });
    return { handled: false, reason: "no_inbound" };
  }

  await logWhatsAppAutomation({
    instance_id: ref.id,
    company_id: ref.company_id,
    event_type: "message_received",
    status: "ok",
    provider_event: payload?.event ?? payload?.type ?? null,
    provider_instance: payload?.instance ?? ref.provider_instance_id,
    from_phone: parts.fromPhone,
    message_preview: parts.text,
    details: { providerMsgId: parts.providerMsgId, ageSeconds: parts.ageSeconds ?? null },
  });

  // Anti-loop nível 1: low-signal (vazio, emoji-only, <2 chars)
  const lowSig = isLowSignal(parts.text);
  if (lowSig.skip) {
    await logWhatsAppAutomation({
      instance_id: ref.id, company_id: ref.company_id,
      event_type: "ai_reply_skipped", status: "skipped",
      from_phone: parts.fromPhone, message_preview: parts.text,
      details: { reason: lowSig.reason },
    });
    return { handled: false, reason: lowSig.reason };
  }

  // Carrega config da instância
  const { data: inst } = await supabaseAdmin
    .from("whatsapp_instances")
    .select("id, company_id, ai_reply_enabled, ai_system_prompt, status, daily_sent_count")
    .eq("id", ref.id)
    .maybeSingle();
  if (!inst) return { handled: false, reason: "instance_missing" };
  if (!inst.ai_reply_enabled) {
    await logWhatsAppAutomation({
      instance_id: ref.id, company_id: ref.company_id,
      event_type: "ai_reply_skipped", status: "skipped",
      from_phone: parts.fromPhone, message_preview: parts.text,
      details: { reason: "ai_disabled" },
    });
    return { handled: false, reason: "ai_disabled" };
  }
  if (inst.status !== "connected") {
    await logWhatsAppAutomation({
      instance_id: ref.id, company_id: ref.company_id,
      event_type: "ai_reply_skipped", status: "skipped",
      from_phone: parts.fromPhone, message_preview: parts.text,
      details: { reason: "not_connected", status: inst.status },
    });
    return { handled: false, reason: "not_connected" };
  }

  // Dedup pelo provider_msg_id
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("whatsapp_inbound_messages")
    .insert({
      instance_id: inst.id,
      company_id: inst.company_id,
      provider_msg_id: parts.providerMsgId,
      from_phone: parts.fromPhone,
      body: parts.text,
      reply_status: "pending",
    })
    .select("id")
    .single();
  if (insErr) {
    if ((insErr as any).code === "23505") return { handled: false, reason: "duplicate" };
    return { handled: false, reason: `db:${(insErr as any).message ?? "insert error"}` };
  }
  const inboundId = inserted!.id;

  // Estado da conversa (memória + limites)
  const state = await loadOrCreateConvoState(inst.company_id, inst.id, parts.fromPhone);
  const now = Date.now();

  // Silêncio ativo (handoff humano ou loop)
  if (state.muted_until && Date.parse(state.muted_until) > now) {
    await supabaseAdmin
      .from("whatsapp_inbound_messages")
      .update({ reply_status: "muted", reply_error: "muted_until" })
      .eq("id", inboundId);
    await logWhatsAppAutomation({
      instance_id: inst.id, company_id: inst.company_id,
      event_type: "ai_reply_skipped", status: "skipped",
      from_phone: parts.fromPhone, message_preview: parts.text,
      details: { reason: "muted", needs_human: state.needs_human, until: state.muted_until },
    });
    return { handled: false, reason: "muted" };
  }

  // Cooldown 8s
  if (state.last_response_at && now - Date.parse(state.last_response_at) < COOLDOWN_MS) {
    await logWhatsAppAutomation({
      instance_id: inst.id, company_id: inst.company_id,
      event_type: "ai_reply_skipped", status: "skipped",
      from_phone: parts.fromPhone, message_preview: parts.text,
      details: { reason: "cooldown" },
    });
    return { handled: false, reason: "cooldown" };
  }

  // Limite por hora
  const window = pruneHourWindow(state.responses_hour_window);
  if (window.length >= HOURLY_LIMIT) {
    await supabaseAdmin
      .from("whatsapp_conversation_state")
      .update({
        needs_human: true,
        human_reason: "hourly_limit_reached",
        muted_until: new Date(now + MUTE_ON_HUMAN_MS).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", state.id);
    await logWhatsAppAutomation({
      instance_id: inst.id, company_id: inst.company_id,
      event_type: "ai_handoff_human", status: "ok",
      from_phone: parts.fromPhone, message_preview: parts.text,
      details: { reason: "hourly_limit_reached" },
    });
    return { handled: false, reason: "hourly_limit" };
  }

  // Memória curta para o contexto
  const memory: ConvoMemory = {
    last_messages: Array.isArray(state.last_messages) ? state.last_messages : [],
    summary: state.summary,
    flags: state.flags ?? {},
  };

  const ctx = await buildAiContext({
    companyId: inst.company_id,
    fromPhone: parts.fromPhone,
    text: parts.text,
    memory,
  });

  // Carrega settings p/ notificar humano
  const { data: aiSettings } = await supabaseAdmin
    .from("ai_company_settings")
    .select("human_handoff_number")
    .eq("company_id", inst.company_id)
    .maybeSingle();
  const handoffNumber = aiSettings?.human_handoff_number ?? null;

  const { system, contextBlock } = buildPromptFromContext(ctx);
  const baseSystem = (inst.ai_system_prompt && inst.ai_system_prompt.trim()) || "";
  const finalSystem = [baseSystem, system, contextBlock].filter(Boolean).join("\n\n");

  // Constrói messages com memória curta
  const historyMsgs = memory.last_messages.slice(-10).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.text,
  }));

  // ===== Gate de quota de IA (plano SaaS do dono) =====
  const quota = await ensureAiQuota(inst.company_id);
  if (!quota.allowed) {
    await markPausedByLimit(inst.company_id, quota.cycle?.id);
    await logWhatsAppAutomation({
      instance_id: inst.id, company_id: inst.company_id,
      event_type: "ai_reply_blocked_quota", status: "skipped",
      from_phone: parts.fromPhone, message_preview: parts.text,
      details: { reason: quota.reason, used: quota.used, total: quota.total },
    });
    // Notifica dono 1x por ciclo
    if (handoffNumber && !quota.cycle?.blocked_at) {
      await notifyHuman(
        ref,
        handoffNumber,
        parts.fromPhone,
        "limite_ia_atingido",
        `Sua cota mensal de respostas IA acabou (${quota.used}/${quota.total}). Compre um pacote extra ou troque de plano para reativar.`,
      );
    }
    await supabaseAdmin
      .from("whatsapp_inbound_messages")
      .update({ reply_status: "skipped", reply_error: "quota_exceeded" })
      .eq("id", inboundId);
    return { handled: false, reason: "quota_exceeded" };
  }

  try {
    await logWhatsAppAutomation({
      instance_id: inst.id, company_id: inst.company_id,
      event_type: "ai_prompt_prepared", status: "ok",
      from_phone: parts.fromPhone, message_preview: parts.text,
      details: {
        intent: ctx.intent,
        classification: ctx.classification,
        priceGroup: ctx.priceGroup?.name ?? null,
        plansCount: ctx.priceGroup?.plans.length ?? 0,
        needsHuman: ctx.needsHuman,
        app: ctx.app.name,
        issue: ctx.app.issue,
        memoryMsgs: memory.last_messages.length,
      },
    });

    const result = await openaiChat({
      messages: [
        { role: "system", content: finalSystem },
        ...historyMsgs,
        { role: "user", content: parts.text },
      ],
      max_tokens: 280,
      temperature: 0.4,
      timeout_ms: 25_000,
    });
    let reply = result.text?.trim();
    if (!reply) throw new Error("resposta vazia");

    // Anti-loop nível 2: hash dedupe (não responder igual à última)
    const replyHash = hashText(reply);
    if (state.last_response_hash && state.last_response_hash === replyHash) {
      await supabaseAdmin
        .from("whatsapp_conversation_state")
        .update({
          needs_human: true,
          human_reason: "loop_detected",
          muted_until: new Date(now + MUTE_ON_LOOP_MS).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", state.id);
      await logWhatsAppAutomation({
        instance_id: inst.id, company_id: inst.company_id,
        event_type: "ai_handoff_human", status: "ok",
        from_phone: parts.fromPhone, message_preview: reply,
        details: { reason: "loop_detected" },
      });
      if (handoffNumber && !state.human_notified_at) {
        await notifyHuman(ref, handoffNumber, parts.fromPhone, "loop_detected", parts.text);
      }
      return { handled: false, reason: "loop_detected" };
    }

    await logWhatsAppAutomation({
      instance_id: inst.id, company_id: inst.company_id,
      event_type: "ai_reply_generated", status: "ok",
      from_phone: parts.fromPhone, message_preview: reply,
      details: { model: result.model, usage: result.usage, classification: ctx.classification },
    });

    const send = await evolutionProvider.sendText(ref, parts.fromPhone, reply);
    if (!send.ok) throw new Error(send.error || "falha ao enviar");

    await logWhatsAppAutomation({
      instance_id: inst.id, company_id: inst.company_id,
      event_type: "whatsapp_reply_sent", status: "ok",
      from_phone: parts.fromPhone, message_preview: reply,
      details: { providerMsgId: send.provider_msg_id ?? null },
    });

    await supabaseAdmin
      .from("whatsapp_inbound_messages")
      .update({
        reply_text: reply,
        reply_status: "sent",
        replied_at: new Date().toISOString(),
      })
      .eq("id", inboundId);

    await supabaseAdmin
      .from("whatsapp_instances")
      .update({
        last_activity_at: new Date().toISOString(),
        daily_sent_count: ((inst as any).daily_sent_count ?? 0) + 1,
      })
      .eq("id", inst.id);

    // Incrementa contador de quota IA do mês (fonte da verdade do plano SaaS)
    await incrementAiUsage(inst.company_id);


    // Atualiza memória curta + flags + limites
    const nowIso = new Date().toISOString();
    const updatedMessages = [
      ...memory.last_messages,
      { role: "user" as const, text: parts.text, at: nowIso },
      { role: "assistant" as const, text: reply, at: nowIso },
    ].slice(-MAX_MEMORY_MESSAGES);

    const updatedFlags: Record<string, unknown> = { ...memory.flags };
    if (ctx.app.name) updatedFlags.app_in_use = ctx.app.name;
    if (ctx.intent === "trial") updatedFlags.asked_trial = true;
    if (ctx.intent === "payment") updatedFlags.sent_payment_claim = true;
    if (ctx.app.issue) updatedFlags.last_issue = ctx.app.issue;

    // Handoff humano (após responder uma vez educadamente)
    const willMuteForHuman = ctx.needsHuman;
    const mutedUntil = willMuteForHuman
      ? new Date(now + MUTE_ON_HUMAN_MS).toISOString()
      : null;

    await supabaseAdmin
      .from("whatsapp_conversation_state")
      .update({
        last_messages: updatedMessages as any,
        flags: updatedFlags as any,
        classification: ctx.classification,
        needs_human: willMuteForHuman || state.needs_human,
        human_reason: willMuteForHuman ? ctx.reason : (state.needs_human ? state.classification : null),
        muted_until: mutedUntil ?? state.muted_until,
        responses_hour_window: [...window, nowIso] as any,
        last_response_hash: replyHash,
        last_response_at: nowIso,
        total_messages_in: (state.total_messages_in ?? 0) + 1,
        total_messages_out: (state.total_messages_out ?? 0) + 1,
        updated_at: nowIso,
      })
      .eq("id", state.id);


    if (willMuteForHuman && handoffNumber && !state.human_notified_at) {
      await notifyHuman(ref, handoffNumber, parts.fromPhone, ctx.reason ?? "handoff", parts.text);
      await supabaseAdmin
        .from("whatsapp_conversation_state")
        .update({ human_notified_at: nowIso })
        .eq("id", state.id);
    }

    return { handled: true };
  } catch (err: any) {
    await logWhatsAppAutomation({
      instance_id: inst.id, company_id: inst.company_id,
      event_type: "ai_pipeline_error", status: "error",
      from_phone: parts.fromPhone, message_preview: parts.text,
      error: String(err?.message ?? err),
      details: { stack: err?.stack ? String(err.stack).slice(0, 1200) : null },
    });
    await supabaseAdmin
      .from("whatsapp_inbound_messages")
      .update({
        reply_status: "error",
        reply_error: String(err?.message ?? err).slice(0, 500),
      })
      .eq("id", inboundId);
    return { handled: false, reason: `ai:${err?.message ?? err}` };
  }
}
