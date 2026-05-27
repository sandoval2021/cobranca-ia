// FASE 3 — Relatório pós-importação + exportação CSV (compatível com Excel).
//
// Sem dependências novas: gera CSV UTF-8 com BOM, separador `;` (padrão pt-BR
// no Excel), datas/valores em formato amigável.

import type { ValidatedRow } from "./import-parse";
import type { ImportEnrichment } from "./import-mapping";

export type ImportStatusFinal =
  | "importado"
  | "atualizado"
  | "agrupado"
  | "conflito"
  | "duplicado_arquivo"
  | "erro"
  | "ignorado"
  | "pendente";

export type ReportContext = {
  rows: ValidatedRow[];
  enrichments: ImportEnrichment[];
  existingMap: Record<string, { name?: string; id?: string; status?: string }>;
  importedIdx: Set<number>;
  forcedIdx: Set<number>;
  skippedIdx: Set<number>;
  notImportedIdx: number[];
};

function statusFor(i: number, ctx: ReportContext): ImportStatusFinal {
  const r = ctx.rows[i];
  if (ctx.skippedIdx.has(i)) return "ignorado";
  if (r.status === "invalid") return ctx.forcedIdx.has(i) ? "importado" : "erro";
  if (r.status === "duplicate")
    return ctx.forcedIdx.has(i) ? "importado" : "duplicado_arquivo";
  // valid:
  if (!ctx.importedIdx.has(i) && !ctx.forcedIdx.has(i)) return "pendente";
  const e = ctx.enrichments[i];
  if (e?.group_conflict) return "conflito";
  if (e && e.group_size > 1) return "agrupado";
  if (r.whatsapp_e164 && ctx.existingMap[r.whatsapp_e164]) return "atualizado";
  return "importado";
}

function reasonFor(i: number, ctx: ReportContext): string {
  const r = ctx.rows[i];
  if (r.status === "invalid" && !ctx.forcedIdx.has(i)) return r.errors.join(", ");
  if (r.status === "duplicate" && !ctx.forcedIdx.has(i))
    return "Linha duplicada dentro do arquivo";
  const e = ctx.enrichments[i];
  if (e?.group_conflict) return `Conflito de ${e.group_conflict.replace("_", " e ")}`;
  return "";
}

function fmtBR(iso: string | null, fallback: string | null): string {
  if (iso) {
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
  }
  return fallback?.trim() || "";
}

function fmtAmount(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const COLUMNS = [
  "linha_original",
  "status_importacao",
  "motivo_erro",
  "nome",
  "whatsapp_original",
  "whatsapp_normalizado",
  "valor_detectado",
  "vencimento_detectado",
  "status_detectado",
  "situacao_detectada",
  "plano_detectado",
  "mensagem_detectada",
  "telas_detectadas",
  "grupo_whatsapp",
  "linha_principal",
  "conflito_valor",
  "conflito_vencimento",
  "observacao",
  "cliente_id",
  "data_importacao",
] as const;

function escapeCsv(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  // CSV pt-BR usa `;` como separador; escapa aspas duplas e quebras.
  if (/[";\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowToRecord(i: number, ctx: ReportContext): Record<string, string> {
  const r = ctx.rows[i];
  const e = ctx.enrichments[i];
  const status = statusFor(i, ctx);
  const reason = reasonFor(i, ctx);
  const ex = r.whatsapp_e164 ? ctx.existingMap[r.whatsapp_e164] : undefined;
  const conflictAmount = e?.group_conflict === "valor" || e?.group_conflict === "valor_e_vencimento";
  const conflictDate =
    e?.group_conflict === "vencimento" || e?.group_conflict === "valor_e_vencimento";
  return {
    linha_original: String(i + 1),
    status_importacao: status,
    motivo_erro: reason,
    nome: r.customer_name ?? "",
    whatsapp_original: r.whatsapp_raw ?? "",
    whatsapp_normalizado: r.whatsapp_e164 ?? "",
    valor_detectado: fmtAmount(r.amount_cents),
    vencimento_detectado: fmtBR(r.expires_at, r.expires_raw),
    status_detectado: r.status,
    situacao_detectada: r.situation ?? "",
    plano_detectado: e?.plan_label ?? "",
    mensagem_detectada: e?.message_label ?? "",
    telas_detectadas: String(e?.group_size ?? 1),
    grupo_whatsapp: e && e.group_size > 1 ? (r.whatsapp_e164 ?? "") : "",
    linha_principal:
      e && e.group_size > 1
        ? // a linha principal é a 1ª aparição do whatsapp no array
          ctx.rows.findIndex((x) => x.whatsapp_e164 && x.whatsapp_e164 === r.whatsapp_e164) === i
          ? "SIM"
          : "NAO"
        : "SIM",
    conflito_valor: conflictAmount ? "SIM" : "NAO",
    conflito_vencimento: conflictDate ? "SIM" : "NAO",
    observacao: e?.observation ?? "",
    cliente_id: ex?.id ?? "",
    data_importacao: new Date().toISOString(),
  };
}

export type ReportScope = "completo" | "erros" | "conflitos" | "importados";

function indicesForScope(scope: ReportScope, ctx: ReportContext): number[] {
  const all = ctx.rows.map((_, i) => i);
  if (scope === "completo") return all;
  if (scope === "erros")
    return all.filter((i) => {
      const s = statusFor(i, ctx);
      return s === "erro" || s === "pendente" || s === "duplicado_arquivo";
    });
  if (scope === "conflitos")
    return all.filter((i) => statusFor(i, ctx) === "conflito");
  // importados
  return all.filter((i) => {
    const s = statusFor(i, ctx);
    return s === "importado" || s === "atualizado" || s === "agrupado";
  });
}

export function buildReportCsv(scope: ReportScope, ctx: ReportContext): string {
  const idx = indicesForScope(scope, ctx);
  const header = COLUMNS.join(";");
  const lines = idx.map((i) => {
    const rec = rowToRecord(i, ctx);
    return COLUMNS.map((c) => escapeCsv(rec[c])).join(";");
  });
  // BOM para Excel reconhecer UTF-8.
  return "\uFEFF" + [header, ...lines].join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ----------------------- Resumo amigável -------------------------------------

export type FinalSummary = {
  total_lido: number;
  whatsapps_unicos: number;
  whatsapps_repetidos_agrupados: number;
  clientes_criados: number;
  clientes_atualizados: number;
  linhas_ignoradas: number;
  linhas_com_erro: number;
  conflitos_valor: number;
  conflitos_vencimento: number;
  telas_servicos_detectados: number;
  texto_amigavel: string;
};

export function buildFinalSummary(
  ctx: ReportContext,
  totals: { imported: number; updated: number },
): FinalSummary {
  const uniq = new Set<string>();
  let repeated = 0;
  let totalScreens = 0;
  let conflitoValor = 0;
  let conflitoVenc = 0;
  const seenWa = new Set<string>();
  ctx.rows.forEach((r, i) => {
    if (r.whatsapp_e164) {
      uniq.add(r.whatsapp_e164);
      if (seenWa.has(r.whatsapp_e164)) {
        // já contado
      } else {
        seenWa.add(r.whatsapp_e164);
      }
    }
    const e = ctx.enrichments[i];
    if (!e) return;
    if (e.group_size > 1) {
      // contamos cada grupo apenas uma vez (na linha principal)
      const firstIdx = ctx.rows.findIndex(
        (x) => x.whatsapp_e164 && x.whatsapp_e164 === r.whatsapp_e164,
      );
      if (firstIdx === i) {
        repeated++;
        totalScreens += e.group_size;
      }
      if (e.group_conflict === "valor" || e.group_conflict === "valor_e_vencimento") {
        if (firstIdx === i) conflitoValor++;
      }
      if (
        e.group_conflict === "vencimento" ||
        e.group_conflict === "valor_e_vencimento"
      ) {
        if (firstIdx === i) conflitoVenc++;
      }
    }
  });

  const errored = ctx.rows.filter(
    (r, i) =>
      (r.status === "invalid" || r.status === "duplicate") &&
      !ctx.forcedIdx.has(i) &&
      !ctx.skippedIdx.has(i),
  ).length;
  const ignored = ctx.skippedIdx.size;
  const total = ctx.rows.length;

  const pieces: string[] = [];
  const ok = totals.imported + totals.updated;
  pieces.push(
    `Importação concluída. ${ok.toLocaleString("pt-BR")} clientes foram importados/atualizados.`,
  );
  if (repeated > 0) {
    pieces.push(
      `${repeated.toLocaleString("pt-BR")} WhatsApps repetidos foram agrupados como ${totalScreens.toLocaleString("pt-BR")} telas/serviços.`,
    );
  }
  if (errored > 0) {
    pieces.push(`${errored.toLocaleString("pt-BR")} linhas precisam de revisão.`);
  }

  return {
    total_lido: total,
    whatsapps_unicos: uniq.size,
    whatsapps_repetidos_agrupados: repeated,
    clientes_criados: totals.imported,
    clientes_atualizados: totals.updated,
    linhas_ignoradas: ignored,
    linhas_com_erro: errored,
    conflitos_valor: conflitoValor,
    conflitos_vencimento: conflitoVenc,
    telas_servicos_detectados: totalScreens,
    texto_amigavel: pieces.join(" "),
  };
}
