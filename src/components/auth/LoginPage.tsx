import { useState, type FormEvent } from "react";
import { Loader2, LogIn, Sparkles, UserPlus, KeyRound, ArrowLeft, MailCheck } from "lucide-react";
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

type View = "login" | "signup" | "forgot" | "signup_sent" | "forgot_sent";

const hasUrl = Boolean(import.meta.env.VITE_SUPABASE_URL);

function isValidWhatsapp(v: string): boolean {
  // aceita formatos BR/E.164 simples: pelo menos 10 dígitos
  const digits = v.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

export function LoginPage() {
  const [view, setView] = useState<View>("login");
  const [pendingEmail, setPendingEmail] = useState("");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-surface to-primary-soft px-4 py-8 safe-top safe-bottom">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-pop">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Painel de Cobrança IA</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {view === "signup"
              ? "Crie sua conta para começar"
              : view === "forgot"
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
              onSent={(email) => {
                setPendingEmail(email);
                setView("signup_sent");
              }}
            />
          )}
          {view === "forgot" && (
            <ForgotForm
              onBack={() => setView("login")}
              onSent={(email) => {
                setPendingEmail(email);
                setView("forgot_sent");
              }}
            />
          )}
          {view === "signup_sent" && (
            <SentNotice
              icon={<MailCheck className="h-6 w-6" />}
              title="Confira seu e-mail"
              message={`Enviamos um e-mail de confirmação para ${pendingEmail}. Confirme seu e-mail para acessar o painel.`}
              onBack={() => setView("login")}
            />
          )}
          {view === "forgot_sent" && (
            <SentNotice
              icon={<MailCheck className="h-6 w-6" />}
              title="Link enviado"
              message={`Enviamos um link para recuperar sua senha para ${pendingEmail}. Confira sua caixa de entrada e spam.`}
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
    // onAuthStateChange troca para o app; mantém botão em loading até unmount.
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
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          onClick={onSignup}
        >
          <UserPlus className="h-4 w-4" />
          Criar nova conta
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-10 w-full text-sm"
          onClick={onForgot}
        >
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
  onSent: (email: string) => void;
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
    if (!supabase) {
      setError("Conexão não configurada.");
      return;
    }
    if (!nome.trim()) return setError("Informe seu nome.");
    if (!empresa.trim()) return setError("Informe o nome da empresa.");
    if (!isValidWhatsapp(whatsapp)) return setError("Informe um WhatsApp válido.");
    if (senha.length < 6) return setError("Senha mínima de 6 caracteres.");
    if (senha !== senha2) return setError("As senhas não conferem.");

    setSubmitting(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
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

    // Se confirmação por e-mail estiver desativada no Supabase Auth, a sessão
    // já vem ativa. Garante base da empresa sem bloquear o fluxo.
    if (data.session) {
      try {
        await syncDefaultCompanyForUser({
          email: email.trim(),
          nome: nome.trim(),
          whatsapp: whatsapp.trim(),
        });
      } catch {
        /* silencioso */
      }
      toast.success("Conta criada!");
      return;
    }

    setSubmitting(false);
    onSent(email.trim());
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
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (err) {
      setError(friendlyAuthError(err.message));
      return;
    }
    onSent(email.trim());
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
            Enviar link de recuperação
          </>
        )}
      </Button>
    </form>
  );
}

function SentNotice({
  icon,
  title,
  message,
  onBack,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4 py-2 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        {icon}
      </div>
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
      <Button type="button" variant="outline" className="h-11 w-full" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
        Voltar para entrar
      </Button>
    </div>
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
