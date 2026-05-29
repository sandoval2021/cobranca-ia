// Server-only: handler determinístico para pedido de "meus dados de acesso".
// REGRAS DURAS:
// - Só envia usuário/senha/link se: cliente identificado pelo WhatsApp,
//   tela ativa, servidor ativo e rota/host público ativo associada ao servidor.
// - Rotas/subdomínios são gerenciados em armazenamento local (frontend) e
//   NÃO existem no banco; portanto, server-side não há "rota ativa" pública
//   confiável → SEMPRE encaminha para humano para enviar o link.
// - Nunca menciona "TV/celular".
// - Nunca envia dados de outro cliente.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Detecta pedido explícito de "meus dados de acesso"
const CREDENTIALS_RE =
  /\b(meus?\s+dados(\s+de\s+acesso)?|dados\s+de\s+acesso|meu\s+(login|usu[áa]rio|acesso)|minha\s+senha|usu[áa]rio\s+e\s+senha|login\s+e\s+senha|me\s+(manda|envia|passa)\s+(o\s+)?(usu[áa]rio|login|acesso|dados)|reenvia(r)?\s+(meus\s+)?dados|esqueci\s+(meu\s+)?(usu[áa]rio|login|senha))\b/i;

export function detectCredentialsRequest(text: string): boolean {
  if (!text) return false;
  return CREDENTIALS_RE.test(text);
}

export type CredentialsReplyResult =
  | { ok: true; reply: string; reason: "no_customer" | "no_active_route_or_data"; needsHuman: true }
  | { ok: false };

/**
 * Resposta determinística para pedido de credenciais.
 * Nunca chama IA. Nunca envia usuário/senha/link inline.
 * Sempre encaminha para humano (com mensagem distinta se o cliente foi ou não
 * identificado pelo WhatsApp).
 */
export async function buildCredentialsReply(params: {
  companyId: string;
  fromPhone: string;
  customerName: string | null;
  customerId: string | null;
}): Promise<CredentialsReplyResult> {
  const { companyId, customerId } = params;

  // Cliente não identificado pelo WhatsApp → não enviar nada
  if (!customerId) {
    return {
      ok: true,
      needsHuman: true,
      reason: "no_customer",
      reply:
        "Não encontrei seu cadastro por este WhatsApp.\n" +
        "Por segurança, vou chamar um atendente para conferir seus dados.",
    };
  }

  // Confere se existem credenciais ativas em servidores ativos.
  // (Mesmo existindo, NÃO enviamos: rota/host público fica em armazenamento
  //  local do painel — sem rota ativa confiável no servidor, encaminhamos.)
  const today = new Date().toISOString().slice(0, 10);
  const { data: creds } = await supabaseAdmin
    .from("customer_iptv_credentials")
    .select("id, server_id, expires_at, iptv_username")
    .eq("company_id", companyId)
    .eq("customer_id", customerId)
    .or(`expires_at.is.null,expires_at.gte.${today}`)
    .limit(5);

  const first = params.customerName?.split(/\s+/)[0] || "tudo bem";

  if (!creds || creds.length === 0) {
    return {
      ok: true,
      needsHuman: true,
      reason: "no_active_route_or_data",
      reply:
        `Olá, ${first} 😊\n` +
        "Encontrei seu cadastro, mas o link do servidor não está liberado no momento.\n" +
        "Vou chamar um atendente para conferir seus dados com segurança.",
    };
  }

  return {
    ok: true,
    needsHuman: true,
    reason: "no_active_route_or_data",
    reply:
      `Olá, ${first} 😊\n` +
      "Encontrei seu cadastro, mas o link do servidor não está liberado no momento.\n" +
      "Vou chamar um atendente para conferir seus dados com segurança.",
  };
}
