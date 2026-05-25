import { LogOut, ShieldCheck, User2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { logoutLocalUser } from "@/lib/local-auth";
import { useLocalAuth } from "@/lib/use-local-auth";
import { roleLabel } from "@/lib/permissions";

export function LocalUserBadge({ compact = false }: { compact?: boolean }) {
  const { user, role, isSuperAdmin } = useLocalAuth();
  const navigate = useNavigate();

  function handleSignOut() {
    logoutLocalUser();
    navigate({ to: "/auth" });
  }

  if (!user) {
    if (compact) return null;
    return (
      <Button size="sm" variant="outline" onClick={() => navigate({ to: "/auth" })}>
        Entrar
      </Button>
    );
  }

  if (compact) {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={handleSignOut}
        aria-label="Sair"
        title={`${user.nome} · ${roleLabel(role)}`}
      >
        <LogOut className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        {isSuperAdmin ? <ShieldCheck className="h-4 w-4" /> : <User2 className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{user.nome}</p>
        <p className="truncate text-[11px] text-muted-foreground">{roleLabel(role)}</p>
      </div>
      <Button size="sm" variant="ghost" onClick={handleSignOut}>
        <LogOut className="h-4 w-4" />
        Sair
      </Button>
    </div>
  );
}
