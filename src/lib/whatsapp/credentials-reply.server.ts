// Server-only: handler determinístico para pedido de "meus dados de acesso".
// Fonte oficial: banco. Cadeia: cliente -> credencial ativa -> servidor ativo
// -> rota ativa (principal > reserva > qualquer produção ativa).
// NUNCA envia dados se algum elo falhar; encaminha para humano.
// NUNCA menciona TV/celular/aplicativo. NUNCA mistura dados de outros clientes.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptSecret } from "@/lib/iptv/crypto.server";

const CREDENTIALS_RE =
  /\b(meus?\s+dados(\s+de\s+acesso)?|dados\s+de\s+acesso|meu\s+(login|usu[áa]rio|acesso|link)|minha\s+senha|meu\s+link|usu[áa]rio\s+e\s+senha|login\s+e\s+senha|me\s+(manda|envia|passa)\s+(o\s+)?(usu[áa]rio|login|acesso|dados|link)|reenvia(r)?\s+(meus\s+)?dados|esqueci\s+(meu\s+)?(usu[áa]rio|login|senha))\b/i;

export function detectCredentialsRequest(text: string): boolean {
  if (!text) return false;
  return CREDENTIALS_RE.test(text);
}

export type CredentialsReplyResult =
  | {
      ok: true;
      sent: true;
      reply: string;
      reason: "credentials_sent";
      needsHuman: false;
    }
  | {
      ok: true;
      sent: false;
      reply: string;
      reason:
        | "no_customer"
        | "no_active_credential"
        | "no_active_server"
        | "no_active_route";
      needsHuman: true;
    }
  | { ok: false };

function fmtDateBR(iso?: string | null): string {
  if (!iso) return "sem data definida";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "sem data definida";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Escolhe a melhor rota ativa: principal > reserva > qualquer produção ativa. */
async function pickActiveRouteForServer(companyId: string, serverId: string) {
  const { data: routes } = await supabaseAdmin
    .from("dns_routes")
    .select("id, host, is_primary, is_backup, environment, is_active, archived")
    .eq("company_id", companyId)
    .eq("server_id", serverId)
    .eq("is_active", true)
    .eq("archived", false);

  if (!routes || routes.length === 0) return null;

  const primary = routes.find((r) => r.is_primary);
  if (primary?.host) return primary;
  const backup = routes.find((r) => r.is_backup);
  if (backup?.host) return backup;
  const prod = routes.find((r) => r.environment === "producao");
  if (prod?.host) return prod;
  return routes.find((r) => !!r.host) ?? null;
}

export async function buildCredentialsReply(params: {
  companyId: string;
  fromPhone: string;
  customerName: string | null;
  customerId: string | null;
}): Promise<CredentialsReplyResult> {
  const { companyId, customerId } = params;
  const first = params.customerName?.split(/\s+/)[0] || "tudo bem";

  if (!customerId) {
    return {
      ok: true,
      sent: false,
      needsHuman: true,
      reason: "no_customer",
      reply:
        "Não encontrei seu cadastro por este WhatsApp.\n" +
        "Por segurança, vou chamar um atendente para conferir seus dados.",
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: creds } = await supabaseAdmin
    .from("customer_iptv_credentials")
    .select("id, server_id, expires_at, iptv_username, iptv_password_enc, company_id, customer_id")
    .eq("company_id", companyId)
    .eq("customer_id", customerId)
    .or(`expires_at.is.null,expires_at.gte.${today}`)
    .order("updated_at", { ascending: false });

  const cred = creds?.find((c) => c.server_id && c.iptv_username && c.iptv_password_enc);
  if (!cred) {
    return {
      ok: true,
      sent: false,
      needsHuman: true,
      reason: "no_active_credential",
      reply:
        `Olá, ${first} 😊\n` +
        "Encontrei seu cadastro, mas não consegui localizar seus dados de acesso neste momento.\n" +
        "Vou encaminhar para um atendente.",
    };
  }

  const { data: server } = await supabaseAdmin
    .from("servers")
    .select("id, company_id, name, is_active")
    .eq("id", cred.server_id!)
    .eq("company_id", companyId)
    .maybeSingle();

  if (!server || !server.is_active) {
    return {
      ok: true,
      sent: false,
      needsHuman: true,
      reason: "no_active_server",
      reply:
        `Olá, ${first} 😊\n` +
        "Encontrei seu cadastro, mas não consegui localizar seus dados de acesso neste momento.\n" +
        "Vou encaminhar para um atendente.",
    };
  }

  const route = await pickActiveRouteForServer(companyId, server.id);
  if (!route?.host) {
    return {
      ok: true,
      sent: false,
      needsHuman: true,
      reason: "no_active_route",
      reply:
        `Olá, ${first} 😊\n` +
        "Encontrei seu cadastro, mas não consegui localizar seus dados de acesso neste momento.\n" +
        "Vou encaminhar para um atendente.",
    };
  }

  const password = decryptSecret(cred.iptv_password_enc);
  if (!password || !cred.iptv_username) {
    return {
      ok: true,
      sent: false,
      needsHuman: true,
      reason: "no_active_credential",
      reply:
        `Olá, ${first} 😊\n` +
        "Encontrei seu cadastro, mas não consegui localizar seus dados de acesso neste momento.\n" +
        "Vou encaminhar para um atendente.",
    };
  }

  const host = route.host.startsWith("http") ? route.host : `http://${route.host}`;

  const reply =
    `Olá, ${first} 😊\n\n` +
    `Aqui estão seus dados de acesso:\n\n` +
    `🌐 Link:\n${host}\n\n` +
    `👤 Usuário:\n${cred.iptv_username}\n\n` +
    `🔐 Senha:\n${password}\n\n` +
    `📅 Vencimento:\n${fmtDateBR(cred.expires_at)}\n\n` +
    `Caso precise de ajuda, estamos à disposição.`;

  // Log de acesso a credencial (auditoria)
  try {
    await supabaseAdmin.from("credential_access_log").insert({
      company_id: companyId,
      user_id: null,
      target_kind: "iptv_credential",
      target_id: cred.id,
      action: "ai_sent_to_customer",
    });
  } catch {
    /* não bloqueia envio se log falhar */
  }

  return {
    ok: true,
    sent: true,
    needsHuman: false,
    reason: "credentials_sent",
    reply,
  };
}
