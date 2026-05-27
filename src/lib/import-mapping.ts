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

// =============================================================================
// FASE 2 — Agrupamento por WhatsApp antes do envio para a RPC.
//
// Mesmo WhatsApp aparecendo N vezes deve virar 1 cliente + N telas/serviços,
// nunca N clientes. Aqui consolidamos as linhas válidas em 1 payload por
// WhatsApp, preservando todos os dados das linhas originais em `notes` e
// `raw_row.members` para não perder histórico em caso de conflito.
// =============================================================================

export type GroupedImportRow = {
  external_code: string | null;
  external_customer_code: string | null;
  customer_name: string | null;
  whatsapp_e164: string;
  service_name: string | null;
  amount_cents: number | null;
  expires_at: string | null;
  situation: string | null;
  notes: string;
  raw_row: Record<string, unknown> & {
    group_size: number;
    group_conflict: ImportEnrichment["group_conflict"];
    matched_service_id: string | null;
    plan_label: string | null;
    message_label: string | null;
    observation: string;
    primary_row_index: number;
    member_row_indices: number[];
    members: Array<Record<string, unknown>>;
    conflicting_amounts_cents?: number[];
    conflicting_expires_at?: string[];
  };
};

export type GroupingReport = {
  payload: GroupedImportRow[];
  groupedCount: number;
  uniqueWhatsapps: number;
  repeatedWhatsapps: number;
  totalScreens: number;
  conflicts: number;
  skippedNoWhatsapp: number;
};

function pickPrimaryIndex(group: Array<{ row: ValidatedRow; idx: number }>): number {
  // Critério seguro: mais recente vencimento -> maior valor -> primeira ocorrência.
  let bestIdx = group[0].idx;
  let bestDate = group[0].row.expires_at ?? "";
  let bestAmount = group[0].row.amount_cents ?? -1;
  for (const g of group.slice(1)) {
    const d = g.row.expires_at ?? "";
    const a = g.row.amount_cents ?? -1;
    if (d > bestDate || (d === bestDate && a > bestAmount)) {
      bestIdx = g.idx;
      bestDate = d;
      bestAmount = a;
    }
  }
  return bestIdx;
}

/**
 * Agrupa linhas válidas por WhatsApp normalizado. Linhas sem WhatsApp são
 * preservadas como entradas individuais (não dá para deduplicar sem chave).
 *
 * - Escolhe 1 linha principal por WhatsApp (vencimento mais recente, depois valor).
 * - Preserva cada linha original em `raw_row.members`.
 * - Monta observação humana com Tela 1 / Tela 2 / ... a partir de `enrichImportRows`.
 * - Marca conflitos sem perder nenhum dado.
 */
export function groupValidRowsByWhatsApp(
  validRows: ValidatedRow[],
  enrichments: ImportEnrichment[],
  rowIndexOf: (r: ValidatedRow) => number,
): GroupingReport {
  const groupsByWa = new Map<string, Array<{ row: ValidatedRow; idx: number }>>();
  const noWa: Array<{ row: ValidatedRow; idx: number }> = [];

  for (const row of validRows) {
    const idx = rowIndexOf(row);
    if (!row.whatsapp_e164) {
      noWa.push({ row, idx });
      continue;
    }
    const arr = groupsByWa.get(row.whatsapp_e164) ?? [];
    arr.push({ row, idx });
    groupsByWa.set(row.whatsapp_e164, arr);
  }

  const payload: GroupedImportRow[] = [];
  let conflicts = 0;
  let repeated = 0;
  let totalScreens = 0;

  for (const [wa, members] of groupsByWa.entries()) {
    totalScreens += members.length;
    if (members.length > 1) repeated++;
    const primaryIdx = pickPrimaryIndex(members);
    const primary = members.find((m) => m.idx === primaryIdx)!.row;
    const enrich = enrichments[primaryIdx];
    if (enrich?.group_conflict) conflicts++;

    const amounts = Array.from(
      new Set(members.map((m) => m.row.amount_cents).filter((v): v is number => v != null)),
    );
    const dates = Array.from(
      new Set(members.map((m) => m.row.expires_at).filter((v): v is string => !!v)),
    );

    const observation = enrich?.observation ?? "";

    payload.push({
      external_code: primary.external_code,
      external_customer_code: primary.external_customer_code,
      customer_name: primary.customer_name,
      whatsapp_e164: wa,
      service_name: primary.service_name,
      amount_cents: primary.amount_cents,
      expires_at: primary.expires_at,
      situation: primary.situation,
      notes: observation, // RPC lê v_row->>'notes'
      raw_row: {
        ...(primary.raw_row ?? {}),
        group_size: members.length,
        group_conflict: enrich?.group_conflict ?? null,
        matched_service_id: enrich?.matched_service_id ?? null,
        plan_label: enrich?.plan_label ?? null,
        message_label: enrich?.message_label ?? null,
        observation,
        primary_row_index: primaryIdx,
        member_row_indices: members.map((m) => m.idx),
        members: members.map((m) => ({
          row_index: m.idx,
          external_code: m.row.external_code,
          external_customer_code: m.row.external_customer_code,
          customer_name: m.row.customer_name,
          service_name: m.row.service_name,
          amount_cents: m.row.amount_cents,
          amount_raw: m.row.amount_raw,
          expires_at: m.row.expires_at,
          expires_raw: m.row.expires_raw,
          situation: m.row.situation,
          raw_row: m.row.raw_row,
        })),
        ...(amounts.length > 1 ? { conflicting_amounts_cents: amounts } : {}),
        ...(dates.length > 1 ? { conflicting_expires_at: dates } : {}),
      },
    });
  }

  // Linhas sem WhatsApp viram entradas individuais (a RPC vai marcar como inválidas
  // se o nome também faltar). Mantemos para não esconder do usuário.
  for (const { row, idx } of noWa) {
    const enrich = enrichments[idx];
    payload.push({
      external_code: row.external_code,
      external_customer_code: row.external_customer_code,
      customer_name: row.customer_name,
      whatsapp_e164: "",
      service_name: row.service_name,
      amount_cents: row.amount_cents,
      expires_at: row.expires_at,
      situation: row.situation,
      notes: enrich?.observation ?? "",
      raw_row: {
        ...(row.raw_row ?? {}),
        group_size: 1,
        group_conflict: null,
        matched_service_id: enrich?.matched_service_id ?? null,
        plan_label: enrich?.plan_label ?? null,
        message_label: enrich?.message_label ?? null,
        observation: enrich?.observation ?? "",
        primary_row_index: idx,
        member_row_indices: [idx],
        members: [],
      },
    });
  }

  return {
    payload,
    groupedCount: payload.length,
    uniqueWhatsapps: groupsByWa.size,
    repeatedWhatsapps: repeated,
    totalScreens,
    conflicts,
    skippedNoWhatsapp: noWa.length,
  };
}
