import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy as CopyIcon,
  Loader2,
  Building2,
} from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { EmptyState } from "@/components/ui-premium/EmptyState";
import { HelpTip } from "@/components/ui-premium/HelpTip";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { supabase, supabaseConfigured } from "@/integrations/supabase/client";
import { useSupabaseList } from "@/lib/use-supabase";
import { useAuth } from "@/lib/use-auth";

import { flags } from "@/lib/flags";
import {
  extractPdfText,
  normalizeWhatsApp,
  parseRowsFromText,
  validateRows,
  type ValidatedRow,
} from "@/lib/import-parse";

type RowKind = "new" | "existing" | "duplicate_file" | "error";

export const Route = createFileRoute("/importar-clientes")({
  component: ImportarClientesPage,
});

type Company = Record<string, unknown>;

function companyLabel(c: Company): string {
  for (const k of ["name", "nome", "fantasia", "razao_social", "company_name", "slug"]) {
    const v = c[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return (c.id as string | undefined) ?? "Empresa";
}

const MAX_BYTES = 10 * 1024 * 1024;

function ImportarClientesPage() {
  const { user, isAuthenticated } = useAuth();
  const companies = useSupabaseList<Company>("companies", {
    limit: 100,
    deps: [user?.id ?? null],
  });
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [rows, setRows] = useState<ValidatedRow[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{
    imported?: number;
    updated?: number;
    charges?: number;
    duplicated?: number;
    errored?: number;
    message?: string;
  } | null>(null);
  const [existingMap, setExistingMap] = useState<Record<string, { name?: string }>>({});
  const [lookupLoading, setLookupLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Auto-select single company
  useEffect(() => {
    if (
      companies.status === "ready" &&
      companies.data.length === 1 &&
      !companyId
    ) {
      const only = companies.data[0] as Record<string, unknown>;
      if (typeof only.id === "string") setCompanyId(only.id);
    }
  }, [companies, companyId]);

  // Reset selection on user change
  useEffect(() => {
    setCompanyId(null);
    setResult(null);
    setExistingMap({});
  }, [user?.id]);

  // Lookup existing customers by WhatsApp for the selected company
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setExistingMap({});
      if (!supabase || !supabaseConfigured) return;
      if (!isAuthenticated || !companyId || !rows || rows.length === 0) return;
      const e164s = Array.from(
        new Set(rows.map((r) => r.whatsapp_e164).filter((x): x is string => !!x)),
      );
      if (e164s.length === 0) return;
      setLookupLoading(true);
      try {
        // Defensive: customers may store WhatsApp in different columns.
        // Fetch a wide projection scoped to the company and normalize client-side.
        const { data, error } = await supabase
          .from("customers")
          .select("id,name,nome,full_name,phone,telefone,whatsapp,whatsapp_e164")
          .eq("company_id", companyId)
          .limit(2000);
        if (error || !data) return;
        const map: Record<string, { name?: string }> = {};
        const want = new Set(e164s);
        for (const c of data as Array<Record<string, unknown>>) {
          const candidates = [
            c.whatsapp_e164,
            c.whatsapp,
            c.phone,
            c.telefone,
          ];
          for (const cand of candidates) {
            if (typeof cand !== "string") continue;
            const norm = normalizeWhatsApp(cand);
            if (norm && want.has(norm) && !map[norm]) {
              const name =
                (typeof c.name === "string" && c.name) ||
                (typeof c.nome === "string" && c.nome) ||
                (typeof c.full_name === "string" && c.full_name) ||
                undefined;
              map[norm] = { name: name || undefined };
              break;
            }
          }
        }
        if (!cancelled) setExistingMap(map);
      } catch {
        /* silent — preview still works without enrichment */
      } finally {
        if (!cancelled) setLookupLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [rows, companyId, isAuthenticated]);

  const rowKind = (r: ValidatedRow): RowKind => {
    if (r.status === "invalid") return "error";
    if (r.status === "duplicate") return "duplicate_file";
    if (r.whatsapp_e164 && existingMap[r.whatsapp_e164]) return "existing";
    return "new";
  };

  const counts = useMemo(() => {
    const c = { new: 0, existing: 0, duplicate_file: 0, error: 0 };
    rows?.forEach((r) => {
      c[rowKind(r)]++;
    });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, existingMap]);


  async function onFile(file: File) {
    setParseError(null);
    setResult(null);
    setRows(null);
    setFileName(file.name);

    if (file.size > MAX_BYTES) {
      setParseError("Arquivo maior que 10 MB. Envie um arquivo menor.");
      return;
    }
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      setParseError("Formato não suportado. Envie um PDF pesquisável.");
      return;
    }

    setParsing(true);
    try {
      const text = await extractPdfText(file);
      const trimmed = text.trim();
      if (!trimmed || trimmed.length < 20) {
        setParseError(
          "Não consegui ler este PDF automaticamente. Envie um PDF pesquisável, CSV ou Excel."
        );
        setParsing(false);
        return;
      }
      const parsed = parseRowsFromText(text);
      if (parsed.length === 0) {
        setParseError(
          "Não encontrei linhas de clientes neste PDF. Confira se ele contém colunas como Cliente, WhatsApp e Valor."
        );
        setParsing(false);
        return;
      }
      const validated = validateRows(parsed);
      setRows(validated);
    } catch (err) {
      setParseError(
        "Falha ao ler o PDF. Envie um PDF pesquisável (com texto, não digitalizado)."
      );
      console.error(err);
    } finally {
      setParsing(false);
    }
  }

  async function onConfirm() {
    if (!supabase || !supabaseConfigured) {
      toast.error("Conexão com Supabase não configurada.");
      return;
    }
    if (!isAuthenticated) {
      toast.error("Faça login para importar clientes.");
      return;
    }
    if (flags.appEnv !== "staging") {
      toast.error("Importação disponível apenas em ambiente de testes.");
      return;
    }
    if (!companyId) {
      toast.error("Selecione uma empresa.");
      return;
    }
    const validas = (rows ?? []).filter((r) => r.status === "valid");
    if (validas.length === 0) {
      toast.error("Nenhuma linha válida para importar.");
      return;
    }

    setConfirming(true);
    setResult(null);
    try {
      const payload = validas.map((r) => ({
        external_code: r.external_code,
        external_customer_code: r.external_customer_code,
        customer_name: r.customer_name,
        whatsapp_e164: r.whatsapp_e164,
        service_name: r.service_name,
        amount_cents: r.amount_cents,
        expires_at: r.expires_at,
        situation: r.situation,
        raw_row: r.raw_row,
      }));

      const { data, error } = await supabase.rpc(
        "staging_import_customers_from_rows",
        { p_company_id: companyId, p_rows: payload as unknown as object }
      );

      if (error) {
        const m = (error.message || "").toLowerCase();
        let friendly = "Erro ao importar: " + error.message;
        if (m.includes("jwt") || m.includes("not authenticated") || m.includes("auth")) {
          friendly = "Faça login para importar clientes.";
        } else if (
          m.includes("permission") ||
          m.includes("denied") ||
          m.includes("not allowed") ||
          m.includes("rls")
        ) {
          friendly = "Sua conta não tem permissão para importar clientes desta empresa.";
        } else if (
          m.includes("does not exist") ||
          m.includes("not find function") ||
          m.includes("could not find")
        ) {
          friendly = "Função segura de importação ainda não instalada no Supabase.";
        } else if (m.includes("invalid") || m.includes("constraint") || m.includes("type")) {
          friendly = "Revise os dados do arquivo antes de importar.";
        }
        toast.error(friendly);
        setResult({
          message: friendly,
          duplicated: counts.duplicate_file,
          errored: counts.error,
        });
      } else {
        const r = (data ?? {}) as Record<string, number>;
        setResult({
          imported: r.imported ?? 0,
          updated: r.updated ?? 0,
          charges: r.charges ?? 0,
          duplicated: counts.duplicate_file,
          errored: counts.error,
        });
        toast.success("Importação concluída.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro inesperado.";
      toast.error("Falha ao importar: " + msg);
    } finally {
      setConfirming(false);
    }
  }

  const disabledReason: string | null = !isAuthenticated
    ? "Entre com uma conta autorizada para importar."
    : flags.appEnv !== "staging"
      ? "A importação só funciona no ambiente de testes."
      : !companyId
        ? "Selecione uma empresa."
        : !rows || rows.length === 0
          ? "Envie um arquivo com pelo menos 1 cliente válido."
          : counts.new + counts.existing === 0 && counts.error > 0
            ? "Revise os erros antes de continuar."
            : counts.new + counts.existing === 0
              ? "Envie um arquivo com pelo menos 1 cliente válido."
              : null;

  const canConfirm = disabledReason === null && !confirming;


  return (
    <PageContainer>
      <SectionHeader
        title="Importar clientes"
        subtitle="Cadastre clientes a partir de um PDF do seu sistema."
        hint="Lemos o PDF, mostramos a prévia e você confirma antes de gravar."
      />

      {/* Aviso */}
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300/50 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="min-w-0">
          Importação em ambiente de testes. Confira os dados antes de
          cadastrar. Nenhum WhatsApp, cobrança real ou IA real será executado.
        </p>
      </div>

      

      {/* Empresa */}
      <Card className="mb-4 p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Building2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Empresa</span>
          <HelpTip text="Os clientes importados ficarão vinculados a esta empresa." />
        </div>
        {!isAuthenticated && (
          <p className="text-sm text-muted-foreground">
            Entre para ver as empresas autorizadas para a sua conta.
          </p>
        )}
        {isAuthenticated && companies.status === "loading" && (
          <p className="text-sm text-muted-foreground">Carregando empresas…</p>
        )}
        {isAuthenticated && companies.status === "not_configured" && (
          <p className="text-sm text-muted-foreground">
            Conexão não configurada.
          </p>
        )}
        {isAuthenticated && companies.status === "error" && (
          <p className="text-sm text-destructive">
            {/permiss/i.test(companies.message)
              ? "Sua conta não tem permissão para listar empresas."
              : companies.message}
          </p>
        )}
        {isAuthenticated &&
          companies.status === "ready" &&
          companies.data.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Sua conta ainda não tem empresa autorizada para importação.
            </p>
          )}
        {isAuthenticated &&
          companies.status === "ready" &&
          companies.data.length > 0 && (
          <Select
            value={companyId ?? undefined}
            onValueChange={(v) => setCompanyId(v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione a empresa" />
            </SelectTrigger>
            <SelectContent>
              {companies.data.map((c) => {
                const id = c.id as string;
                return (
                  <SelectItem key={id} value={id}>
                    {companyLabel(c)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}
      </Card>

      {/* Upload */}
      <Card className="mb-4 p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Upload className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Arquivo</span>
          <HelpTip text="PDF pesquisável é aquele cujo texto pode ser selecionado e copiado — não é uma imagem digitalizada." />
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          Envie o PDF exportado do seu sistema com a lista de clientes.
          Tamanho máximo 10 MB.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={parsing}
          >
            {parsing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Lendo PDF…
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Selecionar PDF
              </>
            )}
          </Button>
          {fileName && (
            <span className="min-w-0 truncate text-xs text-muted-foreground">
              {fileName}
            </span>
          )}
        </div>
        {parseError && (
          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {parseError}
          </div>
        )}
      </Card>

      {/* Prévia */}
      {rows && rows.length > 0 && (
        <Card className="mb-4 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium">Prévia</span>
              <HelpTip text="Confira os dados extraídos. Só linhas válidas serão cadastradas." />
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                {counts.valid} válidos
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <CopyIcon className="h-3 w-3 text-amber-600" />
                {counts.duplicate} duplicados
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <XCircle className="h-3 w-3 text-destructive" />
                {counts.invalid} com erro
              </Badge>
            </div>
          </div>

          {/* Mobile: cards */}
          <div className="space-y-2 sm:hidden">
            {rows.map((r, i) => (
              <div
                key={i}
                className="rounded-xl border bg-card/50 p-3 text-xs"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <StatusPill status={r.status} errors={r.errors} />
                  <span className="text-[10px] text-muted-foreground">
                    {r.external_code ?? ""}
                    {r.external_customer_code ? ` / ${r.external_customer_code}` : ""}
                  </span>
                </div>
                <p className="truncate text-sm font-semibold">
                  {r.customer_name ?? "—"}
                </p>
                <dl className="mt-2 grid grid-cols-[88px_1fr] gap-x-2 gap-y-1">
                  <dt className="text-muted-foreground">WhatsApp</dt>
                  <dd className="min-w-0 truncate">
                    {r.whatsapp_raw ?? "—"}
                    {r.whatsapp_e164 && (
                      <span className="block font-mono text-[10px] text-muted-foreground">
                        {r.whatsapp_e164}
                      </span>
                    )}
                  </dd>
                  <dt className="text-muted-foreground">Serviço</dt>
                  <dd className="min-w-0 truncate">{r.service_name ?? "—"}</dd>
                  <dt className="text-muted-foreground">Valor</dt>
                  <dd>
                    {r.amount_cents != null
                      ? (r.amount_cents / 100).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })
                      : "—"}
                  </dd>
                  <dt className="text-muted-foreground">Expira</dt>
                  <dd>
                    {r.expires_at
                      ? new Date(r.expires_at).toLocaleDateString("pt-BR")
                      : r.expires_raw ?? "—"}
                  </dd>
                  <dt className="text-muted-foreground">Situação</dt>
                  <dd>{r.situation ?? "—"}</dd>
                </dl>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block">
            <div className="-mx-4 overflow-x-auto px-4">
              <table className="w-full min-w-[720px] text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="p-2 text-left font-medium">Status</th>
                    <th className="p-2 text-left font-medium">Cliente</th>
                    <th className="p-2 text-left font-medium">WhatsApp</th>
                    <th className="p-2 text-left font-medium">Normalizado</th>
                    <th className="p-2 text-left font-medium">Serviço</th>
                    <th className="p-2 text-right font-medium">Valor</th>
                    <th className="p-2 text-left font-medium">Expira</th>
                    <th className="p-2 text-left font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="p-2">
                        <StatusPill status={r.status} errors={r.errors} />
                      </td>
                      <td className="p-2">
                        <div className="font-medium">
                          {r.customer_name ?? "—"}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {r.external_code ?? ""}{" "}
                          {r.external_customer_code
                            ? `/ ${r.external_customer_code}`
                            : ""}
                        </div>
                      </td>
                      <td className="p-2">{r.whatsapp_raw ?? "—"}</td>
                      <td className="p-2 font-mono text-[11px]">
                        {r.whatsapp_e164 ?? "—"}
                      </td>
                      <td className="p-2">{r.service_name ?? "—"}</td>
                      <td className="p-2 text-right">
                        {r.amount_cents != null
                          ? (r.amount_cents / 100).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })
                          : "—"}
                      </td>
                      <td className="p-2">
                        {r.expires_at
                          ? new Date(r.expires_at).toLocaleDateString("pt-BR")
                          : r.expires_raw ?? "—"}
                      </td>
                      <td className="p-2">{r.situation ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {counts.valid} clientes válidos, {counts.duplicate} duplicados,{" "}
              {counts.invalid} com erro.
            </p>
            <div className="flex flex-col items-stretch gap-1 sm:items-end">
              <Button
                size="lg"
                onClick={onConfirm}
                disabled={!canConfirm}
                className="w-full sm:w-auto"
              >
                {confirming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importando…
                  </>
                ) : (
                  <>Confirmar importação</>
                )}
              </Button>
              {disabledReason && (
                <p className="text-[11px] text-muted-foreground sm:text-right">
                  {disabledReason}
                </p>
              )}
            </div>
          </div>

        </Card>
      )}

      {/* Resultado */}
      {result && (
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-medium">Resultado</span>
          </div>
          {result.message && (
            <p className="mb-3 rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-100">
              {result.message}
            </p>
          )}
          {!result.message && (
            <p className="mb-3 rounded-lg border border-emerald-300/50 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-700/50 dark:bg-emerald-950/40 dark:text-emerald-100">
              {(result.imported ?? 0) > 0
                ? "Novos clientes importados com sucesso."
                : (result.updated ?? 0) > 0
                  ? "Clientes atualizados com sucesso. Nenhum cliente duplicado foi criado."
                  : "Importação concluída sem alterações."}
              {" "}
              <span className="opacity-80">
                Se o cliente já existia, o sistema atualiza os dados em vez de duplicar.
              </span>
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <ResultCard label="Importados" value={result.imported ?? 0} />
            <ResultCard label="Atualizados" value={result.updated ?? 0} />
            <ResultCard label="Cobranças" value={result.charges ?? 0} />
            <ResultCard label="Duplicados" value={result.duplicated ?? 0} />
            <ResultCard label="Com erro" value={result.errored ?? 0} />
          </div>
        </Card>
      )}


      {!rows && !parsing && !parseError && (
        <EmptyState
          icon={Upload}
          title="Nenhum arquivo enviado"
          description="Selecione um PDF pesquisável para ver a prévia da importação."
        />
      )}
    </PageContainer>
  );
}

function StatusPill({
  status,
  errors,
}: {
  status: "valid" | "invalid" | "duplicate";
  errors: string[];
}) {
  if (status === "valid")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3" />
        Válido
      </span>
    );
  if (status === "duplicate")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
        <CopyIcon className="h-3 w-3" />
        Duplicado
      </span>
    );
  return (
    <span
      title={errors.join(", ")}
      className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive"
    >
      <XCircle className="h-3 w-3" />
      {errors[0] ?? "Erro"}
    </span>
  );
}

function ResultCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
