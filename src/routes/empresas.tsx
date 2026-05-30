/**
 * H1.7 — /empresas backend-first.
 * Fonte oficial = RPCs Supabase. localStorage só como cache de boot.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  Archive,
  Loader2,
  Info,
} from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useLocalAuth } from "@/lib/use-local-auth";
import {
  BACKEND_ACTIVE_COMPANY_EVENT,
  BACKEND_ACTIVE_COMPANY_CACHE_KEY,
  archiveBackendCompany,
  createBackendCompanyAdmin,
  getBackendActiveCompany,
  getBackendCompanyEntitlements,
  listBackendCompanies,
  setBackendActiveCompany,
  updateBackendCompany,
  type BackendCompany,
  type BackendEntitlement,
} from "@/lib/companies-backend";

export const Route = createFileRoute("/empresas")({ component: EmpresasPage });

type EntCacheState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; plan_id: string | null; entitlements: BackendEntitlement[] }
  | { status: "error"; message: string };

function EmpresasPage() {
  const { isSuperAdmin } = useLocalAuth();
  const [companies, setCompanies] = useState<BackendCompany[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(BACKEND_ACTIVE_COMPANY_CACHE_KEY);
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<BackendCompany | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [entCache, setEntCache] = useState<Record<string, EntCacheState>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, active] = await Promise.all([
        listBackendCompanies(),
        getBackendActiveCompany(),
      ]);
      setCompanies(list);
      setActiveId(active);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível carregar empresas. Tente novamente.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const ensureEntitlements = useCallback(
    async (companyId: string) => {
      if (entCache[companyId]?.status === "loaded" || entCache[companyId]?.status === "loading") return;
      setEntCache((prev) => ({ ...prev, [companyId]: { status: "loading" } }));
      try {
        const res = await getBackendCompanyEntitlements(companyId);
        setEntCache((prev) => ({
          ...prev,
          [companyId]: { status: "loaded", plan_id: res.plan_id, entitlements: res.entitlements },
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Não foi possível ler o plano.";
        setEntCache((prev) => ({ ...prev, [companyId]: { status: "error", message: msg } }));
      }
    },
    [entCache],
  );

  const filtered = useMemo(() => {
    if (!companies) return [];
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => c.name.toLowerCase().includes(q));
  }, [companies, query]);

  async function handleSelect(c: BackendCompany) {
    setBusyId(c.id);
    try {
      await setBackendActiveCompany(c.id);
      setActiveId(c.id);
      toast.success(`Empresa ativa: ${c.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível selecionar esta empresa.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleArchive(c: BackendCompany) {
    if (!confirm(`Arquivar ${c.name}? Os dados não serão apagados.`)) return;
    setBusyId(c.id);
    try {
      await archiveBackendCompany(c.id);
      toast.success("Empresa arquivada.");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível arquivar.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <PageContainer>
      <SectionHeader
        title="Empresas cadastradas"
        subtitle="Lista oficial vinda do servidor. A empresa ativa controla o escopo dos seus dados."
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Input
            placeholder="Buscar empresa…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Atualizar
        </Button>
        {isSuperAdmin && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Nova empresa
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && !companies ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
          Carregando empresas…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          <Building2 className="mx-auto mb-2 h-5 w-5" />
          {companies && companies.length === 0
            ? "Nenhuma empresa disponível."
            : "Nenhuma empresa encontrada."}
        </div>
      ) : (
        <>
          {!activeId && companies && companies.length > 0 && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <Info className="mr-1 inline h-3.5 w-3.5" />
              Escolha uma empresa para continuar.
            </div>
          )}
          <ul className="space-y-2">
            {filtered.map((c) => {
              const isActive = activeId === c.id;
              const isArchived = !!c.archived_at;
              const ent = entCache[c.id];
              return (
                <li
                  key={c.id}
                  className={cn(
                    "rounded-xl border bg-card p-3 shadow-sm",
                    isActive && "border-primary",
                    isArchived && "opacity-70",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-semibold">{c.name}</p>
                        {isActive && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                            <CheckCircle2 className="h-3 w-3" /> Empresa ativa
                          </span>
                        )}
                        {isArchived && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Arquivada
                          </span>
                        )}
                      </div>

                      <div className="mt-1">
                        <EntitlementsSummary
                          state={ent}
                          onLoad={() => void ensureEntitlements(c.id)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {!isActive && !isArchived && (
                      <Button
                        size="sm"
                        onClick={() => void handleSelect(c)}
                        disabled={busyId === c.id}
                      >
                        {busyId === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Escolher esta empresa
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Editar nome
                    </Button>
                    {isSuperAdmin && !isArchived && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleArchive(c)}
                        disabled={busyId === c.id}
                      >
                        <Archive className="h-3.5 w-3.5" />
                        Arquivar
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {editing && (
        <EditCompanySheet
          company={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      )}

      {creating && (
        <CreateCompanySheet
          isSuperAdmin={isSuperAdmin}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void refresh();
          }}
        />
      )}
    </PageContainer>
  );
}

function EntitlementsSummary({
  state,
  onLoad,
}: {
  state: EntCacheState | undefined;
  onLoad: () => void;
}) {
  useEffect(() => {
    if (!state || state.status === "idle") onLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state || state.status === "idle" || state.status === "loading") {
    return <p className="text-[11px] text-muted-foreground">Carregando plano…</p>;
  }
  if (state.status === "error") {
    return (
      <p className="text-[11px] text-destructive">
        {state.message}{" "}
        <button className="underline" onClick={onLoad}>
          tentar de novo
        </button>
      </p>
    );
  }
  if (!state.plan_id) {
    return (
      <p className="text-[11px] text-amber-700">
        Sem assinatura ativa identificada · Plano não identificado
      </p>
    );
  }
  const enabled = state.entitlements.filter((e) => e.enabled).map((e) => e.feature_key);
  return (
    <p className="text-[11px] text-muted-foreground">
      Módulos liberados:{" "}
      {enabled.length === 0 ? (
        <span className="text-amber-700">nenhum no plano atual</span>
      ) : (
        <span className="font-medium text-foreground">{enabled.join(", ")}</span>
      )}
    </p>
  );
}

function EditCompanySheet({
  company,
  onClose,
  onSaved,
}: {
  company: BackendCompany;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(company.name);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Informe o nome da empresa.");
      return;
    }
    setSaving(true);
    try {
      await updateBackendCompany(company.id, name.trim());
      toast.success("Empresa atualizada.");
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível salvar a empresa. Tente novamente.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Editar empresa</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="company-name">Nome</Label>
            <Input
              id="company-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Apenas o nome pode ser alterado aqui.
            </p>
          </div>
        </div>
        <SheetFooter className="mt-6 gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function CreateCompanySheet({
  isSuperAdmin,
  onClose,
  onCreated,
}: {
  isSuperAdmin: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  // Sem busca de usuário real implementada — não pedimos UUID manual.
  // Mostramos estado bloqueado e amigável.
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Nova empresa</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {!isSuperAdmin ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <ShieldAlert className="mr-1 inline h-4 w-4" />
              Apenas o Admin do sistema pode criar empresas.
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <Info className="mr-1 inline h-4 w-4" />
              Criação de empresa pelo painel ainda precisa selecionar um dono
              cadastrado. Esta busca será liberada em uma próxima etapa.
            </div>
          )}
        </div>
        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// referenciado para manter import vivo enquanto a UI de criação real não existe
void createBackendCompanyAdmin;
void BACKEND_ACTIVE_COMPANY_EVENT;
