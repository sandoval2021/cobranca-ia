import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Smartphone, RefreshCw, PowerOff, QrCode, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getCurrentCompanyId, listCompanies, setCurrentCompany, COMPANIES_EVENT } from "@/lib/companies";
import { useLocalAuth } from "@/lib/use-local-auth";
import { LOCAL_AUTH_EVENT } from "@/lib/local-auth";
import {
  connectWhatsAppInstance,
  getWhatsAppQr,
  disconnectWhatsAppInstance,
  getCompanyWhatsApp,
} from "@/lib/whatsapp/whatsapp.functions";

export const Route = createFileRoute("/whatsapp")({
  component: WhatsAppPage,
  head: () => ({
    meta: [{ title: "WhatsApp — CobraEasy" }],
  }),
});

const statusLabel: Record<string, { text: string; tone: "ok" | "warn" | "err" | "neutral" }> = {
  connected: { text: "Conectado", tone: "ok" },
  awaiting_qr: { text: "Aguardando QR", tone: "warn" },
  disconnected: { text: "Desconectado", tone: "neutral" },
  error: { text: "Erro", tone: "err" },
  blocked: { text: "Bloqueado", tone: "err" },
};

function StatusBadge({ status }: { status: string }) {
  const s = statusLabel[status] ?? { text: status, tone: "neutral" as const };
  const cls =
    s.tone === "ok"
      ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
      : s.tone === "warn"
      ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
      : s.tone === "err"
      ? "bg-rose-500/15 text-rose-700 border-rose-500/30"
      : "bg-muted text-muted-foreground border-border";
  return <Badge className={`border ${cls}`}>{s.text}</Badge>;
}

function WhatsAppPage() {
  const { isSuperAdmin, user } = useLocalAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [friendlyName, setFriendlyName] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchData = useServerFn(getCompanyWhatsApp);
  const fetchQr = useServerFn(getWhatsAppQr);
  const connectFn = useServerFn(connectWhatsAppInstance);
  const disconnectFn = useServerFn(disconnectWhatsAppInstance);

  // Resolve company id reativamente para evitar bloqueio durante hidratação.
  // Super admin nunca fica preso: auto-seleciona a primeira empresa se nenhuma
  // estiver marcada como atual.
  useEffect(() => {
    function resolve() {
      let cid = getCurrentCompanyId();
      if (!cid && isSuperAdmin) {
        const all = listCompanies();
        if (all.length > 0) {
          cid = all[0]!.id;
          setCurrentCompany(cid);
        }
      }
      setCompanyId(cid);
      setHydrated(true);
    }
    resolve();
    window.addEventListener(LOCAL_AUTH_EVENT, resolve);
    window.addEventListener(COMPANIES_EVENT, resolve);
    window.addEventListener("storage", resolve);
    return () => {
      window.removeEventListener(LOCAL_AUTH_EVENT, resolve);
      window.removeEventListener(COMPANIES_EVENT, resolve);
      window.removeEventListener("storage", resolve);
    };
  }, [isSuperAdmin, user?.id]);


  const query = useQuery({
    queryKey: ["whatsapp", companyId],
    queryFn: () => fetchData({ data: { company_id: companyId! } }),
    enabled: !!companyId,
    refetchInterval: 8000,
  });

  const instance = query.data?.instance ?? null;
  const queued = query.data?.queued ?? 0;

  async function handleConnect() {
    if (!companyId) {
      toast.error("Selecione uma empresa primeiro.");
      return;
    }
    const name = friendlyName.trim() || "WhatsApp Principal";
    setBusy(true);
    try {
      await connectFn({ data: { company_id: companyId, friendly_name: name } });
      await query.refetch();
      toast.success("Conexão iniciada. Escaneie o QR Code.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao conectar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReconnect() {
    if (!instance) return;
    setBusy(true);
    try {
      await fetchQr({ data: { instance_id: instance.id } });
      await query.refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao reconectar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    if (!instance) return;
    if (!confirm("Desconectar este WhatsApp?")) return;
    setBusy(true);
    try {
      await disconnectFn({ data: { instance_id: instance.id } });
      await query.refetch();
      toast.success("Desconectado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao desconectar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageContainer>
      <SectionHeader
        
        title="WhatsApp da empresa"
        subtitle="Conecte seu WhatsApp para enviar cobranças e mensagens automáticas."
      />

      {!companyId && !hydrated && (
        <Card className="p-4 mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
        </Card>
      )}

      {!companyId && hydrated && (
        <Card className="p-4 mt-4">
          <p className="text-sm text-muted-foreground">
            {isSuperAdmin
              ? "Nenhuma empresa cadastrada ainda. Crie uma empresa em Cadastros → Contas de donos para conectar um WhatsApp."
              : "Sua conta ainda não está vinculada a uma empresa. Atualize a página em alguns segundos."}
          </p>
        </Card>
      )}

      {companyId && !instance && (
        <Card className="p-4 mt-4 space-y-3">
          <div>
            <Label htmlFor="fname">Nome da conexão</Label>
            <Input
              id="fname"
              placeholder="WhatsApp Principal"
              value={friendlyName}
              onChange={(e) => setFriendlyName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Identifica este WhatsApp dentro do sistema. Você pode mudar depois.
            </p>
          </div>
          <Button onClick={handleConnect} disabled={busy} className="w-full sm:w-auto">
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <QrCode className="w-4 h-4 mr-2" />}
            Conectar WhatsApp
          </Button>
        </Card>
      )}

      {instance && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{instance.friendly_name}</div>
                {instance.phone_number && (
                  <div className="text-xs text-muted-foreground">{instance.phone_number}</div>
                )}
              </div>
              <StatusBadge status={instance.status} />
            </div>

            {instance.status === "awaiting_qr" && instance.qr_code && (
              <div className="flex flex-col items-center gap-2 rounded-md border p-3 bg-muted/30">
                <img
                  src={
                    instance.qr_code.startsWith("data:")
                      ? instance.qr_code
                      : `data:image/png;base64,${instance.qr_code}`
                  }
                  alt="QR Code"
                  className="w-56 h-56"
                />
                <p className="text-xs text-muted-foreground text-center">
                  Abra o WhatsApp no celular &gt; Aparelhos conectados &gt; Conectar aparelho.
                </p>
              </div>
            )}

            {instance.status === "connected" && (
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                WhatsApp ativo e pronto para enviar mensagens.
              </div>
            )}

            {instance.status === "blocked" && (
              <div className="flex items-start gap-2 text-sm text-rose-700">
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                Esta conexão foi bloqueada pelo WhatsApp. Crie uma nova conexão com outro número.
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={handleReconnect} disabled={busy}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar / Reconectar
              </Button>
              <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={busy}>
                <PowerOff className="w-4 h-4 mr-2" />
                Desconectar
              </Button>
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="font-medium">Hoje</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-muted/40 p-3">
                <div className="text-2xl font-semibold">{instance.daily_sent_count ?? 0}</div>
                <div className="text-xs text-muted-foreground">Enviadas</div>
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <div className="text-2xl font-semibold">{instance.daily_limit ?? 300}</div>
                <div className="text-xs text-muted-foreground">Limite diário</div>
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <div className="text-2xl font-semibold">{queued}</div>
                <div className="text-xs text-muted-foreground">Na fila</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Para evitar bloqueios, o sistema envia com pequenos intervalos e respeita o limite diário.
            </p>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
