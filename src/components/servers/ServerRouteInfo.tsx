import { useEffect, useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getServerById } from "@/lib/server-catalog";
import {
  DNS_ROUTES_EVENT,
  buildServerPublicLink, getPrimaryRouteForServer,
} from "@/lib/dns-routes";

type Props = {
  serverIds?: string[] | null;
  primaryServerId?: string | null;
  compact?: boolean;
  className?: string;
};

/**
 * Mostra a rota pública principal dos servidores vinculados.
 * Não substitui nada automaticamente; apenas exibe + copiar + abrir.
 */
export function ServerRouteInfo({ serverIds, primaryServerId, compact, className }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    window.addEventListener(DNS_ROUTES_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(DNS_ROUTES_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  void tick;

  const ids = (serverIds ?? []).filter(Boolean);
  if (ids.length === 0) return null;

  // Garante que o servidor principal apareça primeiro
  const ordered = primaryServerId && ids.includes(primaryServerId)
    ? [primaryServerId, ...ids.filter((i) => i !== primaryServerId)]
    : ids;

  const copy = async (txt: string) => {
    try { await navigator.clipboard.writeText(txt); toast.success("Rota copiada."); }
    catch { toast.error("Não foi possível copiar."); }
  };

  return (
    <div className={`text-[11px] space-y-1 ${className ?? ""}`}>
      {ordered.map((sid) => {
        const srv = getServerById(sid);
        const route = getPrimaryRouteForServer(sid);
        const link = buildServerPublicLink(sid);
        return (
          <div key={sid} className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground">
              {srv?.name ?? "Servidor"}:
            </span>
            {route?.host ? (
              <span className="font-mono text-foreground/90 break-all">{route.host}</span>
            ) : (
              <span className="text-muted-foreground">Servidor sem rota</span>
            )}
            {link && !compact && (
              <>
                <Button
                  size="sm" variant="ghost"
                  className="h-6 px-1.5 gap-1 text-[10px]"
                  onClick={(e) => { e.stopPropagation(); copy(route?.host || link); }}
                >
                  <Copy className="h-3 w-3" /> Copiar
                </Button>
                <Button
                  size="sm" variant="ghost"
                  className="h-6 px-1.5 gap-1 text-[10px]"
                  onClick={(e) => { e.stopPropagation(); window.open(link, "_blank", "noopener,noreferrer"); }}
                >
                  <ExternalLink className="h-3 w-3" /> Abrir
                </Button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
