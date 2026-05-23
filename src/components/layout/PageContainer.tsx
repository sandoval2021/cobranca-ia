import { cn } from "@/lib/utils";

export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-6xl min-w-0 animate-fade-in px-4 pt-4 pb-[calc(var(--bottomnav-height)+1.5rem)] md:px-6 md:pt-6 md:pb-8",
        className
      )}
    >
      {children}
    </div>
  );
}
