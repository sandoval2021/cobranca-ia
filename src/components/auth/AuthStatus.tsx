import { useState } from "react";
import { LogIn, LogOut, ShieldCheck, UserCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/use-auth";
import { supabase, supabaseConfigured } from "@/integrations/supabase/client";
import { SignInDialog } from "./SignInDialog";

export function AuthStatus({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (!supabase) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
    toast.message("Você saiu da conta.");
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {!compact && <span>Verificando sessão…</span>}
      </div>
    );
  }

  if (!supabaseConfigured) {
    return (
      <p className="text-xs text-muted-foreground">
        Conexão não configurada.
      </p>
    );
  }

  if (user) {
    if (compact) {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          disabled={signingOut}
          aria-label="Sair"
        >
          {signingOut ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
        </Button>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">Conectado</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {user.email}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <LogOut className="h-4 w-4" />
              Sair
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <>
      {compact ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
          aria-label="Entrar"
        >
          <LogIn className="h-4 w-4" />
          <span className="hidden sm:inline">Entrar</span>
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-muted-foreground">
            <UserCircle2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">
              Você não está conectado
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              Entre para acessar suas empresas
            </p>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>
            <LogIn className="h-4 w-4" />
            Entrar
          </Button>
        </div>
      )}
      <SignInDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
