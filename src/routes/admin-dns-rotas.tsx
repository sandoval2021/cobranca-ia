import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Globe2, Network, ShieldAlert, ListChecks, History, Server as ServerIcon,
  Plus, Pencil, Archive, Copy, ExternalLink, Download, Upload, AlertTriangle,
  CheckCircle2, Trash2,
} from "lucide-react";

import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";

import { useSecurityGuard } from "@/components/security/PinConfirmDialog";
import { ProtectedModeBadge } from "@/components/security/ProtectedModeBadge";

import {
  DNS_PROVIDERS, DOMAIN_STATUSES, DNS_RECORD_TYPES, DNS_ENVIRONMENTS,
  DNS_ROUTE_STATUSES, DNS_ROUTES_EVENT,
  type DnsDomain, type DnsRoute, type DnsRouteHistory,
  type DnsProvider, type DomainStatus, type DnsRecordType, type DnsEnvironment, type DnsRouteStatus,
  listDomains, saveDomain, updateDomain, archiveDomain,
  listDnsRoutes, saveDnsRoute, archiveDnsRoute, deleteDnsRoute, hasPrimaryConflict,
  listRouteHistory, computeRouteImpact,
  buildHost, buildServerPublicLink,
  exportDnsRoutes, parseDnsRoutesBackup, importDnsRoutes,
} from "@/lib/dns-routes";
import { listServers, type ServerEntry } from "@/lib/server-catalog";
import {
  hydrateDnsFromDb, pushDomainToDb, pushRouteToDb,
  removeDomainFromDb, removeRouteFromDb,
} from "@/lib/dns-routes-db";
import { getCurrentCompanyAdmin, ensureUserDefaultCompany } from "@/lib/rpc-admin";

export const Route = createFileRoute("/admin-dns-rotas")({
  head: () => ({
    meta: [
      { title: "DNS e Rotas — CobraEasy" },
      { name: "description", content: "Super Admin: domínios, subdomínios e rotas dos servidores (modo local)." },
    ],
  }),
  component: AdminDnsRotasPage,
});

const CHECKLIST_KEY = "cobranca_ia_dns_checklist_v1";

const CHECKLIST_ITEMS = [
  "Comprei o domínio",
  "Configurei nameservers (se usar Cloudflare)",
  "Criei registro DNS no provedor",
  "Apontei subdomínio para o destino correto",
  "Aguardei propagação DNS",
  "Testei o link no navegador",
  "Atualizei rota principal do servidor no painel",
  "Fiz backup antes de alterar rota",
];

function AdminDnsRotasPage() {
  const [domains, setDomains] = useState<DnsDomain[]>([]);
  const [routes, setRoutes] = useState<DnsRoute[]>([]);
  const [history, setHistory] = useState<DnsRouteHistory[]>([]);
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  // dialogs / sheets
  const [domainSheet, setDomainSheet] = useState<{ open: boolean; data?: DnsDomain | null }>({ open: false });
  const [routeSheet, setRouteSheet] = useState<{ open: boolean; data?: DnsRoute | null; defaultServerId?: string }>({ open: false });
  const [primaryConflict, setPrimaryConflict] = useState<{
    open: boolean;
    pendingSave?: () => void;
    existing?: DnsRoute | null;
  }>({ open: false });
  const [impactRoute, setImpactRoute] = useState<DnsRoute | null>(null);
  const [importPreview, setImportPreview] = useState<null | {
    raw: string;
    parsed: ReturnType<typeof parseDnsRoutesBackup>;
  }>(null);

  const { guard, dialog: securityDialog } = useSecurityGuard();

  const refresh = () => {
    setDomains(listDomains(true));
    setRoutes(listDnsRoutes(true));
    setHistory(listRouteHistory());
    setServers(listServers());
    try {
      const raw = localStorage.getItem(CHECKLIST_KEY);
      setChecklist(raw ? JSON.parse(raw) : {});
    } catch { setChecklist({}); }
  };

  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      let cid = (await getCurrentCompanyAdmin()).companyId;
      if (!cid) cid = (await ensureUserDefaultCompany()).companyId;
      if (!cid) return;
      setCompanyId(cid);
      try { await hydrateDnsFromDb(cid); } catch (e) { console.error("dns hydrate", e); }
      refresh();
    })();
    refresh();
    window.addEventListener(DNS_ROUTES_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(DNS_ROUTES_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // Dual-write helpers used by sheets/handlers below
  const persistDomain = async (d: DnsDomain) => {
    if (!companyId) { toast.error("Empresa não identificada."); return; }
    try { await pushDomainToDb(companyId, d); }
    catch (e: any) { toast.error("Falha ao salvar domínio no banco: " + (e?.message ?? e)); }
  };
  const persistRoute = async (r: DnsRoute) => {
    if (!companyId) { toast.error("Empresa não identificada."); return; }
    try { await pushRouteToDb(companyId, r); }
    catch (e: any) { toast.error("Falha ao salvar rota no banco: " + (e?.message ?? e)); }
  };
  const removeDomainDb = async (id: string) => { if (companyId) await removeDomainFromDb(companyId, id).catch(() => {}); };
  const removeRouteDb  = async (id: string) => { if (companyId) await removeRouteFromDb(companyId, id).catch(() => {}); };


  const activeDomains = domains.filter((d) => !d.archived);
  const activeRoutes = routes.filter((r) => !r.archived);

  const routesByServer = useMemo(() => {
    const map = new Map<string, DnsRoute[]>();
    for (const r of activeRoutes) {
      if (!r.server_id) continue;
      const arr = map.get(r.server_id) ?? [];
      arr.push(r);
      map.set(r.server_id, arr);
    }
    return map;
  }, [activeRoutes]);

  const handleSaveChecklist = (item: string, checked: boolean) => {
    const next = { ...checklist, [item]: checked };
    setChecklist(next);
    try { localStorage.setItem(CHECKLIST_KEY, JSON.stringify(next)); } catch { /* noop */ }
  };

  const copyText = async (txt: string) => {
    try { await navigator.clipboard.writeText(txt); toast.success("Copiado."); }
    catch { toast.error("Não foi possível copiar."); }
  };

  const handleExport = () => {
    guard({
      kind: "backup",
      title: "Exportar DNS e Rotas",
      description: "Vai gerar um arquivo local com domínios, rotas e histórico.",
      actionLabel: "Exportar",
      onConfirm: () => {
        const data = exportDnsRoutes();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const date = new Date().toISOString().slice(0, 10);
        const a = document.createElement("a");
        a.href = url;
        a.download = `dns-rotas-cobranca-ia-${date}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Backup local gerado.");
      },
    });
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || "");
      const parsed = parseDnsRoutesBackup(raw);
      setImportPreview({ raw, parsed });
    };
    reader.readAsText(file);
  };

  const performImport = (mode: "merge" | "replace") => {
    if (!importPreview || !importPreview.parsed.ok) return;
    const run = () => {
      const data = (importPreview.parsed as Extract<typeof importPreview.parsed, { ok: true }>).data;
      const res = importDnsRoutes(data, mode);
      toast.success(`Importado: ${res.domains} domínios, ${res.routes} rotas.`);
      setImportPreview(null);
      refresh();
    };
    if (mode === "replace") {
      guard({
        kind: "backup",
        title: "Substituir dados de DNS e Rotas",
        description: "Vai substituir domínios, rotas e histórico locais. Não pode ser desfeito.",
        actionLabel: "Substituir",
        onConfirm: run,
      });
    } else {
      run();
    }
  };

  return (
    <PageContainer>
      <SectionHeader
        title="DNS e Rotas"
        subtitle="Gerencie domínios, subdomínios e rotas dos servidores."
      />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Badge variant="secondary" className="bg-amber-100 text-amber-900 border-amber-200">
          <ShieldAlert className="h-3.5 w-3.5 mr-1" /> Super Admin
        </Badge>
        <ProtectedModeBadge />
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3 text-sm flex gap-2 mb-4">
        <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
        <p>
          <strong>Modo local:</strong> esta tela organiza as rotas, mas ainda não
          altera DNS real automaticamente. Nenhuma API de Cloudflare, Registro.br,
          Hostinger ou GoDaddy é chamada. <em>Apenas Super Admin deve usar esta tela.</em>
        </p>
      </div>

      {/* ============================== DOMÍNIOS ============================ */}
      <Card className="p-4 mb-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-semibold flex items-center gap-2">
            <Globe2 className="h-4 w-4" /> Domínios cadastrados
          </h3>
          <Button size="sm" onClick={() => setDomainSheet({ open: true, data: null })}>
            <Plus className="h-4 w-4 mr-1" /> Novo domínio
          </Button>
        </div>
        {domains.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum domínio cadastrado ainda.
          </p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {domains.map((d) => (
              <div
                key={d.id}
                className={`rounded-md border p-3 text-sm ${d.archived ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{d.domain}</p>
                    <p className="text-xs text-muted-foreground">
                      {DNS_PROVIDERS.find((p) => p.value === d.provider)?.label ?? d.provider}
                    </p>
                  </div>
                  <DomainStatusBadge status={d.status} archived={d.archived} />
                </div>
                {d.notes && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{d.notes}</p>}
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setDomainSheet({ open: true, data: d })}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                  {!d.archived && d.status !== "pausado" && (
                    <Button size="sm" variant="ghost" onClick={() => { updateDomain(d.id, { status: "pausado" }); refresh(); }}>
                      Pausar
                    </Button>
                  )}
                  {!d.archived && (
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => guard({
                        kind: "delete",
                        title: "Arquivar domínio",
                        actionLabel: "Arquivar",
                        onConfirm: () => { archiveDomain(d.id); refresh(); toast.success("Domínio arquivado."); },
                      })}
                    >
                      <Archive className="h-3.5 w-3.5 mr-1" /> Arquivar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ============================== ROTAS =============================== */}
      <Card className="p-4 mb-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-semibold flex items-center gap-2">
            <Network className="h-4 w-4" /> Rotas e subdomínios
          </h3>
          <Button size="sm" onClick={() => setRouteSheet({ open: true, data: null })} disabled={activeDomains.length === 0}>
            <Plus className="h-4 w-4 mr-1" /> Nova rota
          </Button>
        </div>
        {activeDomains.length === 0 && (
          <p className="text-xs text-muted-foreground">Cadastre um domínio primeiro.</p>
        )}
        {routes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma rota cadastrada.</p>
        ) : (
          <div className="space-y-2">
            {routes.map((r) => {
              const dom = domains.find((d) => d.id === r.domain_id);
              const srv = r.server_id ? servers.find((s) => s.id === r.server_id) : null;
              return (
                <div key={r.id} className={`rounded-md border p-3 text-sm ${r.archived ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.host || "(sem host)"}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.record_type} · {r.value || "—"} · {dom?.domain ?? "domínio?"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {r.is_primary && <Badge className="bg-emerald-100 text-emerald-900 border-emerald-200">Principal</Badge>}
                      {r.is_backup && <Badge variant="secondary">Reserva</Badge>}
                      <Badge variant="outline">{DNS_ENVIRONMENTS.find((e) => e.value === r.environment)?.label}</Badge>
                      <RouteStatusBadge status={r.status} />
                    </div>
                  </div>
                  {srv && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Servidor: <span style={{ color: srv.color }}>●</span> {srv.name}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setRouteSheet({ open: true, data: r })}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                    </Button>
                    {r.host && (
                      <Button size="sm" variant="ghost" onClick={() => copyText(r.host)}>
                        <Copy className="h-3.5 w-3.5 mr-1" /> Copiar host
                      </Button>
                    )}
                    {r.host && (
                      <Button size="sm" variant="ghost" asChild>
                        <a href={`https://${r.host}`} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir
                        </a>
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setImpactRoute(r)}>
                      Ver impacto
                    </Button>
                    {!r.archived && (
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => guard({
                          kind: "delete",
                          title: "Arquivar rota",
                          actionLabel: "Arquivar",
                          onConfirm: () => { archiveDnsRoute(r.id); refresh(); toast.success("Rota arquivada."); },
                        })}
                      >
                        <Archive className="h-3.5 w-3.5 mr-1" /> Arquivar
                      </Button>
                    )}
                    <Button
                      size="sm" variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => guard({
                        kind: "delete",
                        title: "Excluir rota definitivamente",
                        description: `Esta ação não pode ser desfeita. A rota ${r.host || ""} será removida permanentemente.`,
                        actionLabel: "Excluir",
                        onConfirm: () => { deleteDnsRoute(r.id); refresh(); toast.success("Rota excluída."); },
                      })}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                    </Button>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ========================= ROTAS POR SERVIDOR ======================= */}
      <Card className="p-4 mb-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <ServerIcon className="h-4 w-4" /> Rotas por servidor
        </h3>
        {servers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem servidores cadastrados.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {servers.filter((s) => s.status === "ativo").map((s) => {
              const arr = routesByServer.get(s.id) ?? [];
              const primary = arr.find((r) => r.is_primary);
              const backups = arr.filter((r) => !r.is_primary);
              const link = buildServerPublicLink(s.id);
              return (
                <div key={s.id} className="rounded-md border p-3 text-sm">
                  <p className="font-medium flex items-center gap-2">
                    <span style={{ color: s.color }}>●</span> {s.name}
                  </p>
                  {primary ? (
                    <p className="text-xs mt-1">
                      Principal: <span className="font-mono">{primary.host}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">Sem rota principal.</p>
                  )}
                  {backups.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Reservas: {backups.map((b) => b.host).join(", ")}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {primary ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRouteSheet({ open: true, data: primary })}
                        disabled={activeDomains.length === 0}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Editar rota / DNS
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRouteSheet({ open: true, data: null, defaultServerId: s.id })}
                        disabled={activeDomains.length === 0}
                        title={activeDomains.length === 0 ? "Cadastre um domínio antes de adicionar rota." : undefined}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar rota
                      </Button>
                    )}
                    {link && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => copyText(link)}>
                          <Copy className="h-3.5 w-3.5 mr-1" /> Copiar link
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <a href={link} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir
                          </a>
                        </Button>
                      </>
                    )}
                    {primary && (
                      <Button size="sm" variant="ghost" onClick={() => setImpactRoute(primary)}>
                        Ver impacto
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* =========================== HISTÓRICO ============================== */}
      <Card className="p-4 mb-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <History className="h-4 w-4" /> Histórico de alterações
        </h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem alterações registradas.</p>
        ) : (
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {history.slice(0, 50).map((h) => {
              const srv = h.server_id ? servers.find((s) => s.id === h.server_id) : null;
              return (
                <div key={h.id} className="text-xs border-l-2 border-border pl-2 py-1">
                  <p className="font-medium">{h.host || h.domain || "—"}</p>
                  <p className="text-muted-foreground">
                    {new Date(h.at).toLocaleString("pt-BR")}
                    {srv ? ` · ${srv.name}` : ""}
                    {h.status ? ` · ${h.status}` : ""}
                  </p>
                  {(h.old_value || h.new_value) && (
                    <p>
                      <span className="text-muted-foreground">{h.old_value || "—"}</span>
                      {" → "}
                      <span>{h.new_value || "—"}</span>
                    </p>
                  )}
                  {h.reason && <p className="text-muted-foreground">Motivo: {h.reason}</p>}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ============================= CHECKLIST ============================ */}
      <Card className="p-4 mb-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <ListChecks className="h-4 w-4" /> Checklist para configurar DNS real
        </h3>
        <p className="text-xs text-muted-foreground">
          Apenas visual/local. Use como guia ao configurar no provedor.
        </p>
        <div className="space-y-2">
          {CHECKLIST_ITEMS.map((item) => (
            <label key={item} className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={!!checklist[item]}
                onCheckedChange={(v) => handleSaveChecklist(item, !!v)}
              />
              <span>{item}</span>
            </label>
          ))}
        </div>
      </Card>

      {/* ========================== EXPORT/IMPORT =========================== */}
      <Card className="p-4 mb-8 space-y-3">
        <h3 className="font-semibold">Exportar / Importar</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" /> Exportar DNS e Rotas
          </Button>
          <label className="inline-flex">
            <Button size="sm" variant="outline" asChild>
              <span>
                <Upload className="h-4 w-4 mr-1" /> Importar
                <input
                  type="file" accept="application/json,.json" className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportFile(f);
                    e.target.value = "";
                  }}
                />
              </span>
            </Button>
          </label>
        </div>
      </Card>

      {securityDialog}

      <DomainSheet
        open={domainSheet.open}
        data={domainSheet.data ?? null}
        onClose={() => setDomainSheet({ open: false })}
        onSaved={() => { setDomainSheet({ open: false }); refresh(); }}
      />

      <RouteSheet
        open={routeSheet.open}
        data={routeSheet.data ?? null}
        defaultServerId={routeSheet.defaultServerId}
        domains={activeDomains}
        servers={servers}
        onClose={() => setRouteSheet({ open: false })}
        onSaved={() => { setRouteSheet({ open: false }); refresh(); }}
        onPrimaryConflict={(existing, doSave) => setPrimaryConflict({ open: true, existing, pendingSave: doSave })}
      />

      <AlertDialog open={primaryConflict.open} onOpenChange={(o) => { if (!o) setPrimaryConflict({ open: false }); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rota principal já existe</AlertDialogTitle>
            <AlertDialogDescription>
              Este servidor já possui uma rota principal
              {primaryConflict.existing?.host ? ` (${primaryConflict.existing.host})` : ""}.
              Deseja substituir?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              primaryConflict.pendingSave?.();
              setPrimaryConflict({ open: false });
            }}>Substituir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImpactDialog
        route={impactRoute}
        servers={servers}
        onClose={() => setImpactRoute(null)}
      />

      <ImportPreviewDialog
        preview={importPreview}
        onClose={() => setImportPreview(null)}
        onConfirm={performImport}
      />
    </PageContainer>
  );
}

// =============================== Helpers ==================================

function DomainStatusBadge({ status, archived }: { status: DomainStatus; archived?: boolean }) {
  if (archived) return <Badge variant="outline">Arquivado</Badge>;
  const map: Record<DomainStatus, string> = {
    ativo: "bg-emerald-100 text-emerald-900 border-emerald-200",
    em_configuracao: "bg-blue-100 text-blue-900 border-blue-200",
    pausado: "bg-slate-100 text-slate-800 border-slate-200",
    erro: "bg-red-100 text-red-900 border-red-200",
  };
  return (
    <Badge className={map[status]}>
      {DOMAIN_STATUSES.find((s) => s.value === status)?.label ?? status}
    </Badge>
  );
}

function RouteStatusBadge({ status }: { status: DnsRouteStatus }) {
  const map: Record<DnsRouteStatus, string> = {
    ativo: "bg-emerald-100 text-emerald-900 border-emerald-200",
    aguardando_dns: "bg-amber-100 text-amber-900 border-amber-200",
    manutencao: "bg-blue-100 text-blue-900 border-blue-200",
    erro: "bg-red-100 text-red-900 border-red-200",
    desativado: "bg-slate-100 text-slate-800 border-slate-200",
  };
  return (
    <Badge className={map[status]}>
      {DNS_ROUTE_STATUSES.find((s) => s.value === status)?.label ?? status}
    </Badge>
  );
}

// =============================== Domain Sheet =============================

function DomainSheet({
  open, data, onClose, onSaved,
}: {
  open: boolean; data: DnsDomain | null;
  onClose: () => void; onSaved: (d: DnsDomain) => void;
}) {
  const [domain, setDomain] = useState("");
  const [provider, setProvider] = useState<DnsProvider>("outro");
  const [status, setStatus] = useState<DomainStatus>("em_configuracao");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setDomain(data?.domain ?? "");
      setProvider(data?.provider ?? "outro");
      setStatus(data?.status ?? "em_configuracao");
      setNotes(data?.notes ?? "");
    }
  }, [open, data]);

  const handleSave = () => {
    const d = domain.trim();
    if (!d) { toast.error("Informe o domínio."); return; }
    const saved = saveDomain({ id: data?.id, domain: d, provider, status, notes });
    toast.success(data ? "Domínio atualizado." : "Domínio cadastrado.");
    onSaved(saved);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{data ? "Editar domínio" : "Novo domínio"}</SheetTitle>
          <SheetDescription>Cadastro local. Não altera DNS real.</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 py-3">
          <div>
            <Label>Domínio</Label>
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="meudominio.com.br" />
          </div>
          <div>
            <Label>Provedor DNS</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as DnsProvider)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DNS_PROVIDERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as DomainStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOMAIN_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// =============================== Route Sheet ==============================
function RouteSheet({
  open, data, defaultServerId, domains, servers, onClose, onSaved, onPrimaryConflict,
}: {
  open: boolean;
  data: DnsRoute | null;
  defaultServerId?: string;
  domains: DnsDomain[];
  servers: ServerEntry[];
  onClose: () => void;
  onSaved: (r: DnsRoute, replacedPrimary?: DnsRoute) => void;
  onPrimaryConflict: (existing: DnsRoute | null, doSave: () => void) => void;
}) {
  const [domainId, setDomainId] = useState<string>("");
  const [subdomain, setSubdomain] = useState("");
  const [serverId, setServerId] = useState<string>("");
  const [recordType, setRecordType] = useState<DnsRecordType>("CNAME");
  const [value, setValue] = useState("");
  const [environment, setEnvironment] = useState<DnsEnvironment>("producao");
  const [status, setStatus] = useState<DnsRouteStatus>("aguardando_dns");
  const [isPrimary, setIsPrimary] = useState(false);
  const [isBackup, setIsBackup] = useState(false);
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setDomainId(data?.domain_id ?? domains[0]?.id ?? "");
      setSubdomain(data?.subdomain ?? "");
      setServerId(data?.server_id ?? defaultServerId ?? "");
      setRecordType(data?.record_type ?? "CNAME");
      setValue(data?.value ?? "");
      setEnvironment(data?.environment ?? "producao");
      setStatus(data?.status ?? "aguardando_dns");
      setIsPrimary(data?.is_primary ?? (defaultServerId ? true : false));
      setIsBackup(data?.is_backup ?? false);
      setActive(data?.active ?? true);
      setNotes(data?.notes ?? "");
      setReason("");
    }
  }, [open, data, domains, defaultServerId]);

  const domain = domains.find((d) => d.id === domainId);
  const host = buildHost(subdomain, domain?.domain ?? "");

  const handleSave = () => {
    if (!domainId) { toast.error("Selecione um domínio."); return; }
    if (!value.trim()) { toast.error("Informe valor/destino."); return; }
    if (data && (data.value !== value.trim() || data.server_id !== serverId || data.is_primary !== isPrimary || data.status !== status) && !reason.trim()) {
      toast.error("Informe o motivo da alteração.");
      return;
    }

    const doSave = (force?: boolean) => {
      const { route, replacedPrimary } = saveDnsRoute(
        {
          id: data?.id,
          domain_id: domainId,
          subdomain: subdomain.trim(),
          server_id: serverId || undefined,
          record_type: recordType,
          value: value.trim(),
          environment,
          status,
          is_primary: isPrimary,
          is_backup: isBackup,
          active,
          notes,
        },
        { reason: reason || undefined, forcePrimaryReplace: force },
      );
      if (replacedPrimary) {
        toast.success(`Rota principal substituída: ${replacedPrimary.host}.`);
      }
      toast.success(data ? "Rota atualizada." : `Rota ${route.host} cadastrada.`);
      onSaved(route, replacedPrimary);
    };

    if (isPrimary && serverId) {
      const conflict = hasPrimaryConflict(serverId, data?.id);
      if (conflict) {
        onPrimaryConflict(conflict, () => doSave(true));
        return;
      }
    }
    doSave(false);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{data ? "Editar rota" : "Nova rota"}</SheetTitle>
          <SheetDescription>
            Vincule subdomínio ao servidor. Não altera DNS real.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 py-3">
          <div>
            <Label>Domínio</Label>
            <Select value={domainId} onValueChange={setDomainId}>
              <SelectTrigger><SelectValue placeholder="Escolha…" /></SelectTrigger>
              <SelectContent>
                {domains.map((d) => <SelectItem key={d.id} value={d.id}>{d.domain}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Subdomínio</Label>
            <Input value={subdomain} onChange={(e) => setSubdomain(e.target.value)} placeholder="lista" />
          </div>
          <div className="text-xs text-muted-foreground">
            Host: <span className="font-mono">{host || "—"}</span>
          </div>
          <div>
            <Label>Servidor vinculado</Label>
            <Select value={serverId || "_none_"} onValueChange={(v) => setServerId(v === "_none_" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none_">— sem servidor —</SelectItem>
                {servers.filter((s) => s.status === "ativo").map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Tipo</Label>
              <Select value={recordType} onValueChange={(v) => setRecordType(v as DnsRecordType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DNS_RECORD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ambiente</Label>
              <Select value={environment} onValueChange={(v) => setEnvironment(v as DnsEnvironment)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DNS_ENVIRONMENTS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Valor / destino</Label>
            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="ip, hostname ou CNAME" />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as DnsRouteStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DNS_ROUTE_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isPrimary} onCheckedChange={(v) => setIsPrimary(!!v)} />
              Rota principal
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isBackup} onCheckedChange={(v) => setIsBackup(!!v)} />
              Rota reserva
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={active} onCheckedChange={(v) => setActive(!!v)} />
              Ativa
            </label>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          {data && (
            <div>
              <Label>Motivo da alteração</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: Troca de servidor Lunar para rota alternativa." />
            </div>
          )}
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// =============================== Impact Dialog ============================

function ImpactDialog({
  route, servers, onClose,
}: {
  route: DnsRoute | null;
  servers: ServerEntry[];
  onClose: () => void;
}) {
  const open = !!route;
  if (!open || !route) return null;
  const impact = computeRouteImpact(route);
  const srv = route.server_id ? servers.find((s) => s.id === route.server_id) : null;

  const exportTxt = () => {
    const lines = [
      `Impacto da troca de rota`,
      `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
      ``,
      `Rota: ${route.host}`,
      `Servidor: ${srv?.name ?? "—"}`,
      `Valor atual: ${impact.currentValue || "—"}`,
      `Valor anterior: ${impact.previousValue || "—"}`,
      `Telas afetadas: ${impact.affectedScreens}`,
      `Clientes afetados: ${impact.affectedCustomers.length}`,
      ``,
      `IDs de clientes:`,
      ...impact.affectedCustomers.map((c) => `- ${c}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `impacto-rota-${route.host || "rota"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Impacto da troca de rota</AlertDialogTitle>
          <AlertDialogDescription>
            Quantas telas/clientes dependem do servidor desta rota.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1 text-sm">
          <p>Rota: <span className="font-mono">{route.host}</span></p>
          <p>Servidor: <strong>{srv?.name ?? "—"}</strong></p>
          <p>Telas afetadas: <strong>{impact.affectedScreens}</strong></p>
          <p>Clientes afetados: <strong>{impact.affectedCustomers.length}</strong></p>
          <p className="text-xs text-muted-foreground">
            Valor atual: {impact.currentValue || "—"} {impact.previousValue ? ` (antes: ${impact.previousValue})` : ""}
          </p>
        </div>
        <AlertDialogFooter>
          <Button variant="outline" onClick={exportTxt}>
            <Download className="h-4 w-4 mr-1" /> Exportar TXT
          </Button>
          <AlertDialogAction onClick={onClose}>Fechar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================ Import Preview ==============================

function ImportPreviewDialog({
  preview, onClose, onConfirm,
}: {
  preview: null | { raw: string; parsed: ReturnType<typeof parseDnsRoutesBackup> };
  onClose: () => void;
  onConfirm: (mode: "merge" | "replace") => void;
}) {
  const open = !!preview;
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Importar DNS e Rotas</AlertDialogTitle>
          <AlertDialogDescription>
            Revise o conteúdo antes de mesclar ou substituir.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {preview && (
          preview.parsed.ok ? (
            <div className="space-y-1 text-sm">
              <p className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Formato válido.
              </p>
              <p>Domínios: <strong>{preview.parsed.data.domains.length}</strong></p>
              <p>Rotas: <strong>{preview.parsed.data.routes.length}</strong></p>
              <p>Histórico: <strong>{preview.parsed.data.history.length}</strong></p>
            </div>
          ) : (
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> {preview.parsed.error}
            </p>
          )
        )}
        <AlertDialogFooter className="flex-wrap gap-2">
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button
            variant="outline"
            disabled={!preview?.parsed.ok}
            onClick={() => onConfirm("merge")}
          >
            Mesclar
          </Button>
          <Button
            variant="destructive"
            disabled={!preview?.parsed.ok}
            onClick={() => onConfirm("replace")}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Substituir
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
