// Server function: Atendimento IA para o CLIENTE FINAL (link público com token).
// Nesta entrega o backend de token de cliente ainda não existe (exige SQL).
// Para garantir multi-tenant seguro, este endpoint roda em MODO DEMO:
// nunca consulta dados reais; responde apenas dúvidas gerais sobre pagamento/renovação.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { openaiChat } from "./openai.server";
import { sanitizeAiOutput } from "./ai-sanitize";

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

export const askCustomerHelp = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    // TODO (próxima tarefa, requer SQL): validar token, buscar company_id + customer_id,
    // montar contexto seguro (plano, vencimento, status) e injetar no system prompt.
    try {
      const result = await openaiChat({
        messages: [
          { role: "system", content: SYSTEM_PROMPT_DEMO },
          { role: "user", content: data.question },
        ],
        max_tokens: 250,
        temperature: 0.3,
      });
      return {
        ok: true as const,
        answer:
          sanitizeAiOutput(result.text) ||
          "Vou te encaminhar para o suporte da sua revenda.",
      };
    } catch (err) {
      console.error("[askCustomerHelp]", err);
      return {
        ok: false as const,
        answer:
          "Estou com instabilidade no momento. Por favor, fale com o suporte da sua revenda.",
      };
    }
  });
