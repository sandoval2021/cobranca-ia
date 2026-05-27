import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  friendlyNotConfiguredMessage,
  getMercadoPagoConfigStatus,
} from "@/lib/mercado-pago.server";

/**
 * Placeholder server-only para criação de checkout.
 * Fase 1: NÃO chama Mercado Pago real. Apenas valida sessão, empresa,
 * e retorna mensagem amigável quando o token não está configurado.
 */
export const createBillingCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        companyId: z.string().min(1).max(128),
        planId: z.string().min(1).max(128).optional(),
        method: z.enum(["pix", "card", "card_recurring"]).default("pix"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const cfg = getMercadoPagoConfigStatus();

    if (!cfg.configured) {
      return {
        ok: false as const,
        reason: "not_configured" as const,
        message: friendlyNotConfiguredMessage(),
      };
    }

    // Mesmo com token presente, nesta fase NÃO realizamos cobrança real.
    return {
      ok: false as const,
      reason: "phase1_disabled" as const,
      message: "Pagamento online ainda não está ativo.",
      requestedBy: userId,
      companyId: data.companyId,
      method: data.method,
    };
  });
