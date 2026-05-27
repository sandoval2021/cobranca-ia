import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, KeyRound, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase, supabaseConfigured } from "@/integrations/supabase/compat";
import { friendlyAuthError } from "@/lib/use-auth";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Quando o Supabase processa o link de recuperação, dispara
  // PASSWORD_RECOVERY no onAuthStateChange. Esperamos isso (ou a sessão já
  // existente) antes de liberar o formulário.
  useEffect(() => {
    if (!supabase) {
      setError("Conexão não configurada.");
      return;
    }
    let alive = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (alive && data.session) setReady(true);
      })
      .catch(() => undefined);
    // Se não houver evento em 4s, mostra mensagem de link inválido
    const t = setTimeout(() => {
      if (alive && !ready) setError("Link inválido ou expirado. Solicite um novo link.");
    }, 4000);
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setError(null);
    if (senha.length < 6) return setError("Senha mínima de 6 caracteres.");
    if (senha !== senha2) return setError("As senhas não conferem.");
    setSubmitting(true);
    const { error: err } = await supabase.auth.updateUser({ password: senha });
    setSubmitting(false);
    if (err) {
      setError(friendlyAuthError(err.message));
      return;
    }
    toast.success("Senha atualizada!");
    navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-surface to-primary-soft px-4 py-8 safe-top safe-bottom">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-pop">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Defina sua nova senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use uma senha de pelo menos 6 caracteres.</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          {!supabaseConfigured && (
            <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              Conexão não configurada.
            </div>
          )}

          {!ready && !error && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Validando link…
            </div>
          )}

          {error && !ready && (
            <div className="space-y-3">
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
              <Button type="button" variant="outline" className="h-11 w-full" onClick={() => navigate({ to: "/" })}>
                Voltar para entrar
              </Button>
            </div>
          )}

          {ready && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="rp-s1">Nova senha</Label>
                <Input
                  id="rp-s1"
                  type="password"
                  autoComplete="new-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rp-s2">Confirmar nova senha</Label>
                <Input
                  id="rp-s2"
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
                    Atualizando…
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4" />
                    Atualizar senha
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
