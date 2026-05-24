// PDF/text parsing + normalization for client import.

export type RawRow = {
  external_code: string | null;
  external_customer_code: string | null;
  customer_name: string | null;
  whatsapp_raw: string | null;
  service_name: string | null;
  amount_raw: string | null;
  expires_raw: string | null;
  situation: string | null;
};

export type ValidatedRow = RawRow & {
  whatsapp_e164: string | null;
  amount_cents: number | null;
  expires_at: string | null;
  status: "valid" | "invalid" | "duplicate";
  errors: string[];
  raw_row: Record<string, unknown>;
};

// ---------- Normalizers ----------

export function normalizeWhatsApp(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = String(input).replace(/\D+/g, "");
  if (!digits) return null;
  let d = digits;
  // remove leading zeros
  d = d.replace(/^0+/, "");
  // already international with country code
  if (d.length >= 12 && d.length <= 15) return "+" + d;
  // Brazil local: 10 (fixo) or 11 (móvel) digits
  if (d.length === 10 || d.length === 11) return "+55" + d;
  // 12-13 starting with 55
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return "+" + d;
  return null;
}

export function normalizeAmount(input: string | null | undefined): number | null {
  if (input == null) return null;
  const s = String(input).trim();
  if (!s) return null;
  // remove R$, spaces
  let v = s.replace(/[^\d,.\-]/g, "");
  if (!v) return null;
  // handle "1.234,56" pt-BR vs "1234.56"
  if (v.includes(",") && v.includes(".")) {
    v = v.replace(/\./g, "").replace(",", ".");
  } else if (v.includes(",")) {
    v = v.replace(",", ".");
  }
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function normalizeDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = String(input).trim();
  // dd/mm/yyyy [hh:mm]
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const [, dd, mm, yyyy, hh = "00", mi = "00"] = m;
    const iso = `${yyyy}-${mm}-${dd}T${hh.padStart(2, "0")}:${mi}:00`;
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  // yyyy-mm-dd
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

// ---------- PDF extraction ----------

export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Use a worker bundled via Vite ?url
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  (pdfjs as any).GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const pdf = await (pdfjs as any).getDocument({ data: buf }).promise;
  const lines: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // group by approximate Y to reconstruct lines
    const items = content.items as Array<{ str: string; transform: number[] }>;
    const buckets = new Map<number, Array<{ x: number; s: string }>>();
    for (const it of items) {
      if (!it.str) continue;
      const y = Math.round(it.transform[5]);
      const x = it.transform[4] as number;
      if (!buckets.has(y)) buckets.set(y, []);
      buckets.get(y)!.push({ x, s: it.str });
    }
    const ys = Array.from(buckets.keys()).sort((a, b) => b - a);
    for (const y of ys) {
      const line = buckets
        .get(y)!
        .sort((a, b) => a.x - b.x)
        .map((p) => p.s)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (line) lines.push(line);
    }
  }
  return lines.join("\n");
}

// ---------- Field cleaners ----------

// Remove pipes, repeated separators, leftover phone fragments and codes from a name.
export function cleanCustomerName(
  raw: string | null | undefined,
  fallbackCode?: string | null,
): string | null {
  if (!raw) return friendlyFallback(fallbackCode);
  let s = String(raw);
  // strip pipes and bullets and stray punctuation
  s = s.replace(/[|¦•·]+/g, " ");
  // remove "+55" fragments and country code mentions
  s = s.replace(/\+?\s*55\b/g, " ");
  // remove header words that may leak in
  s = s.replace(/\b(C[óo]d(?:igo)?(?:\.?\s*cliente)?|Cliente|WhatsApp|Whats)\b/gi, " ");
  // remove standalone numbers/phone fragments (DDD, etc)
  s = s.replace(/\(\s*\d{1,3}\s*\)?/g, " ");
  s = s.replace(/\b\d{2,}\b/g, " ");
  // collapse separators like "/", "-", commas at edges
  s = s.replace(/[\/\-,;]{2,}/g, " ");
  // squash whitespace
  s = s.replace(/\s+/g, " ").trim();
  // strip leading/trailing junk punctuation
  s = s.replace(/^[\s\-\/.,;:]+|[\s\-\/.,;:]+$/g, "");
  if (!s || s.length < 2) return friendlyFallback(fallbackCode);
  // if what's left is just digits/punct, fallback
  if (!/[A-Za-zÀ-ÿ]/.test(s)) return friendlyFallback(fallbackCode);
  return s;
}

function friendlyFallback(code?: string | null): string {
  const c = (code ?? "").toString().trim();
  return c ? `Cliente importado ${c}` : "Cliente importado";
}

export function cleanServiceName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = String(raw);
  s = s.replace(/[|¦•·]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/^[\s\-\/.,;:]+|[\s\-\/.,;:]+$/g, "");
  return s || null;
}

export function cleanSituation(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).replace(/[^A-Za-zÀ-ÿ]/g, "").toLowerCase();
  if (!s) return null;
  if (s.startsWith("ativ")) return "Ativo";
  if (s.startsWith("expir") || s.startsWith("venc")) return "Expirado";
  if (s.startsWith("cancel")) return "Cancelado";
  if (s.startsWith("inativ")) return "Inativo";
  if (s.startsWith("pend")) return "Pendente";
  return String(raw).trim() || null;
}

// ---------- Row parsing from extracted text ----------

// Look for lines containing a phone-ish number; split heuristically.
// Expected header columns: Código | Cód. cliente | Cliente | WhatsApp | Serviço | Valor | Data Expiração | Situação
export function parseRowsFromText(text: string): RawRow[] {
  const rows: RawRow[] = [];
  const lines = text.split(/\r?\n/);

  // Phone regex: BR formats with parens/spaces/dashes or just 10-13 digits
  const phoneRe = /(\+?\s*55\s*)?(\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}|\+?\d{12,14})/;
  const moneyRe = /R?\$?\s*\d{1,3}(?:\.\d{3})*,\d{2}|R?\$?\s*\d+[.,]\d{2}/;
  const dateRe = /\d{2}\/\d{2}\/\d{4}(?:\s+\d{1,2}:\d{2})?/;
  const situationRe = /\b(Ativo|Expirado|Vencido|Cancelado|Inativo|Pendente)\b/i;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // skip obvious header lines
    if (/^(C[óo]digo|Cliente|WhatsApp|Servi[çc]o|Valor|Data|Situa)/i.test(line) && !phoneRe.test(line)) {
      continue;
    }
    const phoneMatch = line.match(phoneRe);
    if (!phoneMatch) continue;

    const moneyMatch = line.match(moneyRe);
    const dateMatch = line.match(dateRe);
    const sitMatch = line.match(situationRe);

    // Split tokens, treat the phone as separator
    const phoneIdx = phoneMatch.index ?? 0;
    const before = line.slice(0, phoneIdx).trim();
    const after = line
      .slice(phoneIdx + phoneMatch[0].length)
      .trim();

    // before usually: [code] [cust_code] [name...]
    // strip pipes from the "before" segment for clean tokenization
    const beforeTokens = before.replace(/[|¦•·]+/g, " ").split(/\s+/).filter(Boolean);
    let external_code: string | null = null;
    let external_customer_code: string | null = null;
    const nameParts: string[] = [];
    for (const t of beforeTokens) {
      if (external_code === null && /^\d+$/.test(t)) {
        external_code = t;
      } else if (external_customer_code === null && /^\d+$/.test(t)) {
        external_customer_code = t;
      } else {
        nameParts.push(t);
      }
    }
    const rawName = nameParts.join(" ").trim() || null;
    const customer_name = cleanCustomerName(
      rawName,
      external_customer_code ?? external_code,
    );

    // after usually: [service...] [valor] [data] [situacao]
    let afterClean = after;
    if (sitMatch) afterClean = afterClean.replace(sitMatch[0], "").trim();
    if (dateMatch) afterClean = afterClean.replace(dateMatch[0], "").trim();
    if (moneyMatch) afterClean = afterClean.replace(moneyMatch[0], "").trim();
    const service_name = cleanServiceName(afterClean);

    rows.push({
      external_code,
      external_customer_code,
      customer_name,
      whatsapp_raw: phoneMatch[0].trim(),
      service_name,
      amount_raw: moneyMatch?.[0] ?? null,
      expires_raw: dateMatch?.[0] ?? null,
      situation: cleanSituation(sitMatch?.[0] ?? null),
    });
  }
  return rows;
}


// ---------- Validation + de-dup ----------

export function validateRows(rows: RawRow[]): ValidatedRow[] {
  const seen = new Map<string, number>();
  const out: ValidatedRow[] = [];

  rows.forEach((r) => {
    const errors: string[] = [];
    const whatsapp_e164 = normalizeWhatsApp(r.whatsapp_raw);
    if (!whatsapp_e164) errors.push("WhatsApp inválido");
    const amount_cents = normalizeAmount(r.amount_raw);
    if (r.amount_raw && amount_cents === null) errors.push("Valor inválido");
    const expires_at = normalizeDate(r.expires_raw);
    if (r.expires_raw && !expires_at) errors.push("Data inválida");
    // customer_name nunca é nulo (fallback amigável aplicado no parser)

    let status: "valid" | "invalid" | "duplicate" = errors.length ? "invalid" : "valid";
    if (status === "valid" && whatsapp_e164) {
      if (seen.has(whatsapp_e164)) {
        status = "duplicate";
      } else {
        seen.set(whatsapp_e164, out.length);
      }
    }

    out.push({
      ...r,
      whatsapp_e164,
      amount_cents,
      expires_at,
      status,
      errors,
      raw_row: { ...r },
    });
  });

  return out;
}
