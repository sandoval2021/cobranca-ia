import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Server, Activity, AlertTriangle, CheckCircle2, AlertCircle, ListChecks } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listVpsNodes } from "@/lib/whatsapp/whatsapp.functions";

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

function AdminVpsPage() {
  const fn = useServerFn(listVpsNodes);
  const q = useQuery({
    queryKey: ["vps-nodes"],
    queryFn: () => fn(),
    refetchInterval: 15000,
  });

  if (q.isLoading) {
    return (
      <PageContainer>
        <SectionHeader icon={Server} title="VPS Evolution" subtitle="Status da infraestrutura" />
        <p className="text-sm text-muted-foreground mt-4">Carregando…</p>
      </PageContainer>
    );
  }

  if (q.error) {
    return (
      <PageContainer>
        <SectionHeader icon={Server} title="VPS Evolution" subtitle="Status da infraestrutura" />
        <Card className="p-4 mt-4">
          <div className="flex items-center gap-2 text-sm text-rose-700">
            <AlertCircle className="w-4 h-4" />
            Acesso restrito a Super Admin.
          </div>
        </Card>
      </PageContainer>
    );
  }

  const data = q.data;
  const nodes = data?.nodes ?? [];

  return (
    <PageContainer>
      <SectionHeader icon={Server} title="VPS Evolution" subtitle="Status da infraestrutura WhatsApp" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">VPS ativas</div>
          <div className="text-2xl font-semibold">{nodes.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Instâncias</div>
          <div className="text-2xl font-semibold">
            {nodes.reduce((s, n: any) => s + (n.instance_count ?? 0), 0)}
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
          <Card className="p-4 col-span-full">
            <p className="text-sm text-muted-foreground">Nenhuma VPS cadastrada ainda.</p>
          </Card>
        )}
        {nodes.map((n: any) => {
          const h = healthLabel[n.health] ?? { text: n.health, cls: "bg-muted" };
          return (
            <Card key={n.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    <Server className="w-4 h-4" /> {n.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{n.base_url}</div>
                </div>
                <Badge className={`border ${h.cls}`}>{h.text}</Badge>
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
            </Card>
          );
        })}
      </div>
    </PageContainer>
  );
}
