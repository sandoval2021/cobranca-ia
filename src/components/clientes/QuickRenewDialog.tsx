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
import { clearCustomerDueOverride } from "@/lib/customer-due-override";
import { clearImportedDueByWhatsapp } from "@/lib/imported-due-dates";
import { supabase } from "@/integrations/supabase/compat";
import { getActiveAccountId, listCustomersAdmin } from "@/lib/rpc-admin";

// Persiste a renovação no Supabase via RPC `renew_customer_admin`.
// Salva due_date COMPLETO (não due_day). NÃO há fallback para
// update_customer_admin: se a RPC nova falhar, abortamos com erro.
async function persistRenewalOnBackend(args: {
  customerId: string;
  customerName: string;
  whatsappE164?: string | null;
  monthlyAmountCents: number | null;
  newDueISO: string;
  months: number;
  oldDueISO?: string | null;
  totalAmount: string;
  monthlyAmount: string;
}): Promise<{
  ok: boolean;
  message?: string;
  persistedDue?: string | null;
  patch?: { due_date: string; due_day: number | null; status: string | null };
}> {
  if (!supabase) {
    return { ok: false, message: "Renovação precisa ser ativada no servidor." };
  }
  const dueDate = new Date(args.newDueISO + "T00:00:00");
  if (isNaN(+dueDate)) return { ok: false, message: "Nova data de vencimento inválida." };

  const fmtBR = (iso?: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00");
    return isNaN(+d) ? iso : d.toLocaleDateString("pt-BR");
  };
  const historyBlock = [
    `Renovação manual em ${new Date().toLocaleString("pt-BR")}:`,
    `- Meses: ${args.months}`,
    `- Vencimento anterior: ${fmtBR(args.oldDueISO)}`,
    `- Novo vencimento: ${fmtBR(args.newDueISO)}`,
    `- Valor mensal: ${args.monthlyAmount || "—"}`,
    `- Valor total: ${args.totalAmount || "—"}`,
  ].join("\n");

  const payload = {
    p_customer_id: args.customerId,
    p_due_date: args.newDueISO,
    p_amount_cents: args.monthlyAmountCents,
    p_notes: historyBlock,
  };
  if (import.meta.env.DEV) {
    console.log("[renew] rpc payload", payload);
  }
  const renewRes = await supabase.rpc("renew_customer_admin", payload);
  if (renewRes.error) {
    if (import.meta.env.DEV) {
      console.error("[renew] error", {
        code: renewRes.error.code,
        message: renewRes.error.message,
        details: (renewRes.error as { details?: string }).details,
        hint: (renewRes.error as { hint?: string }).hint,
      });
    }
    return {
      ok: false,
      message:
        renewRes.error.message ||
        "Falha ao salvar a renovação no servidor (renew_customer_admin).",
    };
  }

  const row = Array.isArray(renewRes.data)
    ? (renewRes.data[0] as Record<string, unknown> | undefined)
    : (renewRes.data as Record<string, unknown> | null);
  const persistedDue =
    row && typeof row.due_date === "string" ? (row.due_date as string) : null;
  const persistedDueDay =
    row && typeof row.due_day === "number" ? (row.due_day as number) : null;
  const persistedStatus =
    row && typeof row.status === "string" ? (row.status as string) : null;
  if (import.meta.env.DEV) {
    console.log("[renew] rpc confirmed", {
      customer_id: args.customerId,
      returned_due_date: persistedDue,
      returned_due_day: persistedDueDay,
      returned_status: persistedStatus,
    });
  }

  // Fonte da verdade primária: retorno da RPC.
  // Se ela devolveu uma linha com due_date == enviado, confirmamos sucesso
  // sem depender de refetch (RPC já garante persistência).
  if (persistedDue && persistedDue.slice(0, 10) === args.newDueISO.slice(0, 10)) {
    return {
      ok: true,
      persistedDue,
      patch: {
        due_date: persistedDue.slice(0, 10),
        due_day: persistedDueDay,
        status: persistedStatus,
      },
    };
  }

  // Se a RPC retornou linha mas com due_date divergente, é erro real.
  if (persistedDue && persistedDue.slice(0, 10) !== args.newDueISO.slice(0, 10)) {
    return {
      ok: false,
      message: `Servidor retornou vencimento diferente do enviado (${persistedDue}).`,
      persistedDue,
    };
  }

  // RPC retornou data=null (sem linha). Cai para refetch via list_customers_admin
  // para confirmar que due_date foi gravado.
  try {
    const { accountId } = await getActiveAccountId();
    if (accountId) {
      const search = args.whatsappE164 || args.customerName;
      const res = await listCustomersAdmin({
        p_company_id: accountId,
        p_search: search,
        p_limit: 50,
      });
      const raw = res.data as unknown;
      const arr = Array.isArray(raw)
        ? (raw as Array<Record<string, unknown>>)
        : Array.isArray((raw as { customers?: unknown[] } | null)?.customers)
          ? ((raw as { customers: Array<Record<string, unknown>> }).customers)
          : [];
      const found = arr.find((r) => String(r.id ?? "") === args.customerId);
      const returnedDue =
        found && typeof found.due_date === "string"
          ? (found.due_date as string)
          : found && typeof found.expires_at === "string"
            ? (found.expires_at as string)
            : null;
      const returnedDueDay =
        found && typeof found.due_day === "number" ? (found.due_day as number) : null;
      const returnedStatus =
        found && typeof found.status === "string" ? (found.status as string) : null;
      if (import.meta.env.DEV) {
        console.log("[renew] refetch check", {
          expected_due_date: args.newDueISO,
          returned_due_date: returnedDue,
          returned_due_day: returnedDueDay,
          returned_status: returnedStatus,
        });
      }
      if (returnedDue && returnedDue.slice(0, 10) === args.newDueISO.slice(0, 10)) {
        return {
          ok: true,
          persistedDue: returnedDue,
          patch: {
            due_date: returnedDue.slice(0, 10),
            due_day: returnedDueDay,
            status: returnedStatus,
          },
        };
      }
      return {
        ok: false,
        message:
          "Renovação enviada, mas o vencimento não foi atualizado. Atualize a página e tente novamente.",
        persistedDue: returnedDue,
      };
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      console.error("[renew] refetch error", e);
    }
  }

  return {
    ok: false,
    message:
      "Renovação enviada, mas não foi possível confirmar no backend. Atualize a página e tente novamente.",
  };
}


// Renovação manual: cada "mês" = 30 dias corridos (regra acordada com o usuário).
function addMonthsISO(base: Date, months: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + months * 30);
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

// Mesma regra do card de Clientes: usa due_date completo quando for futuro;
// se vencido/ausente, parte de hoje. due_day vira último recurso.
function baseFromCustomer(dueIso: string | null | undefined, dueDay: number | null | undefined): Date {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dt = parseISO(dueIso ?? undefined);
  if (dt && dt > today) return dt;
  if (dt) return today; // vencido => hoje
  if (!dueDay) return today;
  const d = new Date(today.getFullYear(), today.getMonth(), Math.min(dueDay, 28));
  if (d < today) d.setMonth(d.getMonth() + 1);
  return d;
}

const MONTH_OPTIONS = [1, 2, 3];

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
  customerDueIso,
  monthlyAmountCents,
  whatsappE164,
  onRenewed,
}: {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  customerDueDay: number | null;
  customerDueIso?: string | null;
  monthlyAmountCents: number | null;
  whatsappE164?: string | null;
  onRenewed?: (patch?: { due_date: string; due_day: number | null; status: string | null }) => void;
}) {
  const [screens, setScreens] = useState<AppScreen[]>([]);
  const [choices, setChoices] = useState<Record<string, ScreenChoice>>({});
  const [months, setMonths] = useState(1);
  const [amount, setAmount] = useState("");
  const [appAmount, setAppAmount] = useState("");
  const [discount, setDiscount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { msg: string; newDue: string; sent: boolean }>(null);
  const [newDueOverride, setNewDueOverride] = useState<string>("");
  const [dataReceber, setDataReceber] = useState<string>("");
  const [sendReceipt, setSendReceipt] = useState(true);
  const [renovarPrazo, setRenovarPrazo] = useState(false);

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
    setDiscount("");
    setSendReceipt(true);
    setRenovarPrazo(false);
    const today = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    setDataReceber(`${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`);
    setNewDueOverride("");
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

  // Vencimento "geral" do cliente — fonte única: a MESMA iso exibida no card.
  // baseFromCustomer retorna customerDueIso se for futuro, senão hoje.
  const baseDate = useMemo(
    () => baseFromCustomer(customerDueIso, customerDueDay),
    [customerDueIso, customerDueDay],
  );
  const baseIsFuture = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return baseDate > today;
  }, [baseDate]);
  const customerNewDue = useMemo(
    () => addMonthsISO(baseDate, months),
    [baseDate, months],
  );

  // Data antiga (vencimento atual) — usa SEMPRE o iso do card quando existe.
  const oldDue = useMemo(() => {
    if (customerDueIso) return customerDueIso;
    if (selectedScreens.length > 0) {
      const dates = selectedScreens
        .map((s) => s.due_date)
        .filter(Boolean) as string[];
      if (dates.length) return dates.sort()[0];
    }
    if (customerDueDay) {
      const base = baseFromCustomer(null, customerDueDay);
      base.setMonth(base.getMonth() - 1);
      const p = (n: number) => String(n).padStart(2, "0");
      return `${base.getFullYear()}-${p(base.getMonth() + 1)}-${p(base.getDate())}`;
    }
    return null;
  }, [customerDueIso, selectedScreens, customerDueDay]);

  const parseBR = (v: string): number => {
    const n = Number((v || "").replace(/\./g, "").replace(",", "."));
    return isNaN(n) ? 0 : n;
  };
  const amountNum = parseBR(amount);
  const appAmountNum = parseBR(appAmount);
  const discountNum = parseBR(discount);
  const totalServicos = amountNum + appAmountNum;
  const totalNum = Math.max(0, totalServicos - discountNum);
  const fmtMoney = (n: number) =>
    `R$ ${n.toFixed(2).replace(".", ",")}`;

  // Vencimento final calculado — SEMPRE a partir do iso do card (customerNewDue).
  // Anteriormente este caminho usava screen.due_date quando havia telas, o que
  // fazia a renovação sequencial perder a data nova do cliente (ex.: 25/06/2026)
  // e somar a partir de uma data de tela antiga.
  const computedNewDue = customerNewDue;


  const effectiveNewDue = newDueOverride || computedNewDue;

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
      // 1) PERSISTÊNCIA REAL no backend — bloqueia se falhar.
      // Fonte única: customerNewDue = customerDueIso (se futuro) + meses*30.
      // NÃO usar baseFromScreen aqui — isso ignorava a data nova do cliente
      // em renovações sequenciais e somava em cima de uma tela antiga.
      const finalDueForBackend = newDueOverride || customerNewDue;
      const oldDueISO = customerDueIso || oldDue || null;
      const expectedDue = finalDueForBackend;

      if (import.meta.env.DEV) {
        console.log("[renew-sequential] calculate", {
          customer_id: customerId,
          whatsapp: whatsappE164 ?? null,
          base_date: `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, "0")}-${String(baseDate.getDate()).padStart(2, "0")}`,
          base_is_future: baseIsFuture,
          months,
          old_due_date: oldDueISO,
          expected_due_date: expectedDue,
          using_override: !!newDueOverride,
        });
      }

      const persist = await persistRenewalOnBackend({
        customerId,
        customerName,
        whatsappE164,
        monthlyAmountCents,
        newDueISO: finalDueForBackend,
        months,
        oldDueISO,
        totalAmount: fmtMoney(totalNum),
        monthlyAmount: amount ? `R$ ${amount}` : "",
      });
      if (!persist.ok) {
        toast.error(persist.message || "Renovação precisa ser ativada no servidor.");
        setBusy(false);
        return;
      }
      // Guarda contra sucesso falso: a RPC retornou ok, mas due_date precisa
      // bater com o esperado E ser diferente do antigo.
      const returnedDue = persist.patch?.due_date ?? persist.persistedDue ?? null;
      if (!returnedDue || returnedDue.slice(0, 10) !== expectedDue.slice(0, 10)) {
        toast.error(
          `Vencimento não foi atualizado (esperado ${expectedDue}, retornou ${returnedDue ?? "—"}).`,
        );
        setBusy(false);
        return;
      }
      if (oldDueISO && returnedDue.slice(0, 10) === oldDueISO.slice(0, 10)) {
        toast.error("Renovação não somou: o vencimento continua igual ao anterior.");
        setBusy(false);
        return;
      }
      if (import.meta.env.DEV) {
        console.log("[renew-sequential] rpc result", {
          customer_id: customerId,
          returned_due_date: returnedDue,
          returned_due_day: persist.patch?.due_day ?? null,
          returned_status: persist.patch?.status ?? null,
          expected_due_date: expectedDue,
          old_due_date: oldDueISO,
        });
      }


      // 2) Histórico local + mensagem WhatsApp (já existente)
      if (!hasScreens) {
        const finalDue = finalDueForBackend;
        const rec = applyRenewal({
          customer_id: customerId,
          customer_name: customerName,
          customer_whatsapp: whatsappE164 ?? null,
          new_due_date: finalDue,
          amount: amount ? `R$ ${amount}` : undefined,
          payment_method: method,
          notes: notes.trim() || `Renovação de ${months} ${months === 1 ? "mês" : "meses"}`,
          renew_app: false,
          screens: [],
        });
        // Backend já tem a verdade: limpa override visual temporário.
        clearCustomerDueOverride(customerId);
        const msg = rec.confirmation_message || buildConfirmationMessage(rec);
        if (sendReceipt) autoSend(msg);
        setDone({ msg, newDue: finalDue, sent: sendReceipt });
      } else {
        const usingOverride = !!newDueOverride;
        const groups = new Map<string, AppScreen[]>();
        for (const s of selectedScreens) {
          const newDue = usingOverride ? newDueOverride : addMonthsISO(baseFromScreen(s), months);
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
            customer_whatsapp: whatsappE164 ?? null,
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
              customer_whatsapp: whatsappE164 ?? null,
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
        // Backend é a fonte de verdade — não precisa de override visual.
        clearCustomerDueOverride(customerId);
        const fullMsg = messages.join("\n\n———\n\n");
        if (sendReceipt) autoSend(fullMsg);
        setDone({ msg: fullMsg, newDue: maxDue, sent: sendReceipt });
      }
      // Limpa caches locais que poderiam sobrescrever o novo due_date no card.
      clearCustomerDueOverride(customerId);
      if (whatsappE164) clearImportedDueByWhatsapp(whatsappE164);
      toast.success("Cliente renovado com sucesso.");
      onRenewed?.(persist.patch);
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
            {/* Telas (se houver mais de uma) */}
            {hasScreens && multi && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs flex items-center gap-1">
                    <Tv className="h-3.5 w-3.5" /> Telas a renovar ({selectedScreens.length}/{screens.length})
                  </Label>
                  <button
                    type="button"
                    className="text-[11px] text-primary hover:underline"
                    onClick={() => selectAll(!allSelected)}
                  >
                    {allSelected ? "Desmarcar todas" : "Marcar todas"}
                  </button>
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
                          ch.selected ? "border-primary/40 bg-primary/5" : "border-border bg-muted/30",
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
                                <span className={cn("rounded px-1.5 py-px text-[10px]", meta.badgeClass)}>
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
                            <span>Renovar também o app {meta.label}</span>
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Card único — tudo editável */}
            <div className="rounded-xl border bg-card overflow-hidden">
              {/* Cabeçalho */}
              <div className="flex items-center gap-3 px-3 py-3 bg-muted/40 border-b">
                <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{customerName}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {hasScreens && selectedScreens.length === 1
                      ? `${selectedScreens[0].name || "Tela"} • ${APP_CATALOG[selectedScreens[0].app]?.label ?? ""}`
                      : hasScreens
                        ? `${selectedScreens.length} tela(s)`
                        : "Renovação geral"}
                    {monthlyAmountCents != null && ` • ${fmtMoney(monthlyAmountCents / 100)}/mês`}
                  </div>
                </div>
              </div>

              {/* Período de renovação (chips) */}
              <div className="px-3 pt-3 space-y-1.5">
                <Label className="text-[11px] font-semibold">Período de renovação</Label>
                <div className="flex flex-wrap gap-1.5">
                  {MONTH_OPTIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMonths(m)}
                      className={cn(
                        "h-9 min-w-[64px] rounded-md border px-3 text-xs font-semibold transition-colors",
                        months === m
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-muted",
                      )}
                    >
                      {m} {m === 1 ? "mês" : "meses"}
                    </button>
                  ))}
                  <div className="flex items-center gap-1.5 rounded-md border px-2 h-9">
                    <span className="text-[10px] text-muted-foreground">Personalizado</span>
                    <Input
                      value={String(months)}
                      onChange={(e) => setMonths(Math.max(1, Math.min(36, Number(e.target.value) || 1)))}
                      inputMode="numeric"
                      className="h-6 w-12 text-xs text-center px-1"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">Cada mês equivale a 30 dias corridos.</p>
              </div>

              {/* Linhas financeiras editáveis */}
              <div className="px-3 py-3 space-y-2 text-sm">
                <FinanceEditRow
                  label="RENOVAÇÕES"
                  op="×"
                  value={String(months)}
                  onChange={(v) => setMonths(Math.max(1, Math.min(36, Number(v) || 1)))}
                  inputMode="numeric"
                />
                <FinanceEditRow
                  label="TOTAL SERVIÇOS"
                  op="="
                  value={amount}
                  onChange={setAmount}
                  prefix="R$"
                />
                <FinanceEditRow
                  label="DESCONTO"
                  op="−"
                  value={discount}
                  onChange={setDiscount}
                  prefix="R$"
                />
                <div className="border-t pt-2">
                  <FinanceRow label="TOTAL A RECEBER" op="=" value={fmtMoney(totalNum)} strong />
                </div>
              </div>

              {/* Datas */}
              <div className="grid grid-cols-2 gap-3 px-3 py-3 border-t bg-muted/20">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">Expiração Atual</Label>
                  <Input
                    value={oldDue ? fmtDateBR(oldDue) : "—"}
                    readOnly
                    className="h-9 text-xs bg-muted/60"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold">
                    <span className="text-rose-500">*</span> Nova Data Expiração
                  </Label>
                  <Input
                    type="date"
                    value={newDueOverride || computedNewDue}
                    onChange={(e) => setNewDueOverride(e.target.value)}
                    className="h-9 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {baseIsFuture
                      ? "Renovação somada a partir do vencimento atual."
                      : "Renovação calculada a partir de hoje."}
                  </p>
                </div>

                <div className="space-y-1 col-span-2">
                  <Label className="text-[11px] font-semibold">Data Contas a Receber</Label>
                  <Input
                    type="date"
                    value={dataReceber}
                    onChange={(e) => setDataReceber(e.target.value)}
                    disabled={!renovarPrazo}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="col-span-2 flex flex-col gap-1.5 pt-1">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox checked={sendReceipt} onCheckedChange={(v) => setSendReceipt(!!v)} />
                    Enviar Recibo no WhatsApp (automático)
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox checked={renovarPrazo} onCheckedChange={(v) => setRenovarPrazo(!!v)} />
                    Renovar a Prazo
                  </label>
                </div>
              </div>

              <div className="px-3 pb-3 pt-2 border-t bg-muted/10 text-[11px] text-muted-foreground">
                Novo vencimento: <strong className="text-foreground">{fmtDateBR(effectiveNewDue)}</strong>
                {" • "}Total: <strong className="text-foreground">{fmtMoney(totalNum)}</strong>
              </div>
            </div>
          </div>
        )}


        {done && (
          <div className="space-y-3 py-1">
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 space-y-1">
              <div className="flex items-center gap-2 font-medium">
                <Check className="h-4 w-4" /> Renovação confirmada
              </div>
              {done.newDue && (
                <div className="flex items-center gap-1.5 pl-6">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Novo vencimento: <strong>{fmtDateBR(done.newDue)}</strong></span>
                </div>
              )}
              {done.sent && (
                <div className="pl-6 text-[11px]">
                  ✅ Mensagem enviada para o cliente no WhatsApp.
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs">Mensagem enviada</Label>
              <Textarea
                value={done.msg}
                readOnly
                rows={8}
                className="resize-none text-xs font-mono mt-1"
              />
            </div>
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
                Reenviar no WhatsApp
              </Button>
              <Button variant="ghost" onClick={onClose}>Fechar</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FinanceRow({
  label, op, value, strong, muted,
}: { label: string; op: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn("flex-1 text-[11px] tracking-wide", muted ? "text-muted-foreground" : "text-foreground/80", strong && "font-semibold text-foreground")}>
        {label}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-muted text-xs font-semibold">{op}</span>
        <div className={cn(
          "inline-flex h-7 min-w-[110px] items-center justify-end rounded-md border px-2 text-xs tabular-nums",
          strong ? "bg-primary/10 text-primary font-bold border-primary/40" : "bg-background"
        )}>
          {value}
        </div>
      </div>
    </div>
  );
}

function FinanceEditRow({
  label, op, value, onChange, prefix, inputMode = "decimal",
}: {
  label: string; op: string; value: string;
  onChange: (v: string) => void;
  prefix?: string;
  inputMode?: "decimal" | "numeric";
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 text-[11px] tracking-wide text-foreground/80">{label}</div>
      <div className="flex items-center gap-1.5">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border bg-muted text-xs font-semibold">{op}</span>
        <div className="relative">
          {prefix && (
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{prefix}</span>
          )}
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            inputMode={inputMode}
            className={cn(
              "h-8 min-w-[110px] text-right text-xs tabular-nums",
              prefix && "pl-8",
            )}
          />
        </div>
      </div>
    </div>
  );
}

