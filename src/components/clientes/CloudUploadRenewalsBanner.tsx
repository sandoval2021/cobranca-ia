import { useEffect, useState } from "react";
import { CloudUpload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getManualRenewalsSyncState,
  uploadLocalManualRenewalsToDb,
  MANUAL_RENEWALS_SYNC_EVENT,
} from "@/lib/manual-renewals";
import {
  getDueOverridesSyncState,
  uploadLocalDueOverridesToDb,
  DUE_OVERRIDES_SYNC_EVENT,
} from "@/lib/customer-due-override";

const DISMISS_KEY = "cobranca_ia_renewals_overrides_cloud_banner_dismissed_v1";

export function CloudUploadRenewalsBanner() {
  const [renewalsPending, setRenewalsPending] = useState(0);
  const [overridesPending, setOverridesPending] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const sync = () => {
      setRenewalsPending(getManualRenewalsSyncState().pendingLocal);
      setOverridesPending(getDueOverridesSyncState().pendingLocal);
    };
    sync();
    window.addEventListener(MANUAL_RENEWALS_SYNC_EVENT, sync);
    window.addEventListener(DUE_OVERRIDES_SYNC_EVENT, sync);
    return () => {
      window.removeEventListener(MANUAL_RENEWALS_SYNC_EVENT, sync);
      window.removeEventListener(DUE_OVERRIDES_SYNC_EVENT, sync);
    };
  }, []);

  const total = renewalsPending + overridesPending;
  if (total === 0 || dismissed) return null;

  const handleUpload = async () => {
    setUploading(true);
    try {
      const [r, o] = await Promise.all([
        uploadLocalManualRenewalsToDb().catch(() => ({ inserted: 0, updated: 0 })),
        uploadLocalDueOverridesToDb().catch(() => ({ upserted: 0 })),
      ]);
      const moved = (r?.inserted ?? 0) + (r?.updated ?? 0) + (o?.upserted ?? 0);
      toast.success(
        moved > 0
          ? "Renovações e vencimentos enviados para sua conta."
          : "Já estavam sincronizados.",
      );
    } catch {
      toast.error("Não foi possível enviar agora. Tente novamente em instantes.");
    } finally {
      setUploading(false);
    }
  };

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* noop */
    }
  };

  return (
    <div className="mb-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
      <div className="flex items-start gap-2">
        <CloudUpload className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">
            Encontramos renovações e vencimentos salvos apenas neste aparelho.
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Envie para sua conta para acessar em qualquer celular, computador ou PWA — e garantir que cobranças e a IA usem a data correta.
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={handleUpload} disabled={uploading} className="h-9">
              {uploading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Enviando…
                </>
              ) : (
                <>
                  <CloudUpload className="mr-1.5 h-3.5 w-3.5" /> Enviar para minha conta
                </>
              )}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss} disabled={uploading} className="h-9">
              Agora não
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
