import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutLocalUser } from "@/lib/local-auth";

export const Route = createFileRoute("/acesso-restrito")({
  component: AcessoRestrito,
});

function AcessoRestrito() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-4 py-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
        <ShieldAlert className="h-7 w-7" />
      </div>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">Acesso restrito</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Você não tem permissão para acessar esta área. Esta seção é exclusiva do Admin do sistema.
      </p>
      <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <Button onClick={() => navigate({ to: "/" })} className="w-full sm:w-auto">
          Voltar ao Painel
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            logoutLocalUser();
            navigate({ to: "/auth" });
          }}
          className="w-full sm:w-auto"
        >
          Sair da conta
        </Button>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        <Link to="/ajuda" className="underline">
          Ver ajuda
        </Link>
      </p>
    </div>
  );
}
