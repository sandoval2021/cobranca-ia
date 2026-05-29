// Server functions da área "Treinar IA" — isoladas por company_id via RLS.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

// ============ Knowledge ============
const KnowledgeInput = z.object({
  company_id: uuid,
  knowledge_text: z.string().max(200000).optional(),
  tone: z.enum(["amigavel", "profissional", "vendedor", "tecnico", "objetivo"]).optional(),
  answer_length: z.enum(["curta", "media", "detalhada"]).optional(),
  allow_after_hours: z.boolean().optional(),
  accepts_audio: z.boolean().optional(),
  auto_offer_trial: z.boolean().optional(),
  human_on_complaint: z.boolean().optional(),
  human_when_unsure: z.boolean().optional(),
  allow_paid_apps_info: z.boolean().optional(),
  use_manual_pix_fallback: z.boolean().optional(),
});

export const getCompanyAiKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string }) => z.object({ companyId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("company_ai_knowledge")
      .select("*")
      .eq("company_id", data.companyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { knowledge: row };
  });

export const upsertCompanyAiKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => KnowledgeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("company_ai_knowledge")
      .upsert(data, { onConflict: "company_id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { knowledge: row };
  });

// ============ FAQs ============
const FaqInput = z.object({
  id: uuid.optional(),
  company_id: uuid,
  category: z.string().trim().min(1).max(40),
  question: z.string().trim().min(1).max(500),
  answer: z.string().trim().min(1).max(4000),
  is_active: z.boolean().optional(),
});

export const listCompanyAiFaqs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string }) => z.object({ companyId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("company_ai_faqs")
      .select("*")
      .eq("company_id", data.companyId)
      .order("category")
      .order("created_at");
    if (error) throw new Error(error.message);
    return { faqs: rows ?? [] };
  });

export const upsertCompanyAiFaq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FaqInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("company_ai_faqs")
      .upsert(data, { onConflict: "id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { faq: row };
  });

export const deleteCompanyAiFaq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("company_ai_faqs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Payment Settings ============
const PaymentInput = z.object({
  company_id: uuid,
  manual_pix_key: z.string().trim().max(200).nullable().optional(),
  manual_pix_holder: z.string().trim().max(120).nullable().optional(),
  manual_pix_bank: z.string().trim().max(120).nullable().optional(),
  payment_note: z.string().trim().max(1000).nullable().optional(),
});

export const getCompanyAiPaymentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string }) => z.object({ companyId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("company_ai_payment_settings")
      .select("*")
      .eq("company_id", data.companyId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    // status do Mercado Pago — para a tela mostrar
    const { data: mp } = await context.supabase
      .from("marketplace_accounts")
      .select("status, live_mode, connected_at")
      .eq("company_id", data.companyId)
      .eq("provider", "mercado_pago")
      .maybeSingle();

    return { payment: row, mercado_pago: mp };
  });

export const upsertCompanyAiPaymentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PaymentInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("company_ai_payment_settings")
      .upsert(data, { onConflict: "company_id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { payment: row };
  });

// ============ App Guides ============
const AppGuideInput = z.object({
  id: uuid.optional(),
  company_id: uuid,
  app_name: z.string().trim().min(1).max(80),
  is_paid: z.boolean().optional(),
  app_price_cents: z.number().int().min(0).max(1_000_00).optional(),
  login_type: z.enum(["user_pass", "mac_key", "both", "other"]).optional(),
  install_steps: z.string().trim().max(2000).nullable().optional(),
  update_steps: z.string().trim().max(2000).nullable().optional(),
  cache_steps: z.string().trim().max(2000).nullable().optional(),
  route_steps: z.string().trim().max(2000).nullable().optional(),
  common_issues: z.string().trim().max(2000).nullable().optional(),
  default_reply: z.string().trim().max(2000).nullable().optional(),
  is_active: z.boolean().optional(),
});

export const listCompanyAiApps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string }) => z.object({ companyId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("company_ai_app_guides")
      .select("*")
      .eq("company_id", data.companyId)
      .order("app_name");
    if (error) throw new Error(error.message);
    return { apps: rows ?? [] };
  });

export const upsertCompanyAiApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AppGuideInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("company_ai_app_guides")
      .upsert(data, { onConflict: "id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { app: row };
  });

export const deleteCompanyAiApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("company_ai_app_guides").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Simulate AI reply (não envia WhatsApp) ============
const SimulateInput = z.object({
  companyId: uuid,
  text: z.string().trim().min(1).max(1000),
});

export const simulateAiReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SimulateInput.parse(d))
  .handler(async ({ data, context }) => {
    // valida acesso: tenta select da empresa (RLS via supabase user client)
    const { data: comp, error: compErr } = await context.supabase
      .from("companies")
      .select("id")
      .eq("id", data.companyId)
      .maybeSingle();
    if (compErr) throw new Error(compErr.message);
    if (!comp) throw new Error("Sem acesso a esta empresa.");

    // Importa server-only dinamicamente
    const { buildAiContext, buildPromptFromContext } = await import("@/lib/whatsapp/ai-context.server");
    const ctx = await buildAiContext({
      companyId: data.companyId,
      fromPhone: "+0000000000",
      text: data.text,
    });
    const { system, contextBlock } = buildPromptFromContext(ctx);

    // Chama Lovable AI Gateway
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        reply: "[Simulação] LOVABLE_API_KEY não configurada. Contexto montado com sucesso, mas sem chamada à IA.",
        sources: collectSources(ctx),
        needsHuman: ctx.needsHuman,
      };
    }
    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: system },
            { role: "system", content: contextBlock },
            { role: "user", content: data.text },
          ],
        }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        return { reply: `[Simulação] Falha IA (${resp.status}): ${t.slice(0, 200)}`, sources: collectSources(ctx), needsHuman: ctx.needsHuman };
      }
      const json = await resp.json();
      const reply: string =
        json?.choices?.[0]?.message?.content ?? "[Simulação] Sem resposta da IA.";
      return { reply, sources: collectSources(ctx), needsHuman: ctx.needsHuman };
    } catch (e) {
      return {
        reply: `[Simulação] Erro: ${e instanceof Error ? e.message : "desconhecido"}`,
        sources: collectSources(ctx),
        needsHuman: ctx.needsHuman,
      };
    }
  });

function collectSources(ctx: any): string[] {
  const out: string[] = [];
  if (ctx.customer) out.push("Cliente cadastrado");
  if (ctx.priceGroup) out.push(`Tabela de preços: ${ctx.priceGroup.name}`);
  if (ctx.app?.entry) out.push(`App: ${ctx.app.entry.app_name}`);
  if (ctx.companyTraining?.knowledge_text) out.push("Conhecimento da empresa");
  if (ctx.companyTraining?.faqs?.length) out.push(`FAQs (${ctx.companyTraining.faqs.length})`);
  if (ctx.companyTraining?.apps?.length) out.push(`Apps da empresa (${ctx.companyTraining.apps.length})`);
  if (ctx.companyTraining?.payment?.manual_pix_key) out.push("Pix manual");
  if (ctx.companyTraining?.mercadoPagoConnected) out.push("Mercado Pago conectado");
  return out.length ? out : ["Sem contexto adicional"];
}
