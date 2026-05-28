// Server function: Atendimento IA para o CLIENTE FINAL (link público com token).
// Valida token server-side, registra uso em ai_usage_log.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "crypto";
import { openaiChat } from "./openai.server";
import { sanitizeAiOutput } from "./ai-sanitize";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAiUsage } from "./ai-usage-log.server";
import { DEFAULT_AI_MODEL, estimateCostUsd } from "./ai-pricing.server";

const SYSTEM_PROMPT_DEMO = `Você é o atendente virtual de uma revenda do CobraEasy.

Responda SEMPRE em português do Brasil, com tom educado, curto e claro.

Você pode orientar o cliente sobre:
- como funciona a renovação
- como pagar (PIX/cartão)
- onde encontrar o comprovante
- o que fazer se o serviço parou

Regras importantes:
- NÃO confirme valores, datas ou status específicos do cliente.
- NÃO mostre dados de outros clientes ou empresas.
- NUNCA mostre código, JSON, UUID ou erro técnico.
- Para qualquer dúvida sobre o contrato pessoal dele, diga:
  "Vou te encaminhar para o suporte da sua revenda."
- Limite respostas a no máximo 3 frases curtas.`;

const inputSchema = z.object({
  token: z.string().trim().min(1).max(200),
  question: z.string().trim().min(1).max(800),
});

async function resolveToken(token: string): Promise<{
  company_id: string;
  customer_id: string | null;
} | null> {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data, error } = await supabaseAdmin
    .from("customer_support_tokens")
    .select("id, company_id, customer_id, expires_at, is_active")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error || !data) return null;
  if (!data.is_active) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  // best-effort touch
  await supabaseAdmin
    .from("customer_support_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  return { company_id: data.company_id, customer_id: data.customer_id };
}

export const askCustomerHelp = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const ctx = await resolveToken(data.token);
    if (!ctx) {
      return {
        ok: false as const,
        answer:
          "Seu link de atendimento expirou. Por favor, fale com o suporte da sua revenda.",
      };
    }

    try {
      const result = await openaiChat({
        messages: [
          { role: "system", content: SYSTEM_PROMPT_DEMO },
          { role: "user", content: data.question },
        ],
        model: DEFAULT_AI_MODEL,
        max_tokens: 250,
        temperature: 0.3,
      });

      const usage = result.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      await logAiUsage({
        company_id: ctx.company_id,
        customer_id: ctx.customer_id,
        usage_type: "customer",
        model: result.model || DEFAULT_AI_MODEL,
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
        estimated_cost_usd: estimateCostUsd(
          result.model || DEFAULT_AI_MODEL,
          usage.prompt_tokens,
          usage.completion_tokens,
        ),
        status: "success",
      });

      return {
        ok: true as const,
        answer:
          sanitizeAiOutput(result.text) ||
          "Vou te encaminhar para o suporte da sua revenda.",
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error("[askCustomerHelp]", reason);
      await logAiUsage({
        company_id: ctx.company_id,
        customer_id: ctx.customer_id,
        usage_type: "customer",
        model: DEFAULT_AI_MODEL,
        status: "error",
        error_reason: reason,
      });
      return {
        ok: false as const,
        answer:
          "Estou com instabilidade no momento. Por favor, fale com o suporte da sua revenda.",
      };
    }
  });
