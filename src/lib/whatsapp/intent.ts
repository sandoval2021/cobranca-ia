// Detector de intenção determinístico (regex/keywords).
// Roda ANTES de chamar a OpenAI para escolher contexto certo e economizar tokens.

export type Intent =
  | "price"
  | "trial"
  | "support"
  | "renewal"
  | "payment"
  | "referral"
  | "app_issue"
  | "greeting"
  | "other";

const PATTERNS: Array<{ intent: Intent; re: RegExp }> = [
  { intent: "referral", re: /\b(indica(ç|c)ao|indicad[oa]|indicou|me indicou|amig[oa] (me )?passou|cliente (de )?voc(ê|e))\b/i },
  { intent: "payment", re: /\b(paguei|pagamento|paguei agora|comprovante|pix enviado|enviei o pix|transferi)\b/i },
  { intent: "renewal", re: /\b(renovar|renova(ç|c)ao|venceu|vencimento|expirou|prorrogar|mais (um|1) m(ê|e)s)\b/i },
  { intent: "trial", re: /\b(teste|trial|testar|experimentar|amostra|periodo gr[áa]tis|gratis)\b/i },
  { intent: "price", re: /\b(valor|valores|pre(ç|c)o|pre(ç|c)os|quanto( custa| fica| sai)?|tabela|planos?|mensalidade)\b/i },
  { intent: "app_issue", re: /\b(travand[oa]?|travou|n(ã|a)o (abre|funciona|carrega|conecta)|sem (canais|audio|som|imagem|sinal)|lista fora|erro|atualiza(r|ção)?|mac|key|usuario|usu[áa]rio|senha|rota)\b/i },
  { intent: "support", re: /\b(ajuda|suporte|problema|d[uú]vida|n(ã|a)o consigo|como (fa(ç|c)o|uso))\b/i },
  { intent: "greeting", re: /\b(oi+|ol[áa]+|bom dia|boa tarde|boa noite|opa)\b/i },
];

export function detectIntent(text: string): Intent {
  const t = text.toLowerCase();
  for (const { intent, re } of PATTERNS) {
    if (re.test(t)) return intent;
  }
  return "other";
}

const KNOWN_APPS = [
  "xciptv", "xc iptv",
  "iptv smarters", "smarters",
  "ibo player", "ibo revenda", "ibo",
  "bob player", "bob",
  "vu player", "vu",
  "iptv blink", "blink",
  "unitv", "uni tv",
];

export function detectApp(text: string): string | null {
  const t = text.toLowerCase();
  for (const app of KNOWN_APPS) {
    if (t.includes(app)) {
      // Normaliza
      if (app.includes("xciptv") || app.includes("xc iptv")) return "XCIPTV";
      if (app.includes("smarters")) return "IPTV Smarters";
      if (app.includes("ibo revenda")) return "IBO Revenda";
      if (app.includes("ibo")) return "IBO Player";
      if (app.includes("bob")) return "Bob Player";
      if (app.includes("vu")) return "Vu Player";
      if (app.includes("blink")) return "IPTV Blink";
      if (app.includes("unitv") || app.includes("uni tv")) return "Unitv";
    }
  }
  return null;
}

/**
 * Extrai dicas de indicação do texto:
 * - número de telefone (com ou sem DDI)
 * - nome próprio capitalizado após "indicado por"/"indicou"
 */
export function extractReferralHints(text: string): { phone: string | null; name: string | null } {
  // telefone: sequências de 8+ dígitos
  const digits = text.replace(/\D/g, " ").match(/\d{8,13}/);
  const phone = digits ? digits[0] : null;

  // nome após "indicado por" / "indicou" / "passou seu contato"
  let name: string | null = null;
  const nameRe = /(?:indicad[oa] (?:por|pelo|pela)|indicou(?: me)?|me indicou|passou(?: seu)? contato:?)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)?)/i;
  const m = text.match(nameRe);
  if (m && m[1]) name = m[1].trim();

  return { phone, name };
}
