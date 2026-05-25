import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldAlert } from "lucide-react";
import {
  isUnlocked, unlockWithPin, requirePinForAction, touchSecuritySession,
  type ProtectedActionKind,
} from "@/lib/local-security";

type PendingAction = {
  kind: ProtectedActionKind;
  title: string;
  description?: string;
  actionLabel: string;
  onConfirm: () => void | Promise<void>;
};

type Props = {
  open: boolean;
  pending: PendingAction | null;
  onClose: () => void;
};

export function PinConfirmDialog({ open, pending, onClose }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPin("");
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleConfirm = useCallback(async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await unlockWithPin(pin);
      if (!ok) {
        setError("PIN incorreto. Tente novamente.");
        setPin("");
        return;
      }
      await pending.onConfirm();
      onClose();
    } catch {
      setError("Não foi possível concluir a ação.");
    } finally {
      setBusy(false);
    }
  }, [pin, pending, onClose]);

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            {pending?.title ?? "Confirmar com PIN"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pending?.description ?? "Digite seu PIN local para continuar."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="security-pin">PIN</Label>
          <Input
            ref={inputRef}
            id="security-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            className="text-center text-2xl tracking-[0.5em] h-14"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 12))}
            onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }}
            disabled={busy}
            aria-label="PIN local"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">
            Segurança local: este PIN protege apenas este navegador.
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => { e.preventDefault(); handleConfirm(); }} disabled={busy || pin.length < 4}>
            {pending?.actionLabel ?? "Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Hook utilitário: retorna { guard, dialog }.
 * Use `guard({ kind, title, actionLabel, onConfirm })` para envolver ações sensíveis.
 * Se PIN não for exigido, executa direto.
 */
export function useSecurityGuard() {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [open, setOpen] = useState(false);

  const guard = useCallback((action: PendingAction) => {
    if (!requirePinForAction(action.kind)) {
      touchSecuritySession();
      void action.onConfirm();
      return;
    }
    if (isUnlocked()) {
      touchSecuritySession();
      void action.onConfirm();
      return;
    }
    setPending(action);
    setOpen(true);
  }, []);

  const dialog = (
    <PinConfirmDialog
      open={open}
      pending={pending}
      onClose={() => { setOpen(false); setPending(null); }}
    />
  );

  return { guard, dialog };
}
