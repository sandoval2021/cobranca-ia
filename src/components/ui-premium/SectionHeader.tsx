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
    <div className={cn("mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3 md:mb-4", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <h2 className="text-base font-semibold tracking-tight md:text-lg truncate">{title}</h2>
          {hint && <HelpTip text={hint} />}
        </div>
        {subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground md:text-sm leading-snug">{subtitle}</p>
        )}
      </div>
      {action && <div className="w-full sm:w-auto sm:shrink-0 [&>*]:w-full sm:[&>*]:w-auto">{action}</div>}
    </div>
  );
}
