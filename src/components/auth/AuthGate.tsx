import { useState, type FormEvent } from "react";
import { Loader2, LogIn, LogOut, ShieldCheck, UserCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, friendlyAuthError, AUTH_REFRESH_EVENT } from "@/lib/use-auth";

export function AuthGate({
  title = "Para importar clientes, entre com uma conta autorizada.",
  description = "Use seu e-mail e senha cadastrados no ambiente de testes.",
}: {
  title?: string;
  description?: string;
}) {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <Card className="mb-4 flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Verificando sessão…
      </Card>
    );
  }

  if (user) {
    return (
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-2 p-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="min-w-0 truncate">
            Conectado como <span className="font-medium">{user.email}</span>
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await supabase?.auth.signOut();
            window.dispatchEvent(new Event(AUTH_REFRESH_EVENT));
            toast.message("Sessão encerrada.");
          }}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </Card>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError("Conexão não configurada.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) {
        setError(friendlyAuthError(err.message));
        return;
      }
      window.dispatchEvent(new Event(AUTH_REFRESH_EVENT));
      toast.success("Bem-vindo!");
      setOpen(false);
      setPassword("");
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mb-4 p-4">
      <div className="flex items-start gap-3">
        <UserCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>

          {!open && (
            <Button
              className="mt-3 w-full sm:w-auto"
              onClick={() => setOpen(true)}
            >
              <LogIn className="h-4 w-4" />
              Entrar para importar
            </Button>
          )}

          {open && (
            <form onSubmit={handleSubmit} className="mt-3 space-y-2">
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setOpen(false);
                    setError(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
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
              </div>
            </form>
          )}
        </div>
      </div>
    </Card>
  );
}
