// Server-only: gera cobrança Mercado Pago a partir do fluxo da IA do WhatsApp.
// Sem auth de usuário (contexto = webhook). Reutiliza cobrança pendente recente
// (mesmo cliente/telefone/valor) criada nos últimos 30 minutos.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  computeFee,
  createPixPayment,
  createPreference,
  getOwnerAccessToken,
  FEE_BPS_DEFAULT,
  type FeeMode,
} from "./marketplace.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (): any => supabaseAdmin as any;

// ---------- Detecção de pedido explícito de cobrança ----------
export type PaymentRequest = {
  wantsCharge: boolean;
  method: "pix" | "card" | "auto";
};

const RE_PIX = /\b(pix|manda(r)?\s+(o\s+)?pix|envia(r)?\s+(o\s+)?pix|gera(r)?\s+(o\s+)?pix)\b/i;
const RE_CARD = /\b(cart[ãa]o|cr[eé]dito|d[eé]bito|parcel)/i;
const RE_LINK = /\b(manda(r)?\s+(o\s+)?link|envia(r)?\s+(o\s+)?link|link\s+de\s+pagamento|gerar\s+cobran|gera\s+cobran|cobran[çc]a)\b/i;
const RE_PAY = /\b(quero\s+pagar|vou\s+pagar|posso\s+pagar|pagar\s+agora|me\s+passa(r)?\s+(o\s+)?(pix|link)|como\s+(eu\s+)?pago|forma\s+de\s+pagamento)\b/i;
const RE_RENEW_PAY = /\b(quero\s+renovar|renovar\s+(agora|hoje|j[áa])|renova[çc][ãa]o\s+(agora|hoje|j[áa]))\b/i;

export function detectPaymentRequest(text: string): PaymentRequest {
  const t = (text || "").toLowerCase();
  if (RE_PIX.test(t)) return { wantsCharge: true, method: "pix" };
  if (RE_CARD.test(t)) return { wantsCharge: true, method: "card" };
  if (RE_LINK.test(t)) return { wantsCharge: true, method: "auto" };
  if (RE_PAY.test(t) || RE_RENEW_PAY.test(t)) return { wantsCharge: true, method: "auto" };
  return { wantsCharge: false, method: "auto" };
}

// ---------- Seleção determinística de plano ----------
export type SimplePlan = {
  name: string;
  duration_days: number;
  price_cents: number;
};

function detectDurationDays(text: string): number | null {
  const t = (text || "").toLowerCase();
  if (/\b(12\s*meses?|1\s*ano|anual)\b/.test(t)) return 365;
  if (/\b(6\s*meses?|semestral)\b/.test(t)) return 180;
  if (/\b(3\s*meses?|trimestral)\b/.test(t)) return 90;
  if (/\b(1\s*m[êe]s|um\s+m[êe]s|mensal|mensalidade)\b/.test(t)) return 30;
  return null;
}

export function pickPlanFromText(plans: SimplePlan[], text: string): SimplePlan | null {
  if (!plans || plans.length === 0) return null;
  const dur = detectDurationDays(text);
  if (dur) {
    let best: SimplePlan | null = null;
    let bestDiff = Infinity;
    for (const p of plans) {
      const diff = Math.abs((p.duration_days ?? 30) - dur);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = p;
      }
    }
    if (best && bestDiff <= 15) return best;
  }
  if (plans.length === 1) return plans[0];
  return null;
}

// ---------- Status conexão MP ----------
export async function isMarketplaceConnected(companyId: string): Promise<boolean> {
  const { data } = await db()
    .from("marketplace_accounts")
    .select("status")
    .eq("company_id", companyId)
    .maybeSingle();
  return data?.status === "connected";
}

// ---------- Reaproveitar cobrança pendente recente ----------
async function findRecentPendingTransaction(opts: {
  companyId: string;
  customerId: string | null;
  amountCents: number;
  method: "pix" | "link";
}): Promise<Record<string, unknown> | null> {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  let q = db()
    .from("payment_transactions")
    .select("*")
    .eq("company_id", opts.companyId)
    .eq("status", "pending")
    .eq("amount_cents", opts.amountCents)
    .eq("payment_method", opts.method)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1);
  if (opts.customerId) q = q.eq("customer_id", opts.customerId);
  const { data } = await q.maybeSingle();
  return data ?? null;
}

// ---------- Geração principal ----------
export type WhatsAppChargeResult = {
  ok: true;
  reused: boolean;
  method: "pix" | "link";
  externalReference: string;
  payUrl: string;
  amountCents: number;
  feeCents: number;
  totalCents: number;
  feeMode: FeeMode;
  planName: string;
};

export type WhatsAppChargeError = {
  ok: false;
  reason:
    | "not_connected"
    | "no_price_data"
    | "ambiguous_plan"
    | "mp_error"
    | "unknown";
  message: string;
};

export async function generateWhatsAppPaymentCharge(opts: {
  companyId: string;
  customerId: string | null;
  phone: string;
  plans: SimplePlan[];
  text: string;
  method: "pix" | "card" | "auto";
}): Promise<WhatsAppChargeResult | WhatsAppChargeError> {
  // 1) Conexão MP
  const connected = await isMarketplaceConnected(opts.companyId);
  if (!connected) {
    return { ok: false, reason: "not_connected", message: "Mercado Pago não conectado." };
  }

  // 2) Plano
  if (!opts.plans || opts.plans.length === 0) {
    return { ok: false, reason: "no_price_data", message: "Sem tabela de preço." };
  }
  const plan = pickPlanFromText(opts.plans, opts.text);
  if (!plan) {
    return { ok: false, reason: "ambiguous_plan", message: "Plano não identificado." };
  }
  const amountCents = plan.price_cents | 0;
  if (amountCents < 100) {
    return { ok: false, reason: "no_price_data", message: "Valor inválido." };
  }

  // 3) Settings / taxa
  const { data: settings } = await db()
    .from("payment_settings")
    .select("fee_mode,platform_fee_bps")
    .eq("company_id", opts.companyId)
    .maybeSingle();
  const feeMode: FeeMode = (settings?.fee_mode as FeeMode) || "customer_pays";
  const bps = settings?.platform_fee_bps ?? FEE_BPS_DEFAULT;
  const fee = computeFee(amountCents, feeMode, bps);

  // 4) Método final
  const method: "pix" | "link" = opts.method === "card" ? "link" : "pix";

  // 5) Reaproveitar cobrança pendente recente (idempotência)
  const existing = await findRecentPendingTransaction({
    companyId: opts.companyId,
    customerId: opts.customerId,
    amountCents,
    method,
  });
  const appUrl = (process.env.PUBLIC_APP_URL || "").replace(/\/+$/, "");
  if (existing && typeof existing.external_reference === "string") {
    return {
      ok: true,
      reused: true,
      method,
      externalReference: String(existing.external_reference),
      payUrl: `${appUrl}/pagar/${existing.external_reference}`,
      amountCents,
      feeCents: fee.feeCents,
      totalCents: fee.totalCents,
      feeMode,
      planName: plan.name,
    };
  }

  // 6) Cria via MP
  try {
    const ownerToken = await getOwnerAccessToken(opts.companyId);
    const externalReference = `wa_${opts.companyId.slice(0, 8)}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const notificationUrl = `${appUrl}/api/public/mp/marketplace-webhook`;
    const description = `${plan.name} — WhatsApp ${opts.phone.slice(-4)}`;

    let mpId: string | null = null;
    let prefId: string | null = null;
    let initPoint: string | null = null;
    let qrCode: string | null = null;
    let qrBase64: string | null = null;
    let ticketUrl: string | null = null;
    let raw: unknown = null;

    if (method === "pix") {
      const pix = await createPixPayment({
        ownerToken,
        amountReais: fee.totalCents / 100,
        applicationFeeReais: fee.feeCents / 100,
        description,
        externalReference,
        notificationUrl,
      });
      mpId = pix.id;
      qrCode = pix.qr_code;
      qrBase64 = pix.qr_code_base64;
      ticketUrl = pix.ticket_url;
      raw = pix.raw;
    } else {
      const pref = await createPreference({
        ownerToken,
        amountReais: fee.totalCents / 100,
        marketplaceFeeReais: fee.feeCents / 100,
        description,
        externalReference,
        notificationUrl,
        successUrl: `${appUrl}/pagar/${externalReference}`,
      });
      prefId = pref.id;
      initPoint = pref.init_point;
      raw = pref.raw;
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const { data: tx, error: txErr } = await db()
      .from("payment_transactions")
      .insert({
        company_id: opts.companyId,
        customer_id: opts.customerId || null,
        external_reference: externalReference,
        description,
        amount_cents: fee.amountCents,
        processing_fee_cents: fee.feeCents,
        total_amount_cents: fee.totalCents,
        fee_mode: feeMode,
        payment_method: method,
        status: "pending",
        mp_payment_id: mpId,
        mp_preference_id: prefId,
        qr_code: qrCode,
        qr_code_base64: qrBase64,
        ticket_url: ticketUrl,
        init_point: initPoint,
        expires_at: expiresAt,
        raw_response: raw as Record<string, unknown>,
      })
      .select("id")
      .single();
    if (txErr) throw new Error(String(txErr.message));

    await db().from("payment_split_logs").insert({
      company_id: opts.companyId,
      transaction_id: tx.id,
      application_fee_cents: fee.feeCents,
      owner_amount_cents: fee.totalCents - fee.feeCents,
      total_amount_cents: fee.totalCents,
      status: "ok",
      mp_response: { source: "whatsapp_ai", method, mp_payment_id: mpId, mp_preference_id: prefId },
    });

    return {
      ok: true,
      reused: false,
      method,
      externalReference,
      payUrl: `${appUrl}/pagar/${externalReference}`,
      amountCents: fee.amountCents,
      feeCents: fee.feeCents,
      totalCents: fee.totalCents,
      feeMode,
      planName: plan.name,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "mp_error", message };
  }
}

// ---------- Formatação da resposta WhatsApp ----------
function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatChargeReply(r: WhatsAppChargeResult): string {
  const taxaLinha =
    r.feeMode === "customer_pays"
      ? `🧾 Taxa de processamento: ${brl(r.feeCents)}\n💵 Total: ${brl(r.totalCents)}\n`
      : "";
  return [
    "Perfeito 😊",
    r.reused
      ? "Reaproveitei sua cobrança recente:"
      : "Gerei sua cobrança com segurança:",
    "",
    `💰 Plano: ${r.planName}`,
    `💳 Valor: ${brl(r.amountCents)}`,
    taxaLinha.trimEnd(),
    `🔗 Pague aqui:`,
    r.payUrl,
    "",
    "Após o pagamento ser confirmado, o sistema registra automaticamente. Se quiser, envie o comprovante para agilizar.",
  ]
    .filter((l) => l !== null && l !== undefined)
    .join("\n");
}
