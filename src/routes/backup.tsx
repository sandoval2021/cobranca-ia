import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  ShieldCheck, Download, Clock, AlertTriangle, Info, HelpCircle,
} from "lucide-react";

import { PageContainer } from "@/components/layout/PageContainer";
import { SectionHeader } from "@/components/ui-premium/SectionHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCurrentCompany, listCustomersAdmin } from "@/lib/rpc-admin";
import { downloadCsv } from "@/lib/import-report";

export const Route = createFileRoute("/backup")({
  head: () => ({
    meta: [
      { title: "Backup e segurança dos dados — Cobrança IA" },
      { name: "description", content: "Exporte cópias de segurança dos seus clientes e veja avisos sobre a proteção dos seus dados." },
    ],
  }),
  component: BackupPage,
});

type Row = Record<string, unknown>;

const str = (r: Row, keys: string[]): string | null => {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
};
const num = (r: Row, keys: string[]): number | null => {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "number" && !isNaN(v)) return v;
    if (typeof v === "string" && v.trim() && !isNaN(Number(v))) return Number(v);
  }
  return null;
};
const toIsoDate = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
  const m2 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
  return null;
};
const todayIso = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const escapeCsv = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  if (/[;"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};
const formatBRL = (cents: number | null): string => {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
};
const formatDate = (iso: string | null): string => {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
};

type Scope = "todos" | "vencidos" | "em-dia";

async function fetchAllCustomers(companyId: string): Promise<Row[]> {
  const all: Row[] = [];
  const limit = 500;
  let offset = 0;
  // safety cap to avoid runaway loops
  for (let i = 0; i < 50; i++) {
    const res = await listCustomersAdmin({
      p_company_id: companyId, p_limit: limit, p_offset: offset,
    });
    if (!res.ok) throw new Error("rpc");
    const batch = (res.data as Row[] | null) ?? [];
    all.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  return all;
}

function buildCustomersCsv(rows: Row[]): string {
  const header = ["Nome", "WhatsApp", "Valor (R$)", "Vencimento", "Status", "Observações"];
  const lines = rows.map((r) => {
    const name = str(r, ["name", "nome", "full_name"]) ?? "";
    const whatsapp = str(r, ["whatsapp_e164", "whatsapp", "phone", "telefone"]) ?? "";
    const cents = num(r, ["amount_cents"]) ??
      (num(r, ["amount", "valor", "value", "monthly_amount"]) !== null
        ? Math.round((num(r, ["amount", "valor", "value", "monthly_amount"]) as number) * 100)
        : null);
    const due = toIsoDate(r["due_date"]) ?? toIsoDate(r["expires_at"]) ?? toIsoDate(r["vencimento"]);
    const status = str(r, ["status", "situacao"]) ?? "";
    const notes = str(r, ["notes", "observacoes", "observacao"]) ?? "";
    return [name, whatsapp, formatBRL(cents), formatDate(due), status, notes]
      .map(escapeCsv).join(";");
  });
  return "\uFEFF" + [header.join(";"), ...lines].join("\r\n");
}

function filterScope(rows: Row[], scope: Scope): Row[] {
  if (scope === "todos") return rows;
  const today = todayIso();
  return rows.filter((r) => {
    const status = (str(r, ["status", "situacao"]) ?? "").toLowerCase();
    if (status === "arquivado" || status === "arquivada") return false;
    const due = toIsoDate(r["due_date"]) ?? toIsoDate(r["expires_at"]) ?? toIsoDate(r["vencimento"]);
    if (!due) return scope === "em-dia";
    if (scope === "vencidos") return due < today;
    return due >= today;
  });
}

function BackupPage() {
  const company = useCurrentCompany();
  const [busy, setBusy] = useState<Scope | null>(null);

  const handleExport = useCallback(async (scope: Scope) => {
    if (company.status !== "ready") {
      toast.error("Sua conta ainda está sendo preparada. Tente novamente em alguns segundos.");
      return;
    }
    setBusy(scope);
    try {
      const all = await fetchAllCustomers(company.companyId);
      const filtered = filterScope(all, scope);
      if (filtered.length === 0) {
        toast.info("Nenhum cliente encontrado para esse filtro.");
        return;
      }
      const csv = buildCustomersCsv(filtered);
      const ymd = todayIso();
      downloadCsv(`clientes-${scope}-${ymd}.csv`, csv);
      toast.success(`Exportado: ${filtered.length} cliente(s).`);
    } catch {
      toast.error("Não foi possível exportar agora. Tente novamente.");
    } finally {
      setBusy(null);
    }
  }, [company]);

  const ready = company.status === "ready";

  return (
    <PageContainer>
      <SectionHeader
        title="Backup e segurança dos dados"
        subtitle="Proteja sua base. Exporte cópias dos seus clientes sempre que precisar."
      />

      {/* 1. Segurança dos dados */}
      <Card className="space-y-2 p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <h3 className="text-sm font-semibold">Segurança dos dados</h3>
        </div>
        <p className="text-sm text-foreground/80">
          Seus clientes, vencimentos, valores e observações ficam salvos no sistema.
        </p>
        <p className="text-xs text-muted-foreground">
          Você só vê e exporta dados da sua própria empresa.
        </p>
      </Card>

      {/* 2. Exportação de segurança */}
      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5 text-sky-600" />
          <h3 className="text-sm font-semibold">Exportação de segurança</h3>
        </div>
        <p className="text-sm text-foreground/80">
          Baixe sua lista de clientes em planilha (CSV compatível com Excel).
        </p>
        <div className="grid grid-cols-1 gap-2">
          <Button
            onClick={() => handleExport("todos")}
            disabled={!ready || busy !== null}
            className="h-12 justify-start gap-2"
          >
            <Download className="h-4 w-4" />
            {busy === "todos" ? "Gerando..." : "Exportar todos os clientes"}
          </Button>
          <Button
            onClick={() => handleExport("vencidos")}
            disabled={!ready || busy !== null}
            variant="outline"
            className="h-12 justify-start gap-2"
          >
            <Download className="h-4 w-4" />
            {busy === "vencidos" ? "Gerando..." : "Exportar clientes vencidos"}
          </Button>
          <Button
            onClick={() => handleExport("em-dia")}
            disabled={!ready || busy !== null}
            variant="outline"
            className="h-12 justify-start gap-2"
          >
            <Download className="h-4 w-4" />
            {busy === "em-dia" ? "Gerando..." : "Exportar clientes em dia"}
          </Button>
        </div>
        {!ready && (
          <p className="text-xs text-muted-foreground">
            Entre na sua conta para liberar a exportação.
          </p>
        )}
        <p className="flex items-start gap-1 text-xs text-muted-foreground">
          <HelpCircle className="mt-0.5 h-3 w-3 shrink-0" />
          Os relatórios de importação ficam disponíveis na tela <strong>Importar clientes</strong>, logo após cada importação.
        </p>
      </Card>

      {/* 3. Backup automático — honesto */}
      <Card className="space-y-2 border-dashed p-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Backup automático</h3>
        </div>
        <p className="text-sm text-foreground/80">
          Backup automático será exibido aqui quando estiver ativo.
        </p>
        <p className="text-xs text-muted-foreground">
          Por enquanto, use os botões de exportação acima para guardar cópias dos seus dados.
        </p>
      </Card>

      {/* 4. Cuidados importantes */}
      <Card className="space-y-2 p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <h3 className="text-sm font-semibold">Cuidados importantes</h3>
        </div>
        <ul className="space-y-1.5 text-sm text-foreground/80">
          <li>• Antes de apagar clientes, exporte uma cópia.</li>
          <li>• Depois de importar muitos clientes, confira o relatório de importação.</li>
          <li>• Guarde seus relatórios em local seguro (e-mail, nuvem ou pendrive).</li>
          <li>• Evite compartilhar sua senha com outras pessoas.</li>
        </ul>
      </Card>

      {/* 5. Histórico de ações — placeholder honesto */}
      <Card className="space-y-2 border-dashed p-4">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Histórico de ações importantes</h3>
        </div>
        <p className="text-sm text-foreground/80">
          Histórico detalhado será exibido aqui quando estiver ativo.
        </p>
        <p className="text-xs text-muted-foreground">
          Vamos registrar criação, renovação, arquivamento, importações e exportações.
        </p>
      </Card>

      {/* 6. Dados que importam */}
      <Card className="space-y-2 p-4">
        <h3 className="text-sm font-semibold">O que protegemos</h3>
        <ul className="grid grid-cols-1 gap-1 text-sm text-foreground/80 sm:grid-cols-2">
          <li className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Clientes</li>
          <li className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> WhatsApp</li>
          <li className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Serviços e telas</li>
          <li className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Valores</li>
          <li className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Vencimentos</li>
          <li className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Status</li>
          <li className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Observações</li>
          <li className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Histórico de importação</li>
          <li className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Renovações</li>
          <li className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Cobranças manuais</li>
        </ul>
      </Card>
    </PageContainer>
  );
}
