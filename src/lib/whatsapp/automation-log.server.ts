import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type WhatsAppAutomationLogInput = {
  instance_id?: string | null;
  company_id: string;
  event_type: string;
  status: "ok" | "error" | "skipped" | "pending";
  provider_event?: string | null;
  provider_instance?: string | null;
  from_phone?: string | null;
  message_preview?: string | null;
  details?: Record<string, unknown>;
  error?: string | null;
};

function trim(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export async function logWhatsAppAutomation(entry: WhatsAppAutomationLogInput): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("whatsapp_automation_logs").insert({
      instance_id: entry.instance_id ?? null,
      company_id: entry.company_id,
      event_type: trim(entry.event_type, 80) ?? "unknown",
      status: entry.status,
      provider_event: trim(entry.provider_event, 120),
      provider_instance: trim(entry.provider_instance, 160),
      from_phone: trim(entry.from_phone, 40),
      message_preview: trim(entry.message_preview, 240),
      details: entry.details ?? {},
      error: trim(entry.error, 500),
    });
    if (error) console.error("[wa-automation-log] insert failed", error.message);
  } catch (err) {
    console.error("[wa-automation-log] unexpected failure", err);
  }
}

export function payloadSummary(payload: any): Record<string, unknown> {
  const data = payload?.data ?? payload;
  const key = data?.key ?? {};
  return {
    event: payload?.event ?? payload?.type ?? null,
    instance: payload?.instance ?? data?.instance ?? null,
    dataKeys: data && typeof data === "object" ? Object.keys(data).slice(0, 30) : [],
    messageId: key?.id ?? data?.id ?? data?.messageId ?? null,
    remoteJid: key?.remoteJid ?? data?.remoteJid ?? null,
    fromMe: key?.fromMe ?? data?.fromMe ?? null,
    messageType: data?.messageType ?? data?.type ?? null,
    messageTimestamp: data?.messageTimestamp ?? data?.timestamp ?? null,
  };
}