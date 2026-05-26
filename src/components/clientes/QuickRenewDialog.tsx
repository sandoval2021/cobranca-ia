import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, RotateCcw, Copy, Check, Tv, Calendar, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AppScreen, APP_CATALOG, listScreens } from "@/lib/app-screens";
import {
  applyRenewal, buildConfirmationMessage, fmtDateBR,
  PAYMENT_LABEL, PaymentMethod,
} from "@/lib/manual-renewals";
import { setCustomerDueOverride } from "@/lib/customer-due-override";

function addMonthsISO(base: Date, months: number): string {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function parseISO(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return isNaN(+d) ? null : d;
}

function baseFromScreen(s: AppScreen): Date {
  const dt = parseISO(s.due_date);
  const today = new Date();
  if (dt && dt > today) return dt;
  return today;
}

function baseFromDueDay(dueDay: number | null | undefined): Date {
  const today = new Date();
  if (!dueDay) return today;
  const d = new Date(today.getFullYear(), today.getMonth(), Math.min(dueDay, 28));
  if (d < today) d.setMonth(d.getMonth() + 1);
  return d;
}

const MONTH_OPTIONS = [1, 3, 6, 12];

type ScreenChoice = {
  id: string;
  selected: boolean;
  renewApp: boolean;
};

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
  const [screens, setScreens] = useState<AppScreen[]>([]);
  const [choices, setChoices] = useState<Record<string, ScreenChoice>>({});
  const [months, setMonths] = useState(1);
  const [amount, setAmount] = useState("");
  const [appAmount, setAppAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { msg: string; newDue: string; sent: boolean }>(null);

  useEffect(() => {
    if (!open) return;
    const all = listScreens(customerId).filter((s) => s.status !== "arquivada");
    setScreens(all);
    const init: Record<string, ScreenChoice> = {};
    for (const s of all) {
      init[s.id] = { id: s.id, selected: true, renewApp: false };
    }
    setChoices(init);
    setMonths(1);
    setMethod("pix");
    setNotes("");
    setDone(null);
    setBusy(false);
    setAppAmount("");
    const base = monthlyAmountCents != null ? monthlyAmountCents / 100 : null;
    setAmount(base != null ? base.toFixed(2).replace(".", ",") : "");
  }, [open, customerId, monthlyAmountCents]);

  useEffect(() => {
    if (!open) return;
    const base = monthlyAmountCents != null ? (monthlyAmountCents / 100) * months : null;
    if (base != null) setAmount(base.toFixed(2).replace(".", ","));
  }, [months, monthlyAmountCents, open]);

  const selectedScreens = useMemo(
    () => screens.filter((s) => choices[s.id]?.selected),
    [screens, choices],
  );

  const hasScreens = screens.length > 0;
  const multi = screens.length > 1;

  // Vencimento "geral" do cliente (sem telas)
  const customerNewDue = useMemo(
    () => addMonthsISO(baseFromDueDay(customerDueDay), months),
    [customerDueDay, months],
  );

  const toggle = (id: string, patch: Partial<ScreenChoice>) =>
    setChoices((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const selectAll = (val: boolean) => {
    const next: Record<string, ScreenChoice> = {};
    for (const s of screens) next[s.id] = { ...choices[s.id], id: s.id, selected: val, renewApp: choices[s.id]?.renewApp ?? false };
    setChoices(next);
  };

  const handleConfirm = async () => {
    if (hasScreens && selectedScreens.length === 0) {
      toast.error("Selecione pelo menos uma tela para renovar.");
      return;
    }
    setBusy(true);
    try {
      // Caso 1: cliente sem telas — registra renovação geral
      if (!hasScreens) {
        const rec = applyRenewal({
          customer_id: customerId,
          customer_name: customerName,
          new_due_date: customerNewDue,
          amount: amount ? `R$ ${amount}` : undefined,
          payment_method: method,
          notes: notes.trim() || `Renovação de ${months} ${months === 1 ? "mês" : "meses"}`,
          renew_app: false,
          screens: [],
        });
        setCustomerDueOverride(customerId, customerNewDue);
        const msg = rec.confirmation_message || buildConfirmationMessage(rec);
        autoSend(msg);
        setDone({ msg, newDue: customerNewDue, sent: true });
      } else {
        const groups = new Map<string, AppScreen[]>();
        for (const s of selectedScreens) {
          const newDue = addMonthsISO(baseFromScreen(s), months);
          if (!groups.has(newDue)) groups.set(newDue, []);
          groups.get(newDue)!.push(s);
        }
        const messages: string[] = [];
        const orderedGroups = [...groups.entries()];
        let maxDue = "";
        for (let i = 0; i < orderedGroups.length; i++) {
          const [newDue, list] = orderedGroups[i];
          if (newDue > maxDue) maxDue = newDue;
          const draftScreens = list.map((s) => {
            const renewApp = choices[s.id]?.renewApp ?? false;
            return {
              screen_id: s.id,
              servers: [] as never[],
              _renewApp: renewApp,
              _appNewDue: renewApp ? addMonthsISO(parseISO(s.app_due_date) ?? new Date(), months) : undefined,
            };
          });
          const appsToRenew = draftScreens.filter((d) => d._renewApp);
          const rec = applyRenewal({
            customer_id: customerId,
            customer_name: customerName,
            new_due_date: newDue,
            amount: i === 0 && amount ? `R$ ${amount}` : undefined,
            payment_method: method,
            notes:
              (i === 0 && notes.trim()) ||
              `Renovação de ${months} ${months === 1 ? "mês" : "meses"}${list.length > 1 ? ` · ${list.length} telas` : ""}`,
            renew_app: false,
            screens: draftScreens.map((d) => ({ screen_id: d.screen_id, servers: d.servers })),
          });
          messages.push(rec.confirmation_message || buildConfirmationMessage(rec));
          for (const a of appsToRenew) {
            if (!a._appNewDue) continue;
            const appRec = applyRenewal({
              customer_id: customerId,
              customer_name: customerName,
              new_due_date: newDue,
              amount: appAmount ? `R$ ${appAmount}` : undefined,
              payment_method: method,
              notes: "Renovação de aplicativo",
              renew_app: true,
              new_app_due_date: a._appNewDue,
              app_amount: appAmount ? `R$ ${appAmount}` : undefined,
              screens: [{ screen_id: a.screen_id, servers: [] }],
            });
            messages.push(buildConfirmationMessage(appRec));
          }
        }
        if (maxDue) setCustomerDueOverride(customerId, maxDue);
        const fullMsg = messages.join("\n\n———\n\n");
        autoSend(fullMsg);
        setDone({ msg: fullMsg, newDue: maxDue, sent: true });
      }
      onRenewed?.();
    } catch (e) {
      toast.error("Não foi possível registrar a renovação.");
    } finally {
      setBusy(false);
    }
  };

  const autoSend = (message: string) => {
    const phone = (whatsappE164 ?? "").replace(/\D/g, "");
    const text = encodeURIComponent(message);
    const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    try {
      window.open(url, "_blank");
      toast.success("Mensagem enviada para o cliente no WhatsApp ✅");
    } catch {
      toast.message("Renovação registrada. Abra o WhatsApp manualmente.");
    }
  };

  const sendWhats = () => {
    if (!done) return;
    autoSend(done.msg);
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

  const allSelected = hasScreens && screens.every((s) => choices[s.id]?.selected);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <RotateCcw className="h-4 w-4" /> Renovar {customerName}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {done
              ? "Renovação registrada. Envie a confirmação ao cliente."
              : hasScreens
              ? `Selecione ${multi ? "as telas" : "a tela"} e o período de renovação.`
              : "Confirme os dados para registrar a renovação."}
          </DialogDescription>
        </DialogHeader>

        {!done && (
          <div className="space-y-3 py-1">
            {/* Período */}
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
                  onChange={(e) =>
                    setMonths(Math.max(1, Math.min(36, Number(e.target.value) || 1)))
                  }
                  className="h-7 w-20"
                />
                <span className="text-[11px] text-muted-foreground">meses</span>
              </div>
            </div>

            {/* Telas */}
            {hasScreens && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs flex items-center gap-1">
                    <Tv className="h-3.5 w-3.5" /> Telas a renovar ({selectedScreens.length}/{screens.length})
                  </Label>
                  {multi && (
                    <button
                      type="button"
                      className="text-[11px] text-primary hover:underline"
                      onClick={() => selectAll(!allSelected)}
                    >
                      {allSelected ? "Desmarcar todas" : "Marcar todas"}
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  {screens.map((s) => {
                    const ch = choices[s.id] ?? { id: s.id, selected: true, renewApp: false };
                    const newDue = addMonthsISO(baseFromScreen(s), months);
                    const meta = APP_CATALOG[s.app];
                    const isPagoApp = meta?.tier === "pago";
                    return (
                      <div
                        key={s.id}
                        className={cn(
                          "rounded-md border px-2.5 py-2 text-xs transition-colors",
                          ch.selected
                            ? "border-primary/40 bg-primary/5"
                            : "border-border bg-muted/30",
                        )}
                      >
                        <label className="flex items-start gap-2 cursor-pointer">
                          <Checkbox
                            checked={ch.selected}
                            onCheckedChange={(v) => toggle(s.id, { selected: !!v })}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold truncate">{s.name || "Tela"}</span>
                              {meta && (
                                <span
                                  className={cn("rounded px-1.5 py-px text-[10px]", meta.badgeClass)}
                                >
                                  {meta.label}
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>
                                {s.due_date ? fmtDateBR(s.due_date) : "—"} →{" "}
                                <span className="font-medium text-foreground">{fmtDateBR(newDue)}</span>
                              </span>
                            </div>
                          </div>
                        </label>
                        {ch.selected && isPagoApp && (
                          <label className="mt-1.5 ml-6 flex items-center gap-2 cursor-pointer text-[11px]">
                            <Checkbox
                              checked={ch.renewApp}
                              onCheckedChange={(v) => toggle(s.id, { renewApp: !!v })}
                            />
                            <Smartphone className="h-3 w-3 text-muted-foreground" />
                            <span>
                              Renovar também o app {meta.label}
                              {s.app_due_date && (
                                <span className="text-muted-foreground">
                                  {" "}— vence {fmtDateBR(s.app_due_date)}
                                </span>
                              )}
                            </span>
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!hasScreens && (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Novo vencimento</span>
                  <span className="font-semibold">{fmtDateBR(customerNewDue)}</span>
                </div>
              </div>
            )}

            {/* Valor / pagamento */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Valor total (R$)</Label>
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                  className="h-8"
                  inputMode="decimal"
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

            {selectedScreens.some((s) => choices[s.id]?.renewApp) && (
              <div>
                <Label className="text-xs">Valor do app (R$, opcional)</Label>
                <Input
                  value={appAmount}
                  onChange={(e) => setAppAmount(e.target.value)}
                  placeholder="0,00"
                  className="h-8"
                  inputMode="decimal"
                />
              </div>
            )}

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
              rows={10}
              className="resize-none text-xs font-mono"
            />
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {!done ? (
            <>
              <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
              <Button
                onClick={handleConfirm}
                disabled={busy}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
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
