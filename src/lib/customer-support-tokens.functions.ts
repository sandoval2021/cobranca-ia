import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const createInput = z.object({
  company_id: z.string().uuid(),
  customer_id: z.string().uuid().optional(),
  ttl_hours: z.number().int().min(1).max(24 * 30).default(24),
});

/**
 * Generates a customer support token. The RAW token is returned ONLY ONCE
 * (caller must use it immediately to build the public link). Only the
 * sha256 hash is persisted.
 */
export const createCustomerSupportToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;

    // Verify caller has access to the company (RLS-scoped query)
    const { data: company, error: companyErr } = await supabase
      .from("companies")
      .select("id")
      .eq("id", data.company_id)
      .maybeSingle();
    if (companyErr || !company) {
      throw new Error("Company not found or access denied");
    }

    // Generate raw token (URL-safe base64, 32 bytes = 256 bits of entropy)
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    const expiresAt = new Date(
      Date.now() + data.ttl_hours * 60 * 60 * 1000,
    ).toISOString();

    const { data: row, error } = await supabaseAdmin
      .from("customer_support_tokens")
      .insert({
        token_hash: tokenHash,
        company_id: data.company_id,
        customer_id: data.customer_id ?? null,
        expires_at: expiresAt,
        is_active: true,
        created_by: userId,
      })
      .select("id, expires_at")
      .single();

    if (error) throw new Error(error.message);

    return {
      id: row.id,
      token: rawToken, // shown ONLY here, never stored
      expires_at: row.expires_at,
    };
  });

const validateInput = z.object({
  token: z.string().min(20).max(200),
});

/** Server-side validation of a raw token. Returns minimal safe info. */
export const validateCustomerSupportToken = createServerFn({ method: "POST" })
  .inputValidator((input) => validateInput.parse(input))
  .handler(async ({ data }) => {
    const tokenHash = createHash("sha256").update(data.token).digest("hex");

    const { data: row, error } = await supabaseAdmin
      .from("customer_support_tokens")
      .select("id, company_id, customer_id, expires_at, is_active")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (error || !row) return { valid: false as const };
    if (!row.is_active) return { valid: false as const };
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return { valid: false as const };
    }

    // Touch last_used_at (best-effort)
    await supabaseAdmin
      .from("customer_support_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", row.id);

    return {
      valid: true as const,
      company_id: row.company_id,
      customer_id: row.customer_id,
    };
  });

const revokeInput = z.object({ id: z.string().uuid() });

export const revokeCustomerSupportToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => revokeInput.parse(input))
  .handler(async ({ data, context }) => {
    // RLS-scoped update (only members of the company can update)
    const { error } = await context.supabase
      .from("customer_support_tokens")
      .update({ is_active: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
