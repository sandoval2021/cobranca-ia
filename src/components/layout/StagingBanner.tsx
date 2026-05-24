import { AlertTriangle } from "lucide-react";
import { flags } from "@/lib/flags";

export function StagingBanner() {
  if (!flags.stagingMode) return null;
  return (
    <div className="sticky top-0 z-40 flex items-start gap-2 border-b border-warning/30 bg-warning-soft px-3 py-2 text-[12px] leading-snug text-warning safe-top md:px-6 md:text-xs">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p className="min-w-0">
        <span className="font-semibold">Ambiente de testes</span> — dados demonstrativos.
        Nenhuma cobrança real, WhatsApp real ou IA real será executada.
      </p>
    </div>
  );
}
