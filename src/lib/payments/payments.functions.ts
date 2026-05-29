// Server functions para integração Mercado Pago Marketplace.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildAuthorizeUrl,
  signState,
  getOwnerAccessToken,
  createPixPayment,
  createPreference,
  computeFee,
  FEE_BPS_DEFAULT,
  type FeeMode,
} from "./marketplace.server";

type AnyDB = ReturnType<typeof admin>;
function admin() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabaseAdmin as any;
}

async function assertMembership(userId: string, companyId: string): Promise<boolean> {
  const db = admin();
  const { data: comp } = await db
    .from("companies")
    .select("id,owner_id")
    .eq("id", companyId)
    .maybeSingle();
  if (comp?.owner_id === userId) return true;
  const { data: m } = await db
    .from("company_members")
    .select("id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!m;
}

// ============================================================
// STATUS DA CONTA MP
// ============================================================
export const getMarketplaceStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await assertMembership(context.userId, data.companyId))) {
      throw new Error("forbidden");
    }
    const db = admin();
    const { data: acc } = await db
      .from("marketplace_accounts")
      .select("status,mp_user_id,expires_at,live_mode,connected_at,disconnected_at,last_error")
      .eq("company_id", data.companyId)
      .maybeSingle();
    return acc ?? null;
  });

// ============================================================
// URL DE AUTORIZAÇÃO OAUTH
// ============================================================
export const getMpAuthorizeUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await assertMembership(context.userId, data.companyId))) {
      throw new Error("forbidden");
    }
    const state = signState(data.companyId);
    return { url: buildAuthorizeUrl(state) };
  });

// ============================================================
// DESCONECTAR
// ============================================================
export const disconnectMarketplace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await assertMembership(context.userId, data.companyId))) {
      throw new Error("forbidden");
    }
    const db = admin();
    const { error } = await db
      .from("marketplace_accounts")
      .update({
        status: "disconnected",
        access_token_enc: null,
        refresh_token_enc: null,
        disconnected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", data.companyId);
    if (error) throw new Error(String(error.message));
    return { ok: true };
  });

// ============================================================
// PAYMENT SETTINGS
// ============================================================
export const getPaymentSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) =>
    z.object({ companyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await assertMembership(context.userId, data.companyId))) {
      throw new Error("forbidden");
    }
    const db = admin();
    const { data: s } = await db
      .from("payment_settings")
      .select("*")
      .eq("company_id", data.companyId)
      .maybeSingle();
    if (s) return s;
    // bootstrap padrão
    const { data: created } = await db
      .from("payment_settings")
      .insert({ company_id: data.companyId })
      .select("*")
      .single();
    return created;
  });

export const updatePaymentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string; feeMode: FeeMode }) =>
    z
      .object({
        companyId: z.string().uuid(),
        feeMode: z.enum(["customer_pays", "owner_pays"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await assertMembership(context.userId, data.companyId))) {
      throw new Error("forbidden");
    }
    const db = admin();
    await db
      .from("payment_settings")
      .upsert(
        {
          company_id: data.companyId,
          fee_mode: data.feeMode,
          platform_fee_bps: FEE_BPS_DEFAULT,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id" },
      );
    return { ok: true };
  });

// ============================================================
// CRIAR COBRANÇA PIX
// ============================================================
export const createPixCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      companyId: string;
      customerId?: string | null;
      amountCents: number;
      description: string;
      idempotencyKey?: string | null;
    }) =>
      z
        .object({
          companyId: z.string().uuid(),
          customerId: z.string().uuid().nullable().optional(),
          amountCents: z.number().int().min(100).max(10_000_000), // R$1 — R$100k
          description: z.string().min(1).max(200),
          idempotencyKey: z.string().min(8).max(128).nullable().optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await assertMembership(context.userId, data.companyId))) {
      throw new Error("forbidden");
    }
    const db = admin();

    // Fase B — Idempotência: se o cliente enviar idempotencyKey, e já houver
    // transação com (company_id, idempotency_key), devolve a existente em vez
    // de chamar o MP de novo. Duplo clique deixa de gerar segunda cobrança.
    if (data.idempotencyKey) {
      const { data: existing } = await db
        .from("payment_transactions")
        .select("*")
        .eq("company_id", data.companyId)
        .eq("idempotency_key", data.idempotencyKey)
        .maybeSingle();
      if (existing) {
        const appUrl0 = (process.env.PUBLIC_APP_URL || "").replace(/\/+$/, "");
        return {
          id: existing.id as string,
          externalReference: existing.external_reference as string,
          amountCents: existing.amount_cents as number,
          feeCents: existing.processing_fee_cents as number,
          totalCents: existing.total_amount_cents as number,
          feeMode: existing.fee_mode as FeeMode,
          qrCode: (existing.qr_code as string | null) ?? null,
          qrCodeBase64: (existing.qr_code_base64 as string | null) ?? null,
          ticketUrl: (existing.ticket_url as string | null) ?? null,
          payUrl: `${appUrl0}/pagar/${existing.external_reference}`,
        };
      }
    }

    // Garante config
    const { data: settings } = await db
      .from("payment_settings")
      .select("*")
      .eq("company_id", data.companyId)
      .maybeSingle();
    const feeMode: FeeMode = (settings?.fee_mode as FeeMode) || "customer_pays";
    const bps = settings?.platform_fee_bps ?? FEE_BPS_DEFAULT;
    const fee = computeFee(data.amountCents, feeMode, bps);

    const ownerToken = await getOwnerAccessToken(data.companyId);
    const externalReference = `tx_${data.companyId.slice(0, 8)}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const appUrl = (process.env.PUBLIC_APP_URL || "").replace(/\/+$/, "");
    const notificationUrl = `${appUrl}/api/public/mp/marketplace-webhook`;

    // Mercado Pago application_fee é o valor que vai para o marketplace (CobraEasy).
    // Independente do feeMode, transaction_amount = totalCents (o que o cliente paga)
    // e application_fee = fee.feeCents.
    const pix = await createPixPayment({
      ownerToken,
      amountReais: fee.totalCents / 100,
      applicationFeeReais: fee.feeCents / 100,
      description: data.description,
      externalReference,
      notificationUrl,
    });

    // Persistir transação
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const { data: tx, error: txErr } = await db
      .from("payment_transactions")
      .insert({
        company_id: data.companyId,
        customer_id: data.customerId || null,
        external_reference: externalReference,
        description: data.description,
        amount_cents: fee.amountCents,
        processing_fee_cents: fee.feeCents,
        total_amount_cents: fee.totalCents,
        fee_mode: feeMode,
        payment_method: "pix",
        status: pix.status === "approved" ? "approved" : "pending",
        mp_payment_id: pix.id,
        qr_code: pix.qr_code,
        qr_code_base64: pix.qr_code_base64,
        ticket_url: pix.ticket_url,
        expires_at: expiresAt,
        raw_response: pix.raw as Record<string, unknown>,
        idempotency_key: data.idempotencyKey ?? null,
      })
      .select("*")
      .single();
    if (txErr) throw new Error(String(txErr.message));

    // Fase B — split log idempotente (UNIQUE em transaction_id).
    await db
      .from("payment_split_logs")
      .upsert(
        {
          company_id: data.companyId,
          transaction_id: tx.id,
          application_fee_cents: fee.feeCents,
          owner_amount_cents: fee.totalCents - fee.feeCents,
          total_amount_cents: fee.totalCents,
          status: "ok",
          mp_response: { payment_id: pix.id, status: pix.status },
        },
        { onConflict: "transaction_id", ignoreDuplicates: true },
      );

    return {
      id: tx.id,
      externalReference,
      amountCents: fee.amountCents,
      feeCents: fee.feeCents,
      totalCents: fee.totalCents,
      feeMode,
      qrCode: pix.qr_code,
      qrCodeBase64: pix.qr_code_base64,
      ticketUrl: pix.ticket_url,
      payUrl: `${appUrl}/pagar/${externalReference}`,
    };
  });

// ============================================================
// CRIAR LINK (Preference)
// ============================================================
export const createPaymentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      companyId: string;
      customerId?: string | null;
      amountCents: number;
      description: string;
      idempotencyKey?: string | null;
    }) =>
      z
        .object({
          companyId: z.string().uuid(),
          customerId: z.string().uuid().nullable().optional(),
          amountCents: z.number().int().min(100).max(10_000_000),
          description: z.string().min(1).max(200),
          idempotencyKey: z.string().min(8).max(128).nullable().optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await assertMembership(context.userId, data.companyId))) {
      throw new Error("forbidden");
    }
    const db = admin();

    // Fase B — Idempotência
    if (data.idempotencyKey) {
      const { data: existing } = await db
        .from("payment_transactions")
        .select("*")
        .eq("company_id", data.companyId)
        .eq("idempotency_key", data.idempotencyKey)
        .maybeSingle();
      if (existing) {
        const appUrl0 = (process.env.PUBLIC_APP_URL || "").replace(/\/+$/, "");
        return {
          id: existing.id as string,
          externalReference: existing.external_reference as string,
          initPoint: (existing.init_point as string | null) ?? null,
          payUrl: `${appUrl0}/pagar/${existing.external_reference}`,
          amountCents: existing.amount_cents as number,
          feeCents: existing.processing_fee_cents as number,
          totalCents: existing.total_amount_cents as number,
          feeMode: existing.fee_mode as FeeMode,
        };
      }
    }

    const { data: settings } = await db
      .from("payment_settings")
      .select("*")
      .eq("company_id", data.companyId)
      .maybeSingle();
    const feeMode: FeeMode = (settings?.fee_mode as FeeMode) || "customer_pays";
    const bps = settings?.platform_fee_bps ?? FEE_BPS_DEFAULT;
    const fee = computeFee(data.amountCents, feeMode, bps);

    const ownerToken = await getOwnerAccessToken(data.companyId);
    const externalReference = `tx_${data.companyId.slice(0, 8)}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const appUrl = (process.env.PUBLIC_APP_URL || "").replace(/\/+$/, "");

    const pref = await createPreference({
      ownerToken,
      amountReais: fee.totalCents / 100,
      marketplaceFeeReais: fee.feeCents / 100,
      description: data.description,
      externalReference,
      notificationUrl: `${appUrl}/api/public/mp/marketplace-webhook`,
      successUrl: `${appUrl}/pagar/${externalReference}`,
    });

    const { data: tx, error: txErr } = await db
      .from("payment_transactions")
      .insert({
        company_id: data.companyId,
        customer_id: data.customerId || null,
        external_reference: externalReference,
        description: data.description,
        amount_cents: fee.amountCents,
        processing_fee_cents: fee.feeCents,
        total_amount_cents: fee.totalCents,
        fee_mode: feeMode,
        payment_method: "link",
        status: "pending",
        mp_preference_id: pref.id,
        init_point: pref.init_point,
        raw_response: pref.raw as Record<string, unknown>,
        idempotency_key: data.idempotencyKey ?? null,
      })
      .select("*")
      .single();
    if (txErr) throw new Error(String(txErr.message));

    await db
      .from("payment_split_logs")
      .upsert(
        {
          company_id: data.companyId,
          transaction_id: tx.id,
          application_fee_cents: fee.feeCents,
          owner_amount_cents: fee.totalCents - fee.feeCents,
          total_amount_cents: fee.totalCents,
          status: "ok",
          mp_response: { preference_id: pref.id },
        },
        { onConflict: "transaction_id", ignoreDuplicates: true },
      );

    return {
      id: tx.id,
      externalReference,
      initPoint: pref.init_point,
      payUrl: `${appUrl}/pagar/${externalReference}`,
      amountCents: fee.amountCents,
      feeCents: fee.feeCents,
      totalCents: fee.totalCents,
      feeMode,
    };
  });

// ============================================================
// HISTÓRICO
// ============================================================
export const listPaymentTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { companyId: string; status?: string; limit?: number }) =>
      z
        .object({
          companyId: z.string().uuid(),
          status: z.string().optional(),
          limit: z.number().int().min(1).max(200).default(50),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!(await assertMembership(context.userId, data.companyId))) {
      throw new Error("forbidden");
    }
    const db = admin();
    let q = db
      .from("payment_transactions")
      .select(
        "id,external_reference,description,amount_cents,processing_fee_cents,total_amount_cents,fee_mode,payment_method,status,paid_at,created_at,customer_id",
      )
      .eq("company_id", data.companyId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(String(error.message));
    return rows ?? [];
  });

// ============================================================
// TELA PÚBLICA DO CLIENTE (sem auth)
// ============================================================
type PublicPaymentDTO = {
  external_reference: string;
  description: string | null;
  amount_cents: number;
  processing_fee_cents: number;
  total_amount_cents: number;
  fee_mode: string;
  payment_method: string;
  status: string;
  qr_code: string | null;
  qr_code_base64: string | null;
  ticket_url: string | null;
  init_point: string | null;
  expires_at: string | null;
  paid_at: string | null;
};

export const getPublicPayment = createServerFn({ method: "GET" })
  .inputValidator((input: { externalReference: string }) =>
    z.object({ externalReference: z.string().min(8).max(120) }).parse(input),
  )
  .handler(async ({ data }): Promise<PublicPaymentDTO | null> => {
    const db = admin();
    const { data: tx } = await db
      .from("payment_transactions")
      .select(
        "external_reference,description,amount_cents,processing_fee_cents,total_amount_cents,fee_mode,payment_method,status,qr_code,qr_code_base64,ticket_url,init_point,expires_at,paid_at",
      )
      .eq("external_reference", data.externalReference)
      .maybeSingle();
    if (!tx) return null;
    return tx as PublicPaymentDTO;
  });

