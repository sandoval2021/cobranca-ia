import { Menu, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthStatus } from "@/components/auth/AuthStatus";
import { UpdateButton } from "@/components/pwa/UpdateButton";

type Props = {
  title: string;
  /**
   * Quando definido, mostra o botão de menu (3 risquinhos) que abre o
   * sidebar como sheet. No mobile/PWA não usamos mais esse botão — as
   * funções extras estão concentradas na aba "Mais" da barra inferior.
   * Por isso o AppShell só passa onMenu no desktop (caso queira).
   */
  onMenu?: () => void;
  action?: React.ReactNode;
};

export function AppHeader({ title, onMenu, action }: Props) {
  return (
    // Wrapper externo carrega o safe-area-inset-top como padding e o
    // border-b fica embaixo do conjunto inteiro — assim a linha nunca
    // atravessa o título no notch do iPhone (PWA standalone).
    <header className="sticky top-0 z-30 border-b border-border bg-surface/85 backdrop-blur safe-top">
      <div className="flex min-h-[var(--header-height)] items-center gap-2 px-3 md:px-6">
        {onMenu ? (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onMenu}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        ) : null}
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight md:text-lg">
          {title}
        </h1>
        <div className="flex items-center gap-1">
          <UpdateButton />
          {action}
          <div className="md:hidden">
            <AuthStatus compact />
          </div>
          <Button variant="ghost" size="icon" aria-label="Notificações" className="hidden sm:inline-flex">
            <Bell className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
