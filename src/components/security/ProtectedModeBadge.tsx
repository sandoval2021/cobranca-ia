import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { isProtectedModeActive, LOCAL_SECURITY_EVENT } from "@/lib/local-security";

export function ProtectedModeBadge({ className }: { className?: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const update = () => setOn(isProtectedModeActive());
    update();
    window.addEventListener(LOCAL_SECURITY_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(LOCAL_SECURITY_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  if (!on) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300",
        className,
      )}
    >
      <ShieldCheck className="h-3 w-3" />
      Modo protegido ativo
    </span>
  );
}
