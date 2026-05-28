// Server function: Ajuda com IA para o Dono do painel.
// Requer sessão autenticada. Resposta sanitizada antes de retornar.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { openaiChat } from "./openai.server";
import { sanitizeAiOutput } from "./ai-sanitize";
import { logAiUsage } from "./ai-usage-log.server";
import { DEFAULT_AI_MODEL, estimateCostUsd } from "./ai-pricing.server";

const SYSTEM_PROMPT = `Você é o assistente do CobraEasy, um painel SaaS de cobrança usado por donos de revenda de IPTV/streaming no Brasil.

Responda SEMPRE em português do Brasil, de forma curta, clara e amigável, sem jargão técnico.

Você pode ajudar com:
- cadastro de clientes
- cobranças
- testes/leads
- serviços e planos
- importação de XLSX/PDF
- assinatura e Mercado Pago (uso, não configuração)
- vencimentos
- mensagens automáticas
- backup e exportação

Regras importantes:
- NUNCA invente nomes, IDs, e-mails ou números do usuário.
- NUNCA mostre código, JSON, UUID, SQL ou erro técnico.
- Se não souber responder, diga: "Não consegui te ajudar com isso. Fale com o suporte humano."
- Limite respostas a no máximo 4 frases curtas, em parágrafos ou lista simples.
- Não toque em assuntos fora do CobraEasy.`;

const inputSchema = z.object({
  question: z.string().trim().min(1).max(1000),
});

export const askDonoHelp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;

    // Resolve a company_id for the caller (first membership). Logging only;
    // never block AI if we can't resolve.
    let companyId: string | null = null;
    try {
      const { data: m } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      companyId = m?.company_id ?? null;
    } catch {
      companyId = null;
    }

    try {
      const result = await openaiChat({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: data.question },
        ],
        model: DEFAULT_AI_MODEL,
        max_tokens: 350,
        temperature: 0.4,
      });

      if (companyId) {
        const usage = result.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
        await logAiUsage({
          company_id: companyId,
          user_id: userId,
          usage_type: "owner",
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
      }

      return {
        ok: true as const,
        answer:
          sanitizeAiOutput(result.text) ||
          "Não consegui te ajudar com isso. Fale com o suporte humano.",
        usage: result.usage,
        model: result.model,
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error("[askDonoHelp]", reason);
      if (companyId) {
        await logAiUsage({
          company_id: companyId,
          user_id: userId,
          usage_type: "owner",
          model: DEFAULT_AI_MODEL,
          status: "error",
          error_reason: reason,
        });
      }
      return {
        ok: false as const,
        answer:
          "Estou com instabilidade no momento. Tente novamente em instantes ou fale com o suporte humano.",
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        model: "",
      };
    }
  });
