// Enriquecimento de linhas importadas:
// - casa valor importado com plano do catálogo (preco_cents)
// - escolhe label de mensagem (Plano R$X,XX | Padrão — revisar)
// - agrupa WhatsApp repetido como "telas/serviços"
// - monta observação estruturada para histórico
//
// Tudo client-side; não toca em RPC nem envia mensagem real.

import { listActiveServices, formatBRL, type ServiceItem } from "./services-catalog";
import type { ValidatedRow } from "./import-parse";

export type ImportEnrichment = {
  matched_service_id: string | null;
  plan_label: string;          // "Plano R$29,90" ou "Plano não definido"
  message_label: string;       // "Mensagem: Plano R$29,90" ou "Mensagem: Padrão — revisar"
  has_message_template: boolean;
  group_size: number;          // 1 quando único; N quando o WhatsApp se repete no arquivo
  group_conflict: null | "valor" | "vencimento" | "valor_e_vencimento";
  observation: string;         // bloco de texto pronto p/ salvar em observações
};

function findServiceByAmount(
  services: ServiceItem[],
  amount_cents: number | null,
): ServiceItem | null {
  if (amount_cents == null) return null;
  return services.find((s) => s.preco_cents === amount_cents) ?? null;
}

function planLabelFor(amount_cents: number | null): string {
  if (amount_cents == null) return "Plano não definido";
  return `Plano ${formatBRL(amount_cents)}`;
}

function hasCobrancaTemplate(svc: ServiceItem | null): boolean {
  if (!svc) return false;
  return svc.messages.some(
    (m) => m.kind === "cobranca" && (m.template ?? "").trim().length > 0,
  );
}

function fmtBR(iso: string | null, fallback: string | null): string {
  if (iso) {
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
  }
  return fallback?.trim() || "—";
}

function fmtAmount(cents: number | null, raw: string | null): string {
  if (cents != null) return formatBRL(cents);
  return raw?.trim() || "—";
}

function buildObservation(
  row: ValidatedRow,
  groupRows: ValidatedRow[],
  enrich: { plan_label: string; message_label: string },
): string {
  const lines: string[] = ["Importação:"];
  if (row.external_code) lines.push(`- Código original: ${row.external_code}`);
  if (row.external_customer_code)
    lines.push(`- Código cliente: ${row.external_customer_code}`);
  lines.push(`- Plano importado: ${row.service_name ?? "—"}`);
  lines.push(`- Valor importado: ${fmtAmount(row.amount_cents, row.amount_raw)}`);
  lines.push(`- Vencimento importado: ${fmtBR(row.expires_at, row.expires_raw)}`);
  lines.push(`- Status importado: ${row.situation ?? "—"}`);
  lines.push(`- Situação importada: ${row.situation ?? "—"}`);
  lines.push(`- Mensagem selecionada: ${enrich.message_label}`);
  lines.push(`- Plano casado: ${enrich.plan_label}`);

  if (groupRows.length > 1) {
    lines.push("");
    lines.push(
      `Telas/serviços agrupados (mesmo WhatsApp ${groupRows[0].whatsapp_e164 ?? "—"}): ${groupRows.length}`,
    );
    groupRows.forEach((r, i) => {
      lines.push(
        `  ${i + 1}. ${r.service_name ?? "—"} | ${fmtAmount(r.amount_cents, r.amount_raw)} | venc ${fmtBR(r.expires_at, r.expires_raw)} | ${r.situation ?? "—"}`,
      );
    });
  }

  return lines.join("\n");
}

function detectGroupConflict(groupRows: ValidatedRow[]): ImportEnrichment["group_conflict"] {
  if (groupRows.length <= 1) return null;
  const amounts = new Set(
    groupRows.map((r) => (r.amount_cents == null ? "?" : String(r.amount_cents))),
  );
  const dates = new Set(
    groupRows.map((r) => (r.expires_at ?? r.expires_raw ?? "?")),
  );
  const valorConf = amounts.size > 1;
  const venciConf = dates.size > 1;
  if (valorConf && venciConf) return "valor_e_vencimento";
  if (valorConf) return "valor";
  if (venciConf) return "vencimento";
  return null;
}

/**
 * Enriquece todas as linhas: casa serviço por valor, escolhe mensagem,
 * calcula tamanho do grupo (WhatsApp repetido) e monta observação.
 */
export function enrichImportRows(rows: ValidatedRow[]): ImportEnrichment[] {
  const services = listActiveServices();

  // Agrupa por whatsapp_e164 (apenas linhas com whatsapp válido).
  const groups = new Map<string, ValidatedRow[]>();
  for (const r of rows) {
    if (!r.whatsapp_e164) continue;
    const arr = groups.get(r.whatsapp_e164) ?? [];
    arr.push(r);
    groups.set(r.whatsapp_e164, arr);
  }

  return rows.map((r) => {
    const svc = findServiceByAmount(services, r.amount_cents);
    const hasTpl = hasCobrancaTemplate(svc);
    const plan_label = planLabelFor(r.amount_cents);
    const message_label = hasTpl
      ? `Mensagem: ${plan_label}`
      : "Mensagem: Padrão — revisar";

    const groupRows = r.whatsapp_e164 ? (groups.get(r.whatsapp_e164) ?? [r]) : [r];
    const group_size = groupRows.length;
    const group_conflict = detectGroupConflict(groupRows);

    const observation = buildObservation(r, groupRows, { plan_label, message_label });

    return {
      matched_service_id: svc?.id ?? null,
      plan_label,
      message_label,
      has_message_template: hasTpl,
      group_size,
      group_conflict,
      observation,
    };
  });
}

/** Resumo agregado para mostrar no topo da prévia. */
export type ImportSummary = {
  total: number;
  valid: number;
  invalid: number;
  duplicates_file: number;
  unique_whatsapps: number;
  amounts_recognized: number;
  dates_recognized: number;
  plans_recognized: number;
  messages_matched: number;
  messages_default: number;
  conflicts: number;
};

export function summarizeImport(
  rows: ValidatedRow[],
  enrichments: ImportEnrichment[],
): ImportSummary {
  const uniqWa = new Set<string>();
  let amounts = 0;
  let dates = 0;
  let plans = 0;
  let matched = 0;
  let def = 0;
  let conflicts = 0;
  let valid = 0;
  let invalid = 0;
  let dup = 0;

  rows.forEach((r, i) => {
    if (r.whatsapp_e164) uniqWa.add(r.whatsapp_e164);
    if (r.amount_cents != null) amounts++;
    if (r.expires_at) dates++;
    if (r.service_name) plans++;
    if (r.status === "valid") valid++;
    else if (r.status === "duplicate") dup++;
    else invalid++;

    const e = enrichments[i];
    if (!e) return;
    if (e.has_message_template) matched++;
    else def++;
    if (e.group_conflict) conflicts++;
  });

  return {
    total: rows.length,
    valid,
    invalid,
    duplicates_file: dup,
    unique_whatsapps: uniqWa.size,
    amounts_recognized: amounts,
    dates_recognized: dates,
    plans_recognized: plans,
    messages_matched: matched,
    messages_default: def,
    conflicts,
  };
}
