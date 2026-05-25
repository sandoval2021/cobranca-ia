import { useEffect, useState } from "react";
import { History, Copy, Download, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  RenewalRecord, RENEWAL_EVENT, listRenewals,
  formatRenewalSummary, exportCustomerRenewals, fmtDateBR, PAYMENT_LABEL,
} from "@/lib/manual-renewals";

function copyText(text: string, label: string) {
  if (!text) return;
  try {
    navigator.clipboard?.writeText(text);
    toast.success(`${label} copiado`);
  } catch {
    toast.error("Não foi possível copiar");
  }
}

export function RenewalHistorySection({
  customerId, customerName,
}: { customerId: string; customerName: string }) {
  const [items, setItems] = useState<RenewalRecord[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setItems(listRenewals(customerId));
    refresh();
    window.addEventListener(RENEWAL_EVENT, refresh);
    return () => window.removeEventListener(RENEWAL_EVENT, refresh);
  }, [customerId]);

  const handleExport = () => {
    const json = exportCustomerRenewals(customerId, customerName);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `renovacoes-${customerName.replace(/\W+/g, "_")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Histórico exportado.");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <History className="h-3.5 w-3.5" /> Histórico local de renovações
        </h3>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={handleExport} disabled={items.length === 0}>
          <Download className="h-3 w-3" /> Exportar
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          Ainda não há renovações registradas para este cliente.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => {
            const open = expanded === r.id;
            return (
              <li key={r.id} className="rounded-xl border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : r.id)}
                  className="flex w-full items-start gap-2 p-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.screens.length} {r.screens.length === 1 ? "tela" : "telas"}
                      {r.amount ? ` • ${r.amount}` : ""}
                      {r.payment_method ? ` • ${PAYMENT_LABEL[r.payment_method]}` : ""}
                    </div>
                  </div>
                  {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {open && (
                  <div className="space-y-2 border-t border-border p-3 text-xs">
                    <ul className="space-y-1.5">
                      {r.screens.map((s) => (
                        <li key={s.screen_id} className="rounded-md bg-surface p-2">
                          <div className="font-semibold">{s.screen_name} <span className="text-muted-foreground">({s.app_label})</span></div>
                          <div className="text-muted-foreground">
                            Lista: {fmtDateBR(s.old_due_date)} → <strong className="text-foreground">{fmtDateBR(s.new_due_date)}</strong>
                          </div>
                          {s.app_renewed && (
                            <div className="text-muted-foreground">
                              App: {fmtDateBR(s.old_app_due_date)} → <strong className="text-foreground">{fmtDateBR(s.new_app_due_date)}</strong>
                            </div>
                          )}
                          {s.servers.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {s.servers.map((sv) => (
                                <span key={sv.server_id} className={cnPill(sv.status)}>
                                  {sv.server_name}: {sv.status}
                                </span>
                              ))}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                    {r.notes && (
                      <p className="rounded-md bg-surface p-2 text-muted-foreground whitespace-pre-wrap">
                        {r.notes}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copyText(formatRenewalSummary(r), "Resumo")}>
                        <Copy className="h-3.5 w-3.5" /> Copiar resumo
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copyText(r.confirmation_message, "Confirmação")}>
                        <Copy className="h-3.5 w-3.5" /> Copiar confirmação
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function cnPill(status: "renovado" | "pulado"): string {
  const base = "inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium";
  if (status === "renovado") return `${base} bg-success-soft text-success`;
  return `${base} bg-warning-soft text-warning`;
}
