import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function HelpTip({
  text,
  children,
  className,
  side = "top",
}: {
  text?: string;
  children?: ReactNode;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Ajuda"
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring",
            className,
          )}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        className="max-w-[280px] text-xs leading-relaxed space-y-1.5"
      >
        {children ?? text}
      </PopoverContent>
    </Popover>
  );
}
