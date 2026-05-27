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
import { CompanyScopeNotice } from "@/components/companies/CompanyScopeNotice";
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

import { supabase, supabaseConfigured } from "@/integrations/supabase/compat";
import { useAuth } from "@/lib/use-auth";
import {
  useCurrentCompany,
  getImportCustomerDedupAdmin,
} from "@/lib/rpc-admin";

import { flags } from "@/lib/flags";
import {
  extractPdfText,
  normalizeWhatsApp,
  parseRowsFromText,
  validateRows,
  type ValidatedRow,
} from "@/lib/import-parse";
import { setImportedDueBulk } from "@/lib/imported-due-dates";
import {
  buildSchedule,
  applyPersistedStatus,
  setStatus as setSchedStatus,
  clearAllPersisted as clearSchedPersisted,
  buildScheduleTxt,
  matchesChip,
  CHIP_LABEL,
  GROUP_LABEL,
  fmtBRLPublic,
  fmtDateBRPublic,
  saveImportScheduleItems,
  clearImportScheduleItems,
  type ScheduleItem,
  type ChipKey,
  type DispatchGroup,
} from "@/lib/import-schedule";
import {
  enrichImportRows,
  summarizeImport,
  type ImportEnrichment,
} from "@/lib/import-mapping";




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

// Sem limite fixo: bases reais podem passar de 10MB. Acima de 25MB só
// avisamos o usuário que pode demorar; o parse roda em chunks.
const SOFT_WARN_BYTES = 25 * 1024 * 1024;
// Tamanho do lote enviado para a RPC staging_import_customers_from_rows.
// Evita timeout/payload gigante em bases de 5k–10k clientes.
const IMPORT_CHUNK_SIZE = 250;

function ImportarClientesPage() {
  const { user, isAuthenticated } = useAuth();
  const companyState = useCurrentCompany();
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
  const [existingMap, setExistingMap] = useState<Record<string, { name?: string; id?: string; status?: string }>>({});
  const [lookupLoading, setLookupLoading] = useState(false);
  const [notImportedIdx, setNotImportedIdx] = useState<number[]>([]);
  const [skippedIdx, setSkippedIdx] = useState<Set<number>>(new Set());
  const [forcedIdx, setForcedIdx] = useState<Set<number>>(new Set());
  const [forcingIdx, setForcingIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Auto-seleciona a empresa atual da sessão (mantém UI igual).
  useEffect(() => {
    if (companyState.status === "ready" && !companyId) {
      setCompanyId(companyState.companyId);
    }
  }, [companyState, companyId]);

  // Reset on user change
  useEffect(() => {
    setCompanyId(null);
    setResult(null);
    setExistingMap({});
  }, [user?.id]);

  const [lookupBump, setLookupBump] = useState(0);
  const [lookupReady, setLookupReady] = useState(false);

  // Dedup via RPC segura: get_import_customer_dedup_admin
  useEffect(() => {
    let cancelled = false;
    const cid =
      companyId ??
      (companyState.status === "ready" ? companyState.companyId : null);
    async function run() {
      setExistingMap({});
      setLookupReady(false);
      if (!supabaseConfigured) {
        setLookupReady(true);
        return;
      }
      if (!isAuthenticated || !cid || !rows || rows.length === 0) {
        setLookupReady(true);
        return;
      }
      const e164s = Array.from(
        new Set(rows.map((r) => r.whatsapp_e164).filter((x): x is string => !!x)),
      );
      if (e164s.length === 0) {
        setLookupReady(true);
        return;
      }
      setLookupLoading(true);

      const map: Record<string, { name?: string; id?: string; status?: string }> = {};
      try {
        const res = await getImportCustomerDedupAdmin({
          p_company_id: cid,
          p_whatsapp_e164_values: e164s,
        });
        if (cancelled) return;

        if (res.error) {
          console.warn("[importar-clientes] dedup falhou", res.error);
        } else {
          const list = Array.isArray(res.data)
            ? res.data
            : res.data && typeof res.data === "object"
              ? [res.data as Record<string, unknown>]
              : [];
          const want = new Set(e164s);
          for (const c of list as Array<Record<string, unknown>>) {
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
                const id =
                  (typeof c.id === "string" && c.id) ||
                  (typeof c.customer_id === "string" && c.customer_id) ||
                  undefined;
                const status =
                  (typeof c.status === "string" && c.status) ||
                  (typeof c.situacao === "string" && c.situacao) ||
                  undefined;
                map[norm] = { name: name || undefined, id, status };
                break;
              }
            }
          }
        }
      } catch (e) {
        console.warn("[importar-clientes] dedup exceção", e);
      } finally {
        if (!cancelled) {
          setExistingMap(map);
          setLookupReady(true);
          setLookupLoading(false);
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [rows, companyId, companyState, isAuthenticated]);

  const rowKind = (r: ValidatedRow): RowKind | "pending" => {
    if (r.status === "invalid") return "error";
    if (r.status === "duplicate") return "duplicate_file";
    if (!lookupReady) return "pending";
    if (r.whatsapp_e164 && existingMap[r.whatsapp_e164]) return "existing";
    return "new";
  };

  const counts = useMemo(() => {
    const c = { new: 0, existing: 0, duplicate_file: 0, error: 0, pending: 0 };
    rows?.forEach((r) => {
      c[rowKind(r)]++;
    });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, existingMap, lookupReady]);

  const enrichments = useMemo<ImportEnrichment[]>(
    () => (rows ? enrichImportRows(rows) : []),
    [rows],
  );
  const summary = useMemo(
    () => (rows ? summarizeImport(rows, enrichments) : null),
    [rows, enrichments],
  );




  async function onFile(file: File) {
    setParseError(null);
    setResult(null);
    setNotImportedIdx([]);
    setSkippedIdx(new Set());
    setForcedIdx(new Set());
    setRows(null);
    setFileName(file.name);

    if (file.size > SOFT_WARN_BYTES) {
      toast.message(
        `Arquivo grande (${(file.size / (1024 * 1024)).toFixed(1)} MB). O processamento será feito em lotes — pode levar alguns minutos.`,
      );
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
    const effCompany =
      companyId ??
      (companyState.status === "ready" ? companyState.companyId : null);
    if (!effCompany) {
      toast.error("Empresa não encontrada para sua conta. Entre novamente.");
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
      const idxByRef = new Map(rows!.map((r, i) => [r, i] as const));
      const payload = validas.map((r) => {
        const idx = idxByRef.get(r);
        const e = idx != null ? enrichments[idx] : undefined;
        return {
          external_code: r.external_code,
          external_customer_code: r.external_customer_code,
          customer_name: r.customer_name,
          whatsapp_e164: r.whatsapp_e164,
          service_name: r.service_name,
          amount_cents: r.amount_cents,
          expires_at: r.expires_at,
          situation: r.situation,
          raw_row: {
            ...r.raw_row,
            matched_service_id: e?.matched_service_id ?? null,
            plan_label: e?.plan_label ?? null,
            message_label: e?.message_label ?? null,
            group_size: e?.group_size ?? 1,
            group_conflict: e?.group_conflict ?? null,
            observation: e?.observation ?? null,
          },
        };
      });


      const { data, error } = await supabase.rpc(
        "staging_import_customers_from_rows",
        { p_company_id: effCompany, p_rows: payload as unknown as object }
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
        const notImported: number[] = [];
        (rows ?? []).forEach((row, i) => {
          if (row.status !== "valid") notImported.push(i);
        });
        setNotImportedIdx(notImported);
        setSkippedIdx(new Set());
        setForcedIdx(new Set());
        // Reativa clientes arquivados que voltaram via importação.
        const toReactivate = new Set<string>();
        for (const r of validas) {
          if (!r.whatsapp_e164) continue;
          const ex = existingMap[r.whatsapp_e164];
          if (ex?.id && ex.status && /arquiv|inativ|cancel|deleted|removed/i.test(ex.status)) {
            toReactivate.add(ex.id);
          }
        }
        if (toReactivate.size > 0) {
          const ids = Array.from(toReactivate);
          const { error: reactErr } = await supabase!
            .from("customers")
            .update({ status: "em_dia" })
            .in("id", ids);
          if (reactErr) {
            console.warn("[importar-clientes] reativar falhou", reactErr);
          }
        }

        // Persiste a data completa de vencimento por WhatsApp localmente,
        // já que o backend atual só guarda due_day.
        setImportedDueBulk(
          validas.map((r) => ({
            wa: r.whatsapp_e164,
            date: r.expires_at ?? r.expires_raw ?? null,
          })),
        );

        toast.success("Importação concluída.");
        setLookupBump((n) => n + 1);
      }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro inesperado.";
      toast.error("Falha ao importar: " + msg);
    } finally {
      setConfirming(false);
    }
  }

  async function forceImportRow(idx: number) {
    if (!supabase || !supabaseConfigured) return;
    const r = rows?.[idx];
    if (!r) return;
    const effCompany =
      companyId ??
      (companyState.status === "ready" ? companyState.companyId : null);
    if (!effCompany) {
      toast.error("Empresa não encontrada.");
      return;
    }
    if (!r.whatsapp_e164 && !r.customer_name) {
      toast.error("Linha sem WhatsApp e sem nome — não dá para importar.");
      return;
    }
    setForcingIdx(idx);
    try {
      const e = enrichments[idx];
      const payload = [
        {
          external_code: r.external_code,
          external_customer_code: r.external_customer_code,
          customer_name: r.customer_name,
          whatsapp_e164: r.whatsapp_e164,
          service_name: r.service_name,
          amount_cents: r.amount_cents,
          expires_at: r.expires_at,
          situation: r.situation,
          raw_row: {
            ...r.raw_row,
            forced: true,
            matched_service_id: e?.matched_service_id ?? null,
            plan_label: e?.plan_label ?? null,
            message_label: e?.message_label ?? null,
            group_size: e?.group_size ?? 1,
            group_conflict: e?.group_conflict ?? null,
            observation: e?.observation ?? null,
          },
        },
      ];
      const { error } = await supabase.rpc(
        "staging_import_customers_from_rows",
        { p_company_id: effCompany, p_rows: payload as unknown as object },
      );
      if (error) {
        toast.error("Não foi possível importar: " + error.message);
        return;
      }
      setImportedDueBulk([{ wa: r.whatsapp_e164, date: r.expires_at ?? r.expires_raw ?? null }]);
      toast.success("Cliente importado mesmo assim.");
      setForcedIdx((prev) => {
        const next = new Set(prev);
        next.add(idx);
        return next;
      });
    } finally {
      setForcingIdx(null);
    }
  }

  const effectiveCompanyId =
    companyId ??
    (companyState.status === "ready" ? companyState.companyId : null);
  const validForImport = (rows ?? []).filter(
    (r) => r.status === "valid" || r.status === "duplicate",
  ).length;
  const companyBlocker =
    companyState.status === "loading"
      ? "Carregando empresa…"
      : companyState.status === "not_configured"
        ? "Conexão não configurada."
        : companyState.status === "unauthenticated"
          ? "Entre com uma conta autorizada para importar."
          : companyState.status === "error"
            ? companyState.message
            : !effectiveCompanyId
              ? "Empresa não encontrada para sua conta."
              : null;
  const disabledReason: string | null = !isAuthenticated
    ? "Entre com uma conta autorizada para importar."
    : flags.appEnv !== "staging"
      ? "A importação só funciona no ambiente de testes."
      : companyBlocker
        ? companyBlocker
        : !rows || rows.length === 0
          ? "Envie um arquivo com pelo menos 1 cliente válido."
          : validForImport === 0 && counts.error > 0
            ? "Revise os erros antes de continuar."
            : validForImport === 0
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
      <CompanyScopeNotice moduleKey="cobranca_ia_import_schedule_items_v1" />

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
            Entre para ver a empresa autorizada para a sua conta.
          </p>
        )}
        {isAuthenticated && companyState.status === "loading" && (
          <p className="text-sm text-muted-foreground">Carregando empresa…</p>
        )}
        {isAuthenticated && companyState.status === "not_configured" && (
          <p className="text-sm text-muted-foreground">
            Conexão não configurada.
          </p>
        )}
        {isAuthenticated && companyState.status === "error" && (
          <p className="text-sm text-destructive">{companyState.message}</p>
        )}
        {isAuthenticated && companyState.status === "ready" && (
          <p className="text-sm text-muted-foreground">
            Importando para a empresa autorizada da sua conta.
          </p>
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
      {rows && rows.length > 0 && !result && (
        <Card className="mb-4 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium">Prévia</span>
              <HelpTip text="“Já cadastrado” significa que o WhatsApp já existe nesta empresa e será atualizado, não duplicado." />
              {lookupLoading && (
                <span className="text-[10px] text-muted-foreground">
                  verificando…
                </span>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => {
                if (disabledReason) {
                  toast.error(disabledReason);
                  return;
                }
                onConfirm();
              }}
              disabled={confirming}
              className="h-8"
            >
              {confirming ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Importando…
                </>
              ) : (
                <>Confirmar importação</>
              )}
            </Button>
          </div>

          <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              {counts.new} novos
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3 text-amber-600" />
              {counts.existing} já cadastrados
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <CopyIcon className="h-3 w-3 text-orange-600" />
              {counts.duplicate_file} duplicados no arquivo
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <XCircle className="h-3 w-3 text-destructive" />
              {counts.error} com erro
            </Badge>
          </div>

          {summary && (
            <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-xl border bg-muted/30 p-2 text-[11px] sm:grid-cols-4">
              <SummaryStat label="WhatsApps únicos" value={summary.unique_whatsapps} />
              <SummaryStat label="Valores reconhecidos" value={summary.amounts_recognized} />
              <SummaryStat label="Vencimentos reconhecidos" value={summary.dates_recognized} />
              <SummaryStat label="Planos casados" value={summary.messages_matched} />
              <SummaryStat label="Mensagem padrão (revisar)" value={summary.messages_default} />
              <SummaryStat label="Conflitos no grupo" value={summary.conflicts} />
            </div>
          )}



          {/* Mobile: cards */}
          <div className="space-y-2 sm:hidden">
            {rows.map((r, i) => (
              <div
                key={i}
                className="rounded-xl border bg-card/50 p-3 text-xs"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <KindPill kind={rowKind(r)} errors={r.errors} />
                  <span className="text-[10px] text-muted-foreground">
                    {r.external_code ?? ""}
                    {r.external_customer_code ? ` / ${r.external_customer_code}` : ""}
                  </span>
                </div>
                <p className="truncate text-sm font-semibold">
                  {r.customer_name ?? "—"}
                </p>
                {rowKind(r) === "existing" && r.whatsapp_e164 && (
                  <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                    Já existe como:{" "}
                    <span className="font-medium">
                      {existingMap[r.whatsapp_e164]?.name ?? "cliente cadastrado"}
                    </span>
                    . Será atualizado.
                  </p>
                )}
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
                {enrichments[i] && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        enrichments[i].has_message_template
                          ? "bg-primary/10 text-primary"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                      }`}
                    >
                      {enrichments[i].message_label}
                    </span>
                    {enrichments[i].group_size > 1 && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                        {enrichments[i].group_size} telas/serviços
                      </span>
                    )}
                    {enrichments[i].group_conflict && (
                      <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-800 dark:bg-orange-900/40 dark:text-orange-200">
                        conflito: {enrichments[i].group_conflict?.replace("_", " ")}
                      </span>
                    )}
                  </div>
                )}

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
                    <th className="p-2 text-left font-medium">Mensagem</th>
                    <th className="p-2 text-left font-medium">Grupo</th>

                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="p-2">
                        <KindPill kind={rowKind(r)} errors={r.errors} />
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
                          {rowKind(r) === "existing" && r.whatsapp_e164 && (
                            <span className="ml-1 text-amber-700 dark:text-amber-300">
                              · já existe como{" "}
                              {existingMap[r.whatsapp_e164]?.name ?? "cliente cadastrado"}
                            </span>
                          )}
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
                      <td className="p-2">
                        {enrichments[i] ? (
                          <span
                            className={
                              enrichments[i].has_message_template
                                ? "text-primary"
                                : "text-amber-700 dark:text-amber-300"
                            }
                          >
                            {enrichments[i].message_label}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-2">
                        {enrichments[i]?.group_size && enrichments[i].group_size > 1 ? (
                          <span className="text-blue-700 dark:text-blue-300">
                            {enrichments[i].group_size} telas
                            {enrichments[i].group_conflict
                              ? ` · conflito: ${enrichments[i].group_conflict?.replace("_", " ")}`
                              : ""}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs text-muted-foreground">
              {counts.new} novos, {counts.existing} já cadastrados (serão atualizados),{" "}
              {counts.duplicate_file} duplicados no arquivo, {counts.error} com erro.
              {" "}Clientes já cadastrados serão atualizados, não duplicados.
            </p>
            {disabledReason && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {disabledReason}
              </p>
            )}
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
            <div className="mb-3 space-y-1 rounded-lg border border-emerald-300/50 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-700/50 dark:bg-emerald-950/40 dark:text-emerald-100">
              {(result.imported ?? 0) > 0 && (
                <p>{result.imported} novos clientes foram importados.</p>
              )}
              {(result.updated ?? 0) > 0 && (
                <p>
                  {result.updated} clientes já existiam e foram atualizados. Nenhum cliente duplicado foi criado.
                </p>
              )}
              {(result.duplicated ?? 0) > 0 && (
                <p>
                  {result.duplicated} linhas duplicadas no arquivo foram ignoradas.
                </p>
      )}

      {/* Agenda de Disparos (local/simulada) */}
      {rows && rows.length > 0 && (
        <ImportScheduleSection rows={rows} />
      )}


              <p className="opacity-80">
                Se o cliente já existia, o sistema atualiza os dados em vez de duplicar.
              </p>
            </div>
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

      {/* Clientes não importados — ação por linha */}
      {result && !result.message && rows && notImportedIdx.length > 0 && (
        <Card className="mt-4 p-4">
          <div className="mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium">Clientes não importados</span>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Estes clientes foram pulados (duplicados no arquivo ou com erro).
            Você pode importar mesmo assim ou ignorar.
          </p>
          <div className="space-y-2">
            {notImportedIdx.map((i) => {
              const r = rows[i];
              const forced = forcedIdx.has(i);
              const skipped = skippedIdx.has(i);
              const isLoading = forcingIdx === i;
              return (
                <div
                  key={i}
                  className={`rounded-xl border p-3 text-xs ${
                    forced
                      ? "border-emerald-300/50 bg-emerald-50/50 dark:bg-emerald-950/20"
                      : skipped
                        ? "border-border bg-muted/30 opacity-60"
                        : "border-border bg-card/50"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <KindPill kind={rowKind(r)} errors={r.errors} />
                    <span className="text-[10px] text-muted-foreground">
                      {r.external_code ?? ""}
                    </span>
                  </div>
                  <p className="truncate text-sm font-semibold">
                    {r.customer_name ?? "—"}
                  </p>
                  <p className="text-muted-foreground">
                    {r.whatsapp_e164 ?? "sem WhatsApp"} ·{" "}
                    {r.service_name ?? "—"}
                  </p>
                  {r.errors.length > 0 && (
                    <p className="mt-1 text-[11px] text-destructive">
                      {r.errors.join(", ")}
                    </p>
                  )}
                  {!forced && !skipped && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        disabled={isLoading}
                        onClick={() => forceImportRow(i)}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Importando…
                          </>
                        ) : (
                          "Importar mesmo assim"
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() =>
                          setSkippedIdx((prev) => {
                            const next = new Set(prev);
                            next.add(i);
                            return next;
                          })
                        }
                      >
                        Ignorar
                      </Button>
                    </div>
                  )}
                  {forced && (
                    <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-300">
                      Importado mesmo assim.
                    </p>
                  )}
                  {skipped && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Ignorado.
                    </p>
                  )}
                </div>
              );
            })}
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

function KindPill({
  kind,
  errors,
}: {
  kind: RowKind | "pending";
  errors: string[];
}) {
  if (kind === "pending")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Verificando…
      </span>
    );
  if (kind === "new")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3" />
        Novo · será importado
      </span>
    );
  if (kind === "existing")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
        <CheckCircle2 className="h-3 w-3" />
        Já cadastrado · será atualizado
      </span>
    );
  if (kind === "duplicate_file")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
        <CopyIcon className="h-3 w-3" />
        Duplicado no arquivo
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

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-card/60 px-2 py-1">
      <span className="truncate text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
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

// =====================================================================
// ImportScheduleSection — Agenda local/simulada gerada na importação
// =====================================================================

function ImportScheduleSection({ rows }: { rows: ValidatedRow[] }) {
  const baseItems = useMemo(() => buildSchedule(rows), [rows]);
  const [items, setItems] = useState<ScheduleItem[]>(() =>
    applyPersistedStatus(baseItems),
  );
  useEffect(() => {
    const next = applyPersistedStatus(baseItems);
    setItems(next);
    saveImportScheduleItems(next);
  }, [baseItems]);


  const [chip, setChip] = useState<ChipKey>("todos");
  const [revealId, setRevealId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const ks: ChipKey[] = [
      "todos","hoje","amanha","prox7","vencidos","recuperar",
      "inativos","bloqueados","copiados","pendentes","ignorados","revisados",
    ];
    const c: Record<ChipKey, number> = {
      todos: 0, hoje: 0, amanha: 0, prox7: 0, vencidos: 0, recuperar: 0,
      inativos: 0, bloqueados: 0, copiados: 0, pendentes: 0, ignorados: 0, revisados: 0,
    };
    for (const it of items) for (const k of ks) if (matchesChip(it, k)) c[k]++;
    return c;
  }, [items]);

  const filtered = useMemo(
    () => items.filter((it) => matchesChip(it, chip)),
    [items, chip],
  );

  // Resumo (cards superiores)
  const summary = useMemo(() => {
    const total = items.length;
    const blocked = items.filter((i) => i.group === "bloqueados").length;
    const planned = total - blocked;
    const today = items.filter((i) => i.kind === "vence_hoje").length;
    const next7 = items.filter(
      (i) => i.days != null && i.days >= 0 && i.days <= 7 && i.kind !== "bloqueado",
    ).length;
    const overdueRecent = items.filter(
      (i) => i.days != null && i.days < 0 && i.days >= -7,
    ).length;
    const recover = items.filter((i) => i.kind === "recuperar_cliente").length;
    const inactive = items.filter((i) => i.kind === "campanha_retorno").length;
    const noWa = items.filter((i) => !i.whatsapp).length;
    const noDue = items.filter((i) => !i.due_date).length;
    const dup = items.filter((i) => i.reason.includes("duplicado")).length;
    return { total, planned, today, next7, overdueRecent, recover, inactive, blocked, noWa, noDue, dup };
  }, [items]);

  function updateStatus(it: ScheduleItem, status: ScheduleItem["status"]) {
    setSchedStatus(it, status);
    setItems((prev) => {
      const next = prev.map((x) => (x.id === it.id ? { ...x, status } : x));
      saveImportScheduleItems(next);
      return next;
    });
  }


  async function copyMessage(it: ScheduleItem) {
    if (!it.message) {
      toast.error("Sem mensagem para copiar.");
      return;
    }
    try {
      await navigator.clipboard.writeText(it.message);
      updateStatus(it, "copiado");
      toast.success("Mensagem copiada");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  function exportTxt() {
    const txt = buildScheduleTxt(items);
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const d = new Date();
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    a.href = url;
    a.download = `agenda-disparos-importacao-cobranca-ia-${ymd}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Agenda exportada");
  }

  function clearStatuses() {
    if (!window.confirm("Limpar status locais da agenda? Isso não apaga clientes.")) return;
    clearSchedPersisted();
    clearImportScheduleItems();
    const next = baseItems.map((it) => ({ ...it }));
    setItems(next);
    saveImportScheduleItems(next);
    toast.success("Status locais limpos");
  }


  const groupsOrder: { key: DispatchGroup; title: string }[] = [
    { key: "hoje", title: GROUP_LABEL.hoje },
    { key: "amanha", title: GROUP_LABEL.amanha },
    { key: "prox7", title: GROUP_LABEL.prox7 },
    { key: "recuperacao", title: GROUP_LABEL.recuperacao },
    { key: "bloqueados", title: GROUP_LABEL.bloqueados },
  ];

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">Agenda criada pela importação</h3>
          <p className="text-xs text-muted-foreground">
            Sugestão local de quando falar com cada cliente. Nada é enviado automaticamente.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={exportTxt}>Exportar agenda</Button>
          <Button size="sm" variant="ghost" onClick={clearStatuses}>Limpar status locais</Button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        <MiniStat label="Total importado" value={summary.total} />
        <MiniStat label="Planejados" value={summary.planned} />
        <MiniStat label="Vencem hoje" value={summary.today} tone="orange" />
        <MiniStat label="Até 7 dias" value={summary.next7} tone="amber" />
        <MiniStat label="Vencidos recentes" value={summary.overdueRecent} tone="red" />
        <MiniStat label="Recuperar" value={summary.recover} tone="violet" />
        <MiniStat label="Inativos" value={summary.inactive} />
        <MiniStat label="Bloqueados" value={summary.blocked} tone="red" />
        <MiniStat label="Sem WhatsApp" value={summary.noWa} />
        <MiniStat label="Sem vencimento" value={summary.noDue} />
        <MiniStat label="Duplicados" value={summary.dup} />
      </div>

      {/* Chips */}
      <div className="mb-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {(Object.keys(CHIP_LABEL) as ChipKey[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setChip(k)}
            className={
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
              (chip === k
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-accent")
            }
          >
            {CHIP_LABEL[k]}
            <span className="ml-1 opacity-70">({counts[k]})</span>
          </button>
        ))}
      </div>

      {/* Lista agrupada */}
      <div className="space-y-4">
        {groupsOrder.map((g) => {
          const list = filtered.filter((i) => i.group === g.key);
          if (list.length === 0) return null;
          return (
            <div key={g.key}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {g.title} <span className="opacity-60">({list.length})</span>
              </div>
              <div className="space-y-2">
                {list.map((it) => (
                  <ScheduleCard
                    key={it.id}
                    item={it}
                    revealOpen={revealId === it.id}
                    onToggleReveal={() => setRevealId((c) => (c === it.id ? null : it.id))}
                    onCopy={() => copyMessage(it)}
                    onMarkCopied={() => updateStatus(it, "copiado")}
                    onIgnore={() => updateStatus(it, "ignorado")}
                    onReview={() => updateStatus(it, "revisar")}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Nenhum item no filtro selecionado.
          </p>
        )}
      </div>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "red" | "orange" | "amber" | "violet";
}) {
  const toneCls =
    tone === "red"
      ? "border-red-300/50 bg-red-50 text-red-900 dark:border-red-700/50 dark:bg-red-950/30 dark:text-red-100"
      : tone === "orange"
      ? "border-orange-300/50 bg-orange-50 text-orange-900 dark:border-orange-700/50 dark:bg-orange-950/30 dark:text-orange-100"
      : tone === "amber"
      ? "border-amber-300/50 bg-amber-50 text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100"
      : tone === "violet"
      ? "border-violet-300/50 bg-violet-50 text-violet-900 dark:border-violet-700/50 dark:bg-violet-950/30 dark:text-violet-100"
      : "border-border bg-card text-foreground";
  return (
    <div className={"rounded-xl border p-2.5 " + toneCls}>
      <p className="text-[10px] uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-lg font-semibold leading-tight">{value}</p>
    </div>
  );
}

function ScheduleCard({
  item,
  revealOpen,
  onToggleReveal,
  onCopy,
  onMarkCopied,
  onIgnore,
  onReview,
}: {
  item: ScheduleItem;
  revealOpen: boolean;
  onToggleReveal: () => void;
  onCopy: () => void;
  onMarkCopied: () => void;
  onIgnore: () => void;
  onReview: () => void;
}) {
  const priorityCls =
    item.priority === "alta"
      ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
      : item.priority === "media"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"
      : item.priority === "baixa"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
      : "bg-muted text-muted-foreground";
  const statusCls =
    item.status === "copiado"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
      : item.status === "ignorado"
      ? "bg-muted text-muted-foreground"
      : item.status === "bloqueado"
      ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
      : item.status === "revisar"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"
      : "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300";

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{item.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {item.whatsapp ?? "Sem WhatsApp"} · Venc. {fmtDateBRPublic(item.due_date)} · {fmtBRLPublic(item.amount_cents)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <span className={"rounded-full px-2 py-0.5 text-[10px] font-medium " + priorityCls}>
            {item.priority}
          </span>
          <span className={"rounded-full px-2 py-0.5 text-[10px] font-medium " + statusCls}>
            {item.status}
          </span>
        </div>
      </div>
      <p className="mb-1 text-xs">
        <span className="font-medium">{item.kindLabel}</span>
        <span className="text-muted-foreground"> · {item.reason}</span>
      </p>
      {item.warning && (
        <p className="mb-2 rounded-md border border-amber-300/50 bg-amber-50 px-2 py-1 text-[11px] text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-100">
          ⚠ {item.warning}
        </p>
      )}
      {item.message ? (
        <>
          {revealOpen && (
            <pre className="mb-2 whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-2 text-[11px] text-foreground">
              {item.message}
            </pre>
          )}
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" onClick={onCopy}>Copiar mensagem</Button>
            <Button size="sm" variant="outline" onClick={onToggleReveal}>
              {revealOpen ? "Ocultar" : "Ver mensagem"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onMarkCopied}>Marcar copiado</Button>
            <Button size="sm" variant="ghost" onClick={onIgnore}>Ignorar</Button>
            <Button size="sm" variant="ghost" onClick={onReview}>Revisar</Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="ghost" onClick={onReview}>Marcar revisado</Button>
          <Button size="sm" variant="ghost" onClick={onIgnore}>Ignorar</Button>
        </div>
      )}
    </div>
  );
}
