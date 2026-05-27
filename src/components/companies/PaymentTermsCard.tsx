import { useEffect, useState } from "react";
import { FileText, ShieldCheck, Receipt, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

// Versão atual do texto do termo. Quando o texto mudar, suba a versão.
export const TERMS_VERSION = "v1-2026-05";

const ACK_KEY = "cobranca_ia_payment_terms_ack_v1";

type LocalAck = {
  version: string;
  ciente_em: string; // ISO local
};

function loadAck(): LocalAck | null {
  try {
    const raw = localStorage.getItem(ACK_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as LocalAck;
    if (!v?.version) return null;
    return v;
  } catch {
    return null;
  }
}

function saveAck(v: LocalAck | null) {
  if (!v) {
    localStorage.removeItem(ACK_KEY);
  } else {
    localStorage.setItem(ACK_KEY, JSON.stringify(v));
  }
}

export function PaymentTermsCard() {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [ack, setAck] = useState<LocalAck | null>(null);

  useEffect(() => {
    const cur = loadAck();
    setAck(cur);
    setChecked(Boolean(cur && cur.version === TERMS_VERSION));
  }, []);

  function handleConfirm() {
    if (!checked) {
      // Permite só registrar ciência local.
      saveAck(null);
      setAck(null);
      setOpen(false);
      toast.message("Marcação removida.");
      return;
    }
    const next: LocalAck = {
      version: TERMS_VERSION,
      ciente_em: new Date().toISOString(),
    };
    saveAck(next);
    setAck(next);
    setOpen(false);
    toast.success("Ciência registrada neste dispositivo.");
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <header className="mb-3 flex items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileText className="h-5 w-5" />
        </span>
        <h3 className="truncate text-base font-semibold">Termos de pagamento</h3>
      </header>

      <p className="text-sm text-muted-foreground">
        Antes de ativar pagamentos automáticos, você poderá revisar e aceitar os termos de cobrança.
        Nenhuma cobrança automática está ativa nesta versão.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" className="h-10" onClick={() => setOpen(true)}>
          <FileText className="h-4 w-4" />
          Ver termos
        </Button>
        {ack && ack.version === TERMS_VERSION && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5" />
            Ciência registrada
          </span>
        )}
      </div>

      {/* Comprovante de aceite — placeholder honesto */}
      <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/40 p-3">
        <div className="mb-2 flex items-center gap-2">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Comprovante de aceite</h4>
        </div>
        <p className="text-sm text-muted-foreground">
          Nenhum termo aceito ainda. Quando o pagamento automático for ativado, o comprovante
          ficará disponível aqui com:
        </p>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li>• Nome do responsável</li>
          <li>• E-mail e WhatsApp</li>
          <li>• Plano e valor</li>
          <li>• Data e hora do aceite</li>
          <li>• Versão do termo</li>
          <li>• Forma de pagamento escolhida</li>
          <li>• IP/dispositivo (quando disponível)</li>
        </ul>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 h-9"
          disabled
          title="Disponível quando o pagamento automático for ativado."
        >
          <Download className="h-4 w-4" />
          Baixar comprovante
        </Button>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Esse comprovante ajuda a registrar o aceite do cliente.
        </p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Termos de cobrança</DialogTitle>
            <DialogDescription className="text-xs">
              Versão {TERMS_VERSION}. Leia com calma antes de marcar a ciência.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1 text-sm leading-relaxed">
            <p>
              Ao usar o sistema, você está contratando uma assinatura conforme o plano escolhido.
            </p>
            <p>
              A cobrança seguirá os valores e a periodicidade do plano. Se, no futuro, você
              escolher pagar por cartão recorrente, estará autorizando a cobrança automática no
              cartão informado, na data combinada (geralmente mensal).
            </p>
            <p>
              Você poderá cancelar a assinatura a qualquer momento, respeitando as regras do
              plano contratado. O cancelamento interrompe novas cobranças, mas não devolve
              valores já pagos referentes a períodos em uso, salvo se a lei exigir.
            </p>
            <p>
              Os dados do aceite (nome, e-mail, WhatsApp, plano, valor, data/hora, versão do
              termo e forma de pagamento) poderão ser salvos como comprovante para a sua própria
              proteção e a do sistema.
            </p>
            <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
              Nesta versão do sistema, <strong>nenhuma cobrança automática está ativa</strong>.
              Este texto serve apenas para você conhecer as regras antes que o pagamento
              recorrente seja liberado.
            </p>
            <p className="text-xs text-muted-foreground">
              Esse comprovante ajuda a registrar o aceite do cliente. Ele não substitui contrato
              específico nem garante, por si só, a recusa de contestações junto à operadora do
              cartão.
            </p>
          </div>

          <label className="mt-2 flex items-start gap-2 rounded-lg border border-border p-2 text-sm">
            <Checkbox
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
              className="mt-0.5"
            />
            <span>Li e estou ciente dos termos.</span>
          </label>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Fechar
            </Button>
            <Button onClick={handleConfirm}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
