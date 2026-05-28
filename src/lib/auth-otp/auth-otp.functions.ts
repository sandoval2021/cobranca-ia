import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  MAX_OTP_ATTEMPTS,
  OTP_TTL_MIN,
  PENDING_SIGNUP_TTL_MIN,
  clearFailures,
  consumeOtp,
  generateOtpCode,
  hashSecret,
  isLocked,
  isValidEmail,
  normalizeEmail,
  registerFailure,
  sendOtpEmail,
  signRecoveryToken,
  upsertActiveOtp,
  verifyRecoveryToken,
} from "./auth-otp.server";

function reqContext() {
  let ip = "unknown";
  try {
    ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
  } catch {
    /* noop */
  }
  let ua = "";
  try {
    ua = getRequestHeader("user-agent") ?? "";
  } catch {
    /* noop */
  }
  return { ip, user_agent: ua.slice(0, 500) };
}

// ===================================================================
// SIGNUP — request OTP
// ===================================================================
export const requestSignupOtp = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        email: z.string().min(3).max(254),
        password: z.string().min(8).max(128),
        nome: z.string().trim().min(1).max(120),
        empresa: z.string().trim().min(1).max(120),
        whatsapp: z.string().trim().min(8).max(20),
        fingerprint: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const email = normalizeEmail(data.email);
    if (!isValidEmail(email)) {
      return { ok: false as const, error: "E-mail inválido." };
    }
    const ctx = reqContext();
    if (await isLocked(email, ctx.ip)) {
      return { ok: false as const, error: "Bloqueado temporariamente. Tente em 15 min." };
    }

    // Verifica se já existe usuário ativo no Auth
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    if (existing?.users?.some((u) => (u.email ?? "").toLowerCase() === email)) {
      return { ok: false as const, error: "Já existe uma conta com este e-mail." };
    }

    // Limpa pending anteriores para esse email
    await supabaseAdmin.from("auth_pending_signups").delete().eq("email_normalized", email);

    const password_hash = await hashSecret(data.password);
    const { data: pending, error: pendErr } = await supabaseAdmin
      .from("auth_pending_signups")
      .insert({
        email_normalized: email,
        password_hash,
        metadata: {
          nome: data.nome.trim(),
          empresa: data.empresa.trim(),
          whatsapp: data.whatsapp.trim(),
          ip: ctx.ip,
          user_agent: ctx.user_agent,
          fingerprint: data.fingerprint ?? null,
        },
        expires_at: new Date(Date.now() + PENDING_SIGNUP_TTL_MIN * 60_000).toISOString(),
      })
      .select("id")
      .single();

    if (pendErr || !pending) {
      return { ok: false as const, error: "Falha ao iniciar cadastro." };
    }

    const code = generateOtpCode();
    const up = await upsertActiveOtp({
      emailNormalized: email,
      purpose: "signup",
      otpCode: code,
      metadata: {
        ip: ctx.ip,
        user_agent: ctx.user_agent,
        fingerprint: data.fingerprint,
        pending_signup_id: pending.id,
      },
    });
    if (up.alreadyRecent) {
      return { ok: false as const, error: "Aguarde antes de pedir outro código." };
    }

    try {
      await sendOtpEmail({ to: email, code, purpose: "signup" });
    } catch (e) {
      console.error("[auth-otp] sendOtpEmail signup failed", e);
      return { ok: false as const, error: "Falha ao enviar e-mail. Tente novamente." };
    }

    return { ok: true as const, ttl_minutes: OTP_TTL_MIN };
  });

// ===================================================================
// SIGNUP — verify OTP, create user, return password to client for signIn
// ===================================================================
export const verifySignupOtp = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        email: z.string().min(3).max(254),
        code: z.string().regex(/^\d{8}$/),
        password: z.string().min(8).max(128),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const email = normalizeEmail(data.email);
    const ctx = reqContext();
    if (await isLocked(email, ctx.ip)) {
      return { ok: false as const, error: "Bloqueado temporariamente. Tente em 15 min." };
    }

    const r = await consumeOtp({ emailNormalized: email, purpose: "signup", code: data.code });
    if (!r.ok) {
      await registerFailure(email, ctx.ip);
      return { ok: false as const, error: r.reason };
    }

    const pendingId = r.metadata.pending_signup_id;
    if (!pendingId) {
      return { ok: false as const, error: "Cadastro pendente expirado. Refaça o cadastro." };
    }
    const { data: pending } = await supabaseAdmin
      .from("auth_pending_signups")
      .select("id, email_normalized, password_hash, metadata, expires_at")
      .eq("id", pendingId)
      .maybeSingle();

    if (!pending || new Date(pending.expires_at).getTime() < Date.now()) {
      return { ok: false as const, error: "Cadastro pendente expirado. Refaça o cadastro." };
    }
    if (pending.email_normalized !== email) {
      return { ok: false as const, error: "Inconsistência no cadastro." };
    }

    // Confirma que a senha enviada confere com a hash registrada na fase de request.
    const { verifySecret } = await import("./auth-otp.server");
    const pwOk = await verifySecret(data.password, pending.password_hash);
    if (!pwOk) {
      await registerFailure(email, ctx.ip);
      return { ok: false as const, error: "Sessão de cadastro inválida. Reinicie o cadastro." };
    }

    const md = (pending.metadata ?? {}) as {
      nome?: string;
      empresa?: string;
      whatsapp?: string;
    };

    // Cria usuário já confirmado via admin API
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        nome: md.nome ?? "",
        empresa: md.empresa ?? "",
        whatsapp: md.whatsapp ?? "",
      },
    });
    if (createErr || !created?.user) {
      const msg = (createErr?.message ?? "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        return { ok: false as const, error: "Já existe uma conta com este e-mail." };
      }
      console.error("[auth-otp] createUser failed", createErr);
      return { ok: false as const, error: "Falha ao criar conta." };
    }

    // Remove pending imediatamente
    await supabaseAdmin.from("auth_pending_signups").delete().eq("id", pending.id);
    await clearFailures(email, ctx.ip);

    return {
      ok: true as const,
      user_id: created.user.id,
      email,
      nome: md.nome ?? "",
      empresa: md.empresa ?? "",
      whatsapp: md.whatsapp ?? "",
    };
  });

// ===================================================================
// RECOVERY — request OTP (always returns generic 200)
// ===================================================================
export const requestRecoveryOtp = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        email: z.string().min(3).max(254),
        fingerprint: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const email = normalizeEmail(data.email);
    if (!isValidEmail(email)) return { ok: true as const };
    const ctx = reqContext();
    if (await isLocked(email, ctx.ip)) return { ok: true as const };

    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const exists = list?.users?.some((u) => (u.email ?? "").toLowerCase() === email);
    if (!exists) return { ok: true as const };

    const code = generateOtpCode();
    const up = await upsertActiveOtp({
      emailNormalized: email,
      purpose: "recovery",
      otpCode: code,
      metadata: { ip: ctx.ip, user_agent: ctx.user_agent, fingerprint: data.fingerprint },
    });
    if (up.alreadyRecent) return { ok: true as const };

    try {
      await sendOtpEmail({ to: email, code, purpose: "recovery" });
    } catch (e) {
      console.error("[auth-otp] sendOtpEmail recovery failed", e);
    }
    return { ok: true as const };
  });

// ===================================================================
// RECOVERY — verify OTP → returns short-lived reset token
// ===================================================================
export const verifyRecoveryOtp = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        email: z.string().min(3).max(254),
        code: z.string().regex(/^\d{8}$/),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const email = normalizeEmail(data.email);
    const ctx = reqContext();
    if (await isLocked(email, ctx.ip)) {
      return { ok: false as const, error: "Bloqueado temporariamente. Tente em 15 min." };
    }
    const r = await consumeOtp({ emailNormalized: email, purpose: "recovery", code: data.code });
    if (!r.ok) {
      await registerFailure(email, ctx.ip);
      return { ok: false as const, error: r.reason };
    }
    await clearFailures(email, ctx.ip);
    const token = await signRecoveryToken(email);
    return { ok: true as const, reset_token: token };
  });

// ===================================================================
// RECOVERY — reset password using reset_token from verifyRecoveryOtp
// ===================================================================
export const resetPasswordWithToken = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        reset_token: z.string().min(20).max(2048),
        new_password: z.string().min(8).max(128),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const email = await verifyRecoveryToken(data.reset_token);
    if (!email) return { ok: false as const, error: "Token inválido ou expirado." };

    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const user = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
    if (!user) return { ok: false as const, error: "Usuário não encontrado." };

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: data.new_password,
    });
    if (error) {
      const raw = (error.message ?? "").toString();
      const lower = raw.toLowerCase();
      let friendly = raw || "Falha ao atualizar senha.";
      if (lower.includes("same_password") || lower.includes("should be different")) {
        friendly = "A nova senha deve ser diferente da senha atual.";
      } else if (lower.includes("weak") || lower.includes("password") && lower.includes("short")) {
        friendly = "Senha muito fraca. Use ao menos 8 caracteres com letras e números.";
      } else if (lower.includes("rate") || lower.includes("too many")) {
        friendly = "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
      } else if (lower.includes("network") || lower.includes("fetch")) {
        friendly = "Falha de conexão. Verifique sua internet e tente novamente.";
      }
      console.error("[resetPasswordWithToken] updateUserById failed:", raw);
      return { ok: false as const, error: `Falha ao atualizar senha: ${friendly}` };
    }
    return { ok: true as const };
  });

// ===================================================================
// RESEND — request another OTP for a previously-started flow
// ===================================================================
export const resendOtp = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        email: z.string().min(3).max(254),
        purpose: z.enum(["signup", "recovery"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const email = normalizeEmail(data.email);
    const ctx = reqContext();
    if (await isLocked(email, ctx.ip)) {
      return { ok: false as const, error: "Bloqueado temporariamente." };
    }
    if (data.purpose === "signup") {
      // pega pending_signup_id do OTP atual (se existir) para manter o metadata
      const { data: existing } = await supabaseAdmin
        .from("auth_email_otps")
        .select("metadata")
        .eq("email_normalized", email)
        .eq("purpose", "signup")
        .is("consumed_at", null)
        .maybeSingle();
      const pendingId = (existing?.metadata as { pending_signup_id?: string } | null)
        ?.pending_signup_id;
      const code = generateOtpCode();
      const up = await upsertActiveOtp({
        emailNormalized: email,
        purpose: "signup",
        otpCode: code,
        metadata: {
          ip: ctx.ip,
          user_agent: ctx.user_agent,
          pending_signup_id: pendingId,
        },
      });
      if (up.alreadyRecent) {
        return { ok: false as const, error: "Aguarde antes de pedir outro código." };
      }
      try {
        await sendOtpEmail({ to: email, code, purpose: "signup" });
      } catch (e) {
        console.error("[auth-otp] resend signup failed", e);
        return { ok: false as const, error: "Falha ao reenviar." };
      }
      return { ok: true as const };
    }
    // recovery
    const code = generateOtpCode();
    const up = await upsertActiveOtp({
      emailNormalized: email,
      purpose: "recovery",
      otpCode: code,
      metadata: { ip: ctx.ip, user_agent: ctx.user_agent },
    });
    if (up.alreadyRecent) {
      return { ok: false as const, error: "Aguarde antes de pedir outro código." };
    }
    try {
      await sendOtpEmail({ to: email, code, purpose: "recovery" });
    } catch (e) {
      console.error("[auth-otp] resend recovery failed", e);
      return { ok: false as const, error: "Falha ao reenviar." };
    }
    return { ok: true as const };
  });

// ===================================================================
// CONFIRM EMAIL — para contas legadas criadas sem confirmação.
// Reusa purpose='signup' (mesmo template "Confirme seu cadastro").
// ===================================================================
export const requestConfirmEmailOtp = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ email: z.string().min(3).max(254) }).parse(input),
  )
  .handler(async ({ data }) => {
    const email = normalizeEmail(data.email);
    if (!isValidEmail(email)) return { ok: false as const, error: "E-mail inválido." };
    const ctx = reqContext();
    if (await isLocked(email, ctx.ip)) {
      return { ok: false as const, error: "Bloqueado temporariamente. Tente em 15 min." };
    }

    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const user = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
    if (!user) return { ok: false as const, error: "Conta não encontrada para este e-mail." };
    if (user.email_confirmed_at) {
      return { ok: true as const, already_confirmed: true };
    }

    const code = generateOtpCode();
    const up = await upsertActiveOtp({
      emailNormalized: email,
      purpose: "signup",
      otpCode: code,
      metadata: {
        ip: ctx.ip,
        user_agent: ctx.user_agent,
        confirm_user_id: user.id,
      } as unknown as Record<string, unknown>,
    });
    if (up.alreadyRecent) {
      return { ok: false as const, error: "Aguarde antes de pedir outro código." };
    }
    try {
      await sendOtpEmail({ to: email, code, purpose: "signup" });
    } catch (e) {
      console.error("[auth-otp] sendOtpEmail confirm failed", e);
      return { ok: false as const, error: "Falha ao enviar e-mail. Tente novamente." };
    }
    return { ok: true as const, already_confirmed: false };
  });

export const verifyConfirmEmailOtp = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        email: z.string().min(3).max(254),
        code: z.string().regex(/^\d{8}$/),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const email = normalizeEmail(data.email);
    const ctx = reqContext();
    if (await isLocked(email, ctx.ip)) {
      return { ok: false as const, error: "Bloqueado temporariamente. Tente em 15 min." };
    }

    const r = await consumeOtp({ emailNormalized: email, purpose: "signup", code: data.code });
    if (!r.ok) {
      await registerFailure(email, ctx.ip);
      return { ok: false as const, error: r.reason };
    }

    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const user = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
    if (!user) return { ok: false as const, error: "Usuário não encontrado." };

    if (!user.email_confirmed_at) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        email_confirm: true,
      });
      if (error) {
        console.error("[auth-otp] confirm updateUserById failed", error);
        return { ok: false as const, error: "Falha ao confirmar e-mail." };
      }
    }
    await clearFailures(email, ctx.ip);
    return { ok: true as const };
  });

// constants re-export for client UI
export { MAX_OTP_ATTEMPTS };
