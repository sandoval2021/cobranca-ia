import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { applyUpdateNow, PWA_UPDATE_EVENT } from "@/lib/pwa-updater";
import { cn } from "@/lib/utils";

/**
 * Botão compacto de atualização do PWA fixado no header.
 * - Cinza/desativado quando não há nova versão.
 * - Azul/ativo quando o Service Worker detectou nova versão.
 * - Reaproveita a mesma lógica do UpdatePrompt (PWA_UPDATE_EVENT + applyUpdateNow).
 */
export function UpdateButton() {
  const [available, setAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const onUpdate = () => setAvailable(true);
    window.addEventListener(PWA_UPDATE_EVENT, onUpdate);
    return () => window.removeEventListener(PWA_UPDATE_EVENT, onUpdate);
  }, []);

  const disabled = !available || updating;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={async () => {
        if (!available) return;
        setUpdating(true);
        await applyUpdateNow();
      }}
      aria-label={available ? "Atualizar aplicativo" : "Sem atualização disponível"}
      title={available ? "Atualizar agora" : "Sem nova versão"}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors",
        available
          ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
          : "bg-muted text-muted-foreground/70 cursor-not-allowed",
      )}
    >
      <RefreshCw className={cn("h-3.5 w-3.5", updating && "animate-spin")} />
      <span className="hidden sm:inline">
        {updating ? "Atualizando…" : available ? "Atualizar" : "Atualizado"}
      </span>
    </button>
  );
}
