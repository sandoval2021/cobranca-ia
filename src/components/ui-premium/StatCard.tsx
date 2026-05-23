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
    <div className="rounded-xl border border-border bg-card p-4 shadow-card transition-shadow hover:shadow-pop">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && (
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", accentMap[accent])}>
              <Icon className="h-4 w-4" />
            </div>
          )}
          <span className="truncate text-sm text-muted-foreground">{label}</span>
        </div>
        {hint && <HelpTip text={hint} />}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="text-2xl font-semibold tracking-tight md:text-3xl">{value}</p>
        {trend && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
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
