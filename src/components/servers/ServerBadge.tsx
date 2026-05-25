import { useEffect, useState } from "react";
import {
  ExternalLink, Copy, Eye, EyeOff, Share2,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ServerEntry, getServerById, serverBadgeStyle, maskSecret,
  formatServerAsText, SERVER_CATALOG_EVENT,
} from "@/lib/server-catalog";
import { useSecurityGuard } from "@/components/security/PinConfirmDialog";
import { isProtectedModeActive, LOCAL_SECURITY_EVENT } from "@/lib/local-security";

function copyText(text: string, label: string) {
  if (!text) return;
  try {
    navigator.clipboard?.writeText(text);
    toast.success(`${label} copiado`);
  } catch {
    toast.error("Não foi possível copiar");
  }
}

export function ServerBadge({
  serverId,
  size = "sm",
}: {
  serverId: string;
  size?: "sm" | "xs";
}) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener(SERVER_CATALOG_EVENT, bump);
    return () => window.removeEventListener(SERVER_CATALOG_EVENT, bump);
  }, []);
  const [open, setOpen] = useState(false);
  const s = getServerById(serverId);
  if (!s) {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
        Servidor não encontrado
      </span>
    );
  }
  // version is read so the badge re-renders on catalog change
  void version;
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        style={serverBadgeStyle(s.color)}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border font-medium transition-opacity hover:opacity-80",
          size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[10px]",
        )}
        title={`Servidor ${s.name}`}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: s.color }}
          aria-hidden
        />
        {s.name}
      </button>
      <ServerDetailsSheet
        server={s}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export function SemServidorBadge() {
  return (
    <span className="rounded-full border border-dashed border-border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
      Sem servidor
    </span>
  );
}

function ServerDetailsSheet({
  server,
  open,
  onClose,
}: {
  server: ServerEntry;
  open: boolean;
  onClose: () => void;
}) {
  const [reveal, setReveal] = useState(false);
  const [askReveal, setAskReveal] = useState(false);
  const [askCopyPwd, setAskCopyPwd] = useState(false);
  const [askCopyFull, setAskCopyFull] = useState(false);
  const { guard, dialog: securityDialog } = useSecurityGuard();
  const [protectedMode, setProtectedMode] = useState(isProtectedModeActive());

  useEffect(() => {
    if (!open) setReveal(false);
  }, [open]);

  useEffect(() => {
    const refresh = () => setProtectedMode(isProtectedModeActive());
    window.addEventListener(LOCAL_SECURITY_EVENT, refresh);
    return () => window.removeEventListener(LOCAL_SECURITY_EVENT, refresh);
  }, []);

  const openPanel = () => {
    if (!server.panel_url) return;
    window.open(server.panel_url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md"
        >
          <SheetHeader className="border-b border-border p-4">
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: server.color }}
                aria-hidden
              />
              <SheetTitle className="text-base">Servidor {server.name}</SheetTitle>
            </div>
            <SheetDescription className="text-xs">
              Dados do painel salvos apenas neste navegador. Nada é enviado.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-3 p-4">
            <Row label="Nome" value={server.name} />
            <Row
              label="Painel"
              value={server.panel_url || "—"}
              onCopy={server.panel_url ? () => copyText(server.panel_url!, "Link do painel") : undefined}
            />
            <Row
              label="Usuário"
              value={server.panel_username || "—"}
              onCopy={server.panel_username ? () => copyText(server.panel_username!, "Usuário") : undefined}
            />
            <Row
              label="Senha"
              value={reveal && server.panel_password ? server.panel_password : maskSecret(server.panel_password)}
              sensitive
              onToggle={server.panel_password ? () => {
                if (!reveal) setAskReveal(true);
                else setReveal(false);
              } : undefined}
              revealed={reveal}
              onCopy={server.panel_password ? () => setAskCopyPwd(true) : undefined}
            />
            {server.notes && (
              <div className="rounded-md bg-surface p-2 text-xs text-muted-foreground whitespace-pre-wrap">
                {server.notes}
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 pt-2">
              {server.panel_url && (
                <Button onClick={openPanel} className="gap-1.5">
                  <ExternalLink className="h-4 w-4" /> Abrir painel
                </Button>
              )}
              <Button variant="outline" onClick={() => setAskCopyFull(true)} className="gap-1.5">
                <Share2 className="h-4 w-4" /> Copiar dados do servidor
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={askReveal} onOpenChange={(o) => !o && setAskReveal(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mostrar senha do painel?</AlertDialogTitle>
            <AlertDialogDescription>
              Esses dados são sensíveis. Deseja exibir mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setAskReveal(false);
              guard({
                kind: "server_password",
                title: "Mostrar senha do painel",
                actionLabel: "Mostrar",
                onConfirm: () => setReveal(true),
              });
            }}>
              Mostrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={askCopyPwd} onOpenChange={(o) => !o && setAskCopyPwd(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copiar senha do painel?</AlertDialogTitle>
            <AlertDialogDescription>
              Esses dados são sensíveis. Deseja copiar mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setAskCopyPwd(false);
              guard({
                kind: "server_password",
                title: "Copiar senha do painel",
                actionLabel: "Copiar",
                onConfirm: () => copyText(server.panel_password ?? "", "Senha do painel"),
              });
            }}>
              Copiar senha
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={askCopyFull} onOpenChange={(o) => !o && setAskCopyFull(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copiar dados do servidor</AlertDialogTitle>
            <AlertDialogDescription>
              Por padrão a senha vai mascarada. Deseja copiar com a senha visível?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="outline" onClick={() => {
              copyText(formatServerAsText(server, { revealSecrets: false }), "Dados do servidor");
              setAskCopyFull(false);
            }}>
              Copiar mascarado
            </Button>
            <AlertDialogAction onClick={() => {
              setAskCopyFull(false);
              guard({
                kind: "server_password",
                title: "Copiar dados com senha visível",
                actionLabel: "Copiar",
                onConfirm: () => copyText(formatServerAsText(server, { revealSecrets: true }), "Dados do servidor (com senha)"),
              });
            }}>
              Copiar com senha
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {securityDialog}
    </>
  );
}

function Row({
  label, value, onCopy, onToggle, revealed, sensitive,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
  onToggle?: () => void;
  revealed?: boolean;
  sensitive?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 flex-1 truncate font-medium", sensitive && !revealed && "tracking-widest")}>
        {value}
      </span>
      {onToggle && (
        <button type="button" onClick={onToggle} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label={revealed ? "Ocultar" : "Mostrar"}>
          {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      )}
      {onCopy && (
        <button type="button" onClick={onCopy} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label={`Copiar ${label}`}>
          <Copy className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
