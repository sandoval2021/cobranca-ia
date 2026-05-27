// Server function: Ajuda com IA para o Dono do painel.
// Requer sessão autenticada. Resposta sanitizada antes de retornar.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { openaiChat } from "./openai.server";
import { sanitizeAiOutput } from "./ai-sanitize";

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
  .handler(async ({ data }) => {
    try {
      const result = await openaiChat({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: data.question },
        ],
        max_tokens: 350,
        temperature: 0.4,
      });
      return {
        ok: true as const,
        answer: sanitizeAiOutput(result.text) ||
          "Não consegui te ajudar com isso. Fale com o suporte humano.",
        usage: result.usage,
        model: result.model,
      };
    } catch (err) {
      console.error("[askDonoHelp]", err);
      return {
        ok: false as const,
        answer:
          "Estou com instabilidade no momento. Tente novamente em instantes ou fale com o suporte humano.",
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        model: "",
      };
    }
  });
