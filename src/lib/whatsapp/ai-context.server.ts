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
};

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
  companyTraining: {
    knowledge_text: string | null;
    tone: string | null;
    answer_length: string | null;
    allow_after_hours: boolean;
    accepts_audio: boolean;
    auto_offer_trial: boolean;
    human_on_complaint: boolean;
    human_when_unsure: boolean;
    allow_paid_apps_info: boolean;
    use_manual_pix_fallback: boolean;
    faqs: Array<{ category: string; question: string; answer: string }>;
    apps: Array<{
      app_name: string;
      is_paid: boolean;
      app_price_cents: number;
      login_type: string;
      install_steps: string | null;
      update_steps: string | null;
      cache_steps: string | null;
      route_steps: string | null;
      common_issues: string | null;
      default_reply: string | null;
    }>;
    payment: {
      manual_pix_key: string | null;
      manual_pix_holder: string | null;
      manual_pix_bank: string | null;
      payment_note: string | null;
    } | null;
    mercadoPagoConnected: boolean;
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
  const appIssue = detectAppIssue(text);
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

  // 8) Override needsHuman para sinais fortes (cancel, reclamação, pedido humano)
  if (!needsHuman) {
    if (intent === "cancel") { needsHuman = true; reason = "cancel_intent"; }
    else if (intent === "complaint") { needsHuman = true; reason = "complaint"; }
    else if (intent === "human_request") { needsHuman = true; reason = "human_requested"; }
  }

  const classification = classifyCustomer({
    hasCustomer: !!customer,
    intent,
    needsHuman,
  });

  // 9) Treinamento da empresa (knowledge / faqs / apps / payment / MP status)
  const [
    { data: trainingRow },
    { data: faqRows },
    { data: appRows },
    { data: payRow },
    { data: mpRow },
  ] = await Promise.all([
    supabaseAdmin.from("company_ai_knowledge").select("*").eq("company_id", companyId).maybeSingle(),
    supabaseAdmin.from("company_ai_faqs").select("category, question, answer").eq("company_id", companyId).eq("is_active", true).limit(60),
    supabaseAdmin.from("company_ai_app_guides").select("app_name, is_paid, app_price_cents, login_type, install_steps, update_steps, cache_steps, route_steps, common_issues, default_reply").eq("company_id", companyId).eq("is_active", true).limit(20),
    supabaseAdmin.from("company_ai_payment_settings").select("manual_pix_key, manual_pix_holder, manual_pix_bank, payment_note").eq("company_id", companyId).maybeSingle(),
    supabaseAdmin.from("marketplace_accounts").select("status").eq("company_id", companyId).eq("provider", "mercado_pago").maybeSingle(),
  ]);

  const companyTraining: AiContext["companyTraining"] = {
    knowledge_text: trainingRow?.knowledge_text ?? null,
    tone: trainingRow?.tone ?? null,
    answer_length: trainingRow?.answer_length ?? null,
    allow_after_hours: trainingRow?.allow_after_hours ?? true,
    accepts_audio: trainingRow?.accepts_audio ?? false,
    auto_offer_trial: trainingRow?.auto_offer_trial ?? false,
    human_on_complaint: trainingRow?.human_on_complaint ?? true,
    human_when_unsure: trainingRow?.human_when_unsure ?? true,
    allow_paid_apps_info: trainingRow?.allow_paid_apps_info ?? true,
    use_manual_pix_fallback: trainingRow?.use_manual_pix_fallback ?? true,
    faqs: (faqRows ?? []) as any,
    apps: (appRows ?? []) as any,
    payment: payRow ?? null,
    mercadoPagoConnected: mpRow?.status === "connected",
  };

  return {
    intent,
    classification,
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
    app: { name: appName, issue: appIssue, entry: appEntry },
    memory,
    settings,
    companyTraining,
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
    "- NUNCA envie usuário, senha, MAC, key ou link de servidor do cliente. Se ele pedir 'meus dados/acesso/login/senha', responda que vai chamar um atendente para conferir com segurança.",
    "- NUNCA diga 'use no aplicativo configurado na sua TV' nem 'no seu celular'. Não invente dispositivo.",
    "- NUNCA mencione dados de outro cliente. Só fale do cliente identificado pelo telefone no CONTEXTO.",
  ];

  if (ctx.settings.support_instructions?.trim()) {
    rules.push(`INSTRUÇÕES DA EMPRESA: ${ctx.settings.support_instructions.trim()}`);
  }

  // Bloco de contexto compacto
  const compact: Record<string, unknown> = {
    intent: ctx.intent,
    classificacao: ctx.classification,
    empresa: ctx.company.name,
    cliente: ctx.customer
      ? { nome: ctx.customer.name, notas: ctx.customer.notes }
      : { encontrado: false, telefone_terminacao: "***" },
    needsHuman: ctx.needsHuman,
    motivo: ctx.reason,
  };

  // Memória curta da conversa (resumo + últimas trocas) — só envia se existir
  if (ctx.memory.summary || ctx.memory.last_messages.length) {
    compact.memoria = {
      resumo: ctx.memory.summary ?? null,
      ultimas: ctx.memory.last_messages.slice(-8).map((m) => ({ de: m.role, txt: m.text })),
      flags: ctx.memory.flags,
    };
    rules.push("- Use 'memoria' para NÃO repetir perguntas já feitas e manter o contexto da conversa.");
  }

  if (ctx.app.issue) {
    compact.problema_app = ctx.app.issue;
    rules.push("- Para problema de app, dê passo a passo curto e prático (3 a 6 passos).");
  }

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

  // ===== Treinamento da empresa (camada 2) =====
  const ct = ctx.companyTraining;
  if (ct) {
    if (ct.knowledge_text?.trim()) {
      compact.conhecimento_empresa = ct.knowledge_text.slice(0, 8000);
      rules.push("- Use 'conhecimento_empresa' como base preferencial, mas REGRAS DURAS prevalecem.");
    }
    if (ct.faqs?.length) {
      compact.faqs_empresa = ct.faqs.slice(0, 30);
      rules.push("- Se a pergunta casar com 'faqs_empresa.question', prefira a resposta correspondente.");
    }
    if (ct.apps?.length && (ctx.intent === "app_issue" || ctx.intent === "other" || ctx.intent === "greeting" || ctx.intent === "price")) {
      compact.apps_empresa = ct.apps;
    }
    compact.pagamento_empresa = {
      mercado_pago_conectado: ct.mercadoPagoConnected,
      pix_manual: ct.payment?.manual_pix_key
        ? {
            chave: ct.payment.manual_pix_key,
            titular: ct.payment.manual_pix_holder,
            banco: ct.payment.manual_pix_bank,
            observacao: ct.payment.payment_note,
          }
        : null,
    };
    if (!ct.mercadoPagoConnected && ct.payment?.manual_pix_key && ct.use_manual_pix_fallback) {
      rules.push("- Para pagamento, envie o Pix manual em 'pagamento_empresa.pix_manual'.");
    } else if (!ct.mercadoPagoConnected && !ct.payment?.manual_pix_key) {
      rules.push("- Sem Mercado Pago e sem Pix manual: encaminhe a humano para tratar pagamento.");
    } else if (ct.mercadoPagoConnected) {
      rules.push("- Para pagamento, prefira o link/Pix gerado pelo Mercado Pago da empresa.");
    }
    compact.preferencias = {
      tom: ct.tone,
      tamanho: ct.answer_length,
      fora_horario: ct.allow_after_hours,
      aceita_audio: ct.accepts_audio,
      oferece_teste: ct.auto_offer_trial,
      humano_em_reclamacao: ct.human_on_complaint,
      humano_quando_nao_sabe: ct.human_when_unsure,
      falar_apps_pagos: ct.allow_paid_apps_info,
    };
    if (ct.human_when_unsure) rules.push("- Quando não souber responder com segurança, encaminhe a humano.");
    if (!ct.allow_paid_apps_info) rules.push("- NÃO ofereça aplicativos pagos.");
    if (!ct.accepts_audio) rules.push("- Peça mensagem de texto; não trate áudios.");
  }

  return {
    system: rules.join("\n"),
    contextBlock: "CONTEXTO:\n" + JSON.stringify(compact, null, 2),
  };
}
