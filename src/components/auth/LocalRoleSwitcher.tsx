import { ShieldCheck, User2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setSessionRoleLocal } from "@/lib/local-auth";
import { useLocalAuth } from "@/lib/use-local-auth";
import { roleLabel } from "@/lib/permissions";

export function LocalRoleSwitcher() {
  const { role, user } = useLocalAuth();

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Modo de teste de perfil</p>
          <p className="text-xs text-muted-foreground">
            Alterne entre Admin e Dono para visualizar o painel correspondente.
            Controle real de perfis depende de backend.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-muted-foreground">
              <User2 className="h-3 w-3" />
              {user?.nome ?? "Sem usuário local"} · {roleLabel(role)}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant={role === "super_admin" ? "default" : "outline"}
          onClick={() => setSessionRoleLocal("super_admin")}
        >
          Super Admin
        </Button>
        <Button
          size="sm"
          variant={role === "owner" ? "default" : "outline"}
          onClick={() => setSessionRoleLocal("owner")}
        >
          Dono
        </Button>
      </div>
    </div>
  );
}
