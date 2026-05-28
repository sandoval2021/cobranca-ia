import { AlertTriangle } from "lucide-react";
import { flags } from "@/lib/flags";

// Hosts de produção onde o banner "Ambiente de testes" NUNCA deve aparecer,
// mesmo que algum flag de staging esteja ligado no build.
const PRODUCTION_HOSTS = [
  "cobranca-ia.lovable.app",
  "cobraeasy.com.br",
  "www.cobraeasy.com.br",
  "app.cobraeasy.com.br",
];

function isProductionHost() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return PRODUCTION_HOSTS.includes(h) || h.endsWith(".cobraeasy.com.br");
}

export function StagingBanner() {
  if (!flags.stagingMode) return null;
  if (isProductionHost()) return null;
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
