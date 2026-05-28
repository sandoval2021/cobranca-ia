import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  RefreshCw,
  PowerOff,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  PhoneOff,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  connectWhatsAppInstance,
  getWhatsAppQr,
  disconnectWhatsAppInstance,
  getCompanyWhatsApp,
  ensureMyCompany,
  setWhatsAppRejectCall,
  sendWhatsAppTestMessage,
} from "@/lib/whatsapp/whatsapp.functions";

export const Route = createFileRoute("/whatsapp")({
  component: WhatsAppPage,
  head: () => ({
    meta: [{ title: "WhatsApp — CobraEasy" }],
  }),
});

const statusLabel: Record<string, { text: string; tone: "ok" | "warn" | "err" | "neutral" }> = {
  connected: { text: "Conectado", tone: "ok" },
  awaiting_qr: { text: "Aguardando conexão", tone: "warn" },
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

function formatPairing(code: string): string {
  const clean = code.replace(/\s|-/g, "").toUpperCase();
  if (clean.length === 8) return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  return clean;
}

function WhatsAppPage() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [friendlyName, setFriendlyName] = useState("");
  const [mode, setMode] = useState<"qr" | "pairing">("qr");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [brokenConnection, setBrokenConnection] = useState(false);
  const [rejectCall, setRejectCall] = useState(false);
  const [rejectMsg, setRejectMsg] = useState(
    "Não posso atender chamadas neste número. Envie uma mensagem.",
  );
  const [savingReject, setSavingReject] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testBody, setTestBody] = useState("Olá! Esta é uma mensagem de teste do CobraEasy.");
  const [sendingTest, setSendingTest] = useState(false);

  const ensureCompany = useServerFn(ensureMyCompany);
  const fetchData = useServerFn(getCompanyWhatsApp);
  const fetchQr = useServerFn(getWhatsAppQr);
  const connectFn = useServerFn(connectWhatsAppInstance);
  const disconnectFn = useServerFn(disconnectWhatsAppInstance);
  const setRejectFn = useServerFn(setWhatsAppRejectCall);
  const sendTestFn = useServerFn(sendWhatsAppTestMessage);

  // Garante uma empresa real (UUID) no backend para o usuário logado.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await ensureCompany();
        if (!cancelled) setCompanyId(r.company_id);
      } catch (e: any) {
        if (!cancelled) setBootError(e?.message ?? "Falha ao preparar empresa.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureCompany]);

  const query = useQuery({
    queryKey: ["whatsapp", companyId],
    queryFn: () => fetchData({ data: { company_id: companyId! } }),
    enabled: !!companyId,
    refetchInterval: 8000,
  });

  const instance = query.data?.instance ?? null;
  const queued = query.data?.queued ?? 0;

  useEffect(() => {
    if (instance) setBrokenConnection(false);
  }, [instance]);

  function digitsOnly(v: string) {
    return v.replace(/\D/g, "");
  }

  async function handleConnect() {
    if (!companyId) {
      toast.error("Aguarde a empresa carregar.");
      return;
    }
    const name = friendlyName.trim() || "WhatsApp Principal";
    let phone: string | undefined;
    if (mode === "pairing") {
      phone = digitsOnly(phoneNumber);
      if (phone.length < 10) {
        toast.error("Informe o número com DDI e DDD (ex.: 5511999998888).");
        return;
      }
    }
    setBusy(true);
    try {
      await connectFn({
        data: { company_id: companyId, friendly_name: name, phone_number: phone },
      });
      setBrokenConnection(false);
      await query.refetch();
      toast.success(
        phone
          ? "Código de pareamento gerado. Digite no WhatsApp do celular."
          : "Conexão iniciada. Escaneie o QR Code.",
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao conectar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReconnect(usePairing?: boolean) {
    if (!instance) return;
    let phone: string | undefined;
    if (usePairing) {
      phone = digitsOnly(phoneNumber || instance.phone_number || "");
      if (phone.length < 10) {
        toast.error("Informe o número com DDI e DDD para gerar um novo código.");
        return;
      }
    }
    setBusy(true);
    try {
      await fetchQr({ data: { instance_id: instance.id, phone_number: phone } });
      await query.refetch();
    } catch (e: any) {
      const message = e?.message ?? "Falha ao reconectar.";
      if (/404|instance does not exist|Instância local inválida/i.test(message)) {
        setBrokenConnection(true);
        await query.refetch();
        toast.error("Conexão quebrada removida. Clique em Recriar conexão.");
        return;
      }
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

  async function handleToggleRejectCall(next: boolean) {
    if (!instance) return;
    setSavingReject(true);
    setRejectCall(next);
    try {
      await setRejectFn({
        data: {
          instance_id: instance.id,
          reject_call: next,
          msg_call: next ? rejectMsg : undefined,
        },
      });
      toast.success(next ? "Chamadas serão bloqueadas." : "Chamadas liberadas.");
    } catch (e: any) {
      setRejectCall(!next);
      toast.error(e?.message ?? "Falha ao atualizar configuração.");
    } finally {
      setSavingReject(false);
    }
  }

  async function handleSendTest() {
    if (!instance) return;
    const to = digitsOnly(testPhone);
    if (to.length < 10) {
      toast.error("Informe o número com DDI e DDD (ex.: 5511999998888).");
      return;
    }
    if (!testBody.trim()) {
      toast.error("Escreva a mensagem de teste.");
      return;
    }
    setSendingTest(true);
    try {
      await sendTestFn({ data: { instance_id: instance.id, to_phone: to, body: testBody.trim() } });
      toast.success("Mensagem de teste enviada!");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar teste.");
    } finally {
      setSendingTest(false);
    }
  }


  return (
    <PageContainer>
      <SectionHeader
        title="WhatsApp da empresa"
        subtitle="Conecte seu WhatsApp para enviar cobranças e mensagens automáticas."
      />

      {!companyId && !bootError && (
        <Card className="p-4 mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Preparando empresa…
        </Card>
      )}

      {bootError && (
        <Card className="p-4 mt-4 text-sm text-rose-700">
          {bootError}
        </Card>
      )}

      {companyId && !instance && (
        <Card className="p-4 mt-4 space-y-4">
          {brokenConnection && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700">
              A conexão anterior não existe mais na Evolution. Recrie a conexão para gerar um QR real.
            </div>
          )}
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

          <Tabs value={mode} onValueChange={(v) => setMode(v as "qr" | "pairing")}>
            <TabsList className="grid grid-cols-2 w-full sm:w-auto">
              <TabsTrigger value="qr">
                <QrCode className="w-4 h-4 mr-2" /> QR Code
              </TabsTrigger>
              <TabsTrigger value="pairing">
                <KeyRound className="w-4 h-4 mr-2" /> Código
              </TabsTrigger>
            </TabsList>

            <TabsContent value="qr" className="mt-3 space-y-2">
              <p className="text-sm text-muted-foreground">
                Vamos gerar um QR Code para escanear no app do WhatsApp.
              </p>
            </TabsContent>

            <TabsContent value="pairing" className="mt-3 space-y-2">
              <Label htmlFor="phone">Número do WhatsApp (com DDI e DDD)</Label>
              <Input
                id="phone"
                inputMode="tel"
                placeholder="5511999998888"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(digitsOnly(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Geramos um código de 8 dígitos para digitar no celular em
                <strong> Aparelhos conectados → Conectar com número de telefone</strong>.
              </p>
            </TabsContent>
          </Tabs>

          <Button onClick={handleConnect} disabled={busy} className="w-full sm:w-auto">
            {busy ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : mode === "qr" ? (
              <QrCode className="w-4 h-4 mr-2" />
            ) : (
              <KeyRound className="w-4 h-4 mr-2" />
            )}
            {brokenConnection
              ? "Recriar conexão"
              : mode === "qr"
              ? "Gerar QR Code"
              : "Gerar código de pareamento"}
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

            {instance.status === "awaiting_qr" && (
              <Tabs defaultValue={instance.pairing_code ? "pairing" : "qr"}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="qr">
                    <QrCode className="w-4 h-4 mr-2" /> QR Code
                  </TabsTrigger>
                  <TabsTrigger value="pairing">
                    <KeyRound className="w-4 h-4 mr-2" /> Código
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="qr" className="mt-3">
                  {instance.qr_code ? (
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
                        WhatsApp &gt; Aparelhos conectados &gt; Conectar aparelho.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground text-center">
                      QR ainda não disponível. Clique em <strong>Atualizar</strong>.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="pairing" className="mt-3 space-y-3">
                  {instance.pairing_code ? (
                    <div className="rounded-md border p-4 bg-muted/30 text-center space-y-1">
                      <div className="text-xs text-muted-foreground">Seu código</div>
                      <div className="text-3xl font-mono font-semibold tracking-widest">
                        {formatPairing(instance.pairing_code)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        WhatsApp &gt; Aparelhos conectados &gt; Conectar com número.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="phone2">Número (DDI + DDD + número)</Label>
                      <Input
                        id="phone2"
                        inputMode="tel"
                        placeholder="5511999998888"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(digitsOnly(e.target.value))}
                      />
                      <Button
                        size="sm"
                        onClick={() => handleReconnect(true)}
                        disabled={busy}
                      >
                        <KeyRound className="w-4 h-4 mr-2" /> Gerar código
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
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
              <Button variant="outline" size="sm" onClick={() => handleReconnect(false)} disabled={busy}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar QR
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
