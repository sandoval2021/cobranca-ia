/**
 * Camada server-only para Mercado Pago.
 * NUNCA importar a partir de código de cliente.
 * NUNCA expor o token. NUNCA logar o token.
 */

export const MERCADO_PAGO_PROVIDER = "mercado_pago" as const;
export const MP_API_BASE = "https://api.mercadopago.com";

export type MPConfigStatus =
  | { configured: true }
  | { configured: false; reason: "missing_token" };

export function getMercadoPagoConfigStatus(): MPConfigStatus {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token || token.trim().length === 0) {
    return { configured: false, reason: "missing_token" };
  }
  return { configured: true };
}

export function friendlyNotConfiguredMessage(): string {
  return "Pagamento online ainda não está configurado.";
}

function getToken(): string {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADO_PAGO_ACCESS_TOKEN missing");
  return token;
}

function getPublicAppUrl(): string {
  const url =
    process.env.PUBLIC_APP_URL ||
    process.env.APP_PUBLIC_URL ||
    "";
  return url.replace(/\/+$/, "");
}

export interface CreatePreferenceInput {
  attemptId: string;
  planName: string;
  amountBRL: number; // reais (not cents)
  payerEmail?: string;
}

export interface MPPreferenceResult {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
}

/**
 * Cria uma preference de Checkout Pro (suporta Pix + outros métodos).
 * NÃO armazena cartão. NÃO solicita CVV. Tudo via ambiente seguro do MP.
 */
export async function createMpPreference(
  input: CreatePreferenceInput,
): Promise<MPPreferenceResult> {
  const token = getToken();
  const appUrl = getPublicAppUrl();
  const notificationUrl = appUrl
    ? `${appUrl}/api/public/webhooks/mercado-pago`
    : undefined;

  const body: Record<string, unknown> = {
    items: [
      {
        id: input.attemptId,
        title: input.planName.slice(0, 200),
        quantity: 1,
        currency_id: "BRL",
        unit_price: Number(input.amountBRL.toFixed(2)),
      },
    ],
    external_reference: input.attemptId,
    payment_methods: {
      // Fase 3: sem parcelamento, sem ticket. Pix + cartão único liberado.
      excluded_payment_types: [{ id: "ticket" }],
      installments: 1,
    },
    ...(notificationUrl ? { notification_url: notificationUrl } : {}),
    ...(appUrl
      ? {
          back_urls: {
            success: `${appUrl}/meus-dados?mp=success`,
            failure: `${appUrl}/meus-dados?mp=failure`,
            pending: `${appUrl}/meus-dados?mp=pending`,
          },
          auto_return: "approved",
        }
      : {}),
    ...(input.payerEmail ? { payer: { email: input.payerEmail } } : {}),
  };

  const res = await fetch(`${MP_API_BASE}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": input.attemptId,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Não logar token. Só status.
    console.error("[mp] preference failed", res.status, text.slice(0, 300));
    throw new Error(`Falha ao criar preferência Mercado Pago (${res.status}).`);
  }

  return (await res.json()) as MPPreferenceResult;
}

export interface MPPayment {
  id: number | string;
  status: string; // approved, pending, rejected, cancelled, refunded, in_process
  status_detail?: string;
  external_reference?: string;
  preference_id?: string;
  payment_method_id?: string;
  payment_type_id?: string;
  transaction_amount?: number;
  currency_id?: string;
}

export async function fetchMpPayment(paymentId: string): Promise<MPPayment | null> {
  const token = getToken();
  const res = await fetch(`${MP_API_BASE}/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    console.error("[mp] fetch payment failed", res.status);
    throw new Error(`Falha ao consultar pagamento (${res.status}).`);
  }
  return (await res.json()) as MPPayment;
}

/**
 * Higieniza payload (remove campos sensíveis de cartão).
 */
export function sanitizeWebhookPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const FORBIDDEN = new Set([
    "card_number",
    "card_number_id",
    "security_code",
    "cvv",
    "cvc",
    "token",
    "access_token",
    "card",
    "cardholder",
    "first_six_digits",
    "last_four_digits",
  ]);
  if (Array.isArray(payload)) {
    return payload.map((p) => sanitizeWebhookPayload(p));
  }
  const clone: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    if (FORBIDDEN.has(k.toLowerCase())) continue;
    clone[k] = v && typeof v === "object" ? sanitizeWebhookPayload(v) : v;
  }
  return clone;
}
