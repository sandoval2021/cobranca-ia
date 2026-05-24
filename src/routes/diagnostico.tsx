import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, CheckCircle2, AlertCircle, MinusCircle, Loader2 } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { supabase, supabaseConfigured } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/use-supabase";

export const Route = createFileRoute("/diagnostico")({ component: DiagnosticoPage });

type Check = {
  label: string;
  status: "loading" | "ok" | "empty" | "denied" | "error" | "not_configured";
  detail?: string;
};

const TABLES = ["companies", "customers", "customer_charges", "messages", "ai_messages"];

async function runCheck(table: string): Promise<Check> {
  if (!supabaseConfigured || !supabase) {
    return { label: table, status: "not_configured" };
  }
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) {
    const m = friendlyError(error.message);
    const denied = /permiss/i.test(m);
    return {
      label: table,
      status: denied ? "denied" : "error",
      detail: m,
    };
  }
  if (!count || count === 0) return { label: table, status: "empty" };
  return { label: table, status: "ok", detail: `${count} registros` };
}

function statusUi(s: Check["status"]) {
  switch (s) {
    case "loading":
      return { icon: Loader2, color: "text-muted-foreground", text: "Verificando...", spin: true };
    case "ok":
      return { icon: CheckCircle2, color: "text-success", text: "Conectado" };
    case "empty":
      return { icon: MinusCircle, color: "text-warning", text: "Sem dados demo" };
    case "denied":
      return { icon: AlertCircle, color: "text-danger", text: "Permissão bloqueada" };
    case "not_configured":
      return { icon: AlertCircle, color: "text-danger", text: "Erro de configuração" };
    case "error":
      return { icon: AlertCircle, color: "text-danger", text: "Erro de leitura" };
  }
}

function DiagnosticoPage() {
  const [conn, setConn] = useState<Check>({ label: "Conexão", status: "loading" });
  const [checks, setChecks] = useState<Check[]>(
    TABLES.map((t) => ({ label: t, status: "loading" })),
  );

  useEffect(() => {
    (async () => {
      if (!supabaseConfigured) {
        setConn({ label: "Conexão", status: "not_configured", detail: "Variáveis ausentes" });
        setChecks(TABLES.map((t) => ({ label: t, status: "not_configured" })));
        return;
      }
      setConn({ label: "Conexão", status: "ok", detail: "URL e chave presentes" });
      const results = await Promise.all(TABLES.map(runCheck));
      setChecks(results);
    })();
  }, []);

  return (
    <PageContainer>
      <SectionHeader
        title="Diagnóstico"
        subtitle="Verifica a conexão e a leitura das tabelas"
        hint="Use para confirmar se o ambiente está saudável."
      />
      <Row check={conn} />
      <div className="mt-3 space-y-2">
        {checks.map((c) => (
          <Row key={c.label} check={c} />
        ))}
      </div>
    </PageContainer>
  );
}

function Row({ check }: { check: Check }) {
  const ui = statusUi(check.status);
  const Icon = ui.icon;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card">
      <div className={"flex h-9 w-9 items-center justify-center rounded-lg bg-surface-muted " + ui.color}>
        <Icon className={"h-4 w-4 " + (ui.spin ? "animate-spin" : "")} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-muted-foreground" /> {check.label}
        </p>
        <p className={"truncate text-xs " + ui.color}>{ui.text}</p>
      </div>
      {check.detail && (
        <span className="shrink-0 text-[11px] text-muted-foreground">{check.detail}</span>
      )}
    </div>
  );
}
