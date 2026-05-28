// Implementação real do provider Evolution (server-only).
// SEM fallback simulado. Se ALLOW_REAL_WHATSAPP=false → erro explícito.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type {
  WAInstanceRef,
  WAVpsNode,
  WAQrResult,
  WAStatus,
  WASendResult,
  WACreateResult,
  WAInstanceState,
  WhatsAppProvider,
} from "./provider";

function assertReal(): void {
  const real = (process.env.ALLOW_REAL_WHATSAPP ?? "true").toLowerCase() !== "false";
  if (!real) {
    throw new Error(
      "Envio real do WhatsApp está desativado pelo administrador (ALLOW_REAL_WHATSAPP=false).",
    );
  }
}

export function isEvolutionNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /evolution\.[^\s]+ falhou \(404\)|\b404\b.*instance does not exist/i.test(message);
}

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

// Normaliza QR retornado pela Evolution (string base64, data URL ou objeto aninhado).
function extractQr(d: any): string | null {
  if (!d) return null;
  const candidates: any[] = [
    d?.base64,
    d?.qrcode?.base64,
    d?.qrcode?.code,
    d?.qr?.base64,
    d?.qr?.code,
    d?.code,
    typeof d?.qrcode === "string" ? d.qrcode : null,
    typeof d?.qr === "string" ? d.qr : null,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 20) return c;
  }
  return null;
}

function extractPairing(d: any): string | null {
  if (!d) return null;
  const candidates: any[] = [
    d?.pairingCode,
    d?.qrcode?.pairingCode,
    d?.qr?.pairingCode,
    d?.instance?.pairingCode,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length >= 6) return c;
  }
  return null;
}

function cleanPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/@s\.whatsapp\.net|@c\.us|\D/g, "");
  return digits.length >= 8 ? digits : null;
}

function extractPhone(d: any): string | null {
  const candidates: unknown[] = [
    d?.instance?.number,
    d?.instance?.ownerJid,
    d?.instance?.wuid,
    d?.instance?.connectionStatus?.number,
    d?.instance?.connectionStatus?.ownerJid,
    d?.instance?.connectionStatus?.wuid,
    d?.number,
    d?.ownerJid,
    d?.wuid,
    d?.data?.number,
    d?.data?.ownerJid,
    d?.data?.wuid,
    d?.connectionStatus?.number,
    d?.connectionStatus?.ownerJid,
    d?.connectionStatus?.wuid,
  ];
  for (const candidate of candidates) {
    const phone = cleanPhone(candidate);
    if (phone) return phone;
  }
  return null;
}

function extractProfileName(d: any): string | null {
  const candidates: unknown[] = [d?.instance?.profileName, d?.profileName, d?.data?.profileName];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

function parseInstanceState(d: any): WAInstanceState {
  const status = mapEvolutionStatus(
    d?.instance?.state ||
      d?.instance?.connectionStatus?.state ||
      d?.instance?.connectionStatus?.status ||
      d?.instance?.connectionStatus ||
      d?.instance?.status ||
      d?.state ||
      d?.connectionStatus?.state ||
      d?.connectionStatus?.status ||
      d?.connectionStatus ||
      d?.status,
  );
  return {
    status,
    phone_number: extractPhone(d),
    profile_name: extractProfileName(d),
  };
}

function pickFetchInstancePayload(d: any, providerInstanceId: string): any {
  const list = Array.isArray(d) ? d : Array.isArray(d?.instances) ? d.instances : Array.isArray(d?.data) ? d.data : [d];
  return (
    list.find((item: any) => {
      const instance = item?.instance ?? item;
      return instance?.instanceName === providerInstanceId || instance?.instanceId === providerInstanceId;
    }) ?? list[0]
  );
}

export const evolutionProvider: WhatsAppProvider = {
  async createInstance({ vps, instance_name, webhook_url, phone_number }) {
    assertReal();

    const body: Record<string, unknown> = {
      instanceName: instance_name,
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
      throw new Error(`evolution.createInstance falhou (${res.status}): ${res.text.slice(0, 300)}`);
    }

    const providerId: string | null =
      res.data?.instance?.instanceName ||
      res.data?.instance?.instanceId ||
      res.data?.instanceName ||
      null;
    if (!providerId) {
      throw new Error("evolution.createInstance não retornou instanceName/instanceId.");
    }
    const qr = extractQr(res.data);
    const pairing = extractPairing(res.data);

    return {
      provider_instance_id: providerId,
      qr_code: qr,
      qr_expires_at: qr ? new Date(Date.now() + 45_000).toISOString() : null,
      pairing_code: pairing,
      pairing_code_expires_at: pairing ? new Date(Date.now() + 60_000).toISOString() : null,
      status: qr || pairing ? "awaiting_qr" : "disconnected",
    } satisfies WACreateResult;
  },

  async getQrCode(ref, phone_number): Promise<WAQrResult> {
    assertReal();
    const path = `/instance/connect/${encodeURIComponent(ref.provider_instance_id)}${
      phone_number ? `?number=${encodeURIComponent(phone_number)}` : ""
    }`;
    const res = await callEvolution(ref.vps, path, { method: "GET" });
    if (!res.ok) {
      throw new Error(`evolution.getQrCode falhou (${res.status}): ${res.text.slice(0, 300)}`);
    }
    const qr = extractQr(res.data);
    const pairing = extractPairing(res.data);
    const status = mapEvolutionStatus(
      res.data?.instance?.state || res.data?.state || (qr || pairing ? "qr" : ""),
    );
    return {
      qr_code: qr,
      qr_expires_at: qr ? new Date(Date.now() + 45_000).toISOString() : null,
      pairing_code: pairing,
      pairing_code_expires_at: pairing ? new Date(Date.now() + 60_000).toISOString() : null,
      status,
    };
  },


  async connect(ref) {
    assertReal();
    const res = await callEvolution(
      ref.vps,
      `/instance/connect/${encodeURIComponent(ref.provider_instance_id)}`,
      { method: "GET" },
    );
    return mapEvolutionStatus(res.data?.instance?.state || res.data?.state);
  },

  async disconnect(ref) {
    assertReal();
    const res = await callEvolution(
      ref.vps,
      `/instance/logout/${encodeURIComponent(ref.provider_instance_id)}`,
      { method: "DELETE" },
    );
    if (!res.ok) throw new Error(`evolution.disconnect falhou (${res.status})`);
    return "disconnected";
  },

  async deleteInstance(ref) {
    assertReal();
    const res = await callEvolution(
      ref.vps,
      `/instance/delete/${encodeURIComponent(ref.provider_instance_id)}`,
      { method: "DELETE" },
    );
    if (!res.ok && res.status !== 404) {
      throw new Error(`evolution.deleteInstance falhou (${res.status}): ${res.text.slice(0, 300)}`);
    }
  },

  async getStatus(ref) {
    assertReal();
    const res = await callEvolution(
      ref.vps,
      `/instance/connectionState/${encodeURIComponent(ref.provider_instance_id)}`,
      { method: "GET" },
    );
    return mapEvolutionStatus(res.data?.instance?.state || res.data?.state);
  },

  async getInstanceState(ref) {
    assertReal();
    const res = await callEvolution(
      ref.vps,
      `/instance/connectionState/${encodeURIComponent(ref.provider_instance_id)}`,
      { method: "GET" },
    );
    if (!res.ok) {
      throw new Error(`evolution.connectionState falhou (${res.status}): ${res.text.slice(0, 300)}`);
    }
    const state = parseInstanceState(res.data);

    const details = await callEvolution(
      ref.vps,
      `/instance/fetchInstances?instanceName=${encodeURIComponent(ref.provider_instance_id)}`,
      { method: "GET" },
    );
    if (details.ok) {
      const detailState = parseInstanceState(pickFetchInstancePayload(details.data, ref.provider_instance_id));
      return {
        status: detailState.status === "error" ? state.status : detailState.status,
        phone_number: detailState.phone_number ?? state.phone_number,
        profile_name: detailState.profile_name ?? state.profile_name,
      };
    }

    return state;
  },

  async sendText(ref, to, body): Promise<WASendResult> {
    assertReal();
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

  async setSettings(ref, settings) {
    assertReal();
    const body: Record<string, unknown> = {
      rejectCall: typeof settings.rejectCall === "boolean" ? settings.rejectCall : false,
      msgCall: typeof settings.msgCall === "string" ? settings.msgCall : "",
      groupsIgnore: true,
      alwaysOnline: false,
      readMessages: false,
      readStatus: false,
      syncFullHistory: false,
    };
    const res = await callEvolution(
      ref.vps,
      `/settings/set/${encodeURIComponent(ref.provider_instance_id)}`,
      { method: "POST", body: JSON.stringify(body) },
    );
    if (!res.ok) {
      throw new Error(`evolution.setSettings falhou (${res.status}): ${res.text.slice(0, 300)}`);
    }
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
