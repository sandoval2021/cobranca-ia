import { useState, type FormEvent } from "react";
import { Loader2, LogIn, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase, supabaseConfigured } from "@/integrations/supabase/client";
import { friendlyAuthError } from "@/lib/use-auth";

export function LoginPage() {
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
    setSubmitting(false);
    if (err) {
      setError(friendlyAuthError(err.message));
      return;
    }
    toast.success("Bem-vindo!");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-surface to-primary-soft px-4 py-8 safe-top safe-bottom">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-pop">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            Painel de Cobrança IA
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acesse sua conta para continuar
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          {!supabaseConfigured && (
            <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              Conexão não configurada. Verifique as variáveis do Supabase no
              ambiente do Lovable.
            </div>
          )}
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
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={submitting || !supabaseConfigured}
              className="h-11 w-full"
            >
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
          </form>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Ambiente de testes — sem cobrança, WhatsApp ou IA reais.
        </p>
      </div>
    </div>
  );
}

export function SessionLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando sua sessão…
      </div>
    </div>
  );
}
