import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { StatusBadge, type Status } from "./StatusBadge";
import { ColorDot } from "./ColorDot";

export function ListCard({
  title,
  subtitle,
  initials,
  status,
  appColor,
  serverColor,
  right,
  onClick,
}: {
  title: string;
  subtitle?: string;
  initials?: string;
  status?: Status;
  appColor?: string;
  serverColor?: string;
  right?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-card transition-all",
        "hover:border-border-strong hover:shadow-pop active:scale-[0.99]"
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
        {initials ?? title.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{title}</p>
          {status && <StatusBadge status={status} />}
        </div>
        <div className="mt-0.5 flex items-center gap-3">
          {subtitle && (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          )}
          {appColor && <ColorDot color={appColor} />}
          {serverColor && <ColorDot color={serverColor} />}
        </div>
      </div>
      {right ?? (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
      )}
    </button>
  );
}
