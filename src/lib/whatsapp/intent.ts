// Detector determinístico (regex/keywords).
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
  | "complaint"
  | "cancel"
  | "human_request"
  | "other";

const PATTERNS: Array<{ intent: Intent; re: RegExp }> = [
  { intent: "cancel", re: /\b(cancelar|cancela|n(ã|a)o quero mais|desistir|sair|encerrar (plano|servi(ç|c)o))\b/i },
  { intent: "human_request", re: /\b(falar com (humano|atendente|pessoa|gerente|dono|respons[áa]vel)|quero (um|uma) (humano|atendente)|atendente humano|chama (a|o) (humano|atendente))\b/i },
  { intent: "complaint", re: /\b(absurd[oa]|p[ée]ssimo|horr[íi]vel|merda|porra|caralh[oa]|fdp|filha? da (p|m)|vagabund[oa]|ladr[ãa]o|golpe|enganaram|reclama(ç|c)ao|procon|cad[êe] (o|a)|enrolando|enrola(ç|c)ao|vou processar|cobrar duas vezes|cobraram (duas|2) vezes)\b/i },
  { intent: "referral", re: /\b(indica(ç|c)ao|indicad[oa]|indicou|me indicou|amig[oa] (me )?passou|cliente (de )?voc(ê|e))\b/i },
  { intent: "payment", re: /\b(paguei|pagamento|paguei agora|comprovante|pix enviado|enviei o pix|transferi|j[áa] paguei|t[áa] pago)\b/i },
  { intent: "renewal", re: /\b(renovar|renova(ç|c)ao|venceu|vencimento|expirou|prorrogar|mais (um|1) m(ê|e)s)\b/i },
  { intent: "trial", re: /\b(teste|trial|testar|experimentar|amostra|periodo gr[áa]tis|gratis)\b/i },
  { intent: "price", re: /\b(valor|valores|pre(ç|c)o|pre(ç|c)os|quanto( custa| fica| sai)?|tabela|planos?|mensalidade)\b/i },
  { intent: "app_issue", re: /\b(travand[oa]?|travou|n(ã|a)o (abre|funciona|carrega|conecta|passa|liga)|sem (canais|audio|som|imagem|sinal)|lista fora|buffering|bufferando|carregando|dns|cache|mac|key|usuario|usu[áa]rio|senha|rota|servidor|reiniciar|atualiza(r|ção)?)\b/i },
  { intent: "support", re: /\b(ajuda|suporte|problema|d[uú]vida|n(ã|a)o consigo|como (fa(ç|c)o|uso|instalo|configuro))\b/i },
  { intent: "greeting", re: /^(oi+|ol[áa]+|bom dia|boa tarde|boa noite|opa|e a[íi]+|hello|hi)[\s!.,?]*$/i },
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

export type AppIssueTag =
  | "buffering"
  | "no_channels"
  | "no_audio"
  | "wont_open"
  | "login_error"
  | "mac_key"
  | "route"
  | "update"
  | "cache"
  | null;

export function detectAppIssue(text: string): AppIssueTag {
  const t = text.toLowerCase();
  if (/\b(buffer|bufferando|travand|carregando demora|lento)/.test(t)) return "buffering";
  if (/\b(sem canais|n(ã|a)o (passa|aparece) (os )?canais|lista fora)/.test(t)) return "no_channels";
  if (/\b(sem (audio|som))/.test(t)) return "no_audio";
  if (/\b(n(ã|a)o abre|fecha sozinho|cai sozinho|n(ã|a)o (liga|inicia))/.test(t)) return "wont_open";
  if (/\b(login (errado|inv[áa]lido|incorreto)|usu[áa]rio (errado|inv[áa]lido)|senha errada)/.test(t)) return "login_error";
  if (/\b(mac|key)\b/.test(t)) return "mac_key";
  if (/\b(rota|servidor|url|portal)/.test(t)) return "route";
  if (/\b(atualiza(r|ção)?|update)/.test(t)) return "update";
  if (/\b(cache|limpar (dados|cache))/.test(t)) return "cache";
  return null;
}

export function extractReferralHints(text: string): { phone: string | null; name: string | null } {
  const digits = text.replace(/\D/g, " ").match(/\d{8,13}/);
  const phone = digits ? digits[0] : null;
  let name: string | null = null;
  const nameRe = /(?:indicad[oa] (?:por|pelo|pela)|indicou(?: me)?|me indicou|passou(?: seu)? contato:?)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)?)/i;
  const m = text.match(nameRe);
  if (m && m[1]) name = m[1].trim();
  return { phone, name };
}

const EMOJI_ONLY_RE = /^[\p{Extended_Pictographic}\p{Emoji_Component}\s]+$/u;

export function isLowSignal(text: string): { skip: boolean; reason?: string } {
  const t = text.trim();
  if (t.length < 2) return { skip: true, reason: "too_short" };
  try {
    if (EMOJI_ONLY_RE.test(t)) return { skip: true, reason: "emoji_only" };
  } catch {
    // ambiente sem suporte a regex Unicode property → ignora
  }
  return { skip: false };
}

export type CustomerClass =
  | "new_lead"
  | "active"
  | "expiring"
  | "expired"
  | "support"
  | "billing"
  | "trial"
  | "at_risk"
  | "human_needed"
  | "referral"
  | "unknown";

export function classifyCustomer(opts: {
  hasCustomer: boolean;
  intent: Intent;
  needsHuman: boolean;
}): CustomerClass {
  if (opts.needsHuman) return "human_needed";
  if (opts.intent === "cancel" || opts.intent === "complaint") return "at_risk";
  if (opts.intent === "human_request") return "human_needed";
  if (opts.intent === "payment") return "billing";
  if (opts.intent === "renewal") return "expired";
  if (opts.intent === "trial") return "trial";
  if (opts.intent === "referral") return "referral";
  if (opts.intent === "support" || opts.intent === "app_issue") return "support";
  if (!opts.hasCustomer) return "new_lead";
  return "active";
}
