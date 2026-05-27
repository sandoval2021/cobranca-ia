// Excel (.xlsx/.xls) parsing for client import.
// Uses dynamic import of `xlsx` so the library is only loaded when needed.

import type { RawRow } from "./import-parse";

// Synonym dictionary for smart column mapping
const FIELD_SYNONYMS: Record<string, string[]> = {
  customer_name: ["nome", "cliente", "nome cliente", "nome do cliente", "titular", "nome completo"],
  whatsapp_raw: ["whatsapp", "whats", "telefone", "celular", "contato", "numero", "número", "phone", "fone", "tel"],
  amount_raw: ["valor", "mensalidade", "preço", "preco", "plano valor", "valor plano", "valor mensal", "price"],
  expires_raw: ["vencimento", "vence", "expira", "validade", "data vencimento", "data de vencimento", "due date", "expires", "expira em", "data venc"],
  situation: ["status", "situação", "situacao", "ativo", "estado"],
  service_name: ["plano", "serviço", "servico", "pacote", "produto", "app", "aplicativo", "player", "servidor", "server", "painel"],
  external_code: ["código", "codigo", "code", "id"],
  external_customer_code: ["código cliente", "codigo cliente", "id cliente", "cliente id"],
};

const EXTRA_NOTE_KEYS = ["observação", "observacao", "obs", "descrição", "descricao", "notas", "anotações", "anotacoes", "usuário", "usuario", "login", "user", "mac", "key"];

// FASE 5.1 — Segurança/privacidade da importação Excel
// Chaves perigosas: evitar poluição de protótipo (CVE-2023-30533).
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

// Limite por célula para evitar travamento / mitigar ReDoS (CVE-2024-22363)
// na renderização de prévia e observações. Não limita o arquivo inteiro.
const MAX_CELL_CHARS = 2000;

// Padrões de rótulos sensíveis que NÃO devem ser exibidos em texto puro
// na prévia ou em relatórios. O dado pode ser preservado internamente,
// mas o que aparecer ao usuário/relatório vai mascarado.
const SENSITIVE_PATTERNS: Array<{ test: (l: string) => boolean; label: string }> = [
  { test: (l) => /\bsenha\b|\bpassword\b|\bpass\b/.test(l), label: "senha: não exibida por segurança" },
  { test: (l) => /\btoken\b/.test(l), label: "token: informado" },
  { test: (l) => /\bkey\b|\bchave\b/.test(l), label: "chave: informada" },
  { test: (l) => /\bmac\b/.test(l), label: "mac: informado" },
  { test: (l) => /\busuario\b|\busuário\b|\blogin\b|\buser\b/.test(l), label: "login: informado" },
];

function maskedSensitiveLabel(normalizedLabel: string): string | null {
  for (const p of SENSITIVE_PATTERNS) {
    if (p.test(normalizedLabel)) return p.label;
  }
  return null;
}

function safeKey(key: string): string | null {
  // Sanitiza chaves: nunca deixar chave perigosa entrar em qualquer objeto
  // que possa ser mesclado adiante (raw_row, notes, etc).
  const k = key.trim();
  if (!k) return null;
  if (DANGEROUS_KEYS.has(k)) return null;
  if (DANGEROUS_KEYS.has(k.toLowerCase())) return null;
  return k;
}

function truncateLong(value: string): { text: string; truncated: boolean } {
  if (value.length <= MAX_CELL_CHARS) return { text: value, truncated: false };
  return {
    text: value.slice(0, MAX_CELL_CHARS) + " […texto muito longo foi resumido para segurança]",
    truncated: true,
  };
}

function norm(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectFieldForHeader(header: string): keyof typeof FIELD_SYNONYMS | null {
  const h = norm(header);
  if (!h) return null;
  for (const field of Object.keys(FIELD_SYNONYMS) as Array<keyof typeof FIELD_SYNONYMS>) {
    const syns = FIELD_SYNONYMS[field];
    for (const syn of syns) {
      if (h === syn || h.includes(syn)) return field;
    }
  }
  return null;
}

// Excel serial date → "dd/mm/yyyy" string that validateRows understands
function excelSerialToBR(serial: number): string | null {
  if (!Number.isFinite(serial)) return null;
  // Excel epoch 1899-12-30 (accounts for 1900 leap bug)
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function cellToDateString(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    const dd = String(value.getDate()).padStart(2, "0");
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${value.getFullYear()}`;
  }
  if (typeof value === "number") {
    return excelSerialToBR(value);
  }
  return String(value).trim() || null;
}

function cellToString(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const raw = String(value);
  const { text } = truncateLong(raw);
  const s = text.trim();
  return s || null;
}

export type XlsxParseResult = {
  rows: RawRow[];
  sheetName: string;
  totalSheets: number;
  unmappedHeaders: string[];
  detectedHeaderRow: number; // 0-indexed within the sheet
};

/**
 * Parse an Excel file into RawRow[]. Dynamically imports the xlsx library so
 * it stays out of the main bundle until a user picks an Excel file.
 */
export async function parseExcelFile(file: File): Promise<XlsxParseResult> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    throw new Error("Planilha vazia.");
  }
  const sheet = wb.Sheets[sheetName];
  // Get a matrix; we detect the header row ourselves to tolerate title rows.
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  });

  if (matrix.length === 0) {
    return { rows: [], sheetName, totalSheets: wb.SheetNames.length, unmappedHeaders: [], detectedHeaderRow: 0 };
  }

  // Detect header row: the first row (within the first 10) that maps at least
  // 2 known fields, preferring rows that include whatsapp/nome.
  let headerRowIdx = 0;
  let bestScore = -1;
  const scan = Math.min(matrix.length, 10);
  for (let i = 0; i < scan; i++) {
    const row = matrix[i] ?? [];
    let score = 0;
    let hasKey = false;
    for (const cell of row) {
      const f = detectFieldForHeader(String(cell ?? ""));
      if (f) {
        score++;
        if (f === "whatsapp_raw" || f === "customer_name") hasKey = true;
      }
    }
    if (hasKey) score += 2;
    if (score > bestScore) {
      bestScore = score;
      headerRowIdx = i;
    }
  }

  const headerRow = matrix[headerRowIdx] ?? [];
  const columnMap = new Map<number, keyof typeof FIELD_SYNONYMS>();
  const unmapped: { index: number; label: string }[] = [];
  headerRow.forEach((cell, idx) => {
    const label = String(cell ?? "").trim();
    if (!label) return;
    const field = detectFieldForHeader(label);
    if (field) {
      // first-wins to avoid overriding nome with cliente etc.
      if (!Array.from(columnMap.values()).includes(field)) {
        columnMap.set(idx, field);
        return;
      }
    }
    unmapped.push({ index: idx, label });
  });

  const rows: RawRow[] = [];
  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    // Skip fully empty rows
    if (row.every((c) => c == null || String(c).trim() === "")) continue;

    const raw: RawRow = {
      external_code: null,
      external_customer_code: null,
      customer_name: null,
      whatsapp_raw: null,
      service_name: null,
      amount_raw: null,
      expires_raw: null,
      situation: null,
    };

    columnMap.forEach((field, idx) => {
      const value = row[idx];
      if (field === "expires_raw") {
        raw.expires_raw = cellToDateString(value);
      } else if (field === "amount_raw") {
        raw.amount_raw = cellToString(value);
      } else {
        (raw as Record<string, string | null>)[field] = cellToString(value);
      }
    });

    // Preserve extras (unmapped columns + known "note" columns) in raw_row via service_name fallback / notes
    const extras: Record<string, unknown> = {};
    unmapped.forEach(({ index, label }) => {
      const v = row[index];
      if (v != null && String(v).trim() !== "") {
        const key = norm(label) || `col_${index}`;
        extras[key] = v instanceof Date ? v.toISOString() : v;
      }
    });
    // Also capture explicitly-note-ish columns even if they collided with another mapping
    headerRow.forEach((cell, idx) => {
      const label = norm(String(cell ?? ""));
      if (!label) return;
      if (EXTRA_NOTE_KEYS.some((k) => label.includes(k))) {
        const v = row[idx];
        if (v != null && String(v).trim() !== "") {
          extras[label] = v instanceof Date ? v.toISOString() : v;
        }
      }
    });

    // Ensure customer_name fallback
    if (!raw.customer_name) raw.customer_name = "Cliente";

    // Smuggle extras through service_name suffix so they end up in validated.raw_row
    if (Object.keys(extras).length > 0) {
      const extraStr = Object.entries(extras)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(" | ");
      raw.service_name = raw.service_name
        ? `${raw.service_name} — ${extraStr}`
        : extraStr;
    }

    rows.push(raw);
  }

  return {
    rows,
    sheetName,
    totalSheets: wb.SheetNames.length,
    unmappedHeaders: unmapped.map((u) => u.label),
    detectedHeaderRow: headerRowIdx,
  };
}
