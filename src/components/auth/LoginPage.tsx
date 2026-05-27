import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Loader2,
  LogIn,
  Sparkles,
  UserPlus,
  KeyRound,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  supabase,
  supabaseConfigured,
  supabaseAnonKeyPresent,
  supabaseAnonKeyRef,
  isAnonKeyForExpectedProject,
} from "@/integrations/supabase/compat";
import { friendlyAuthError } from "@/lib/use-auth";
import { syncDefaultCompanyForUser } from "@/lib/rpc-admin";

type View =
  | "login"
  | "signup"
  | "signup_otp"
  | "forgot"
  | "forgot_otp";

const hasUrl = Boolean(import.meta.env.VITE_SUPABASE_URL);

function isValidWhatsapp(v: string): boolean {
  const digits = v.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

type SignupContext = {
  email: string;
  nome: string;
  empresa: string;
  whatsapp: string;
};

export function LoginPage() {
  const [view, setView] = useState<View>("login");
  const [signupCtx, setSignupCtx] = useState<SignupContext | null>(null);
  const [forgotEmail, setForgotEmail] = useState("");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-surface to-primary-soft px-4 py-8 safe-top safe-bottom">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-pop">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Painel de Cobrança IA</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {view === "signup" || view === "signup_otp"
              ? "Crie sua conta para começar"
              : view === "forgot" || view === "forgot_otp"
                ? "Recupere o acesso à sua conta"
                : "Acesse sua conta para continuar"}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          {!supabaseConfigured && (
            <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {!supabaseAnonKeyPresent
                ? "Conexão não configurada. Tente novamente em instantes."
                : !isAnonKeyForExpectedProject
                  ? `Conexão apontando para projeto errado (${supabaseAnonKeyRef ?? "?"}).`
                  : "Conexão não configurada."}
            </div>
          )}

          {view === "login" && (
            <LoginForm
              onForgot={() => setView("forgot")}
              onSignup={() => setView("signup")}
            />
          )}
          {view === "signup" && (
            <SignupForm
              onBack={() => setView("login")}
              onSent={(ctx) => {
                setSignupCtx(ctx);
                setView("signup_otp");
              }}
            />
          )}
          {view === "signup_otp" && signupCtx && (
            <SignupOtpForm
              ctx={signupCtx}
              onBack={() => setView("login")}
            />
          )}
          {view === "forgot" && (
            <ForgotForm
              onBack={() => setView("login")}
              onSent={(email) => {
                setForgotEmail(email);
                setView("forgot_otp");
              }}
            />
          )}
          {view === "forgot_otp" && forgotEmail && (
            <ForgotOtpForm
              email={forgotEmail}
              onDone={() => setView("login")}
              onBack={() => setView("login")}
            />
          )}
        </div>

        <div className="mt-4 rounded-xl border border-border bg-card/60 p-3 text-[11px]">
          <p className="mb-1 font-semibold text-muted-foreground">Conexão</p>
          <p className="text-muted-foreground">
            {hasUrl && supabaseAnonKeyPresent && isAnonKeyForExpectedProject
              ? "Pronta."
              : "Verifique configuração."}
          </p>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Ambiente de testes — sem cobrança, WhatsApp ou IA reais.
        </p>
      </div>
    </div>
  );
}

function LoginForm({
  onForgot,
  onSignup,
}: {
  onForgot: () => void;
  onSignup: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError("Conexão não configurada.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (err) {
      setError(friendlyAuthError(err.message));
      setSubmitting(false);
      return;
    }
    toast.success("Bem-vindo!");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="login-email">E-mail</Label>
        <Input
          id="login-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-11"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="login-password">Senha</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          placeholder="Sua senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="h-11"
        />
      </div>
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
      )}
      <Button type="submit" disabled={submitting || !supabaseConfigured} className="h-11 w-full">
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Entrando…
          </>
        ) : (
          <>
            <LogIn className="h-4 w-4" />
            Entrar
          </>
        )}
      </Button>

      <div className="flex flex-col gap-2 pt-1">
        <Button type="button" variant="outline" className="h-11 w-full" onClick={onSignup}>
          <UserPlus className="h-4 w-4" />
          Criar nova conta
        </Button>
        <Button type="button" variant="ghost" className="h-10 w-full text-sm" onClick={onForgot}>
          <KeyRound className="h-4 w-4" />
          Esqueci minha senha
        </Button>
      </div>
    </form>
  );
}

function SignupForm({
  onBack,
  onSent,
}: {
  onBack: () => void;
  onSent: (ctx: SignupContext) => void;
}) {
  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supabase) return setError("Conexão não configurada.");
    if (!nome.trim()) return setError("Informe seu nome.");
    if (!empresa.trim()) return setError("Informe o nome da empresa.");
    if (!isValidWhatsapp(whatsapp)) return setError("Informe um WhatsApp válido.");
    if (senha.length < 6) return setError("Senha mínima de 6 caracteres.");
    if (senha !== senha2) return setError("As senhas não conferem.");

    setSubmitting(true);
    const trimmedEmail = email.trim().toLowerCase();
    const { error: err } = await supabase.auth.signUp({
      email: trimmedEmail,
      password: senha,
      options: {
        // Sem emailRedirectTo: queremos OTP de 6 dígitos, nunca link mágico.
        data: {
          nome: nome.trim(),
          empresa: empresa.trim(),
          whatsapp: whatsapp.trim(),
        },
      },
    });
    if (err) {
      setSubmitting(false);
      setError(friendlyAuthError(err.message));
      return;
    }

    // Sempre ir para a etapa OTP — nunca mostrar tela legada de "Confira seu e-mail".
    setSubmitting(false);
    onSent({
      email: trimmedEmail,
      nome: nome.trim(),
      empresa: empresa.trim(),
      whatsapp: whatsapp.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <button
        type="button"
        onClick={onBack}
        className="-mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Voltar para entrar
      </button>

      <div className="space-y-1.5">
        <Label htmlFor="su-nome">Nome do responsável</Label>
        <Input id="su-nome" value={nome} onChange={(e) => setNome(e.target.value)} required className="h-11" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-emp">Nome da empresa</Label>
        <Input id="su-emp" value={empresa} onChange={(e) => setEmpresa(e.target.value)} required className="h-11" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-email">E-mail</Label>
        <Input
          id="su-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-11"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-wa">WhatsApp (com DDD)</Label>
        <Input
          id="su-wa"
          inputMode="tel"
          placeholder="(11) 99999-0000"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          required
          className="h-11"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-s1">Senha</Label>
        <Input
          id="su-s1"
          type="password"
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          className="h-11"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-s2">Confirmar senha</Label>
        <Input
          id="su-s2"
          type="password"
          autoComplete="new-password"
          value={senha2}
          onChange={(e) => setSenha2(e.target.value)}
          required
          className="h-11"
        />
      </div>
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
      )}
      <Button type="submit" disabled={submitting || !supabaseConfigured} className="h-11 w-full">
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Criando…
          </>
        ) : (
          <>
            <UserPlus className="h-4 w-4" />
            Criar conta
          </>
        )}
      </Button>
    </form>
  );
}

/**
 * Tela de confirmação por código de 6 dígitos (cadastro).
 * Usa supabase.auth.verifyOtp({ type: "signup", email, token }).
 * Importante: o template "Confirm signup" no Supabase Auth precisa conter
 * {{ .Token }} para que o e-mail mostre o código, não só o link.
 */
function SignupOtpForm({
  ctx,
  onBack,
}: {
  ctx: SignupContext;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  function onlyDigits(v: string) {
    return v.replace(/\D/g, "").slice(0, 6);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supabase) return setError("Conexão não configurada.");
    if (code.length !== 6) return setError("Digite os 6 dígitos do código.");

    setSubmitting(true);
    const { data, error: err } = await supabase.auth.verifyOtp({
      type: "signup",
      email: ctx.email,
      token: code,
    });
    if (err || !data.session) {
      setSubmitting(false);
      setError(
        err
          ? friendlyAuthError(err.message) ||
              "Código inválido ou expirado. Confira e tente novamente."
          : "Código inválido ou expirado. Confira e tente novamente.",
      );
      return;
    }

    try {
      await syncDefaultCompanyForUser({
        email: ctx.email,
        nome: ctx.nome,
        whatsapp: ctx.whatsapp,
      });
    } catch {
      /* silencioso */
    }
    toast.success("E-mail confirmado com sucesso.");
  }

  async function handleResend() {
    if (!supabase || cooldown > 0) return;
    setError(null);
    setResending(true);
    const { error: err } = await supabase.auth.resend({
      type: "signup",
      email: ctx.email,
    });
    setResending(false);
    if (err) {
      setError(friendlyAuthError(err.message));
      return;
    }
    setCooldown(45);
    toast.success("Novo código enviado.");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h2 className="text-base font-semibold">Digite o código enviado para seu e-mail</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enviamos um código de 6 dígitos para <strong>{ctx.email}</strong>. Digite abaixo para
          confirmar sua conta.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="otp-code">Código de 6 dígitos</Label>
        <Input
          id="otp-code"
          ref={inputRef}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          placeholder="••••••"
          value={code}
          onChange={(e) => setCode(onlyDigits(e.target.value))}
          required
          className="h-14 text-center text-2xl tracking-[0.5em] font-semibold"
        />
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
      )}

      <Button type="submit" disabled={submitting || code.length !== 6} className="h-11 w-full">
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Confirmando…
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4" />
            Confirmar código
          </>
        )}
      </Button>

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          onClick={handleResend}
          disabled={resending || cooldown > 0}
        >
          {resending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Reenviando…
            </>
          ) : cooldown > 0 ? (
            `Reenviar código (${cooldown}s)`
          ) : (
            "Reenviar código"
          )}
        </Button>
        <Button type="button" variant="ghost" className="h-10 w-full text-sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Voltar para entrar
        </Button>
      </div>
    </form>
  );
}

function ForgotForm({
  onBack,
  onSent,
}: {
  onBack: () => void;
  onSent: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError("Conexão não configurada.");
      return;
    }
    setError(null);
    setSubmitting(true);
    // Sem redirectTo: queremos OTP de recuperação, não link.
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    setSubmitting(false);
    if (err) {
      setError(friendlyAuthError(err.message));
      return;
    }
    onSent(email.trim().toLowerCase());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <button
        type="button"
        onClick={onBack}
        className="-mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Voltar para entrar
      </button>
      <p className="text-sm text-muted-foreground">
        Informe o e-mail da sua conta. Enviaremos um código de 6 dígitos para você criar uma nova
        senha.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="fg-email">E-mail</Label>
        <Input
          id="fg-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-11"
        />
      </div>
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
      )}
      <Button type="submit" disabled={submitting || !supabaseConfigured} className="h-11 w-full">
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Enviando…
          </>
        ) : (
          <>
            <KeyRound className="h-4 w-4" />
            Enviar código
          </>
        )}
      </Button>
    </form>
  );
}

/**
 * OTP de recuperação de senha.
 * 1) verifyOtp({ type: "recovery", email, token }) → cria sessão temporária.
 * 2) updateUser({ password }) → grava a nova senha.
 */
function ForgotOtpForm({
  email,
  onDone,
  onBack,
}: {
  email: string;
  onDone: () => void;
  onBack: () => void;
}) {
  const [step, setStep] = useState<"code" | "password">("code");
  const [code, setCode] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  function onlyDigits(v: string) {
    return v.replace(/\D/g, "").slice(0, 6);
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supabase) return setError("Conexão não configurada.");
    if (code.length !== 6) return setError("Digite os 6 dígitos do código.");
    setSubmitting(true);
    const { data, error: err } = await supabase.auth.verifyOtp({
      type: "recovery",
      email,
      token: code,
    });
    setSubmitting(false);
    if (err || !data.session) {
      setError(
        err
          ? friendlyAuthError(err.message) ||
              "Código inválido ou expirado. Confira e tente novamente."
          : "Código inválido ou expirado. Confira e tente novamente.",
      );
      return;
    }
    setStep("password");
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supabase) return setError("Conexão não configurada.");
    if (senha.length < 6) return setError("Senha mínima de 6 caracteres.");
    if (senha !== senha2) return setError("As senhas não conferem.");
    setSubmitting(true);
    const { error: err } = await supabase.auth.updateUser({ password: senha });
    setSubmitting(false);
    if (err) {
      setError(friendlyAuthError(err.message));
      return;
    }
    toast.success("Senha atualizada. Você já pode entrar.");
    try {
      await supabase.auth.signOut();
    } catch {
      /* noop */
    }
    onDone();
  }

  async function handleResend() {
    if (!supabase || cooldown > 0) return;
    setError(null);
    setResending(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email);
    setResending(false);
    if (err) {
      setError(friendlyAuthError(err.message));
      return;
    }
    setCooldown(45);
    toast.success("Novo código enviado.");
  }

  if (step === "password") {
    return (
      <form onSubmit={handleUpdate} className="space-y-3">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <KeyRound className="h-6 w-6" />
          </div>
          <h2 className="text-base font-semibold">Crie sua nova senha</h2>
          <p className="mt-1 text-sm text-muted-foreground">Mínimo de 6 caracteres.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="np1">Nova senha</Label>
          <Input
            id="np1"
            type="password"
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="np2">Confirmar nova senha</Label>
          <Input
            id="np2"
            type="password"
            autoComplete="new-password"
            value={senha2}
            onChange={(e) => setSenha2(e.target.value)}
            required
            className="h-11"
          />
        </div>
        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
        )}
        <Button type="submit" disabled={submitting} className="h-11 w-full">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Salvando…
            </>
          ) : (
            "Salvar nova senha"
          )}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerify} className="space-y-4">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h2 className="text-base font-semibold">Digite o código enviado para seu e-mail</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enviamos um código de 6 dígitos para <strong>{email}</strong>. Digite abaixo para
          recuperar o acesso.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="otp-recovery">Código de 6 dígitos</Label>
        <Input
          id="otp-recovery"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          placeholder="••••••"
          value={code}
          onChange={(e) => setCode(onlyDigits(e.target.value))}
          required
          className="h-14 text-center text-2xl tracking-[0.5em] font-semibold"
        />
      </div>
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
      )}
      <Button type="submit" disabled={submitting || code.length !== 6} className="h-11 w-full">
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Confirmando…
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4" />
            Confirmar código
          </>
        )}
      </Button>
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          onClick={handleResend}
          disabled={resending || cooldown > 0}
        >
          {resending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Reenviando…
            </>
          ) : cooldown > 0 ? (
            `Reenviar código (${cooldown}s)`
          ) : (
            "Reenviar código"
          )}
        </Button>
        <Button type="button" variant="ghost" className="h-10 w-full text-sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Voltar para entrar
        </Button>
      </div>
    </form>
  );
}

export function SessionLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary-soft/40 via-background to-background px-4">
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-border/70 bg-card/80 px-8 py-7 shadow-pop backdrop-blur-xl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" strokeWidth={2.5} />
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">Carregando sua sessão…</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Aguarde um momento.</p>
        </div>
      </div>
    </div>
  );
}
