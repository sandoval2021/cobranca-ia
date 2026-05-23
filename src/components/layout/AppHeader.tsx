import { Menu, Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  onMenu?: () => void;
  action?: React.ReactNode;
};

export function AppHeader({ title, onMenu, action }: Props) {
  return (
    <header className="sticky top-0 z-30 flex h-[var(--header-height)] items-center gap-2 border-b border-border bg-surface/85 px-3 backdrop-blur safe-top md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenu}
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight md:text-lg">
        {title}
      </h1>
      <div className="flex items-center gap-1">
        {action}
        <Button variant="ghost" size="icon" aria-label="Buscar" className="hidden sm:inline-flex">
          <Search className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Notificações">
          <Bell className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
