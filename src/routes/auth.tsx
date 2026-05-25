import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Sparkles, Loader2, KeyRound, Info } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  registerLocalUser,
  loginLocalUser,
  confirmSignupCodeLocal,
  requestPasswordResetLocal,
  updateLocalPassword,
  getPendingCode,
} from "@/lib/local-auth";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background to-surface-muted px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Painel Cobrança IA</h1>
            <p className="text-xs text-muted-foreground">Acesso da revenda</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
              <TabsTrigger value="forgot">Esqueci senha</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="pt-4">
              <LoginForm />
            </TabsContent>
            <TabsContent value="signup" className="pt-4">
              <SignUpForm />
            </TabsContent>
            <TabsContent value="forgot" className="pt-4">
              <ForgotForm />
            </TabsContent>
          </Tabs>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Esta autenticação é local para protótipo. Em produção será necessário backend seguro com
            Supabase Auth, confirmação real por e-mail, recuperação de senha, RLS e separação real por empresa.
          </p>
        </div>

        <div className="mt-4 text-center">
          <Link to="/" className="text-xs text-muted-foreground underline">
            Voltar ao painel
          </Link>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await loginLocalUser(email, senha);
    setBusy(false);
    if (!r.ok) {
      setErr(r.error ?? "Falha ao entrar.");
      return;
    }
    toast.success(`Bem-vindo, ${r.user?.nome ?? ""}!`);
    navigate({ to: "/" });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="li-email">E-mail</Label>
        <Input id="li-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="li-senha">Senha</Label>
        <Input id="li-senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
      </Button>
    </form>
  );
}

function SignUpForm() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [confirmedEmail, setConfirmedEmail] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (senha !== senha2) {
      setErr("As senhas não conferem.");
      return;
    }
    setBusy(true);
    const r = await registerLocalUser({ nome, email, whatsapp, senha });
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setCode(r.confirmation_code);
    setConfirmedEmail(email);
    toast.success("Conta criada. Use o código de confirmação.");
  }

  function confirm() {
    if (!confirmedEmail) return;
    const r = confirmSignupCodeLocal(confirmedEmail, confirmCode);
    if (!r.ok) {
      setErr(r.error ?? "Código inválido.");
      return;
    }
    toast.success("Cadastro confirmado. Faça login.");
    setCode(null);
    setConfirmCode("");
  }

  if (code && confirmedEmail) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-border bg-surface-muted p-3 text-sm">
          <p className="font-medium">Código de confirmação gerado para demonstração local.</p>
          <p className="mt-1 font-mono text-2xl tracking-widest">{code}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            No futuro, este código será enviado por e-mail via Supabase/backend.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf-code">Código de confirmação</Label>
          <Input id="cf-code" value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} />
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button className="w-full" onClick={confirm}>
          Confirmar cadastro
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="su-nome">Nome</Label>
        <Input id="su-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-email">E-mail</Label>
        <Input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-wa">WhatsApp</Label>
        <Input id="su-wa" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-s1">Senha</Label>
        <Input id="su-s1" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-s2">Confirmar senha</Label>
        <Input id="su-s2" type="password" value={senha2} onChange={(e) => setSenha2(e.target.value)} required />
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar conta"}
      </Button>
    </form>
  );
}

function ForgotForm() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [novaSenha2, setNovaSenha2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function request() {
    setErr(null);
    const r = requestPasswordResetLocal(email);
    if (!r.ok) {
      setErr(r.error ?? "Erro.");
      return;
    }
    setCode(r.code ?? getPendingCode(email, "reset"));
    toast.message("Código de recuperação gerado para demonstração local.");
  }

  async function reset() {
    setErr(null);
    if (novaSenha !== novaSenha2) {
      setErr("As senhas não conferem.");
      return;
    }
    setBusy(true);
    const r = await updateLocalPassword(email, inputCode, novaSenha);
    setBusy(false);
    if (!r.ok) {
      setErr(r.error ?? "Erro.");
      return;
    }
    toast.success("Senha atualizada. Faça login.");
    setCode(null);
    setInputCode("");
    setNovaSenha("");
    setNovaSenha2("");
  }

  if (!code) {
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="fg-email">E-mail</Label>
          <Input id="fg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button className="w-full" onClick={request}>
          <KeyRound className="h-4 w-4" />
          Gerar código
        </Button>
        <p className="text-xs text-muted-foreground">
          No futuro, o código será enviado por e-mail.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-surface-muted p-3 text-sm">
        <p className="font-medium">Código de recuperação gerado para demonstração local.</p>
        <p className="mt-1 font-mono text-2xl tracking-widest">{code}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fg-code">Código</Label>
        <Input id="fg-code" value={inputCode} onChange={(e) => setInputCode(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fg-s1">Nova senha</Label>
        <Input id="fg-s1" type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fg-s2">Confirmar nova senha</Label>
        <Input id="fg-s2" type="password" value={novaSenha2} onChange={(e) => setNovaSenha2(e.target.value)} />
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button className="w-full" onClick={reset} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar senha"}
      </Button>
    </div>
  );
}
