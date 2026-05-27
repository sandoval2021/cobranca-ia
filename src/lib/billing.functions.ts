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
type AnyDB = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const REUSE_PENDING_WINDOW_MIN = 10;

function admin(): AnyDB {
  return supabaseAdmin as unknown as AnyDB;
}

// -------- modo controlado de produção --------
function paymentsGloballyEnabled(): boolean {
  const v = (process.env.PAYMENTS_ENABLED || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function allowedCompanyIds(): Set<string> {
  const raw = process.env.PAYMENTS_ALLOWED_COMPANY_IDS || "";
  return new Set(
    raw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function companyAllowedForPayments(companyId: string): boolean {
  return allowedCompanyIds().has(companyId);
}
// ---------------------------------------------

async function isSuperAdmin(userClient: AnyDB): Promise<boolean> {
  try {
    const { data } = await userClient.rpc("current_user_is_super_admin");
    return Boolean(data);
  } catch {
    return false;
  }
}

async function assertCompanyMember(
  userClient: AnyDB,
  userId: string,
  companyId: string,
): Promise<boolean> {
  const db = admin();
  const { data: member } = await db
    .from("company_members")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (member) return true;
  return isSuperAdmin(userClient);
}

/**
 * Config público (sem auth) — informa apenas se o provedor tem token e
 * se há liberação global. NÃO retorna allowlist específica.
 */
export const getBillingPublicConfig = createServerFn({ method: "GET" }).handler(
  async () => {
    const cfg = getMercadoPagoConfigStatus();
    return {
      configured: cfg.configured,
      paymentsEnabled: paymentsGloballyEnabled(),
    };
  },
);

/**
 * Config por empresa (com auth) — diz se ESTA empresa pode pagar agora.
 * Liberado se: super admin OU global enabled OU company explicitamente liberada.
 */
export const getBillingCompanyAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ companyId: z.string().min(1).max(128) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const cfg = getMercadoPagoConfigStatus();
    const sa = await isSuperAdmin(context.supabase as unknown as AnyDB);
    const enabled = paymentsGloballyEnabled();
    const allowed = companyAllowedForPayments(data.companyId);
    return {
      configured: cfg.configured,
      paymentsEnabled: enabled,
      companyAllowed: allowed,
      isSuperAdmin: sa,
      canCheckout: cfg.configured && (sa || enabled || allowed),
    };
  });

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
    const allowed = await assertCompanyMember(
      context.supabase as unknown as AnyDB,
      userId,
      data.companyId,
    );
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
 * Modo controlado: só Super Admin ou companies liberadas via env.
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
    const userClient = context.supabase as unknown as AnyDB;

    const allowedMember = await assertCompanyMember(userClient, userId, data.companyId);
    if (!allowedMember) {
      return {
        ok: false as const,
        reason: "forbidden" as const,
        message: "Você não tem permissão sobre esta empresa.",
      };
    }

    // GATE: produção controlada
    const sa = await isSuperAdmin(userClient);
    const globallyEnabled = paymentsGloballyEnabled();
    const companyAllowed = companyAllowedForPayments(data.companyId);
    if (!sa && !globallyEnabled && !companyAllowed) {
      return {
        ok: false as const,
        reason: "payments_not_enabled" as const,
        message: "Pagamento online em validação. Fale com o suporte.",
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

    // 2) Registra aceite de termos
    try {
      await db.from("terms_acceptances").insert({
        company_id: data.companyId,
        user_id: userId,
        terms_version: data.termsVersion,
        terms_snapshot:
          data.termsSnapshot ?? `Termos de pagamento ${data.termsVersion}`,
        payment_method_context: "mercado_pago_checkout",
      });
    } catch (e) {
      console.error("[billing] terms_acceptances insert failed", e);
    }

    // 3) Reaproveita tentativa pendente recente
    const since = new Date(
      Date.now() - REUSE_PENDING_WINDOW_MIN * 60_000,
    ).toISOString();
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
        message:
          "Não foi possível gerar o checkout agora. Tente novamente em instantes.",
      };
    }
  });
