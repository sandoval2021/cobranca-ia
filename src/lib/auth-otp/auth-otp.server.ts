// Server-only helpers for custom OTP authentication flow.
// Never import this file from client code.
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const OTP_LENGTH = 8;
export const OTP_TTL_MIN = 10;
export const PENDING_SIGNUP_TTL_MIN = 30;
export const RESEND_COOLDOWN_SEC = 60;
export const MAX_OTP_ATTEMPTS = 5;
export const MAX_FAILED_BEFORE_LOCK = 5;
export const LOCK_DURATION_MIN = 15;
export const RECOVERY_TOKEN_TTL_MIN = 10;

export type OtpPurpose = "signup" | "login" | "recovery";

/** trim + lowercase + NFKC unicode normalize. */
export function normalizeEmail(email: string): string {
  return String(email ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function generateOtpCode(): string {
  // 8-digit numeric code, leading zeros allowed.
  const max = 10 ** OTP_LENGTH;
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % max).padStart(OTP_LENGTH, "0");
}

export async function hashSecret(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifySecret(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

function getJwtSecret(): Uint8Array {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return new TextEncoder().encode(k);
}

export async function signRecoveryToken(emailNormalized: string): Promise<string> {
  return new SignJWT({ purpose: "recovery", email: emailNormalized })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("cobraeasy-auth-otp")
    .setExpirationTime(`${RECOVERY_TOKEN_TTL_MIN}m`)
    .setJti(crypto.randomUUID())
    .sign(getJwtSecret());
}

export async function verifyRecoveryToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      issuer: "cobraeasy-auth-otp",
    });
    if (payload.purpose !== "recovery") return null;
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

// ----------------- Rate-limit / lock helpers -----------------

export async function isLocked(emailNormalized: string, ip: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("auth_login_locks")
    .select("locked_until")
    .eq("email_normalized", emailNormalized)
    .eq("ip", ip)
    .maybeSingle();
  if (!data?.locked_until) return false;
  return new Date(data.locked_until).getTime() > Date.now();
}

export async function registerFailure(emailNormalized: string, ip: string): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from("auth_login_locks")
    .select("id, failed_attempts")
    .eq("email_normalized", emailNormalized)
    .eq("ip", ip)
    .maybeSingle();

  const next = (existing?.failed_attempts ?? 0) + 1;
  const lock_until =
    next >= MAX_FAILED_BEFORE_LOCK
      ? new Date(Date.now() + LOCK_DURATION_MIN * 60_000).toISOString()
      : null;

  if (existing) {
    await supabaseAdmin
      .from("auth_login_locks")
      .update({
        failed_attempts: next,
        locked_until: lock_until,
        last_failed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabaseAdmin.from("auth_login_locks").insert({
      email_normalized: emailNormalized,
      ip,
      failed_attempts: next,
      locked_until: lock_until,
    });
  }
}

export async function clearFailures(emailNormalized: string, ip: string): Promise<void> {
  await supabaseAdmin
    .from("auth_login_locks")
    .delete()
    .eq("email_normalized", emailNormalized)
    .eq("ip", ip);
}

// ----------------- OTP storage helpers -----------------

export type OtpMetadata = {
  ip?: string;
  user_agent?: string;
  fingerprint?: string;
  pending_signup_id?: string;
};

/**
 * Replaces any active OTP for (email, purpose) and inserts a new one.
 * The unique partial index uq_auth_email_otps_active enforces single-active.
 */
export async function upsertActiveOtp(params: {
  emailNormalized: string;
  purpose: OtpPurpose;
  otpCode: string;
  metadata: OtpMetadata;
}): Promise<{ alreadyRecent: boolean }> {
  const { emailNormalized, purpose, otpCode, metadata } = params;

  // Check existing active for cooldown
  const { data: active } = await supabaseAdmin
    .from("auth_email_otps")
    .select("id, resend_available_at")
    .eq("email_normalized", emailNormalized)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .maybeSingle();

  if (active) {
    const cooldownMs = new Date(active.resend_available_at).getTime() - Date.now();
    if (cooldownMs > 0) return { alreadyRecent: true };
    // consume old so unique partial index allows new
    await supabaseAdmin
      .from("auth_email_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", active.id);
  }

  const otp_hash = await hashSecret(otpCode);
  const now = Date.now();
  await supabaseAdmin.from("auth_email_otps").insert({
    email_normalized: emailNormalized,
    purpose,
    otp_hash,
    expires_at: new Date(now + OTP_TTL_MIN * 60_000).toISOString(),
    resend_available_at: new Date(now + RESEND_COOLDOWN_SEC * 1000).toISOString(),
    metadata,
  });
  return { alreadyRecent: false };
}

/** Validates and consumes the active OTP. Returns true on success. */
export async function consumeOtp(params: {
  emailNormalized: string;
  purpose: OtpPurpose;
  code: string;
}): Promise<{ ok: true; metadata: OtpMetadata } | { ok: false; reason: string }> {
  const { emailNormalized, purpose, code } = params;
  const { data: row } = await supabaseAdmin
    .from("auth_email_otps")
    .select("id, otp_hash, attempts, max_attempts, expires_at, metadata")
    .eq("email_normalized", emailNormalized)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .maybeSingle();

  if (!row) return { ok: false, reason: "Código inválido ou expirado." };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await supabaseAdmin
      .from("auth_email_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id);
    return { ok: false, reason: "Código expirado. Solicite um novo." };
  }
  if (row.attempts >= row.max_attempts) {
    await supabaseAdmin
      .from("auth_email_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id);
    return { ok: false, reason: "Muitas tentativas. Solicite um novo código." };
  }

  const valid = await verifySecret(code, row.otp_hash);
  if (!valid) {
    await supabaseAdmin
      .from("auth_email_otps")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id);
    return { ok: false, reason: "Código incorreto." };
  }

  await supabaseAdmin
    .from("auth_email_otps")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);

  return { ok: true, metadata: (row.metadata ?? {}) as OtpMetadata };
}

// ----------------- Resend email -----------------

const EMAIL_FROM = process.env.RESEND_FROM || "CobraEasy <onboarding@resend.dev>";

function buildOtpEmailHtml(opts: { code: string; purpose: OtpPurpose }): string {
  const titulo =
    opts.purpose === "signup"
      ? "Confirme seu cadastro"
      : opts.purpose === "recovery"
        ? "Redefinir sua senha"
        : "Seu código de acesso";
  const corpo =
    opts.purpose === "recovery"
      ? "Use o código abaixo para criar uma nova senha. Ele expira em 10 minutos."
      : "Use o código abaixo para concluir sua verificação. Ele expira em 10 minutos.";

  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;padding:32px;">
        <tr><td>
          <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;">${titulo}</h1>
          <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.5;">${corpo}</p>
          <div style="text-align:center;background:#f1f5f9;border-radius:12px;padding:20px;font-family:'Menlo','Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#0f172a;">
            ${opts.code}
          </div>
          <p style="margin:24px 0 0;color:#64748b;font-size:12px;line-height:1.5;">
            Se você não solicitou este código, ignore este e-mail.<br/>
            Equipe CobraEasy
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function sendOtpEmail(opts: {
  to: string;
  code: string;
  purpose: OtpPurpose;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY missing");

  const subject =
    opts.purpose === "signup"
      ? "Código de confirmação CobraEasy"
      : opts.purpose === "recovery"
        ? "Código de redefinição de senha CobraEasy"
        : "Código de acesso CobraEasy";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [opts.to],
      subject,
      html: buildOtpEmailHtml({ code: opts.code, purpose: opts.purpose }),
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${txt.slice(0, 200)}`);
  }
}
