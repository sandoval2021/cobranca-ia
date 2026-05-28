// Implementação real do provider Evolution (server-only).
// Respeita flag ALLOW_REAL_WHATSAPP — em "false" simula sem chamar a VPS.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type {
  WAInstanceRef,
  WAVpsNode,
  WAQrResult,
  WAStatus,
  WASendResult,
  WACreateResult,
  WhatsAppProvider,
} from "./provider";

const REAL = (process.env.ALLOW_REAL_WHATSAPP ?? "false").toLowerCase() === "true";

function headers(vps: WAVpsNode): HeadersInit {
  return {
    "Content-Type": "application/json",
    apikey: vps.api_token,
  };
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

async function callEvolution(
  vps: WAVpsNode,
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: any; text: string }> {
  const url = joinUrl(vps.base_url, path);
  const res = await fetch(url, {
    ...init,
    headers: { ...headers(vps), ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data, text };
}

function mapEvolutionStatus(s: unknown): WAStatus {
  const v = String(s ?? "").toLowerCase();
  if (v === "open" || v === "connected") return "connected";
  if (v === "connecting" || v === "qr" || v === "awaiting_qr") return "awaiting_qr";
  if (v === "close" || v === "closed" || v === "disconnected") return "disconnected";
  if (v === "banned" || v === "blocked") return "blocked";
  return "error";
}

export const evolutionProvider: WhatsAppProvider = {
  async createInstance({ vps, friendly_name, webhook_url, phone_number }) {
    if (!REAL) {
      const now = Date.now();
      return {
        provider_instance_id: `sim_${now}`,
        qr_code: phone_number ? null : `sim-qr-${now}`,
        qr_expires_at: phone_number ? null : new Date(now + 45_000).toISOString(),
        pairing_code: phone_number ? "ABCD-1234" : null,
        pairing_code_expires_at: phone_number
          ? new Date(now + 60_000).toISOString()
          : null,
        status: "awaiting_qr",
      } satisfies WACreateResult;
    }

    const body: Record<string, unknown> = {
      instanceName: friendly_name,
      qrcode: !phone_number,
      integration: "WHATSAPP-BAILEYS",
      webhook: {
        url: webhook_url,
        events: [
          "QRCODE_UPDATED",
          "CONNECTION_UPDATE",
          "MESSAGES_UPSERT",
          "SEND_MESSAGE",
        ],
      },
    };
    if (phone_number) body.number = phone_number;

    const res = await callEvolution(vps, "/instance/create", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`evolution.createInstance failed: ${res.status} ${res.text}`);
    }

    const providerId: string =
      res.data?.instance?.instanceName ||
      res.data?.instance?.instanceId ||
      friendly_name;
    const qr = res.data?.qrcode?.base64 || res.data?.qrcode?.code || null;
    const pairing =
      res.data?.qrcode?.pairingCode ||
      res.data?.pairingCode ||
      res.data?.instance?.pairingCode ||
      null;

    return {
      provider_instance_id: providerId,
      qr_code: qr,
      qr_expires_at: qr ? new Date(Date.now() + 45_000).toISOString() : null,
      pairing_code: pairing,
      pairing_code_expires_at: pairing ? new Date(Date.now() + 60_000).toISOString() : null,
      status: qr || pairing ? "awaiting_qr" : "disconnected",
    };
  },

  async getQrCode(ref, phone_number): Promise<WAQrResult> {
    if (!REAL) {
      const now = Date.now();
      return {
        qr_code: phone_number ? null : `sim-qr-${now}`,
        qr_expires_at: phone_number ? null : new Date(now + 45_000).toISOString(),
        pairing_code: phone_number ? "ABCD-1234" : null,
        pairing_code_expires_at: phone_number
          ? new Date(now + 60_000).toISOString()
          : null,
        status: "awaiting_qr",
      };
    }
    const path = `/instance/connect/${encodeURIComponent(ref.provider_instance_id)}${
      phone_number ? `?number=${encodeURIComponent(phone_number)}` : ""
    }`;
    const res = await callEvolution(ref.vps, path, { method: "GET" });
    if (!res.ok) throw new Error(`evolution.getQrCode failed: ${res.status}`);
    const qr = res.data?.base64 || res.data?.qrcode?.base64 || res.data?.code || null;
    const pairing =
      res.data?.pairingCode || res.data?.qrcode?.pairingCode || null;
    const status = mapEvolutionStatus(res.data?.instance?.state || res.data?.state);
    return {
      qr_code: qr,
      qr_expires_at: qr ? new Date(Date.now() + 45_000).toISOString() : null,
      pairing_code: pairing,
      pairing_code_expires_at: pairing ? new Date(Date.now() + 60_000).toISOString() : null,
      status,
    };
  },


  async connect(ref) {
    if (!REAL) return "awaiting_qr";
    const res = await callEvolution(
      ref.vps,
      `/instance/connect/${encodeURIComponent(ref.provider_instance_id)}`,
      { method: "GET" },
    );
    return mapEvolutionStatus(res.data?.instance?.state || res.data?.state);
  },

  async disconnect(ref) {
    if (!REAL) return "disconnected";
    const res = await callEvolution(
      ref.vps,
      `/instance/logout/${encodeURIComponent(ref.provider_instance_id)}`,
      { method: "DELETE" },
    );
    if (!res.ok) throw new Error(`evolution.disconnect failed: ${res.status}`);
    return "disconnected";
  },

  async getStatus(ref) {
    if (!REAL) return "disconnected";
    const res = await callEvolution(
      ref.vps,
      `/instance/connectionState/${encodeURIComponent(ref.provider_instance_id)}`,
      { method: "GET" },
    );
    return mapEvolutionStatus(res.data?.instance?.state || res.data?.state);
  },

  async sendText(ref, to, body): Promise<WASendResult> {
    if (!REAL) {
      return { ok: true, provider_msg_id: `sim_${Date.now()}` };
    }
    const res = await callEvolution(
      ref.vps,
      `/message/sendText/${encodeURIComponent(ref.provider_instance_id)}`,
      {
        method: "POST",
        body: JSON.stringify({
          number: to,
          text: body,
          options: { delay: 0, presence: "composing" },
        }),
      },
    );
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${res.text.slice(0, 300)}` };
    }
    const id =
      res.data?.key?.id ||
      res.data?.messageId ||
      res.data?.id ||
      null;
    return { ok: true, provider_msg_id: id };
  },

  async markHealthy(vps) {
    await supabaseAdmin
      .from("whatsapp_vps_nodes")
      .update({ health: "healthy", last_health_at: new Date().toISOString() })
      .eq("id", vps.id);
  },

  async markError(vps) {
    await supabaseAdmin
      .from("whatsapp_vps_nodes")
      .update({ health: "attention", last_health_at: new Date().toISOString() })
      .eq("id", vps.id);
  },
};

// ---------- Helpers compartilhados ----------

export async function loadInstanceRef(instanceId: string): Promise<WAInstanceRef | null> {
  const { data: inst, error } = await supabaseAdmin
    .from("whatsapp_instances")
    .select("id, company_id, provider_instance_id, vps_node_id")
    .eq("id", instanceId)
    .maybeSingle();
  if (error || !inst) return null;

  const { data: vps, error: ve } = await supabaseAdmin
    .from("whatsapp_vps_nodes")
    .select("id, base_url, api_token_enc, webhook_secret")
    .eq("id", inst.vps_node_id)
    .maybeSingle();
  if (ve || !vps) return null;

  return {
    id: inst.id,
    company_id: inst.company_id,
    provider_instance_id: inst.provider_instance_id,
    vps: {
      id: vps.id,
      base_url: vps.base_url,
      api_token: vps.api_token_enc, // decriptar aqui se for cifrar no futuro
      webhook_secret: vps.webhook_secret,
    },
  };
}

export async function pickAvailableVps(): Promise<{ id: string } | null> {
  const { data, error } = await supabaseAdmin
    .from("whatsapp_vps_nodes")
    .select("id, max_instances")
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (error || !data?.length) return null;

  for (const node of data) {
    const { count } = await supabaseAdmin
      .from("whatsapp_instances")
      .select("id", { count: "exact", head: true })
      .eq("vps_node_id", node.id);
    if ((count ?? 0) < (node.max_instances ?? 50)) return { id: node.id };
  }
  return null;
}

export function getEvolutionWebhookUrl(instanceId: string): string {
  const base = process.env.PUBLIC_APP_URL || "";
  return `${base.replace(/\/+$/, "")}/api/public/webhooks/evolution/${instanceId}`;
}
