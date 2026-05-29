// Modal "Visualizar quem vai receber" — mostra a lista de clientes elegíveis
// para uma mensagem específica do plano (ou para todas as mensagens do plano).
import { useEffect, useState } from "react";
import { Loader2, Users, Check, AlertCircle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  previewServiceDispatchDb,
  type EligibleCustomer,
} from "@/lib/services/dispatch.functions";
import { getActiveCompanyId } from "@/lib/company-scope";

export function EligibleRecipientsDialog({
  open,
  onClose,
  planMessageIds,
  title,
  subtitle,
}: {
  open: boolean;
  onClose: () => void;
  planMessageIds: string[] | null; // null = todas as mensagens da empresa
  title: string;
  subtitle?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<EligibleCustomer[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const previewFn = useServerFn(previewServiceDispatchDb);

  useEffect(() => {
    if (!open) return;
    const companyId = getActiveCompanyId();
    if (!companyId) {
      setErr("Empresa não identificada.");
      return;
    }
    setLoading(true);
    setErr(null);
    previewFn({
      data: {
        companyId,
        planMessageIds: planMessageIds && planMessageIds.length > 0 ? planMessageIds : null,
        onlyDueToday: false,
      },
    })
      .then((rows) => setItems(rows as EligibleCustomer[]))
      .catch((e: any) => setErr(e?.message ?? "Não foi possível carregar."))
      .finally(() => setLoading(false));
  }, [open, planMessageIds, previewFn]);

  const pending = items.filter((i) => !i.already_sent);
  const already = items.filter((i) => i.already_sent);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> {title}
          </DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Calculando…
          </div>
        ) : err ? (
          <Card className="flex items-start gap-2 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {err}
          </Card>
        ) : items.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Nenhum cliente está dentro da janela dessa mensagem hoje.
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-primary/10 px-2 py-1 font-medium text-primary">
                {pending.length} {pending.length === 1 ? "pessoa receberá" : "pessoas receberão"}
              </span>
              {already.length > 0 && (
                <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
                  {already.length} já {already.length === 1 ? "recebeu" : "receberam"} nesse ciclo
                </span>
              )}
            </div>
            <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
              {items.map((r) => (
                <Card
                  key={`${r.customer_id}-${r.service_plan_message_id}`}
                  className="p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{r.customer_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        WhatsApp: {r.phone ?? "—"} · Vence em {r.due_date}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {r.message_label}
                      </p>
                    </div>
                    {r.already_sent && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                        <Check className="h-3 w-3" /> já enviada
                      </span>
                    )}
                  </div>
                  <pre className="mt-2 whitespace-pre-wrap break-words rounded-md bg-muted/60 p-2 text-[11px] text-foreground">
                    {r.rendered_message}
                  </pre>
                </Card>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
