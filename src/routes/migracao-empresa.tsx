import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Database,
  Download,
  History,
  Info,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useLocalAuth } from "@/lib/use-local-auth";
import {
  COMPANIES_EVENT,
  getCompanyById,
  listCompanies,
} from "@/lib/companies";
import {
  assignRecordsToCompany,
  exportCompanyScopeReport,
  getMigrationPreview,
  listMigrationHistory,
  saveMigrationHistoryEntry,
  type MigrationPreviewItem,
} from "@/lib/company-scope";
import { getCurrentLocalUser } from "@/lib/local-auth";

export const Route = createFileRoute("/migracao-empresa")({
  component: MigracaoEmpresaPage,
});

function MigracaoEmpresaPage() {
  const { isSuperAdmin } = useLocalAuth();
  if (!isSuperAdmin) {
    return (
      <PageContainer>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <ShieldAlert className="mb-1 inline h-4 w-4" /> Esta área é exclusiva do Admin do sistema.
        </div>
      </PageContainer>
    );
  }
  return <MigracaoContent />;
}

function MigracaoContent() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const r = () => setTick((n) => n + 1);
    window.addEventListener(COMPANIES_EVENT, r);
    window.addEventListener("storage", r);
    return () => {
      window.removeEventListener(COMPANIES_EVENT, r);
      window.removeEventListener("storage", r);
    };
  }, []);

  const companies = useMemo(() => listCompanies(), []);
  const [companyId, setCompanyId] = useState<string>(companies[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [observacao, setObservacao] = useState("");
  const preview = useMemo<MigrationPreviewItem[]>(() => getMigrationPreview(), []);
  const [history, setHistory] = useState(() => listMigrationHistory());

  const company = getCompanyById(companyId);

  function toggle(k: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function handleApply() {
    if (!company) return toast.error("Selecione uma empresa.");
    if (selected.size === 0) return toast.error("Selecione ao menos um módulo.");
    const confirmMsg = `Vincular dados locais à empresa "${company.nome}"? Confirme que escolheu a empresa correta.`;
    if (!window.confirm(confirmMsg)) return;
    const results: { key: string; label: string; updated: number; total: number }[] = [];
    for (const item of preview) {
      if (!selected.has(item.key)) continue;
      const { updated, total } = assignRecordsToCompany(item.key, company.id, { onlyUnscoped: true });
      results.push({ key: item.key, label: item.label, updated, total });
    }
    const entry = saveMigrationHistoryEntry({
      company_id: company.id,
      company_nome: company.nome,
      user_email: getCurrentLocalUser()?.email,
      modules: results,
      observacao: observacao.trim() || undefined,
    });
    setHistory((h) => [entry, ...h]);
    setSelected(new Set());
    setObservacao("");
    toast.success(`Vinculação concluída: ${results.reduce((a, r) => a + r.updated, 0)} registro(s).`);
  }

  function handleExportReport() {
    const txt = exportCompanyScopeReport();
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `escopo-empresa-cobranca-ia-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalSem = preview.reduce((a, p) => a + p.sem_empresa, 0);
  const totalCom = preview.reduce((a, p) => a + p.com_empresa, 0);

  return (
    <PageContainer>
      <SectionHeader
        title="Migração Empresa"
        subtitle="Vincule dados locais antigos a uma empresa antes de migrar para backend real."
        hint="Apenas Super Admin. Modo local."
      />

      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
        <Info className="mr-1 inline h-3.5 w-3.5" />
        Esta etapa é local. Não cria backend, não altera Supabase e não garante isolamento real sem RLS.
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <Stat label="Sem empresa" value={totalSem} tone="bg-amber-50" />
        <Stat label="Com empresa" value={totalCom} tone="bg-emerald-50" />
        <Stat label="Empresas" value={companies.length} />
      </div>

      <div className="mb-3 rounded-xl border bg-card p-3 shadow-sm">
        <Label className="text-xs">Empresa destino</Label>
        <Select value={companyId} onValueChange={setCompanyId}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Selecione uma empresa" />
          </SelectTrigger>
          <SelectContent>
            {companies.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                Cadastre uma empresa em <Link to="/empresas" className="underline">/empresas</Link>.
              </div>
            )}
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {company && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Dono: {company.dono_nome} · {company.dono_email}
          </p>
        )}
      </div>

      <div className="mb-3 space-y-2">
        {preview.map((p) => {
          const isSelected = selected.has(p.key);
          const risk = p.globalByDefault
            ? "Dados normalmente globais (admin). Confirme antes de vincular."
            : p.sem_empresa > 0
              ? "Se escolher empresa errada, dados podem aparecer no painel errado localmente."
              : "Tudo já vinculado.";
          return (
            <label
              key={p.key}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-3 shadow-sm",
                isSelected && "border-primary",
                p.sem_empresa === 0 && "opacity-70",
              )}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={p.sem_empresa === 0}
                onChange={() => toggle(p.key)}
                className="mt-1 h-4 w-4"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-sm font-semibold">{p.label}</p>
                  {p.globalByDefault && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-900">
                      global por padrão
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Total: {p.total} · com empresa: {p.com_empresa} · sem empresa: {p.sem_empresa}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">{risk}</p>
              </div>
            </label>
          );
        })}
      </div>

      <div className="mb-3 rounded-xl border bg-card p-3 shadow-sm">
        <Label className="text-xs">Observação (opcional)</Label>
        <Textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          rows={2}
          placeholder="Anote o motivo desta vinculação"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button onClick={handleApply} disabled={!company || selected.size === 0}>
          <ArrowRight className="h-4 w-4" />
          Confirmar vinculação
        </Button>
        <Button variant="outline" onClick={handleExportReport}>
          <Download className="h-4 w-4" />
          Exportar relatório
        </Button>
        <Link to="/preparacao-backend">
          <Button variant="outline">
            <Database className="h-4 w-4" />
            Preparação Backend
          </Button>
        </Link>
      </div>

      <SectionHeader title="Histórico local" subtitle="Últimas vinculações realizadas neste navegador" />
      {history.length === 0 ? (
        <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
          <History className="mx-auto mb-1 h-4 w-4" />
          Sem migrações registradas.
        </div>
      ) : (
        <ul className="space-y-2">
          {history.map((h) => (
            <li key={h.id} className="rounded-xl border bg-card p-3 text-sm shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-semibold">{h.company_nome ?? h.company_id}</p>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(h.at).toLocaleString()}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Por: {h.user_email ?? "—"} · Módulos: {h.modules.length}
              </p>
              <ul className="mt-1 space-y-0.5">
                {h.modules.map((m) => (
                  <li key={m.key} className="text-[11px] text-muted-foreground">
                    • {m.label}: {m.updated}/{m.total} registro(s) vinculado(s)
                  </li>
                ))}
              </ul>
              {h.observacao && (
                <p className="mt-1 rounded bg-surface-muted p-2 text-[11px]">{h.observacao}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className={cn("rounded-lg border bg-card p-2 text-center", tone)}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}
