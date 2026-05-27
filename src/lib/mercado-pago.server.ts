/**
 * Camada server-only para Mercado Pago.
 * NUNCA importar a partir de código de cliente.
 * NUNCA expor o token. NUNCA logar o token.
 *
 * Nesta Fase 1 não fazemos nenhuma chamada real ao Mercado Pago.
 * Apenas validamos a presença do secret e produzimos respostas amigáveis.
 */

export const MERCADO_PAGO_PROVIDER = "mercado_pago" as const;

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
  return "Pagamentos ainda não configurados.";
}

/**
 * Higieniza payload de webhook antes de gravar.
 * Remove campos sensíveis conhecidos (cartão / tokens).
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
  ]);
  const clone: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    if (FORBIDDEN.has(k.toLowerCase())) continue;
    clone[k] = v && typeof v === "object" ? sanitizeWebhookPayload(v) : v;
  }
  return clone;
}
