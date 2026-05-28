// Centralized pricing + future per-plan/per-company limit hooks for AI usage.
// Server-only. USD per 1K tokens. Update as OpenAI/provider pricing changes.

export type ModelPricing = {
  input_per_1k: number;
  output_per_1k: number;
};

// Conservative defaults; safe to under-report rather than over-charge.
const PRICING: Record<string, ModelPricing> = {
  "gpt-4o-mini": { input_per_1k: 0.00015, output_per_1k: 0.0006 },
  "gpt-4o": { input_per_1k: 0.0025, output_per_1k: 0.01 },
  "gpt-4.1-mini": { input_per_1k: 0.0004, output_per_1k: 0.0016 },
  "gpt-4.1": { input_per_1k: 0.002, output_per_1k: 0.008 },
};

const DEFAULT_PRICING: ModelPricing = { input_per_1k: 0.0002, output_per_1k: 0.0008 };

export const DEFAULT_AI_MODEL = "gpt-4o-mini";

/** Returns USD cost estimate. Always >= 0. Falls back to a safe default when model unknown. */
export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const key = (model || "").toLowerCase().split(":")[0];
  // Match by prefix (e.g. "gpt-4o-mini-2024-07-18" -> "gpt-4o-mini")
  let pricing = PRICING[key];
  if (!pricing) {
    for (const k of Object.keys(PRICING)) {
      if (key.startsWith(k)) {
        pricing = PRICING[k];
        break;
      }
    }
  }
  const p = pricing ?? DEFAULT_PRICING;
  const cost =
    (Math.max(0, promptTokens) / 1000) * p.input_per_1k +
    (Math.max(0, completionTokens) / 1000) * p.output_per_1k;
  return Math.max(0, Number(cost.toFixed(6)));
}

/**
 * Future hook: returns whether a company is allowed to make another AI call.
 * Currently always allows; wire to plan/quota when limits are introduced.
 */
export async function canCompanyUseAi(_companyId: string): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  return { allowed: true };
}
