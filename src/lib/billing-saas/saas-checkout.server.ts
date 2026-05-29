/**
 * Server-only: checkout do próprio plano SaaS via Mercado Pago da plataforma.
 * Usa MERCADO_PAGO_PLATFORM_ACCESS_TOKEN (fallback MERCADO_PAGO_ACCESS_TOKEN).
 */

const MP_API_BASE = "https://api.mercadopago.com";

function getPlatformToken(): string {
  const t =
    process.env.MERCADO_PAGO_PLATFORM_ACCESS_TOKEN ||
    process.env.MERCADO_PAGO_ACCESS_TOKEN ||
    "";
  if (!t) throw new Error("MERCADO_PAGO_PLATFORM_ACCESS_TOKEN missing");
  return t;
}

function getPublicAppUrl(): string {
  const u = process.env.PUBLIC_APP_URL || "";
  return u.replace(/\/+$/, "");
}

export type CreateSaasPreferenceInput = {
  externalReference: string;
  planName: string;
  amountBRL: number;
  payerEmail?: string;
};

export type CreateSaasPreferenceResult = {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
};

export async function createSaasPreference(
  input: CreateSaasPreferenceInput,
): Promise<CreateSaasPreferenceResult> {
  const token = getPlatformToken();
  const appUrl = getPublicAppUrl();
  const notificationUrl = appUrl ? `${appUrl}/api/public/mp/saas-webhook` : undefined;

  const body: Record<string, unknown> = {
    items: [
      {
        id: input.externalReference,
        title: input.planName.slice(0, 200),
        quantity: 1,
        currency_id: "BRL",
        unit_price: Number(input.amountBRL.toFixed(2)),
      },
    ],
    external_reference: input.externalReference,
    payment_methods: { installments: 1 },
    ...(notificationUrl ? { notification_url: notificationUrl } : {}),
    ...(appUrl
      ? {
          back_urls: {
            success: `${appUrl}/minha-assinatura?saas=success`,
            failure: `${appUrl}/minha-assinatura?saas=failure`,
            pending: `${appUrl}/minha-assinatura?saas=pending`,
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
      "X-Idempotency-Key": input.externalReference,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[saas-mp] preference failed", res.status, text.slice(0, 300));
    throw new Error(`Falha ao criar preferência (${res.status}).`);
  }

  return (await res.json()) as CreateSaasPreferenceResult;
}

export async function fetchSaasPayment(paymentId: string): Promise<{
  id: number | string;
  status: string;
  external_reference?: string;
  transaction_amount?: number;
} | null> {
  const token = getPlatformToken();
  const res = await fetch(
    `${MP_API_BASE}/v1/payments/${encodeURIComponent(paymentId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    console.error("[saas-mp] fetch payment failed", res.status);
    return null;
  }
  return (await res.json()) as {
    id: number | string;
    status: string;
    external_reference?: string;
    transaction_amount?: number;
  };
}
