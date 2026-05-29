// Contador VISUAL local de uso da IA (cache para o painel "consumo hoje").
// NÃO é fonte da verdade: limites, plano, cobrança e custo vivem no banco:
//   - ai_usage_log          (eventos auditáveis, escrito via supabaseAdmin
//                            em src/lib/ai-usage-log.server.ts)
//   - company_ai_usage_cycle (ciclo + base/extra/used; incrementado pela
//                            RPC increment_ai_usage, em quota.server.ts)
// Esta chave (cobraeasy_ai_usage_v1) só serve para mostrar contagem do dia
// no painel sem hit no banco. Pode ser limpa sem impacto financeiro.

const KEY = "cobraeasy_ai_usage_v1";
const MAX_ENTRIES = 500;


export type AiUsageEntry = {
  at: string;
  scope: "dono" | "cliente";
  model: string;
  tokens_in: number;
  tokens_out: number;
  ok: boolean;
};

function read(): AiUsageEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AiUsageEntry[]) : [];
  } catch {
    return [];
  }
}

function write(list: AiUsageEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
  } catch {
    /* noop */
  }
}

export function recordAiUsage(entry: Omit<AiUsageEntry, "at">) {
  const list = read();
  list.unshift({ ...entry, at: new Date().toISOString() });
  write(list);
}

export function getAiUsageToday(): { count: number; tokens: number } {
  const list = read();
  const today = new Date().toISOString().slice(0, 10);
  let count = 0;
  let tokens = 0;
  for (const e of list) {
    if (e.at.slice(0, 10) !== today) continue;
    count += 1;
    tokens += (e.tokens_in || 0) + (e.tokens_out || 0);
  }
  return { count, tokens };
}
