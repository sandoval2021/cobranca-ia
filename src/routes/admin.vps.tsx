import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  Server,
  Activity,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ListChecks,
  Plus,
  Pencil,
  Wifi,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listVpsNodes,
  createVpsNode,
  updateVpsNode,
  probeVpsNode,
} from "@/lib/whatsapp/whatsapp.functions";
import { useLocalAuth } from "@/lib/use-local-auth";

export const Route = createFileRoute("/admin/vps")({
  component: AdminVpsPage,
  head: () => ({ meta: [{ title: "VPS — Super Admin" }] }),
});

const healthLabel: Record<string, { text: string; cls: string }> = {
  healthy: { text: "Saudável", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  attention: { text: "Atenção", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  upgrade_recommended: { text: "Upgrade recomendado", cls: "bg-orange-500/15 text-orange-700 border-orange-500/30" },
  upgrade_urgent: { text: "Upgrade urgente", cls: "bg-rose-500/15 text-rose-700 border-rose-500/30" },
};

function fmtPct(v: number | null | undefined) {
  if (v == null) return "—";
  return `${Math.round(Number(v))}%`;
}
function fmtUptime(sec: number | null | undefined) {
  if (!sec) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
}

type VpsRow = {
  id: string;
  name: string;
  base_url: string;
  health: string;
  cpu_pct: number | null;
  ram_pct: number | null;
  disk_pct: number | null;
  uptime_seconds: number | null;
  max_instances: number;
  is_active: boolean;
  instance_count: number;
};

type EditState =
  | { mode: "create" }
  | { mode: "edit"; row: VpsRow }
  | null;

function VpsDialog({
  state,
  onClose,
  onSaved,
}: {
  state: EditState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const create = useServerFn(createVpsNode);
  const update = useServerFn(updateVpsNode);
  const isEdit = state?.mode === "edit";

  const [name, setName] = useState(isEdit ? state.row.name : "");
  const [baseUrl, setBaseUrl] = useState(isEdit ? state.row.base_url : "");
  const [apiToken, setApiToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [maxInst, setMaxInst] = useState(isEdit ? state.row.max_instances : 50);
  const [isActive, setIsActive] = useState(isEdit ? state.row.is_active : true);
  const [saving, setSaving] = useState(false);

  if (!state) return null;

  async function handleSave() {
    if (!name.trim() || !baseUrl.trim()) {
      toast.error("Nome e URL são obrigatórios");
      return;
    }
    if (!isEdit && (apiToken.length < 8 || webhookSecret.length < 8)) {
      toast.error("Informe token e secret (mín. 8 caracteres)");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await update({
          data: {
            id: state.row.id,
            name,
            base_url: baseUrl,
            ...(apiToken ? { api_token: apiToken } : {}),
            ...(webhookSecret ? { webhook_secret: webhookSecret } : {}),
            max_instances: Number(maxInst),
            is_active: isActive,
          },
        });
        toast.success("VPS atualizada");
      } else {
        await create({
          data: {
            name,
            base_url: baseUrl,
            api_token: apiToken,
            webhook_secret: webhookSecret,
            max_instances: Number(maxInst),
            is_active: isActive,
          },
        });
        toast.success("VPS cadastrada");
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar VPS" : "Cadastrar nova VPS"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VPS Principal" />
          </div>
          <div>
            <Label>URL base</Label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://evolution.suaempresa.com"
              inputMode="url"
            />
          </div>
          <div>
            <Label>API Token {isEdit && <span className="text-xs text-muted-foreground">(deixe vazio para manter)</span>}</Label>
            <Input
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder={isEdit ? "•••••••• (oculto)" : "token da Evolution"}
              autoComplete="off"
            />
          </div>
          <div>
            <Label>Webhook Secret {isEdit && <span className="text-xs text-muted-foreground">(deixe vazio para manter)</span>}</Label>
            <Input
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder={isEdit ? "•••••••• (oculto)" : "segredo HMAC"}
              autoComplete="off"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Máx. instâncias</Label>
              <Input
                type="number"
                min={1}
                max={500}
                value={maxInst}
                onChange={(e) => setMaxInst(Number(e.target.value))}
              />
            </div>
            <div className="flex items-end gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} id="active" />
              <Label htmlFor="active">Ativa</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdminVpsPage() {
  const { isSuperAdmin } = useLocalAuth();
  const fn = useServerFn(listVpsNodes);
  const probe = useServerFn(probeVpsNode);
  const qc = useQueryClient();
  const [edit, setEdit] = useState<EditState>(null);

  if (!isSuperAdmin) {
    return (
      <PageContainer>
        <Card className="p-6 text-center">
          <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Acesso restrito</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Apenas Super Admin pode configurar VPS. Donos de conta não têm acesso a esta área.
          </p>
        </Card>
      </PageContainer>
    );
  }

  const q = useQuery({
    queryKey: ["vps-nodes"],
    queryFn: () => fn(),
    refetchInterval: 15000,
  });

  const probeMut = useMutation({
    mutationFn: (id: string) => probe({ data: { id } }),
    onSuccess: (res: any) => {
      if (res?.ok) {
        toast.success("VPS respondendo OK");
      } else {
        const status = res?.status ?? 0;
        const reason = res?.error ? String(res.error) : "";
        const hint =
          status === 0
            ? "Não foi possível conectar (DNS, TLS, URL inválida, servidor offline ou bloqueado)."
            : status === 401 || status === 403
              ? "API Token inválido ou sem permissão."
              : status === 404
                ? "URL base não responde no endpoint /instance/fetchInstances."
                : `HTTP ${status}.`;
        toast.error(`VPS sem resposta: ${hint}${reason ? ` Detalhe: ${reason}` : ""}`, {
          duration: 8000,
        });
        console.error("[probeVpsNode]", res);
      }
      qc.invalidateQueries({ queryKey: ["vps-nodes"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha no probe"),
  });

  useEffect(() => {
    const msg = String((q.error as Error | null)?.message ?? "");
    if (!/Unauthorized:\s*Invalid token|invalid (JWT|token)|bad_jwt/i.test(msg)) return;

    let cancelled = false;
    async function recoverAuth() {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // ignore
      }
      if (!cancelled) window.location.replace("/?auth=expired");
    }
    void recoverAuth();
    return () => {
      cancelled = true;
    };
  }, [q.error]);

  if (q.isLoading) {
    return (
      <PageContainer>
        <SectionHeader title="VPS Evolution" subtitle="Status da infraestrutura" />
        <p className="text-sm text-muted-foreground mt-4">Carregando…</p>
      </PageContainer>
    );
  }

  if (q.error) {
    const msg = String((q.error as Error)?.message ?? q.error);
    const isForbidden = /forbidden/i.test(msg);
    const isAuth = /Unauthorized|Invalid token|No authorization/i.test(msg);

    async function claimSuperAdmin() {
      try {
        const { error } = await supabase.rpc("claim_super_admin_bootstrap");
        if (error) {
          if (/already_exists/i.test(error.message)) {
            toast.error("Já existe um Super Admin. Peça acesso a ele.");
          } else if (/not_authenticated/i.test(error.message)) {
            toast.error("Faça login antes.");
          } else {
            toast.error(error.message);
          }
          return;
        }
        toast.success("Você agora é Super Admin. Recarregando…");
        setTimeout(() => window.location.reload(), 600);
      } catch (e: any) {
        toast.error(e?.message ?? "Falha no bootstrap");
      }
    }

    return (
      <PageContainer>
        <SectionHeader title="VPS Evolution" subtitle="Status da infraestrutura" />
        <Card className="p-4 mt-4 space-y-3">
          <div className="flex items-start gap-2 text-sm text-rose-700">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="min-w-0">
              {isForbidden
                ? "Sua conta autenticada não tem papel de Super Admin no banco."
                : isAuth
                  ? "Sessão expirada. Faça login novamente."
                  : "Não foi possível carregar a lista de VPS."}
              <div className="text-xs text-muted-foreground mt-1 break-words">{msg}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => q.refetch()}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Tentar novamente
            </Button>
            {isForbidden && (
              <Button size="sm" onClick={claimSuperAdmin}>
                <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Tornar-me Super Admin (bootstrap inicial)
              </Button>
            )}
          </div>
          {isForbidden && (
            <p className="text-xs text-muted-foreground">
              O botão acima só funciona se ainda <strong>não existir</strong> nenhum Super Admin no sistema. Após o primeiro uso, ele recusa qualquer nova tentativa.
            </p>
          )}
        </Card>
      </PageContainer>
    );
  }

  const data = q.data;
  const nodes: VpsRow[] = (data?.nodes ?? []) as VpsRow[];

  return (
    <PageContainer>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <SectionHeader title="VPS Evolution" subtitle="Status da infraestrutura WhatsApp" />
        <Button onClick={() => setEdit({ mode: "create" })} size="sm" className="shrink-0">
          <Plus className="w-4 h-4 mr-1" /> Nova VPS
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">VPS ativas</div>
          <div className="text-2xl font-semibold">{nodes.filter((n) => n.is_active).length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Instâncias</div>
          <div className="text-2xl font-semibold">
            {nodes.reduce((s, n) => s + (n.instance_count ?? 0), 0)}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <ListChecks className="w-3 h-3" /> Fila pendente
          </div>
          <div className="text-2xl font-semibold">{data?.queueTotal ?? 0}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Falhas
          </div>
          <div className="text-2xl font-semibold">{data?.errorsTotal ?? 0}</div>
        </Card>
      </div>

      <div className="grid gap-3 mt-4 md:grid-cols-2">
        {nodes.length === 0 && (
          <Card className="p-6 col-span-full text-center">
            <p className="text-sm text-muted-foreground mb-3">Nenhuma VPS cadastrada ainda.</p>
            <Button onClick={() => setEdit({ mode: "create" })} size="sm">
              <Plus className="w-4 h-4 mr-1" /> Cadastrar primeira VPS
            </Button>
          </Card>
        )}
        {nodes.map((n) => {
          const h = healthLabel[n.health] ?? { text: n.health, cls: "bg-muted" };
          return (
            <Card key={n.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium flex items-center gap-2 truncate">
                    <Server className="w-4 h-4 shrink-0" /> <span className="truncate">{n.name}</span>
                    {!n.is_active && (
                      <Badge variant="outline" className="ml-1 text-xs">Inativa</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{n.base_url}</div>
                </div>
                <Badge className={`border shrink-0 ${h.cls}`}>{h.text}</Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-muted/40 p-2">
                  <div className="text-xs text-muted-foreground">CPU</div>
                  <div className="font-semibold">{fmtPct(n.cpu_pct)}</div>
                </div>
                <div className="rounded-md bg-muted/40 p-2">
                  <div className="text-xs text-muted-foreground">RAM</div>
                  <div className="font-semibold">{fmtPct(n.ram_pct)}</div>
                </div>
                <div className="rounded-md bg-muted/40 p-2">
                  <div className="text-xs text-muted-foreground">Disco</div>
                  <div className="font-semibold">{fmtPct(n.disk_pct)}</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Activity className="w-3 h-3" /> Uptime {fmtUptime(n.uptime_seconds)}
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {n.instance_count}/{n.max_instances} instâncias
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => setEdit({ mode: "edit", row: n })}>
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => probeMut.mutate(n.id)}
                  disabled={probeMut.isPending}
                >
                  <Wifi className="w-3.5 h-3.5 mr-1" /> Testar conexão
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <VpsDialog
        state={edit}
        onClose={() => setEdit(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["vps-nodes"] })}
      />
    </PageContainer>
  );
}
