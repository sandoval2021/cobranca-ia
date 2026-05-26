import { cn } from "@/lib/utils";
import { HelpTip } from "./HelpTip";

export function SectionHeader({
  title,
  subtitle,
  hint,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-start justify-between gap-3 md:mb-4", className)}>
      <div className="min-w-0">
        <div className="flex items-start gap-1.5">
          <h2 className="text-base font-semibold tracking-tight md:text-lg break-words">{title}</h2>
          {hint && <HelpTip text={hint} />}
        </div>
        {subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground md:text-sm break-words leading-snug">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
