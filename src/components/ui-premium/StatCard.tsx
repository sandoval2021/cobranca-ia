import { cn } from "@/lib/utils";
import { HelpTip } from "./HelpTip";
import type { LucideIcon } from "lucide-react";

type Trend = { value: string; up?: boolean };

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  hint,
  accent = "primary",
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  trend?: Trend;
  hint?: string;
  accent?: "primary" | "success" | "warning" | "danger" | "info";
}) {
  const accentMap: Record<string, string> = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    info: "bg-info-soft text-info",
  };
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-3 shadow-card transition-shadow hover:shadow-pop md:p-4">
      <div className="flex items-start justify-between gap-2">
        {Icon && (
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg md:h-9 md:w-9",
              accentMap[accent]
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
        {hint && <HelpTip text={hint} />}
      </div>
      <p className="mt-2 text-[11px] leading-tight text-muted-foreground md:text-sm">
        {label}
      </p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="text-xl font-semibold tracking-tight md:text-2xl">{value}</p>
        {trend && (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-medium md:text-xs",
              trend.up ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
            )}
          >
            {trend.up ? "↑" : "↓"} {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}
