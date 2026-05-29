// Banner reutilizável para enviar dados locais para a conta na nuvem.
import { useEffect, useState } from "react";
import { CloudUpload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type CloudUploadModule = {
  /** Identificador único do módulo (usado para dismiss e dedupe). */
  key: string;
  /** Quantos itens locais ainda não foram para a nuvem. */
  getPendingCount: () => number;
  /** Evento global emitido quando o estado de sincronização muda. */
  syncEvent: string;
  /** Faz o upload dos dados locais. Pode retornar qualquer DTO. */
  upload: () => Promise<unknown>;
};

type Props = {
  modules: CloudUploadModule[];
  title?: string;
  subtitle?: string;
  /** Sufixo único do dismissedKey. Útil para banners de telas diferentes. */
  storageScope?: string;
};

export function CloudUploadLocalDataBanner(_props: Props) {
  // Banner desativado: módulos migrados agora fazem auto-upload silencioso e
  // escrita espelhada imediata (useDbFirstSync). O usuário não precisa mais
  // ver detalhes técnicos sobre dados "salvos apenas neste aparelho".
  return null;
}

function _unusedKeepProps(_p: Props) {
  const _ = `${_p.storageScope ?? ""}`;
  return _;
}

// Implementação original mantida abaixo (não exportada) caso seja necessário
// reativar no futuro.
function CloudUploadLocalDataBannerLegacy({
  modules,
  title = "Encontramos dados salvos apenas neste aparelho.",
  subtitle = "Envie para sua conta para acessar em qualquer celular, computador ou PWA.",
  storageScope,
}: Props) {
  const dismissKey = `cobranca_ia_cloud_upload_banner_dismissed:${storageScope ?? modules
    .map((m) => m.key)
    .sort()
    .join("|")}`;

  const [pending, setPending] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(dismissKey) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const refresh = () => {
      let total = 0;
      for (const m of modules) {
        try {
          total += Math.max(0, m.getPendingCount());
        } catch {
          /* noop */
        }
      }
      setPending(total);
    };
    refresh();
    const events = Array.from(new Set(modules.map((m) => m.syncEvent)));
    for (const ev of events) window.addEventListener(ev, refresh);
    return () => {
      for (const ev of events) window.removeEventListener(ev, refresh);
    };
  }, [modules]);

  if (pending === 0 || dismissed) return null;

  const handleUpload = async () => {
    if (uploading) return;
    setUploading(true);
    try {
      const results = await Promise.allSettled(modules.map((m) => m.upload()));
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed === 0) {
        toast.success("Dados enviados para sua conta.");
      } else if (failed < results.length) {
        toast.warning("Alguns itens não puderam ser enviados. Tente novamente.");
      } else {
        toast.error("Não foi possível enviar agora. Tente novamente em instantes.");
      }
    } catch {
      toast.error("Não foi possível enviar agora. Tente novamente em instantes.");
    } finally {
      setUploading(false);
    }
  };

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(dismissKey, "1");
    } catch {
      /* noop */
    }
  };

  return (
    <div className="mb-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
      <div className="flex items-start gap-2">
        <CloudUpload className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>
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
            <Button
              size="sm"
              variant="ghost"
              onClick={dismiss}
              disabled={uploading}
              className="h-9"
            >
              Agora não
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
