import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { applyUpdateNow, PWA_UPDATE_EVENT } from "@/lib/pwa-updater";
import { cn } from "@/lib/utils";

/**
 * Botão de atualização do PWA — SEMPRE disponível.
 * - Quando há nova versão detectada, fica em destaque (azul "pulsando").
 * - Quando não há nova versão, ainda permite forçar: limpa caches do SW
 *   e recarrega para aplicar mudanças sem o usuário fechar/abrir o app.
 */
export function UpdateButton() {
  const [available, setAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const onUpdate = () => setAvailable(true);
    window.addEventListener(PWA_UPDATE_EVENT, onUpdate);
    return () => window.removeEventListener(PWA_UPDATE_EVENT, onUpdate);
  }, []);

  return (
    <button
      type="button"
      disabled={updating}
      onClick={async () => {
        setUpdating(true);
        try {
          await applyUpdateNow();
        } finally {
          // applyUpdateNow já dispara reload; mantemos fallback
          setTimeout(() => window.location.reload(), 600);
        }
      }}
      aria-label="Atualizar aplicativo"
      title={available ? "Nova versão disponível — atualizar agora" : "Forçar atualização"}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors",
        available
          ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
          : "bg-primary-soft text-primary hover:bg-primary-soft/70",
      )}
    >
      <RefreshCw className={cn("h-3.5 w-3.5", updating && "animate-spin")} />
      <span className="hidden sm:inline">
        {updating ? "Atualizando…" : available ? "Atualizar" : "Atualizar"}
      </span>
    </button>
  );
}
