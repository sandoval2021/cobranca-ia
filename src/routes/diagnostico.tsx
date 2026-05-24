import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  MinusCircle,
  Loader2,
  Database,
  Settings as SettingsIcon,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { supabase, supabaseConfigured } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/use-supabase";
import { useAuth } from "@/lib/use-auth";
import { flags } from "@/lib/flags";

export const Route = createFileRoute("/diagnostico")({ component: DiagnosticoPage });

type CheckStatus = "loading" | "ok" | "empty" | "denied" | "protected" | "error" | "not_configured";
type Check = { label: string; status: CheckStatus; detail?: string };

const TABLES = ["companies", "customers", "customer_charges", "messages", "ai_messages"];

async function runCheck(table: string, isAuthed: boolean): Promise<Check> {
  if (!supabaseConfigured || !supabase) return { label: table, status: "not_configured" };
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) {
    const m = friendlyError(error.message);
    const denied = /permiss/i.test(m);
    if (denied && !isAuthed) {
      return { label: table, status: "protected", detail: "Faça login para acessar" };
    }
    return { label: table, status: denied ? "denied" : "error", detail: m };
  }
  if (!count || count === 0) return { label: table, status: "empty" };
  return { label: table, status: "ok", detail: `${count} registros` };
}

function ui(s: CheckStatus) {
  switch (s) {
    case "loading":
      return { icon: Loader2, color: "text-muted-foreground", text: "Verificando...", spin: true };
    case "ok":
      return { icon: CheckCircle2, color: "text-success", text: "Conectado" };
    case "empty":
      return { icon: MinusCircle, color: "text-warning", text: "Sem dados demo" };
    case "protected":
      return { icon: MinusCircle, color: "text-muted-foreground", text: "Protegido — faça login" };
    case "denied":
      return { icon: AlertCircle, color: "text-danger", text: "Permissão bloqueada" };
    case "not_configured":
      return { icon: AlertCircle, color: "text-danger", text: "Conexão não configurada" };
    case "error":
      return { icon: AlertCircle, color: "text-danger", text: "Erro de configuração" };
    default:
      return { icon: AlertCircle, color: "text-danger", text: "Desconhecido" };
  }
}

function DiagnosticoPage() {
  const { isAuthenticated, user } = useAuth();
  const [conn, setConn] = useState<Check>({ label: "Conexão Supabase", status: "loading" });
  const [checks, setChecks] = useState<Check[]>(
    TABLES.map((t) => ({ label: t, status: "loading" })),
  );

  useEffect(() => {
    (async () => {
      if (!supabaseConfigured) {
        setConn({
          label: "Conexão Supabase",
          status: "not_configured",
          detail: "Falta configurar o Supabase",
        });
        setChecks(TABLES.map((t) => ({ label: t, status: "not_configured" })));
        return;
      }
      setConn({
        label: "Conexão Supabase",
        status: "ok",
        detail: isAuthenticated ? `Sessão: ${user?.email ?? "ok"}` : "URL e chave presentes",
      });
      setChecks(TABLES.map((t) => ({ label: t, status: "loading" })));
      const results = await Promise.all(TABLES.map((t) => runCheck(t, isAuthenticated)));
      setChecks(results);
    })();
  }, [isAuthenticated, user?.id]);

  const connectedCount = checks.filter((c) => c.status === "ok").length;
  const allDone = checks.every((c) => c.status !== "loading");

  return (
    <PageContainer>
      <SectionHeader
        title="Diagnóstico"
        subtitle="Estado geral do ambiente"
        hint="Use esta tela para confirmar se tudo está conectado."
      />

      {/* Summary */}
      <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="mb-3 flex items-center gap-2">
          <SettingsIcon className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight">Resumo</h2>
        </div>
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <SummaryRow label="Supabase configurado" value={supabaseConfigured ? "Sim" : "Não"} ok={supabaseConfigured} />
          <SummaryRow label="Ambiente" value={flags.appEnv} ok />
          <SummaryRow
            label="Sessão"
            value={isAuthenticated ? (user?.email ?? "Logado") : "Não logado"}
            ok={isAuthenticated}
            invertOkColor
          />
          <SummaryRow label="Pagamentos reais" value={flags.allowRealPayments ? "Liberado" : "Bloqueado"} ok={!flags.allowRealPayments} invertOkColor />
          <SummaryRow label="WhatsApp real" value={flags.allowRealWhatsapp ? "Liberado" : "Bloqueado"} ok={!flags.allowRealWhatsapp} invertOkColor />
          <SummaryRow label="IA real" value={flags.allowRealAi ? "Liberada" : "Bloqueada"} ok={!flags.allowRealAi} invertOkColor />
          <SummaryRow
            label="Tabelas conectadas"
            value={allDone ? `${connectedCount} de ${TABLES.length}` : "Verificando..."}
            ok={connectedCount === TABLES.length}
          />
        </dl>
        {!supabaseConfigured && (
          <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
            Conexão não configurada. Verifique as variáveis do Supabase no ambiente do Lovable e republique o app.
          </p>
        )}
      </div>

      <Row check={conn} />
      <div className="mt-3 flex items-center gap-2 px-1 pb-1">
        <Database className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tabelas demo
        </h3>
      </div>
      <div className="space-y-2">
        {checks.map((c) => (
          <Row key={c.label} check={c} />
        ))}
      </div>
    </PageContainer>
  );
}

function SummaryRow({
  label,
  value,
  ok,
  invertOkColor,
}: {
  label: string;
  value: string;
  ok: boolean;
  invertOkColor?: boolean;
}) {
  const tone = ok ? (invertOkColor ? "text-success" : "text-success") : "text-danger";
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-muted px-3 py-2">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className={"shrink-0 text-xs font-semibold " + tone}>{value}</dd>
    </div>
  );
}

function Row({ check }: { check: Check }) {
  const u = ui(check.status);
  const Icon = u.icon;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card">
      <div className={"flex h-9 w-9 items-center justify-center rounded-lg bg-surface-muted " + u.color}>
        <Icon className={"h-4 w-4 " + (u.spin ? "animate-spin" : "")} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm font-semibold">
          <Activity className="h-3.5 w-3.5 text-muted-foreground" /> {check.label}
        </p>
        <p className={"truncate text-xs " + u.color}>{u.text}</p>
      </div>
      {check.detail && (
        <span className="shrink-0 text-[11px] text-muted-foreground">{check.detail}</span>
      )}
    </div>
  );
}
