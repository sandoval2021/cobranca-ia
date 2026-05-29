import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ListChecks,
  RefreshCcw,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  HelpCircle,
  Search,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  listWhatsAppQueue,
  listRenewalQueue,
  getQueueCounts,
  reprocessWhatsAppMessage,
  reprocessRenewalTask,
} from "@/lib/queue-ops/queue-ops.functions";
import { ensureMyCompany } from "@/lib/whatsapp/whatsapp.functions";

export const Route = createFileRoute("/operacao-filas")({
  component: OperacaoFilasPage,
  head: () => ({ meta: [{ title: "Operação · Filas — CobraEasy" }] }),
});

type WaView =
  | "todos"
  | "aguardando"
  | "enviando"
  | "enviado"
  | "falhou"
  | "incerto"
  | "travado";

const WA_TABS: { key: WaView; label: string }[] = [
  { key: "aguardando", label: "Aguardando envio" },
  { key: "enviando", label: "Enviando" },
  { key: "travado", label: "Travado" },
  { key: "incerto", label: "Envio incerto" },
  { key: "falhou", label: "Falhou" },
  { key: "enviado", label: "Enviado" },
];

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function maskPhone(p: string): string {
  const d = p.replace(/\D/g, "");
  if (d.length < 6) return p;
  return d.slice(0, 2) + " " + d.slice(2, 4) + " ****-" + d.slice(-4);
}

function OperacaoFilasPage() {
  const queryClient = useQueryClient();
  const ensureCompanyFn = useServerFn(ensureMyCompany);
  const listWaFn = useServerFn(listWhatsAppQueue);
  const listRenewalFn = useServerFn(listRenewalQueue);
  const getCountsFn = useServerFn(getQueueCounts);
  const reprocessWaFn = useServerFn(reprocessWhatsAppMessage);
  const reprocessRenewalFn = useServerFn(reprocessRenewalTask);

  const [view, setView] = useState<WaView>("aguardando");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [confirmUncertain, setConfirmUncertain] = useState<string | null>(null);
  const PAGE_SIZE = 25;

  const companyQ = useQuery({
    queryKey: ["operacao-filas-company"],
    queryFn: () => ensureCompanyFn(),
  });
  const companyId = companyQ.data?.company_id as string | undefined;

  const countsQ = useQuery({
    queryKey: ["queue-counts", companyId],
    queryFn: () => getCountsFn({ data: { company_id: companyId! } }),
    enabled: Boolean(companyId),
    refetchInterval: 30_000,
  });

  const waQ = useQuery({
    queryKey: ["wa-queue", companyId, view, page, search],
    queryFn: () =>
      listWaFn({
        data: {
          company_id: companyId!,
          view,
          page,
          page_size: PAGE_SIZE,
          search: search || undefined,
        },
      }),
    enabled: Boolean(companyId),
  });

  const renewalQ = useQuery({
    queryKey: ["renewal-queue", companyId],
    queryFn: () =>
      listRenewalFn({
        data: { company_id: companyId!, view: "pendente", page: 1, page_size: 10 },
      }),
    enabled: Boolean(companyId),
  });

  const reprocessMut = useMutation({
    mutationFn: (args: { id: string; confirm_uncertain: boolean }) =>
      reprocessWaFn({
        data: {
          company_id: companyId!,
          id: args.id,
          confirm_uncertain: args.confirm_uncertain,
        },
      }),
    onSuccess: () => {
      toast.success("Mensagem reenfileirada.");
      queryClient.invalidateQueries({ queryKey: ["wa-queue"] });
      queryClient.invalidateQueries({ queryKey: ["queue-counts"] });
      setConfirmUncertain(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao reprocessar."),
  });

  const reprocessRenewalMut = useMutation({
    mutationFn: (id: string) =>
      reprocessRenewalFn({ data: { company_id: companyId!, id } }),
    onSuccess: () => {
      toast.success("Renovação reenfileirada.");
      queryClient.invalidateQueries({ queryKey: ["renewal-queue"] });
      queryClient.invalidateQueries({ queryKey: ["queue-counts"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao reprocessar."),
  });

  const waCounts = countsQ.data?.whatsapp;
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((waQ.data?.total ?? 0) / PAGE_SIZE)),
    [waQ.data?.total],
  );

  return (
    <PageContainer>
      <SectionHeader
        title="Operação · Filas"
        subtitle="Acompanhe envios, falhas e renovações pendentes"
        hint="Mensagens com envio incerto precisam de confirmação antes de reenviar."
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6 mb-4">
        {WA_TABS.map((t) => {
          const n =
            (waCounts as any)?.[t.key === "incerto" ? "incerto" : t.key] ?? 0;
          const active = view === t.key;
          return (
            <button
              key={t.key}
              onClick={() => {
                setView(t.key);
                setPage(1);
              }}
              className={
                "rounded-xl border p-3 text-left transition " +
                (active
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50")
              }
            >
              <div className="text-xs text-muted-foreground">{t.label}</div>
              <div className="mt-1 text-lg font-semibold">{n}</div>
            </button>
          );
        })}
      </div>

      <Card className="p-3 mb-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="flex items-center gap-2 flex-1">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por telefone (apenas números)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["wa-queue"] });
              queryClient.invalidateQueries({ queryKey: ["queue-counts"] });
            }}
          >
            <RefreshCcw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        {waQ.isLoading && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Carregando...
          </Card>
        )}
        {!waQ.isLoading && (waQ.data?.items.length ?? 0) === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Nada para exibir nesta categoria.
          </Card>
        )}
        {(waQ.data?.items ?? []).map((m) => (
          <Card key={m.id} className="p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge view={m.view} />
                  <span className="text-sm font-medium">{maskPhone(m.to_phone)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {m.preview}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span>Criada: {fmtDate(m.created_at)}</span>
                  {m.next_attempt_at && (
                    <span>Próxima tentativa: {fmtDate(m.next_attempt_at)}</span>
                  )}
                  <span>
                    Tentativas: {m.attempts}/{m.max_attempts}
                  </span>
                  {m.sent_at && <span>Enviada: {fmtDate(m.sent_at)}</span>}
                </div>
                {m.last_error && (
                  <p className="mt-1 text-[11px] text-danger">
                    Último erro: {m.last_error}
                  </p>
                )}
              </div>
              <div className="shrink-0">
                {m.view === "enviado" && (
                  <span className="text-[11px] text-success">Concluída</span>
                )}
                {m.can_reprocess && !m.is_uncertain && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      reprocessMut.mutate({ id: m.id, confirm_uncertain: false })
                    }
                  >
                    Reprocessar
                  </Button>
                )}
                {m.can_reprocess && m.is_uncertain && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmUncertain(m.id)}
                  >
                    <ShieldAlert className="h-3 w-3 mr-1" /> Reenviar com cautela
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {(waQ.data?.total ?? 0) > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-muted-foreground">
            Página {page} de {totalPages} · {waQ.data?.total ?? 0} no total
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}

      <div className="mt-8">
        <SectionHeader
          title="Renovações pendentes"
          subtitle="Tarefas de renovação que aguardam processamento"
        />
        <div className="space-y-2">
          {(renewalQ.data?.items ?? []).length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma renovação pendente.
            </Card>
          )}
          {(renewalQ.data?.items ?? []).map((t) => (
            <Card key={t.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{t.kind}</Badge>
                    <span className="text-sm font-medium">
                      {t.customer_name ?? "Cliente"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    <span>Criada: {fmtDate(t.created_at)}</span>
                    <span>
                      Tentativas: {t.attempts}/{t.max_attempts}
                    </span>
                  </div>
                  {t.last_error && (
                    <p className="mt-1 text-[11px] text-danger">
                      Último erro: {t.last_error}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => reprocessRenewalMut.mutate(t.id)}
                >
                  Reprocessar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <AlertDialog
        open={Boolean(confirmUncertain)}
        onOpenChange={(o) => !o && setConfirmUncertain(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar reenvio</AlertDialogTitle>
            <AlertDialogDescription>
              Essa mensagem pode já ter sido enviada ao cliente. Verifique com ele
              antes de reenviar para evitar mensagens duplicadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                confirmUncertain &&
                reprocessMut.mutate({
                  id: confirmUncertain,
                  confirm_uncertain: true,
                })
              }
            >
              Confirmar reenvio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

function StatusBadge({ view }: { view: WaView }) {
  const map: Record<
    WaView,
    { label: string; icon: any; cls: string }
  > = {
    todos: { label: "Todos", icon: ListChecks, cls: "bg-muted text-muted-foreground" },
    aguardando: {
      label: "Aguardando",
      icon: Clock,
      cls: "bg-info-soft text-info",
    },
    enviando: { label: "Enviando", icon: RefreshCcw, cls: "bg-info-soft text-info" },
    enviado: {
      label: "Enviado",
      icon: CheckCircle2,
      cls: "bg-success-soft text-success",
    },
    falhou: { label: "Falhou", icon: XCircle, cls: "bg-danger-soft text-danger" },
    incerto: {
      label: "Envio incerto",
      icon: HelpCircle,
      cls: "bg-warning-soft text-warning",
    },
    travado: {
      label: "Travado",
      icon: AlertTriangle,
      cls: "bg-warning-soft text-warning",
    },
  };
  const s = map[view];
  const Icon = s.icon;
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium " +
        s.cls
      }
    >
      <Icon className="h-3 w-3" /> {s.label}
    </span>
  );
}
