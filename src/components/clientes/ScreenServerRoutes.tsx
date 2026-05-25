import { useEffect, useState } from "react";
import { Copy, ExternalLink, Link2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getServerById } from "@/lib/server-catalog";
import {
  DNS_ROUTES_EVENT,
  buildServerPublicLink, getPrimaryRouteForServer,
} from "@/lib/dns-routes";
import type { AppScreen } from "@/lib/app-screens";
import { upsertScreen } from "@/lib/app-screens";

type Props = {
  screen: AppScreen;
  onChanged?: () => void;
};

/**
 * Mostra a rota pública principal de cada servidor vinculado à tela.
 * Permite copiar, abrir e (com confirmação) usar como link da lista/servidor
 * daquela tela.
 */
export function ScreenServerRoutes({ screen, onChanged }: Props) {
  const [tick, setTick] = useState(0);
  const [confirm, setConfirm] = useState<null | { serverId: string; link: string }>(null);

  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    window.addEventListener(DNS_ROUTES_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(DNS_ROUTES_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // assegura recálculo quando rotas mudarem
  void tick;

  const ids = screen.server_ids ?? [];
  if (ids.length === 0) return null;

  const copy = async (txt: string) => {
    try { await navigator.clipboard.writeText(txt); toast.success("Rota copiada."); }
    catch { toast.error("Não foi possível copiar."); }
  };

  const applyRoute = (serverId: string, link: string) => {
    upsertScreen({
      ...screen,
      list_server_url: link,
      updated_at: new Date().toISOString(),
    });
    toast.success("Link da lista atualizado para a rota principal.");
    setConfirm(null);
    onChanged?.();
  };

  return (
    <div className="rounded-md border border-border bg-surface p-2 text-xs space-y-2">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Link2 className="h-3.5 w-3.5" />
        <span className="font-medium">Rotas públicas</span>
      </div>
      <ul className="space-y-2">
        {ids.map((sid) => {
          const srv = getServerById(sid);
          const route = getPrimaryRouteForServer(sid);
          const link = buildServerPublicLink(sid);
          const host = route?.host ?? "";
          return (
            <li key={sid} className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5"
                  style={srv ? { color: srv.color } : undefined}
                >
                  ● <span className="text-foreground">{srv?.name ?? "Servidor"}</span>
                </span>
                {host ? (
                  <span className="font-mono text-foreground break-all">{host}</span>
                ) : (
                  <span className="text-muted-foreground">Servidor sem rota pública</span>
                )}
              </div>
              {link && (
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => copy(host || link)}>
                    <Copy className="h-3 w-3" /> Copiar rota
                  </Button>
                  <Button
                    size="sm" variant="outline" className="h-7 gap-1"
                    onClick={() => window.open(link, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="h-3 w-3" /> Abrir rota
                  </Button>
                  <Button
                    size="sm" variant="outline" className="h-7 gap-1"
                    onClick={() => setConfirm({ serverId: sid, link })}
                  >
                    Usar rota principal
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <AlertDialog open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usar rota principal do servidor?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja substituir o link atual da lista/servidor desta tela pela rota principal deste servidor?
              {confirm && (
                <span className="mt-2 block font-mono text-xs">{confirm.link}</span>
              )}
              <span className="mt-2 block text-xs text-muted-foreground">
                Só esta tela será alterada. Nenhuma outra tela é atualizada automaticamente.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm) applyRoute(confirm.serverId, confirm.link);
              }}
            >
              Substituir link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
