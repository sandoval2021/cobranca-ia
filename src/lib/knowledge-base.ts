// Base de Conhecimento da IA — armazenamento local (preview).
// NÃO chama IA real. Apenas organiza regras e respostas para uso futuro.

export type KBCategory =
  | "saudacao"
  | "regra"
  | "problema"
  | "app"
  | "humano"
  | "audio_foto";

export const KB_CATEGORY_LABEL: Record<KBCategory, string> = {
  saudacao: "Saudações",
  regra: "Regras de atendimento",
  problema: "Problemas comuns",
  app: "Respostas por aplicativo",
  humano: "Quando chamar humano",
  audio_foto: "Áudio / Foto / Não funciona",
};

export type KBEntry = {
  id: string;
  title: string;
  category: KBCategory;
  app?: string; // chave do app ou nome livre
  keywords: string[]; // palavras-chave (lowercase)
  short: string; // resposta curta
  full: string; // resposta completa
  when_to_use?: string;
  when_not_to_use?: string;
  needs_human: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};

const STORAGE_KEY = "cobranca_ia_kb_v1";

export function readAll(): KBEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function writeAll(list: KBEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("kb:changed"));
  } catch { /* noop */ }
}

export function newId(): string {
  return `kb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function upsert(entry: KBEntry): void {
  const list = readAll();
  const idx = list.findIndex((e) => e.id === entry.id);
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  writeAll(list);
  // Write-through DB-first (best-effort). Se o id local não for UUID,
  // o banco gera um e reescrevemos o id local para manter idempotência.
  mirrorKbEntryToDb(entry);
}

export function remove(id: string): void {
  writeAll(readAll().filter((e) => e.id !== id));
  // Write-through delete (apenas para ids UUID; ids locais kb_* nunca foram ao banco).
  mirrorKbDeleteToDb(id);
}


// ----- Sementes padrão -----

function seed(
  title: string,
  category: KBCategory,
  short: string,
  full: string,
  opts: {
    keywords?: string[];
    app?: string;
    needs_human?: boolean;
    when_to_use?: string;
    when_not_to_use?: string;
  } = {},
): KBEntry {
  const now = new Date().toISOString();
  return {
    id: newId(),
    title,
    category,
    app: opts.app,
    keywords: (opts.keywords ?? []).map((k) => k.toLowerCase()),
    short,
    full,
    when_to_use: opts.when_to_use,
    when_not_to_use: opts.when_not_to_use,
    needs_human: !!opts.needs_human,
    active: true,
    created_at: now,
    updated_at: now,
  };
}

export function buildDefaults(): KBEntry[] {
  return [
    // Saudações
    seed("Bom dia", "saudacao", "Bom dia! 😊 Como posso te ajudar hoje?",
      "Bom dia! 😊 Como posso te ajudar hoje?",
      { keywords: ["bom dia", "oi", "ola", "olá"] }),
    seed("Boa tarde", "saudacao", "Boa tarde! Como posso te ajudar?",
      "Boa tarde! Como posso te ajudar?", { keywords: ["boa tarde"] }),
    seed("Boa noite", "saudacao", "Boa noite! Como posso te ajudar?",
      "Boa noite! Como posso te ajudar?", { keywords: ["boa noite"] }),
    seed("Como posso ajudar?", "saudacao", "Como posso te ajudar?",
      "Olá! Como posso te ajudar hoje?", { keywords: ["ajuda", "ajudar", "preciso"] }),

    // Regras
    seed("Não reproduzir áudio", "regra",
      "Não respondemos por áudio.", "Peça ao cliente para enviar a dúvida por texto.",
      { keywords: ["audio", "áudio"] }),
    seed("Não analisar foto sozinha", "regra",
      "Peça texto junto com a foto.", "Se cliente mandar só imagem, peça o texto explicando o problema e o nome do app.",
      { keywords: ["foto", "imagem", "print"] }),
    seed("Pedir nome do app", "regra",
      "Sempre pergunte qual app o cliente usa.",
      "Antes de orientar, pergunte qual aplicativo (XCIPTV, Bob Player, IBO, Vu Player, etc.).",
      { keywords: ["app", "aplicativo"] }),
    seed("Pedir MAC/Key (app pago)", "regra",
      "Apps pagos pedem MAC e às vezes Key.",
      "Quando o app for pago (Bob, IBO, Vu, Eagle, Duplex, Set IPTV, SmartOne), peça o MAC do aparelho.",
      { keywords: ["mac", "key", "pago"] }),
    seed("Pedir usuário/senha (XCIPTV/Smarters)", "regra",
      "XCIPTV e Smarters usam usuário e senha.",
      "Quando o app for XCIPTV ou IPTV Smarters, peça usuário e senha cadastrados.",
      { keywords: ["xciptv", "smarters", "usuario", "senha"] }),

    // Áudio / Foto / Não funciona
    seed("Cliente enviou áudio", "audio_foto",
      "Peça para escrever em texto.",
      "Por favor, envie sua dúvida por texto. No momento não reproduzimos áudio no atendimento automático.",
      { keywords: ["audio", "áudio", "voz"] }),
    seed("Cliente enviou foto", "audio_foto",
      "Peça texto + nome do app.",
      "Recebi sua imagem, mas preciso que você escreva também o que está acontecendo e informe o nome do aplicativo que está usando.",
      { keywords: ["foto", "imagem", "print"] }),
    seed("Cliente disse 'não funciona'", "audio_foto",
      "Peça app + print + mensagem da tela.",
      "Me informe o nome do aplicativo, mande um print do erro e diga se aparece alguma mensagem na tela.",
      { keywords: ["nao funciona", "não funciona", "parou", "travou"] }),

    // Problemas comuns
    seed("App travando", "problema",
      "Reiniciar app e roteador.",
      "Tente: 1) fechar e abrir o app; 2) reiniciar a TV/box; 3) reiniciar o roteador. Se continuar, mande um print.",
      { keywords: ["travando", "travou", "lento"] }),
    seed("Canais não abrem", "problema",
      "Verificar rota/servidor e reiniciar app.",
      "Reinicie o app e o roteador. Se persistir, pode ser instabilidade no servidor — vou checar a rota.",
      { keywords: ["canais", "não abre", "nao abre"] }),
    seed("Filmes/séries não carregam", "problema",
      "Pode ser cache. Reiniciar app e box.",
      "Limpe o cache do app, reinicie a TV/box e tente novamente. Se continuar, mande um print.",
      { keywords: ["filme", "serie", "vod", "não carrega"] }),
    seed("App fechando sozinho", "problema",
      "Limpar cache e atualizar app.",
      "Tente limpar o cache do app e atualizar a versão. Se continuar, mande o modelo do aparelho.",
      { keywords: ["fechando", "fecha sozinho", "crash"] }),
    seed("Tela preta", "problema",
      "Verificar conexão e reiniciar.",
      "Reinicie a TV/box e o roteador. Se a tela continuar preta, mande um print.",
      { keywords: ["tela preta", "preto"] }),
    seed("Usuário ou senha inválido", "problema",
      "Conferir dados cadastrados.",
      "Vou conferir os dados cadastrados. Me confirma o usuário usado, por favor.",
      { keywords: ["usuario invalido", "senha invalida", "usuário ou senha"] }),
    seed("Servidor fora", "problema",
      "Pode ser instabilidade temporária.",
      "Estamos verificando o servidor. Se houver atualização de rota, te aviso por aqui.",
      { keywords: ["servidor", "fora", "off"] }),
    seed("App pedindo atualização", "problema",
      "Pode ser licença do app pago.",
      "Se for um app pago (Bob, IBO, etc.), pode ser a licença anual vencendo. Me manda o nome do app.",
      { keywords: ["atualização", "atualizar", "renovar"] }),
    seed("Cliente não sabe o app", "problema",
      "Pedir foto da tela inicial.",
      "Sem problemas! Me manda um print da tela inicial do aplicativo que vou identificar.",
      { keywords: ["nao sei", "qual app"] }),

    // Por aplicativo
    seed("XCIPTV — login", "app",
      "Login por usuário e senha.",
      "No XCIPTV, o login é por usuário e senha. Me manda o usuário cadastrado.",
      { keywords: ["xciptv"], app: "xciptv" }),
    seed("IPTV Smarters — login", "app",
      "Login por usuário e senha.",
      "No Smarters, o login é por usuário e senha. Me manda o usuário cadastrado.",
      { keywords: ["smarters"], app: "smarters" }),
    seed("Bob Player — MAC", "app",
      "Bob Player é pago, login por MAC.",
      "O Bob Player precisa do MAC do aparelho. Vá em Configurações do app e me manda o MAC.",
      { keywords: ["bob", "bobplayer"], app: "bob_player" }),
    seed("IBO Player — MAC e Key", "app",
      "IBO usa MAC e Key.",
      "O IBO Player usa MAC e Key. Me manda o MAC e, se aparecer, a Key também.",
      { keywords: ["ibo"], app: "ibo_player" }),
    seed("Vu Player — MAC", "app",
      "Vu Player é pago, login por MAC.",
      "O Vu Player usa MAC. Me manda o MAC do aparelho.",
      { keywords: ["vu", "vuplayer"], app: "vu_player" }),
    seed("Eagle Play — MAC", "app",
      "Eagle Play é pago, login por MAC.",
      "O Eagle Play usa MAC. Me manda o MAC do aparelho.",
      { keywords: ["eagle"], app: "eagle_play" }),
    seed("Outro app", "app",
      "Pedir nome e tipo do app.",
      "Me diz o nome do app e se ele pede usuário/senha ou MAC/Key.",
      { keywords: ["outro"], app: "outro" }),

    // Humano
    seed("Cliente não consegue explicar", "humano",
      "Encaminhar para humano.",
      "Vou te transferir para um atendente para entender melhor seu caso.",
      { keywords: ["nao entendo", "complicado"], needs_human: true }),
    seed("Cliente mandou só áudio", "humano",
      "Encaminhar para humano se insistir.",
      "Vou te encaminhar para um atendente que pode te ouvir.",
      { keywords: ["audio"], needs_human: true }),
    seed("Dados não conferem", "humano",
      "Encaminhar para humano.",
      "Vou pedir para um atendente conferir seus dados, um momento.",
      { keywords: ["nao confere", "dados errados"], needs_human: true }),
    seed("App pago vencido", "humano",
      "Encaminhar para humano renovar.",
      "Sua licença do app está vencida. Vou te encaminhar para renovar.",
      { keywords: ["vencido", "licença"], needs_human: true }),
    seed("Servidor precisa atualização manual", "humano",
      "Encaminhar para humano.",
      "Vou te encaminhar para um atendente atualizar manualmente o seu servidor.",
      { keywords: ["servidor", "atualizar"], needs_human: true }),
    seed("Cliente irritado", "humano",
      "Encaminhar para humano imediatamente.",
      "Entendo sua frustração. Vou te transferir agora para um atendente.",
      { keywords: ["irritado", "raiva"], needs_human: true }),
    seed("Pagamento não localizado", "humano",
      "Encaminhar para humano financeiro.",
      "Vou pedir para alguém do financeiro confirmar seu pagamento.",
      { keywords: ["pagamento", "pix", "nao localizado"], needs_human: true }),
  ];
}

// ----- simulador -----

export type SimResult = {
  intent: string;
  match?: KBEntry;
  needsHuman: boolean;
  askFor: string[];
};

const AUDIO_RE = /\b(audio|áudio|voz)\b/i;
const PHOTO_RE = /\b(foto|imagem|print)\b/i;
const BROKEN_RE = /(não\s*funciona|nao\s*funciona|parou|travou|deu\s*ruim|com\s*problema)/i;

export function simulate(message: string): SimResult {
  const m = (message || "").toLowerCase().trim();
  if (!m) {
    return { intent: "Sem texto", needsHuman: false, askFor: ["Mensagem do cliente"] };
  }

  // regras especiais antes da busca por palavra-chave
  if (AUDIO_RE.test(m)) {
    const entries = readAll();
    const match = entries.find((e) => e.active && e.category === "audio_foto" && /audio|áudio/i.test(e.title));
    return {
      intent: "Cliente enviou áudio",
      match,
      needsHuman: false,
      askFor: ["Dúvida em texto"],
    };
  }
  if (PHOTO_RE.test(m)) {
    const entries = readAll();
    const match = entries.find((e) => e.active && e.category === "audio_foto" && /foto/i.test(e.title));
    return {
      intent: "Cliente enviou foto",
      match,
      needsHuman: false,
      askFor: ["Texto explicando o problema", "Nome do aplicativo"],
    };
  }
  if (BROKEN_RE.test(m)) {
    const entries = readAll();
    const match = entries.find((e) => e.active && /não funciona|nao funciona/i.test(e.title));
    return {
      intent: "Cliente disse que não funciona",
      match,
      needsHuman: false,
      askFor: ["Nome do app", "Print do erro", "Mensagem que aparece"],
    };
  }

  // busca por palavras-chave nas entradas ativas
  const entries = readAll().filter((e) => e.active);
  let best: KBEntry | undefined;
  let bestScore = 0;
  for (const e of entries) {
    let score = 0;
    for (const kw of e.keywords) {
      if (!kw) continue;
      if (m.includes(kw)) score += kw.length; // palavras maiores valem mais
    }
    if (m.includes(e.title.toLowerCase())) score += 5;
    if (score > bestScore) { bestScore = score; best = e; }
  }

  if (!best) {
    return {
      intent: "Intenção não identificada",
      needsHuman: true,
      askFor: ["Detalhar dúvida", "Nome do app"],
    };
  }

  const askFor: string[] = [];
  if (best.category === "app") askFor.push("MAC ou usuário, conforme o app");
  if (best.category === "problema") askFor.push("Print do erro");

  return {
    intent: best.title,
    match: best,
    needsHuman: best.needs_human,
    askFor,
  };
}

// ----- backup -----

export type KBBackup = {
  type: "cobranca-ia/kb-backup";
  version: 1;
  generated_at: string;
  entries: KBEntry[];
};

export function buildBackup(): KBBackup {
  return {
    type: "cobranca-ia/kb-backup",
    version: 1,
    generated_at: new Date().toISOString(),
    entries: readAll(),
  };
}

export type KBParseResult =
  | { ok: true; entries: KBEntry[] }
  | { ok: false; error: string };

export function parseBackup(raw: string): KBParseResult {
  try {
    const j = JSON.parse(raw);
    let entries: KBEntry[] = [];
    if (j?.type === "cobranca-ia/kb-backup" && Array.isArray(j.entries)) {
      entries = j.entries.filter(isValid);
    } else if (Array.isArray(j)) {
      entries = j.filter(isValid);
    } else {
      return { ok: false, error: "Formato não reconhecido." };
    }
    return { ok: true, entries };
  } catch {
    return { ok: false, error: "JSON inválido." };
  }
}

function isValid(x: unknown): x is KBEntry {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.id === "string"
    && typeof o.title === "string"
    && typeof o.category === "string"
    && typeof o.short === "string";
}

export function restoreDefaults(): void {
  const defaults = buildDefaults();
  writeAll(defaults);
  // Espelha a restauração padrão no banco em lote (best-effort).
  mirrorBulkKbToDb(defaults);
}

export function mergeEntries(incoming: KBEntry[]): void {
  const cur = readAll();
  const byId = new Map(cur.map((e) => [e.id, e]));
  for (const e of incoming) byId.set(e.id, e);
  const merged = Array.from(byId.values());
  writeAll(merged);
  // Espelha apenas o incoming (delta) no banco em lote — não reenvia tudo.
  mirrorBulkKbToDb(incoming);
}

// ============================================================
// Sincronização com o banco (ai_knowledge_entries) — Fase 2E
// ============================================================

import { getActiveCompanyId } from "@/lib/company-scope";
import {
  bulkUpsertKbEntriesDb,
  type KbEntryDto,
} from "@/lib/knowledge-base/kb.functions";

export const KB_SYNC_EVENT = "cobranca_ia_kb:sync";

type KbSyncState = { loaded: boolean; lastError: string | null; pendingLocal: number };
const kbSyncState: KbSyncState = { loaded: false, lastError: null, pendingLocal: 0 };

function emitKbSync() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(KB_SYNC_EVENT, { detail: { ...kbSyncState } }));
}

export function getKnowledgeBaseSyncState(): KbSyncState {
  return { ...kbSyncState };
}

export function markKnowledgeBaseSyncError(message: string) {
  kbSyncState.lastError = message;
  emitKbSync();
}

function isUuid(v: string | null | undefined): v is string {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export function hydrateKnowledgeBaseFromDb(companyId: string, rows: KbEntryDto[]): void {
  if (typeof window === "undefined") return;
  if (!isUuid(companyId)) return;
  const local = readAll();
  if (rows.length === 0 && local.length > 0) {
    kbSyncState.loaded = true;
    kbSyncState.lastError = null;
    kbSyncState.pendingLocal = local.length;
    emitKbSync();
    return;
  }
  const mapped: KBEntry[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    category: (r.category as KBCategory) ?? "regra",
    app: r.app ?? undefined,
    keywords: Array.isArray(r.keywords) ? r.keywords : [],
    short: r.short_text ?? "",
    full: r.full_text ?? "",
    when_to_use: r.when_to_use ?? undefined,
    when_not_to_use: r.when_not_to_use ?? undefined,
    needs_human: !!r.needs_human,
    active: !!r.active,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
  writeAll(mapped);
  kbSyncState.loaded = true;
  kbSyncState.lastError = null;
  kbSyncState.pendingLocal = 0;
  emitKbSync();
}

export async function uploadLocalKnowledgeBaseToDb(): Promise<{ inserted: number; updated: number }> {
  const companyId = getActiveCompanyId();
  if (!companyId) return { inserted: 0, updated: 0 };
  const list = readAll();
  if (list.length === 0) return { inserted: 0, updated: 0 };
  const entries = list.map((e) => ({
    id: isUuid(e.id) ? e.id : undefined,
    title: e.title || "Sem título",
    category: e.category,
    app: e.app ?? null,
    keywords: e.keywords ?? [],
    short_text: e.short ?? "",
    full_text: e.full ?? "",
    when_to_use: e.when_to_use ?? null,
    when_not_to_use: e.when_not_to_use ?? null,
    needs_human: !!e.needs_human,
    active: e.active !== false,
  }));
  return bulkUpsertKbEntriesDb({ data: { companyId, entries } });
}

// Write-through fire-and-forget para mutações pontuais (upsert/remove).
function mirrorKbEntryToDb(entry: KBEntry): void {
  if (typeof window === "undefined") return;
  const companyId = getActiveCompanyId();
  if (!companyId || !isUuid(companyId)) return;
  queueMicrotask(() => {
    import("@/lib/knowledge-base/kb.functions").then(({ upsertKbEntryDb }) => {
      const payload: any = {
        companyId,
        title: entry.title || "Sem título",
        category: entry.category,
        app: entry.app ?? null,
        keywords: entry.keywords ?? [],
        short_text: entry.short ?? "",
        full_text: entry.full ?? "",
        when_to_use: entry.when_to_use ?? null,
        when_not_to_use: entry.when_not_to_use ?? null,
        needs_human: !!entry.needs_human,
        active: entry.active !== false,
      };
      if (isUuid(entry.id)) payload.id = entry.id;
      return upsertKbEntryDb({ data: payload }).then((res) => {
        // Se o id local não era UUID e o banco retornou outro, atualiza o cache
        // local para que próximos writes sejam idempotentes.
        if (!isUuid(entry.id) && res && (res as any).id) {
          const list = readAll();
          const idx = list.findIndex((e) => e.id === entry.id);
          if (idx >= 0) {
            list[idx] = { ...list[idx], id: (res as any).id };
            writeAll(list);
          }
        }
      });
    }).catch(() => { /* hook periódico/manual upload retenta */ });
  });
}

function mirrorKbDeleteToDb(id: string): void {
  if (typeof window === "undefined") return;
  if (!isUuid(id)) return;
  const companyId = getActiveCompanyId();
  if (!companyId || !isUuid(companyId)) return;
  queueMicrotask(() => {
    import("@/lib/knowledge-base/kb.functions").then(({ deleteKbEntryDb }) =>
      deleteKbEntryDb({ data: { id, companyId } }),
    ).catch(() => { /* ignore */ });
  });
}

