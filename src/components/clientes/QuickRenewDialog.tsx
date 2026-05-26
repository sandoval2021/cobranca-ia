import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RotateCcw, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { listScreens } from "@/lib/app-screens";
import {
  applyRenewal, buildConfirmationMessage, fmtDateBR,
  PAYMENT_LABEL, PaymentMethod,
} from "@/lib/manual-renewals";

function addMonthsISO(base: Date, months: number): string {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fromDueDay(dueDay: number | null | undefined): Date {
  const today = new Date();
  if (!dueDay) return today;
  // próxima ocorrência do dia
  const d = new Date(today.getFullYear(), today.getMonth(), Math.min(dueDay, 28));
  if (d < today) d.setMonth(d.getMonth() + 1);
  return d;
}

const MONTH_OPTIONS = [1, 3, 6, 12];

export function QuickRenewDialog({
  open,
  onClose,
  customerId,
  customerName,
  customerDueDay,
  monthlyAmountCents,
  whatsappE164,
  onRenewed,
}: {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  customerDueDay: number | null;
  monthlyAmountCents: number | null;
  whatsappE164?: string | null;
  onRenewed?: () => void;
}) {
  const [months, setMonths] = useState(1);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { msg: string }>(null);

  useEffect(() => {
    if (!open) return;
    setMonths(1);
    setMethod("pix");
    setNotes("");
    setDone(null);
    setBusy(false);
    const base = monthlyAmountCents != null ? (monthlyAmountCents / 100) : null;
    setAmount(base != null ? base.toFixed(2).replace(".", ",") : "");
  }, [open, monthlyAmountCents]);

  useEffect(() => {
    if (!open) return;
    const base = monthlyAmountCents != null ? (monthlyAmountCents / 100) * months : null;
    if (base != null) setAmount(base.toFixed(2).replace(".", ","));
  }, [months, monthlyAmountCents, open]);

  const baseDate = useMemo(() => fromDueDay(customerDueDay), [customerDueDay]);
  const newDueISO = useMemo(() => addMonthsISO(baseDate, months), [baseDate, months]);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      const screens = listScreens(customerId).filter((s) => s.status !== "arquivada");
      const draftScreens = screens.length
        ? screens.map((s) => ({ screen_id: s.id, servers: [] }))
        : [];
      const rec = applyRenewal({
        customer_id: customerId,
        customer_name: customerName,
        new_due_date: newDueISO,
        amount: amount ? `R$ ${amount}` : undefined,
        payment_method: method,
        notes: notes.trim() || `Renovação de ${months} ${months === 1 ? "mês" : "meses"}`,
        renew_app: false,
        screens: draftScreens,
      });
      const msg = rec.confirmation_message || buildConfirmationMessage(rec);
      setDone({ msg });
      onRenewed?.();
    } catch (e) {
      toast.error("Não foi possível registrar a renovação.");
    } finally {
      setBusy(false);
    }
  };

  const sendWhats = () => {
    if (!done) return;
    const phone = (whatsappE164 ?? "").replace(/\D/g, "");
    const text = encodeURIComponent(done.msg);
    const url = phone
      ? `https://wa.me/${phone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, "_blank");
  };

  const copyMsg = async () => {
    if (!done) return;
    try {
      await navigator.clipboard.writeText(done.msg);
      toast.success("Mensagem copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <RotateCcw className="h-4 w-4" /> Renovar {customerName}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {done
              ? "Renovação registrada. Envie a confirmação ao cliente."
              : "Confirme os dados para registrar a renovação."}
          </DialogDescription>
        </DialogHeader>

        {!done && (
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs">Quantos meses?</Label>
              <div className="mt-1 grid grid-cols-4 gap-2">
                {MONTH_OPTIONS.map((m) => (
                  <Button
                    key={m}
                    type="button"
                    size="sm"
                    variant={months === m ? "default" : "outline"}
                    onClick={() => setMonths(m)}
                  >
                    {m}m
                  </Button>
                ))}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Label className="text-[11px] text-muted-foreground">Personalizado:</Label>
                <Input
                  type="number"
                  min={1}
                  max={36}
                  value={months}
                  onChange={(e) => setMonths(Math.max(1, Math.min(36, Number(e.target.value) || 1)))}
                  className="h-7 w-20"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Valor (R$)</Label>
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs">Pagamento</Label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  {(Object.keys(PAYMENT_LABEL) as PaymentMethod[]).map((k) => (
                    <option key={k} value={k}>{PAYMENT_LABEL[k]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Novo vencimento</span>
                <span className="font-semibold">{fmtDateBR(newDueISO)}</span>
              </div>
            </div>

            <div>
              <Label className="text-xs">Observações (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Ex.: pago via PIX"
                className="resize-none text-sm"
              />
            </div>
          </div>
        )}

        {done && (
          <div className="space-y-3 py-1">
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <Check className="h-4 w-4" /> Renovação registrada com sucesso.
            </div>
            <Textarea
              value={done.msg}
              readOnly
              rows={8}
              className="resize-none text-xs font-mono"
            />
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {!done ? (
            <>
              <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
              <Button onClick={handleConfirm} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Confirmar renovação
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={copyMsg} className="gap-1.5">
                <Copy className="h-4 w-4" /> Copiar
              </Button>
              <Button onClick={sendWhats} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                Enviar no WhatsApp
              </Button>
              <Button variant="ghost" onClick={onClose}>Fechar</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
