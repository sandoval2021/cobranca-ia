// Server-only: motor determinístico que monta o contexto da IA
// (cliente, grupo de preço, planos, indicador, app, memória) ANTES de chamar a OpenAI.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  detectApp,
  detectAppIssue,
  detectIntent,
  extractReferralHints,
  classifyCustomer,
  type Intent,
  type CustomerClass,
} from "./intent";

export type ConvoMemory = {
  last_messages: Array<{ role: "user" | "assistant"; text: string; at: string }>;
  summary: string | null;
  flags: Record<string, unknown>;
export type AiContext = {
  intent: Intent;
  classification: CustomerClass;
  company: { id: string; name: string | null };
  customer: {
    id: string;
    name: string;
    phone: string | null;
    notes: string | null;
    price_group_id: string | null;
  } | null;
  priceGroup: {
    id: string;
    name: string;
    ai_notes: string | null;
    plans: Array<{
      name: string;
      screens: number;
      duration_days: number;
      price_brl: string;
      allow_installments: boolean;
      notes: string | null;
    }>;
  } | null;
  referral: {
    mentioned: boolean;
    indicator: { id: string; name: string; price_group_id: string | null } | null;
    hint: { phone: string | null; name: string | null };
  };
  app: {
    name: string | null;
    issue: ReturnType<typeof detectAppIssue>;
    entry: {
      app_name: string;
      login_type: string;
      stability_level: string;
      how_to_update: string | null;
      how_to_change_route: string | null;
      common_issues: string | null;
      default_reply: string | null;
      escalate_when: string | null;
    } | null;
  };
  memory: ConvoMemory;
  settings: {
    support_instructions: string | null;
    ask_referral_for_new: boolean;
    escalate_when_referrer_missing: boolean;
    human_handoff_number: string | null;
  };
  needsHuman: boolean;
  reason: string | null;
};

function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function buildAiContext(params: {
  companyId: string;
  fromPhone: string;
  text: string;
  memory?: ConvoMemory;
}): Promise<AiContext> {
  const { companyId, fromPhone, text } = params;
  const memory: ConvoMemory = params.memory ?? { last_messages: [], summary: null, flags: {} };
  const intent = detectIntent(text);

  reason: string | null;
};

function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function buildAiContext(params: {
  companyId: string;
  fromPhone: string;
  text: string;
}): Promise<AiContext> {
  const { companyId, fromPhone, text } = params;
  const intent = detectIntent(text);

  // 1) Empresa
  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .maybeSingle();

  // 2) Settings da empresa (com fallback default)
  const { data: settingsRow } = await supabaseAdmin
    .from("ai_company_settings")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  const settings = {
    support_instructions: settingsRow?.support_instructions ?? null,
    ask_referral_for_new: settingsRow?.ask_referral_for_new ?? true,
    escalate_when_referrer_missing: settingsRow?.escalate_when_referrer_missing ?? true,
    human_handoff_number: settingsRow?.human_handoff_number ?? null,
  };

  // 3) Cliente por telefone (best-effort match nos últimos 8 dígitos)
  const last8 = fromPhone.slice(-8);
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id, name, phone, notes, price_group_id")
    .eq("company_id", companyId)
    .ilike("phone", `%${last8}%`)
    .limit(1)
    .maybeSingle();

  // 4) Indicação
  const hint = extractReferralHints(text);
  const referralMentioned = intent === "referral" || !!hint.phone || !!hint.name;
  let indicator: AiContext["referral"]["indicator"] = null;
  if (!customer && referralMentioned) {
    if (hint.phone) {
      const ph = hint.phone.slice(-8);
      const { data: byPhone } = await supabaseAdmin
        .from("customers")
        .select("id, name, price_group_id")
        .eq("company_id", companyId)
        .ilike("phone", `%${ph}%`)
        .limit(1)
        .maybeSingle();
      if (byPhone) indicator = byPhone;
    }
    if (!indicator && hint.name) {
      const { data: byName } = await supabaseAdmin
        .from("customers")
        .select("id, name, price_group_id")
        .eq("company_id", companyId)
        .ilike("name", `%${hint.name}%`)
        .limit(1)
        .maybeSingle();
      if (byName) indicator = byName;
    }
  }

  // 5) Resolve grupo de preço
  let priceGroupId: string | null = null;
  let needsHuman = false;
  let reason: string | null = null;

  if (customer?.price_group_id) {
    priceGroupId = customer.price_group_id;
  } else if (indicator?.price_group_id) {
    priceGroupId = indicator.price_group_id;
  } else if (!customer && referralMentioned && !indicator && settings.escalate_when_referrer_missing) {
    needsHuman = true;
    reason = "referrer_not_found";
    // não carrega plano
  } else {
    // grupo default da empresa
    const { data: def } = await supabaseAdmin
      .from("price_groups")
      .select("id")
      .eq("company_id", companyId)
      .eq("is_default", true)
      .eq("is_active", true)
      .maybeSingle();
    priceGroupId = def?.id ?? null;
  }

  // 6) Carrega o grupo + planos (apenas o relevante)
  let priceGroup: AiContext["priceGroup"] = null;
  if (priceGroupId) {
    const { data: pg } = await supabaseAdmin
      .from("price_groups")
      .select("id, name, ai_notes")
      .eq("id", priceGroupId)
      .maybeSingle();
    if (pg) {
      const { data: plans } = await supabaseAdmin
        .from("price_group_plans")
        .select("name, screens, duration_days, price_cents, allow_installments, notes")
        .eq("price_group_id", pg.id)
        .eq("is_active", true)
        .order("price_cents", { ascending: true });
      priceGroup = {
        id: pg.id,
        name: pg.name,
        ai_notes: pg.ai_notes,
        plans: (plans ?? []).map((p) => ({
          name: p.name,
          screens: p.screens,
          duration_days: p.duration_days,
          price_brl: brl(p.price_cents),
          allow_installments: p.allow_installments,
          notes: p.notes,
        })),
      };
    }
  }

  // 7) App suporte
  const appName = detectApp(text);
  let appEntry: AiContext["app"]["entry"] = null;
  if (appName) {
    const { data: kb } = await supabaseAdmin
      .from("app_support_kb")
      .select("app_name, login_type, stability_level, how_to_update, how_to_change_route, common_issues, default_reply, escalate_when")
      .eq("company_id", companyId)
      .ilike("app_name", appName)
      .eq("is_active", true)
      .maybeSingle();
    if (kb) appEntry = kb;
  }

  return {
    intent,
    company: { id: companyId, name: company?.name ?? null },
    customer: customer
      ? {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          notes: customer.notes,
          price_group_id: customer.price_group_id,
        }
      : null,
    priceGroup,
    referral: { mentioned: referralMentioned, indicator, hint },
    app: { name: appName, entry: appEntry },
    settings,
    needsHuman,
    reason,
  };
}

/**
 * Monta o system prompt enxuto + bloco de contexto JSON pequeno.
 * Mantém uso de tokens baixo: só envia o que importa para a intenção.
 */
export function buildPromptFromContext(ctx: AiContext): { system: string; contextBlock: string } {
  const rules = [
    "Você é um atendente de WhatsApp educado, objetivo e útil. Responda em PT-BR, máximo 4 frases curtas.",
    "REGRAS DURAS:",
    "- NUNCA invente preço, plano, desconto, teste, prazo, data ou status de pagamento.",
    "- NUNCA confirme renovação, pagamento ou alteração de vencimento.",
    "- Só fale de planos que estão no bloco CONTEXTO. Se não houver plano, NÃO cite valores.",
    "- Se faltar dado essencial, peça ao cliente OU diga que um humano vai continuar o atendimento.",
    "- Se 'needsHuman' for true no contexto, encaminhe educadamente para atendente humano.",
    "- Para pagamento ('paguei'), peça o comprovante; nunca confirme renovação sem registro.",
  ];

  if (ctx.settings.support_instructions?.trim()) {
    rules.push(`INSTRUÇÕES DA EMPRESA: ${ctx.settings.support_instructions.trim()}`);
  }

  // Bloco de contexto compacto
  const compact: Record<string, unknown> = {
    intent: ctx.intent,
    empresa: ctx.company.name,
    cliente: ctx.customer
      ? { nome: ctx.customer.name, notas: ctx.customer.notes }
      : { encontrado: false, telefone_terminacao: "***" },
    needsHuman: ctx.needsHuman,
    motivo: ctx.reason,
  };

  if (ctx.priceGroup && (ctx.intent === "price" || ctx.intent === "renewal" || ctx.intent === "referral" || ctx.intent === "trial" || ctx.intent === "other" || ctx.intent === "greeting")) {
    compact.tabela_preco = {
      nome: ctx.priceGroup.name,
      observacoes: ctx.priceGroup.ai_notes,
      planos: ctx.priceGroup.plans,
    };
  }

  if (ctx.referral.mentioned) {
    compact.indicacao = {
      mencionada: true,
      indicador_encontrado: !!ctx.referral.indicator,
      indicador_nome: ctx.referral.indicator?.name ?? null,
      pista: ctx.referral.hint,
    };
    if (!ctx.customer && !ctx.referral.indicator && ctx.settings.ask_referral_for_new) {
      compact.acao_sugerida = "Peça o número de WhatsApp do indicador para confirmar a tabela de preços.";
    }
  } else if (!ctx.customer && ctx.settings.ask_referral_for_new) {
    compact.acao_sugerida = "Pergunte de forma educada se a pessoa veio por indicação antes de apresentar preços.";
  }

  if (ctx.app.entry) {
    compact.suporte_app = ctx.app.entry;
  } else if (ctx.intent === "app_issue") {
    compact.suporte_app = { observacao: "Cliente reportou problema de app; pergunte qual aplicativo está usando." };
  }

  if (ctx.needsHuman && ctx.settings.human_handoff_number) {
    compact.contato_humano = ctx.settings.human_handoff_number;
  }

  return {
    system: rules.join("\n"),
    contextBlock: "CONTEXTO:\n" + JSON.stringify(compact, null, 2),
  };
}
