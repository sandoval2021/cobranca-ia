import { useEffect, useMemo, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ChevronLeft, ChevronRight, Copy, ExternalLink, Check, SkipForward,
  Server as ServerIcon, CheckCircle2, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AppScreen, APP_CATALOG, listScreens, daysUntil, urgencyClass,
  urgencyFromDays, urgencyLabel,
} from "@/lib/app-screens";
import {
  getServerById, serverBadgeStyle, maskSecret,
} from "@/lib/server-catalog";
import {
  PAYMENT_LABEL, PaymentMethod, RenewalServerLog,
  applyRenewal, buildConfirmationMessage, fmtDateBR,
} from "@/lib/manual-renewals";

type ServerStepState = Record<string, "pendente" | "renovado" | "pulado">;

type PerScreenState = Record<string, ServerStepState>;

function copyText(text: string, label: string) {
  if (!text) return;
  try {
    navigator.clipboard?.writeText(text);
    toast.success(`${label} copiado`);
  } catch {
    toast.error("Não foi possível copiar");
  }
}

function defaultNewDate(current?: string): string {
  // se houver vencimento atual, +30 dias; senão hoje+30
  const base = current ? new Date(current + "T00:00:00") : new Date();
  if (isNaN(+base)) {
    const t = new Date();
    return addDaysISO(t, 30);
  }
  return addDaysISO(base, 30);
}

function addDaysISO(d: Date, days: number): string {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${nd.getFullYear()}-${p(nd.getMonth() + 1)}-${p(nd.getDate())}`;
}

export function RenewScreensWizard({
  open,
  onClose,
  customerId,
  customerName,
  customerWhatsapp,
  initialScreenId,
}: {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  customerWhatsapp?: string | null;
  initialScreenId?: string | null;
}) {

  const [screens, setScreens] = useState<AppScreen[]>([]);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newDue, setNewDue] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [notes, setNotes] = useState("");
  const [renewApp, setRenewApp] = useState(false);
  const [newAppDue, setNewAppDue] = useState("");
  const [appAmount, setAppAmount] = useState("");
  const [perScreen, setPerScreen] = useState<PerScreenState>({});
  const [revealServer, setRevealServer] = useState<Record<string, boolean>>({});
  const [askCopyPwd, setAskCopyPwd] = useState<{ serverId: string } | null>(null);
  const [askReveal, setAskReveal] = useState<{ serverId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [finalized, setFinalized] = useState<null | string>(null); // confirmation msg

  useEffect(() => {
    if (!open) return;
    const all = listScreens(customerId).filter((s) => s.status !== "arquivada");
    setScreens(all);
    setStep(0);
    setBusy(false);
    setFinalized(null);
    setRevealServer({});
    setNotes("");
    setAmount("");
    setAppAmount("");
    setPaymentMethod("pix");
    setRenewApp(false);
    setNewAppDue("");
    // selected
    const init = new Set<string>();
    if (initialScreenId && all.some((s) => s.id === initialScreenId)) {
      init.add(initialScreenId);
    }
    setSelected(init);
    // default new due date
    const ref = initialScreenId
      ? all.find((s) => s.id === initialScreenId)?.due_date
      : undefined;
    setNewDue(defaultNewDate(ref));
    setPerScreen({});
  }, [open, customerId, initialScreenId]);

  const selectedScreens = useMemo(
    () => screens.filter((s) => selected.has(s.id)),
    [screens, selected],
  );

  const serverSteps = useMemo(
    () => selectedScreens.filter((s) => (s.server_ids ?? []).length > 0),
    [selectedScreens],
  );

  // Steps:
  // 0 = select
  // 1 = data/pagamento
  // 2..2+N-1 = servidores de cada selectedScreens (apenas as com servidores)
  // último = resumo
  const totalSteps = 2 + serverSteps.length + 1;

  const isSelectStep = step === 0;
  const isDataStep = step === 1;
  const isSummaryStep = step === totalSteps - 1;
  const isServerStep = !isSelectStep && !isDataStep && !isSummaryStep;
  const currentServerScreenIdx = step - 2;
  const currentServerScreen = isServerStep ? serverSteps[currentServerScreenIdx] : null;

  // Inicializa estado per-screen quando entra em step de servidores
  useEffect(() => {
    if (!currentServerScreen) return;
    setPerScreen((cur) => {
      if (cur[currentServerScreen.id]) return cur;
      const init: ServerStepState = {};
      for (const sid of currentServerScreen.server_ids ?? []) init[sid] = "pendente";
      return { ...cur, [currentServerScreen.id]: init };
    });
  }, [currentServerScreen]);

  const canNext = (): boolean => {
    if (isSelectStep) return selected.size > 0;
    if (isDataStep) {
      if (!newDue) return false;
      if (renewApp && !newAppDue) return false;
      return true;
    }
    if (isServerStep && currentServerScreen) {
      const st = perScreen[currentServerScreen.id] ?? {};
      return Object.values(st).every((v) => v !== "pendente");
    }
    return true;
  };

  const next = () => {
    if (!canNext()) {
      toast.error("Preencha os campos necessários antes de avançar.");
      return;
    }
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const setServerStatus = (
    screenId: string,
    serverId: string,
    status: "renovado" | "pulado" | "pendente",
  ) => {
    setPerScreen((cur) => ({
      ...cur,
      [screenId]: { ...(cur[screenId] ?? {}), [serverId]: status },
    }));
  };

  const finalize = () => {
    setBusy(true);
    try {
      const draftScreens = selectedScreens.map((s) => {
        const stateForScreen = perScreen[s.id] ?? {};
        const servers: RenewalServerLog[] = (s.server_ids ?? []).map((sid) => {
          const srv = getServerById(sid);
          const st = stateForScreen[sid] === "renovado" ? "renovado" : "pulado";
          return {
            server_id: sid,
            server_name: srv?.name ?? sid,
            status: st as "renovado" | "pulado",
          };
        });
        return { screen_id: s.id, servers };
      });
      const rec = applyRenewal({
        customer_id: customerId,
        customer_name: customerName,
        customer_whatsapp: customerWhatsapp ?? null,
        new_due_date: newDue,
        amount: amount.trim() || undefined,
        payment_method: paymentMethod,
        notes: notes.trim() || undefined,
        renew_app: renewApp,
        new_app_due_date: renewApp ? newAppDue : undefined,
        app_amount: renewApp ? appAmount.trim() || undefined : undefined,
        screens: draftScreens,
      });
      setFinalized(rec.confirmation_message);
      toast.success("Renovação registrada com sucesso.");
    } catch {
      toast.error("Não foi possível finalizar a renovação.");
    } finally {
      setBusy(false);
    }
  };

  // ----- preview message for summary step -----
  const previewMessage = useMemo(() => {
    if (!isSummaryStep && !finalized) return "";
    if (finalized) return finalized;
    // build a temporary record-like preview
    const ss = selectedScreens.map((s) => ({
      screen_id: s.id,
      screen_name: s.name,
      app_label: APP_CATALOG[s.app]?.label ?? s.app,
      old_due_date: s.due_date,
      new_due_date: newDue,
      app_renewed: !!(renewApp && newAppDue),
      old_app_due_date: s.app_due_date,
      new_app_due_date: renewApp ? newAppDue : undefined,
      servers: [],
    }));
    return buildConfirmationMessage({
      id: "preview",
      created_at: new Date().toISOString(),
      customer_id: customerId,
      customer_name: customerName,
        customer_whatsapp: customerWhatsapp ?? null,
      screens: ss,
      amount: amount.trim() || undefined,
      payment_method: paymentMethod,
      notes: notes.trim() || undefined,
      confirmation_message: "",
    });
  }, [isSummaryStep, finalized, selectedScreens, newDue, renewApp, newAppDue, amount, paymentMethod, notes, customerId, customerName]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="text-base">Renovar telas — {customerName}</SheetTitle>
          <SheetDescription className="text-xs">
            Tudo é registrado localmente. Nada é enviado e nenhum painel é renovado automaticamente.
          </SheetDescription>
          <StepIndicator step={step} total={totalSteps} />
        </SheetHeader>

        <div className="flex-1 space-y-3 p-4">
          {isSelectStep && (
            <SelectScreensStep
              screens={screens}
              selected={selected}
              setSelected={setSelected}
            />
          )}

          {isDataStep && (
            <DataStep
              newDue={newDue}
              setNewDue={setNewDue}
              amount={amount}
              setAmount={setAmount}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              notes={notes}
              setNotes={setNotes}
              renewApp={renewApp}
              setRenewApp={setRenewApp}
              newAppDue={newAppDue}
              setNewAppDue={setNewAppDue}
              appAmount={appAmount}
              setAppAmount={setAppAmount}
              anyPaid={selectedScreens.some((s) => (s.tier ?? APP_CATALOG[s.app]?.tier) === "pago")}
            />
          )}

          {isServerStep && currentServerScreen && (
            <ServersStep
              screen={currentServerScreen}
              state={perScreen[currentServerScreen.id] ?? {}}
              onChange={(srvId, status) => setServerStatus(currentServerScreen.id, srvId, status)}
              revealServer={revealServer}
              onAskReveal={(sid) => setAskReveal({ serverId: sid })}
              onAskCopyPwd={(sid) => setAskCopyPwd({ serverId: sid })}
              currentIndex={currentServerScreenIdx + 1}
              total={serverSteps.length}
            />
          )}

          {isSummaryStep && (
            <SummaryStep
              finalized={!!finalized}
              selectedScreens={selectedScreens}
              perScreen={perScreen}
              newDue={newDue}
              renewApp={renewApp}
              newAppDue={newAppDue}
              amount={amount}
              paymentMethod={paymentMethod}
              notes={notes}
              previewMessage={previewMessage}
            />
          )}
        </div>

        <div className="sticky bottom-0 flex gap-2 border-t border-border bg-card p-3">
          {!finalized ? (
            <>
              <Button type="button" variant="outline" onClick={step === 0 ? onClose : back} className="flex-1" disabled={busy}>
                <ChevronLeft className="mr-1 h-4 w-4" /> {step === 0 ? "Cancelar" : "Voltar"}
              </Button>
              {!isSummaryStep ? (
                <Button type="button" onClick={next} className="flex-1" disabled={!canNext() || busy}>
                  Avançar <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" onClick={finalize} className="flex-1" disabled={busy}>
                  {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
                  Finalizar renovação
                </Button>
              )}
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => copyText(finalized, "Confirmação")} className="flex-1">
                <Copy className="mr-1 h-4 w-4" /> Copiar confirmação
              </Button>
              <Button type="button" variant="outline" onClick={() => {
                import("@/lib/financeiro-local").then(({ openFinanceWithDraft }) => {
                  const screenLabels = Array.from(selected).map((id) => screens.find((s) => s.id === id)?.app).filter(Boolean).join(", ");
                  openFinanceWithDraft({
                    customer_name: customerName,

                    type: renewApp ? "renovacao_app" : "renovacao_lista",
                    amount_received: Number(amount) || 0,
                    screen_label: screenLabels,
                    note: notes,
                    source: "renovacao",
                  });
                });
              }} className="flex-1">
                💰 Registrar no financeiro
              </Button>
              <Button type="button" onClick={onClose} className="flex-1">
                Fechar
              </Button>
            </>
          )}
        </div>
      </SheetContent>

      {/* confirm copy panel password */}
      <AlertDialog open={!!askCopyPwd} onOpenChange={(o) => !o && setAskCopyPwd(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copiar senha do painel?</AlertDialogTitle>
            <AlertDialogDescription>Esses dados são sensíveis. Deseja copiar mesmo assim?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (askCopyPwd) {
                const srv = getServerById(askCopyPwd.serverId);
                copyText(srv?.panel_password ?? "", "Senha do painel");
              }
              setAskCopyPwd(null);
            }}>
              Copiar senha
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!askReveal} onOpenChange={(o) => !o && setAskReveal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mostrar senha do painel?</AlertDialogTitle>
            <AlertDialogDescription>Esses dados são sensíveis.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (askReveal) setRevealServer((r) => ({ ...r, [askReveal.serverId]: true }));
              setAskReveal(null);
            }}>
              Mostrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="mt-2 flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1 flex-1 rounded-full",
            i <= step ? "bg-primary" : "bg-muted",
          )}
        />
      ))}
    </div>
  );
}

function SelectScreensStep({
  screens, selected, setSelected,
}: {
  screens: AppScreen[];
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
}) {
  const toggle = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelected(n);
  };
  const allOn = screens.length > 0 && screens.every((s) => selected.has(s.id));
  const toggleAll = () => {
    setSelected(allOn ? new Set() : new Set(screens.map((s) => s.id)));
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Passo 1 — Selecionar telas</p>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={toggleAll}>
          {allOn ? "Limpar" : "Todas"}
        </Button>
      </div>
      {screens.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          Este cliente não tem telas ativas para renovar.
        </p>
      ) : (
        <ul className="space-y-2">
          {screens.map((s) => {
            const app = APP_CATALOG[s.app];
            const days = daysUntil(s.due_date);
            const urg = urgencyFromDays(days);
            const isSel = selected.has(s.id);
            return (
              <li key={s.id}>
                <label className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-lg border p-3",
                  isSel ? "border-primary bg-primary/5" : "border-border bg-card",
                )}>
                  <Checkbox checked={isSel} onCheckedChange={() => toggle(s.id)} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold">{s.name}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", app.badgeClass)}>
                        {app.label}
                      </span>
                      {(s.server_ids ?? []).map((sid) => {
                        const srv = getServerById(sid);
                        if (!srv) return null;
                        return (
                          <span key={sid} style={serverBadgeStyle(srv.color)} className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: srv.color }} />
                            {srv.name}
                          </span>
                        );
                      })}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Lista vence: {s.due_date ? fmtDateBR(s.due_date) : "—"}
                      {s.due_date && (
                        <span className={cn("ml-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px]", urgencyClass(urg))}>
                          {urgencyLabel(urg, days)}
                        </span>
                      )}
                    </div>
                    {s.app_due_date && (
                      <div className="text-[11px] text-muted-foreground">
                        App vence: {fmtDateBR(s.app_due_date)}
                      </div>
                    )}
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function DataStep(props: {
  newDue: string; setNewDue: (s: string) => void;
  amount: string; setAmount: (s: string) => void;
  paymentMethod: PaymentMethod; setPaymentMethod: (m: PaymentMethod) => void;
  notes: string; setNotes: (s: string) => void;
  renewApp: boolean; setRenewApp: (b: boolean) => void;
  newAppDue: string; setNewAppDue: (s: string) => void;
  appAmount: string; setAppAmount: (s: string) => void;
  anyPaid: boolean;
}) {
  const {
    newDue, setNewDue, amount, setAmount, paymentMethod, setPaymentMethod,
    notes, setNotes, renewApp, setRenewApp, newAppDue, setNewAppDue,
    appAmount, setAppAmount, anyPaid,
  } = props;
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">Passo 2 — Dados da renovação</p>
      <div className="space-y-1.5">
        <Label className="text-xs">Novo vencimento da lista *</Label>
        <Input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Valor pago</Label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="R$ 30" maxLength={40} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Forma de pagamento</Label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            {(Object.keys(PAYMENT_LABEL) as PaymentMethod[]).map((k) => (
              <option key={k} value={k}>{PAYMENT_LABEL[k]}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Observação interna</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} />
      </div>
      {anyPaid && (
        <div className="space-y-3 rounded-lg border border-amber-300/40 bg-amber-50/40 p-3 dark:bg-amber-500/5">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <Checkbox checked={renewApp} onCheckedChange={(c) => setRenewApp(!!c)} />
            Renovar app pago também?
          </label>
          {renewApp && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nova data do app *</Label>
                <Input type="date" value={newAppDue} onChange={(e) => setNewAppDue(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valor do app</Label>
                <Input value={appAmount} onChange={(e) => setAppAmount(e.target.value)} placeholder="R$ 50" maxLength={40} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ServersStep({
  screen, state, onChange, revealServer, onAskReveal, onAskCopyPwd,
  currentIndex, total,
}: {
  screen: AppScreen;
  state: ServerStepState;
  onChange: (serverId: string, status: "renovado" | "pulado" | "pendente") => void;
  revealServer: Record<string, boolean>;
  onAskReveal: (serverId: string) => void;
  onAskCopyPwd: (serverId: string) => void;
  currentIndex: number;
  total: number;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">
        Passo {currentIndex + 2} — Servidores da {screen.name} ({currentIndex}/{total})
      </p>
      <ul className="space-y-2">
        {(screen.server_ids ?? []).map((sid) => {
          const srv = getServerById(sid);
          const status = state[sid] ?? "pendente";
          const reveal = !!revealServer[sid];
          if (!srv) return (
            <li key={sid} className="rounded-md border border-dashed border-border p-2 text-xs text-muted-foreground">
              Servidor não encontrado
            </li>
          );
          return (
            <li key={sid} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: srv.color }} />
                <span className="text-sm font-semibold">{srv.name}</span>
                <StatusPill status={status} />
              </div>
              <div className="mt-2 space-y-1 text-xs">
                {srv.panel_url && (
                  <div className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-muted-foreground">Painel</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{srv.panel_url}</span>
                  </div>
                )}
                {srv.panel_username && (
                  <div className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-muted-foreground">Usuário</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{srv.panel_username}</span>
                    <button type="button" onClick={() => copyText(srv.panel_username!, "Usuário")} className="rounded p-1 text-muted-foreground hover:bg-muted">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {srv.panel_password && (
                  <div className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-muted-foreground">Senha</span>
                    <span className={cn("min-w-0 flex-1 truncate font-medium", !reveal && "tracking-widest")}>
                      {reveal ? srv.panel_password : maskSecret(srv.panel_password)}
                    </span>
                    {!reveal && (
                      <button type="button" onClick={() => onAskReveal(sid)} className="rounded p-1 text-muted-foreground hover:bg-muted">
                        <ServerIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button type="button" onClick={() => onAskCopyPwd(sid)} className="rounded p-1 text-muted-foreground hover:bg-muted">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {srv.notes && (
                  <p className="mt-1 whitespace-pre-wrap rounded bg-surface p-2 text-[11px] text-muted-foreground">{srv.notes}</p>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {srv.panel_url && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="col-span-2 gap-1.5"
                    onClick={() => window.open(srv.panel_url!, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Abrir painel
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={status === "renovado" ? "default" : "outline"}
                  className="gap-1.5"
                  onClick={() => onChange(sid, status === "renovado" ? "pendente" : "renovado")}
                >
                  <Check className="h-3.5 w-3.5" /> Marcar renovado
                </Button>
                <Button
                  size="sm"
                  variant={status === "pulado" ? "secondary" : "outline"}
                  className="gap-1.5"
                  onClick={() => onChange(sid, status === "pulado" ? "pendente" : "pulado")}
                >
                  <SkipForward className="h-3.5 w-3.5" /> Pular servidor
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-muted-foreground">
        Marque cada servidor como renovado ou pulado para avançar. Nada é renovado automaticamente.
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: "pendente" | "renovado" | "pulado" }) {
  const map = {
    pendente: "bg-muted text-muted-foreground",
    renovado: "bg-success-soft text-success",
    pulado: "bg-warning-soft text-warning",
  };
  const lbl = { pendente: "Pendente", renovado: "Renovado", pulado: "Pulado" }[status];
  return <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium", map[status])}>{lbl}</span>;
}

function SummaryStep({
  finalized, selectedScreens, perScreen, newDue, renewApp, newAppDue,
  amount, paymentMethod, notes, previewMessage,
}: {
  finalized: boolean;
  selectedScreens: AppScreen[];
  perScreen: PerScreenState;
  newDue: string;
  renewApp: boolean;
  newAppDue: string;
  amount: string;
  paymentMethod: PaymentMethod;
  notes: string;
  previewMessage: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">{finalized ? "Renovação registrada" : "Passo final — Resumo"}</p>
      <ul className="space-y-2">
        {selectedScreens.map((s) => {
          const st = perScreen[s.id] ?? {};
          const ren = Object.entries(st).filter(([, v]) => v === "renovado").map(([k]) => getServerById(k)?.name ?? k);
          const pul = Object.entries(st).filter(([, v]) => v === "pulado").map(([k]) => getServerById(k)?.name ?? k);
          return (
            <li key={s.id} className="rounded-lg border border-border bg-card p-3 text-xs">
              <div className="text-sm font-semibold">{s.name}</div>
              <div className="text-muted-foreground">
                Lista: {fmtDateBR(s.due_date)} → <strong className="text-foreground">{fmtDateBR(newDue)}</strong>
              </div>
              {renewApp && newAppDue && (
                <div className="text-muted-foreground">
                  App: {fmtDateBR(s.app_due_date)} → <strong className="text-foreground">{fmtDateBR(newAppDue)}</strong>
                </div>
              )}
              {ren.length > 0 && <div className="text-success">Renovados: {ren.join(", ")}</div>}
              {pul.length > 0 && <div className="text-warning">Pulados: {pul.join(", ")}</div>}
            </li>
          );
        })}
      </ul>
      <div className="rounded-lg border border-border bg-surface p-3 text-xs space-y-0.5">
        {amount && <div>Valor: <strong>{amount}</strong></div>}
        <div>Pagamento: <strong>{PAYMENT_LABEL[paymentMethod]}</strong></div>
        {notes && <div>Obs: {notes}</div>}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Mensagem de confirmação</Label>
        <Textarea value={previewMessage} readOnly rows={10} className="text-xs" />
      </div>
    </div>
  );
}
