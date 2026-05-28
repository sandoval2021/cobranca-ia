// Provider abstrato de WhatsApp. Evolution é uma implementação.
// Sem segredos aqui — apenas tipos compartilháveis.

export type WAStatus =
  | "connected"
  | "disconnected"
  | "awaiting_qr"
  | "error"
  | "blocked";

export type WAVpsNode = {
  id: string;
  base_url: string;
  api_token: string;       // texto cru (decriptado server-side)
  webhook_secret: string;  // usado para HMAC
};

export type WAInstanceRef = {
  id: string;                    // whatsapp_instances.id
  company_id: string;
  provider_instance_id: string;  // id remoto na VPS
  vps: WAVpsNode;
};

export type WACreateResult = {
  provider_instance_id: string;
  qr_code?: string | null;
  qr_expires_at?: string | null;
  pairing_code?: string | null;
  pairing_code_expires_at?: string | null;
  status: WAStatus;
};

export type WAQrResult = {
  qr_code: string | null;
  qr_expires_at: string | null;
  pairing_code?: string | null;
  pairing_code_expires_at?: string | null;
  status: WAStatus;
};

export type WASendResult = {
  provider_msg_id?: string | null;
  ok: boolean;
  error?: string | null;
};

export interface WhatsAppProvider {
  createInstance(args: {
    vps: WAVpsNode;
    friendly_name: string;
    webhook_url: string;
    phone_number?: string;
  }): Promise<WACreateResult>;

  getQrCode(ref: WAInstanceRef, phone_number?: string): Promise<WAQrResult>;

  connect(ref: WAInstanceRef): Promise<WAStatus>;
  disconnect(ref: WAInstanceRef): Promise<WAStatus>;
  getStatus(ref: WAInstanceRef): Promise<WAStatus>;

  sendText(ref: WAInstanceRef, to: string, body: string): Promise<WASendResult>;

  markHealthy(vps: WAVpsNode): Promise<void>;
  markError(vps: WAVpsNode, reason: string): Promise<void>;
}
