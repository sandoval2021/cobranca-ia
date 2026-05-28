// Server-only helpers para Mercado Pago Marketplace (split / application_fee).
// NUNCA importar de código cliente. Tokens criptografados em marketplace_accounts.
import { createHmac, timingSafeEqual } from "crypto";
import { encryptSecret, decryptSecret } from "@/lib/iptv/crypto.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const MP_API = "https://api.mercadopago.com";
export const MP_AUTH = "https://auth.mercadopago.com.br/authorization";
const FEE_BPS_DEFAULT = 100; // 1%

function appUrl(): string {
  const u = process.env.PUBLIC_APP_URL || process.env.APP_PUBLIC_URL || "";
  return u.replace(/\/+$/, "");
}

function clientId() {
  const v = process.env.MERCADO_PAGO_CLIENT_ID;
  if (!v) throw new Error("MERCADO_PAGO_CLIENT_ID missing");
  return v;
}
function clientSecret() {
  const v = process.env.MERCADO_PAGO_CLIENT_SECRET;
  if (!v) throw new Error("MERCADO_PAGO_CLIENT_SECRET missing");
  return v;
}
function webhookSecret() {
  const v = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!v) throw new Error("MERCADO_PAGO_WEBHOOK_SECRET missing");
  return v;
}

// ---------- OAuth state (HMAC anti-CSRF) ----------
export function signState(companyId: string): string {
  const payload = `${companyId}.${Date.now()}`;
  const sig = createHmac("sha256", webhookSecret()).update(payload).digest("hex").slice(0, 32);
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}
export function verifyState(state: string): { companyId: string } | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return null;
    const [companyId, ts, sig] = parts;
    const expected = createHmac("sha256", webhookSecret())
      .update(`${companyId}.${ts}`)
      .digest("hex")
      .slice(0, 32);
    if (sig.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    // expira em 30 min
    if (Date.now() - Number(ts) > 30 * 60 * 1000) return null;
    return { companyId };
  } catch {
    return null;
  }
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    response_type: "code",
    platform_id: "mp",
    state,
    redirect_uri: `${appUrl()}/api/public/mp/oauth-callback`,
  });
  return `${MP_AUTH}?${params.toString()}`;
}

// ---------- OAuth token exchange ----------
type MpTokenResponse = {
  access_token: string;
  refresh_token?: string;
  user_id: number | string;
  expires_in: number;
  public_key?: string;
  live_mode?: boolean;
  scope?: string;
};

export async function exchangeCodeForToken(code: string): Promise<MpTokenResponse> {
  const res = await fetch(`${MP_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: "authorization_code",
      code,
      redirect_uri: `${appUrl()}/api/public/mp/oauth-callback`,
    }).toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`MP oauth exchange failed: ${res.status} ${t}`);
  }
  return (await res.json()) as MpTokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<MpTokenResponse> {
  const res = await fetch(`${MP_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });
  if (!res.ok) throw new Error(`MP refresh failed: ${res.status}`);
  return (await res.json()) as MpTokenResponse;
}

export async function saveMarketplaceAccount(companyId: string, tok: MpTokenResponse) {
  const expires = new Date(Date.now() + (tok.expires_in - 60) * 1000).toISOString();
  const db = supabaseAdmin as never as {
    from: (t: string) => {
      upsert: (v: unknown, opt?: unknown) => Promise<{ error: unknown }>;
    };
  };
  const { error } = await db.from("marketplace_accounts").upsert(
    {
      company_id: companyId,
      provider: "mercado_pago",
      mp_user_id: String(tok.user_id),
      access_token_enc: encryptSecret(tok.access_token),
      refresh_token_enc: encryptSecret(tok.refresh_token || ""),
      public_key: tok.public_key || null,
      expires_at: expires,
      live_mode: tok.live_mode ?? true,
      scope: tok.scope || null,
      status: "connected",
      last_error: null,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id" },
  );
  if (error) throw new Error(String((error as { message?: string }).message || error));
}

// ---------- Token helpers para uso em pagamentos ----------
export async function getOwnerAccessToken(companyId: string): Promise<string> {
  const db = supabaseAdmin as never as {
    from: (t: string) => {
      select: (s: string) => {
        eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null }> };
      };
    };
  };
  const { data } = await db.from("marketplace_accounts").select("*").eq("company_id", companyId).maybeSingle();
  if (!data || data.status !== "connected") {
    throw new Error("Conta Mercado Pago do dono não está conectada.");
  }
  const expiresAt = data.expires_at ? new Date(String(data.expires_at)).getTime() : 0;
  if (expiresAt && expiresAt < Date.now() + 30_000) {
    const refresh = decryptSecret(String(data.refresh_token_enc || ""));
    if (!refresh) throw new Error("Token expirado e sem refresh_token.");
    const newTok = await refreshAccessToken(refresh);
    await saveMarketplaceAccount(companyId, newTok);
    return newTok.access_token;
  }
  const token = decryptSecret(String(data.access_token_enc || ""));
  if (!token) throw new Error("Token Mercado Pago inválido.");
  return token;
}

// ---------- Payments (Pix) com application_fee ----------
export type CreatePixInput = {
  ownerToken: string;
  amountReais: number;
  description: string;
  externalReference: string;
  applicationFeeReais: number;
  payerEmail?: string;
  notificationUrl?: string;
};

export type CreatedPix = {
  id: string;
  status: string;
  qr_code: string | null;
  qr_code_base64: string | null;
  ticket_url: string | null;
  raw: unknown;
};

export async function createPixPayment(input: CreatePixInput): Promise<CreatedPix> {
  const idem = `pix_${input.externalReference}_${Date.now()}`;
  const body: Record<string, unknown> = {
    transaction_amount: Number(input.amountReais.toFixed(2)),
    description: input.description.slice(0, 200),
    payment_method_id: "pix",
    external_reference: input.externalReference,
    application_fee: Number(input.applicationFeeReais.toFixed(2)),
    notification_url: input.notificationUrl,
    payer: {
      email: input.payerEmail || `cliente+${input.externalReference}@cobraeasy.com.br`,
    },
  };
  const res = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.ownerToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idem,
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`MP pix failed: ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  }
  const poi = (json.point_of_interaction as Record<string, unknown> | undefined) || {};
  const td = (poi.transaction_data as Record<string, unknown> | undefined) || {};
  return {
    id: String(json.id),
    status: String(json.status || "pending"),
    qr_code: (td.qr_code as string) || null,
    qr_code_base64: (td.qr_code_base64 as string) || null,
    ticket_url: (td.ticket_url as string) || null,
    raw: json,
  };
}

// ---------- Preference (cartão/link) com marketplace_fee ----------
export type CreatePreferenceInput = {
  ownerToken: string;
  amountReais: number;
  description: string;
  externalReference: string;
  marketplaceFeeReais: number;
  notificationUrl?: string;
  successUrl?: string;
};
export type CreatedPreference = {
  id: string;
  init_point: string | null;
  raw: unknown;
};
export async function createPreference(input: CreatePreferenceInput): Promise<CreatedPreference> {
  const body: Record<string, unknown> = {
    items: [
      {
        title: input.description.slice(0, 200),
        quantity: 1,
        currency_id: "BRL",
        unit_price: Number(input.amountReais.toFixed(2)),
      },
    ],
    external_reference: input.externalReference,
    marketplace_fee: Number(input.marketplaceFeeReais.toFixed(2)),
    notification_url: input.notificationUrl,
    payment_methods: { excluded_payment_types: [{ id: "ticket" }], installments: 1 },
    back_urls: input.successUrl ? { success: input.successUrl, pending: input.successUrl, failure: input.successUrl } : undefined,
  };
  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.ownerToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error(`MP preference failed: ${res.status}`);
  return {
    id: String(json.id),
    init_point: (json.init_point as string) || null,
    raw: json,
  };
}

export async function fetchMpPayment(paymentId: string, ownerToken: string) {
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${ownerToken}`, Accept: "application/json" },
  });
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}

// ---------- Webhook signature (x-signature do MP) ----------
export function verifyMpSignature(
  signatureHeader: string | null,
  requestId: string | null,
  dataId: string | null,
): boolean {
  // Mercado Pago: ts=...,v1=hmacsha256(`id:${dataId};request-id:${requestId};ts:${ts};`)
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k.trim(), (v || "").trim()];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  const manifest = `id:${dataId || ""};request-id:${requestId || ""};ts:${ts};`;
  const expected = createHmac("sha256", webhookSecret()).update(manifest).digest("hex");
  try {
    return v1.length === expected.length && timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ---------- Cálculo de taxa ----------
export type FeeMode = "customer_pays" | "owner_pays";
export type FeeBreakdown = {
  amountCents: number; // valor do plano
  feeCents: number; // taxa de processamento (1%)
  totalCents: number; // o que o cliente paga
  feeMode: FeeMode;
};
export function computeFee(amountCents: number, feeMode: FeeMode, bps: number = FEE_BPS_DEFAULT): FeeBreakdown {
  const feeCents = Math.max(1, Math.round((amountCents * bps) / 10_000));
  const totalCents = feeMode === "customer_pays" ? amountCents + feeCents : amountCents;
  return { amountCents, feeCents, totalCents, feeMode };
}

export { FEE_BPS_DEFAULT };
