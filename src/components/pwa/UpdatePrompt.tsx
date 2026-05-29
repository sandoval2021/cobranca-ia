import { useEffect, useState } from "react";
import { applyUpdateNow, PWA_UPDATE_EVENT } from "@/lib/pwa-updater";

export function UpdatePrompt() {
  const [show, setShow] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const onUpdate = () => setShow(true);
    window.addEventListener(PWA_UPDATE_EVENT, onUpdate);
    return () => window.removeEventListener(PWA_UPDATE_EVENT, onUpdate);
  }, []);

  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[100] flex justify-center px-4"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
      }}
    >
      <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-border bg-background/95 p-3 pl-4 shadow-2xl backdrop-blur">
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">
            🚀 Nova versão disponível
          </p>
          <p className="text-xs text-muted-foreground">
            Atualize para receber as últimas melhorias.
          </p>
        </div>
        <button
          type="button"
          disabled={updating}
          onClick={async () => {
            setUpdating(true);
            await applyUpdateNow();
          }}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {updating ? "Atualizando…" : "Atualizar agora"}
        </button>
      </div>
    </div>
  );
}
