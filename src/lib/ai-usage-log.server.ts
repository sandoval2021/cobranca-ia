import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AiUsageLogInput = {
  company_id: string;
  user_id?: string | null;
  customer_id?: string | null;
  usage_type: "owner" | "customer";
  model: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  estimated_cost_usd?: number;
  status: "success" | "error";
  error_reason?: string | null;
};

/**
 * Records an AI usage entry. Server-only: uses supabaseAdmin (service_role).
 * RLS prevents authenticated users from writing directly to ai_usage_log.
 */
export async function logAiUsage(entry: AiUsageLogInput): Promise<void> {
  const { error } = await supabaseAdmin.from("ai_usage_log").insert({
    company_id: entry.company_id,
    user_id: entry.user_id ?? null,
    customer_id: entry.customer_id ?? null,
    usage_type: entry.usage_type,
    model: entry.model.slice(0, 100),
    prompt_tokens: entry.prompt_tokens ?? 0,
    completion_tokens: entry.completion_tokens ?? 0,
    total_tokens:
      entry.total_tokens ??
      (entry.prompt_tokens ?? 0) + (entry.completion_tokens ?? 0),
    estimated_cost_usd: entry.estimated_cost_usd ?? 0,
    status: entry.status,
    error_reason: entry.error_reason ? entry.error_reason.slice(0, 500) : null,
  });
  if (error) {
    // Never break the caller; just log server-side
    console.error("[ai_usage_log] insert failed:", error.message);
  }
}
