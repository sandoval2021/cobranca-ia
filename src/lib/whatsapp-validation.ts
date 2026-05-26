// Validação e normalização de WhatsApp.
// BR (padrão): 10 ou 11 dígitos após DDI (DDD + número). Aceita máscara.
// Internacional: 8 a 15 dígitos no total, formato E.164.

export type WhatsappCheck = {
  ok: boolean;
  e164: string;
  digits: string;
  error?: string;
};

/** Mantém só dígitos. */
export function onlyDigits(v: string): string {
  return (v || "").replace(/\D/g, "");
}

/** Aplica máscara BR (XX) 9XXXX-XXXX enquanto digita; limita 11 dígitos. */
export function maskBR(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

/** Internacional: preserva o '+' inicial e dígitos, limita 15. */
export function maskIntl(v: string): string {
  const raw = (v || "").trim();
  const plus = raw.startsWith("+");
  const d = onlyDigits(raw).slice(0, 15);
  return plus || d ? `+${d}` : "";
}

export function validateWhatsapp(
  value: string,
  opts: { international?: boolean } = {},
): WhatsappCheck {
  const d = onlyDigits(value);
  if (!d) {
    return { ok: false, e164: "", digits: "", error: "WhatsApp é obrigatório" };
  }
  if (opts.international) {
    if (d.length < 8 || d.length > 15) {
      return {
        ok: false,
        e164: "",
        digits: d,
        error: "Número internacional deve ter 8 a 15 dígitos.",
      };
    }
    return { ok: true, e164: `+${d}`, digits: d };
  }
  // BR
  if (d.length !== 10 && d.length !== 11) {
    return {
      ok: false,
      e164: "",
      digits: d,
      error:
        "WhatsApp brasileiro deve ter 10 ou 11 dígitos (DDD + número). Marque 'Fora do Brasil' se for internacional.",
    };
  }
  // Quando 11 dígitos, o 3º precisa ser 9 (celular BR)
  if (d.length === 11 && d[2] !== "9") {
    return {
      ok: false,
      e164: "",
      digits: d,
      error: "Celular brasileiro deve começar com 9 após o DDD.",
    };
  }
  return { ok: true, e164: `+55${d}`, digits: d };
}
