// Server-only: gera e envia resposta automática via IA quando chega
// uma mensagem no webhook do WhatsApp.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { evolutionProvider } from "./evolution.server";
import { openaiChat } from "@/lib/openai.server";
import { logWhatsAppAutomation } from "./automation-log.server";
import { buildAiContext, buildPromptFromContext } from "./ai-context.server";
import type { WAInstanceRef } from "./provider";


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
    if (remoteJid.endsWith("@g.us")) continue; // ignora grupos
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

  // Carrega config da instância
  const { data: inst } = await supabaseAdmin
    .from("whatsapp_instances")
    .select("id, company_id, ai_reply_enabled, ai_system_prompt, status, daily_sent_count")
    .eq("id", ref.id)
    .maybeSingle();
  if (!inst) return { handled: false, reason: "instance_missing" };
  if (!inst.ai_reply_enabled) {
    await logWhatsAppAutomation({
      instance_id: ref.id,
      company_id: ref.company_id,
      event_type: "ai_reply_skipped",
      status: "skipped",
      provider_instance: ref.provider_instance_id,
      from_phone: parts.fromPhone,
      message_preview: parts.text,
      details: { reason: "ai_disabled" },
    });
    return { handled: false, reason: "ai_disabled" };
  }
  if (inst.status !== "connected") {
    await logWhatsAppAutomation({
      instance_id: ref.id,
      company_id: ref.company_id,
      event_type: "ai_reply_skipped",
      status: "skipped",
      provider_instance: ref.provider_instance_id,
      from_phone: parts.fromPhone,
      message_preview: parts.text,
      details: { reason: "not_connected", status: inst.status },
    });
    return { handled: false, reason: "not_connected" };
  }

  // Insere com dedup. Se já existe, ignora (webhook duplicado).
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
    // unique violation = já processada
    if ((insErr as any).code === "23505") return { handled: false, reason: "duplicate" };
    return { handled: false, reason: `db:${insErr.message}` };
  }
  const inboundId = inserted!.id;

  // Busca cliente pelo telefone (best-effort)
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("name, notes, phone")
    .eq("company_id", inst.company_id)
    .ilike("phone", `%${parts.fromPhone.slice(-8)}%`)
    .limit(1)
    .maybeSingle();

  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("name")
    .eq("id", inst.company_id)
    .maybeSingle();

  const sys = (inst.ai_system_prompt && inst.ai_system_prompt.trim()) || DEFAULT_SYSTEM_PROMPT;
  const contextLines: string[] = [];
  if (company?.name) contextLines.push(`Empresa: ${company.name}.`);
  if (customer?.name) contextLines.push(`Cliente identificado: ${customer.name}.`);
  else contextLines.push(`Cliente não identificado no cadastro (telefone ${parts.fromPhone}).`);
  if (customer?.notes) contextLines.push(`Notas internas: ${customer.notes}`);
  const prompt = `${sys}\n\nContexto:\n${contextLines.join("\n")}`;

  try {
    await logWhatsAppAutomation({
      instance_id: inst.id,
      company_id: inst.company_id,
      event_type: "ai_prompt_prepared",
      status: "ok",
      provider_event: payload?.event ?? payload?.type ?? null,
      provider_instance: ref.provider_instance_id,
      from_phone: parts.fromPhone,
      message_preview: parts.text,
      details: { prompt },
    });
    const result = await openaiChat({
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: parts.text },
      ],
      max_tokens: 280,
      temperature: 0.4,
      timeout_ms: 25_000,
    });
    const reply = result.text?.trim();
    if (!reply) throw new Error("resposta vazia");

    await logWhatsAppAutomation({
      instance_id: inst.id,
      company_id: inst.company_id,
      event_type: "ai_reply_generated",
      status: "ok",
      provider_event: payload?.event ?? payload?.type ?? null,
      provider_instance: ref.provider_instance_id,
      from_phone: parts.fromPhone,
      message_preview: reply,
      details: { model: result.model, usage: result.usage },
    });

    const send = await evolutionProvider.sendText(ref, parts.fromPhone, reply);
    if (!send.ok) throw new Error(send.error || "falha ao enviar");

    await logWhatsAppAutomation({
      instance_id: inst.id,
      company_id: inst.company_id,
      event_type: "whatsapp_reply_sent",
      status: "ok",
      provider_event: payload?.event ?? payload?.type ?? null,
      provider_instance: ref.provider_instance_id,
      from_phone: parts.fromPhone,
      message_preview: reply,
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

    return { handled: true };
  } catch (err: any) {
    await logWhatsAppAutomation({
      instance_id: inst.id,
      company_id: inst.company_id,
      event_type: "ai_pipeline_error",
      status: "error",
      provider_event: payload?.event ?? payload?.type ?? null,
      provider_instance: ref.provider_instance_id,
      from_phone: parts.fromPhone,
      message_preview: parts.text,
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
