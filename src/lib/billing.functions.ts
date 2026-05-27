import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  createMpPreference,
  friendlyNotConfiguredMessage,
  getMercadoPagoConfigStatus,
} from "@/lib/mercado-pago.server";

// Tipos relaxados pois Database types não inclui as tabelas billing ainda.
// supabaseAdmin é cast para any nas chamadas para evitar atrito de tipos.
// RLS é contornado intencionalmente (service_role) — segurança via checks server-side.
type AnyDB = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const REUSE_PENDING_WINDOW_MIN = 10;

function admin(): AnyDB {
  return supabaseAdmin as unknown as AnyDB;
}

async function assertCompanyMember(userId: string, companyId: string): Promise<boolean> {
  const db = admin();
  const { data: member } = await db
    .from("company_members")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (member) return true;
  // Super admin bypass
  const { data: sa } = await db
    .rpc("current_user_is_super_admin");
  return Boolean(sa);
}

/**
 * Server-fn público: indica se pagamento online está configurado.
 * NÃO retorna o token.
 */
export const getBillingPublicConfig = createServerFn({ method: "GET" }).handler(
  async () => {
    const cfg = getMercadoPagoConfigStatus();
    return { configured: cfg.configured };
  },
);

/**
 * Última tentativa de pagamento da empresa.
 */
export const getLastPaymentAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ companyId: z.string().min(1).max(128) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const allowed = await assertCompanyMember(userId, data.companyId);
    if (!allowed) return { attempt: null as any };
    const db = admin();
    const { data: attempt } = await db
      .from("payment_attempts")
      .select(
        "id,status,method,amount_cents,currency,checkout_url,created_at,updated_at",
      )
      .eq("company_id", data.companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { attempt };
  });

/**
 * Cria checkout Mercado Pago (Pix/checkout único, sem cartão recorrente).
 */
export const createBillingCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        companyId: z.string().min(1).max(128),
        planId: z.string().min(1).max(128),
        termsAccepted: z.boolean(),
        termsVersion: z.string().min(1).max(64).default("v1"),
        termsSnapshot: z.string().min(1).max(20000).optional(),
        payerEmail: z.string().email().max(255).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const cfg = getMercadoPagoConfigStatus();
    if (!cfg.configured) {
      return {
        ok: false as const,
        reason: "not_configured" as const,
        message: friendlyNotConfiguredMessage(),
      };
    }

    if (!data.termsAccepted) {
      return {
        ok: false as const,
        reason: "terms_required" as const,
        message: "É necessário aceitar os termos antes de pagar.",
      };
    }

    const { userId, claims } = context;
    const allowed = await assertCompanyMember(userId, data.companyId);
    if (!allowed) {
      return {
        ok: false as const,
        reason: "forbidden" as const,
        message: "Você não tem permissão sobre esta empresa.",
      };
    }

    const db = admin();

    // 1) Carrega plano ativo
    const { data: plan, error: planErr } = await db
      .from("billing_plans")
      .select("id,name,amount_cents,currency,active")
      .eq("id", data.planId)
      .maybeSingle();
    if (planErr || !plan || !plan.active) {
      return {
        ok: false as const,
        reason: "invalid_plan" as const,
        message: "Plano indisponível.",
      };
    }
    if (!plan.amount_cents || plan.amount_cents <= 0) {
      return {
        ok: false as const,
        reason: "invalid_amount" as const,
        message: "Plano sem valor configurado.",
      };
    }

    // 2) Registra aceite de termos (idempotência leve: append-only)
    try {
      await db.from("terms_acceptances").insert({
        company_id: data.companyId,
        user_id: userId,
        terms_version: data.termsVersion,
        terms_snapshot: data.termsSnapshot ?? `Termos de pagamento ${data.termsVersion}`,
        payment_method_context: "mercado_pago_checkout",
      });
    } catch (e) {
      console.error("[billing] terms_acceptances insert failed", e);
    }

    // 3) Reaproveita tentativa pendente recente
    const since = new Date(Date.now() - REUSE_PENDING_WINDOW_MIN * 60_000).toISOString();
    const { data: pending } = await db
      .from("payment_attempts")
      .select("id,checkout_url,provider_preference_id,status,created_at")
      .eq("company_id", data.companyId)
      .eq("provider", "mercado_pago")
      .eq("status", "pending")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pending?.checkout_url) {
      return {
        ok: true as const,
        attemptId: pending.id,
        checkoutUrl: pending.checkout_url,
        reused: true as const,
      };
    }

    // 4) Cria tentativa pending
    const { data: created, error: insErr } = await db
      .from("payment_attempts")
      .insert({
        company_id: data.companyId,
        provider: "mercado_pago",
        method: "checkout",
        status: "pending",
        amount_cents: plan.amount_cents,
        currency: plan.currency || "BRL",
      })
      .select("id")
      .single();
    if (insErr || !created) {
      console.error("[billing] payment_attempts insert failed", insErr);
      return {
        ok: false as const,
        reason: "internal_error" as const,
        message: "Não foi possível iniciar o pagamento agora.",
      };
    }

    const attemptId: string = created.id;

    // 5) Chama Mercado Pago
    try {
      const pref = await createMpPreference({
        attemptId,
        planName: plan.name,
        amountBRL: Number(plan.amount_cents) / 100,
        payerEmail: data.payerEmail ?? (claims?.email as string | undefined),
      });
      const checkoutUrl = pref.init_point || pref.sandbox_init_point || "";
      await db
        .from("payment_attempts")
        .update({
          provider_preference_id: pref.id,
          checkout_url: checkoutUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", attemptId);

      return {
        ok: true as const,
        attemptId,
        checkoutUrl,
        reused: false as const,
      };
    } catch (e) {
      console.error("[billing] mp preference failed", e);
      await db
        .from("payment_attempts")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", attemptId);
      return {
        ok: false as const,
        reason: "provider_error" as const,
        message: "Não foi possível gerar o checkout agora. Tente novamente em instantes.",
      };
    }
  });
