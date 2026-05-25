// Configurações da Revenda — 100% local (localStorage). Sem API, sem Supabase.

export const REVENDA_SETTINGS_KEY = "cobranca_ia_revenda_settings_v1";
export const REVENDA_SETTINGS_EVENT = "cobranca_ia_revenda_settings:changed";

export type RevendaDados = {
  nome_revenda: string;
  responsavel: string;
  whatsapp_suporte: string;
  cidade: string;
  site: string;
  observacoes: string;
};

export type RevendaAtendimento = {
  horario_semana: string;
  horario_domingo: string;
  aceita_audio: boolean;
  aceita_ligacao: boolean;
  texto_audio: string;
  texto_fora_horario: string;
  texto_pedir_print: string;
  texto_pedir_nome_app: string;
};

export type RevendaPagamento = {
  pix: string;
  recebedor: string;
  banco: string;
  aceita_pix: boolean;
  aceita_cartao: boolean;
  aceita_dinheiro: boolean;
  observacao_pagamento: string;
};

export type RevendaPlanos = {
  plano_mensal_padrao: string;
  valor_mensal: string;
  valor_tela_extra: string;
  valor_app: string;
  valor_renovacao_app: string;
  texto_planos: string;
  promocao_ativa: boolean;
  texto_promocao: string;
  data_fim_promocao: string;
};

export type RevendaRegras = {
  exigir_aprovacao_manual: boolean;
  bloquear_envio_automatico: boolean;
  separar_app_pago: boolean;
  recuperar_apos_30: boolean;
  inativo_apos_60: boolean;
};

export type RevendaSettings = {
  dados: RevendaDados;
  atendimento: RevendaAtendimento;
  pagamento: RevendaPagamento;
  planos: RevendaPlanos;
  regras: RevendaRegras;
  updated_at?: string;
};

export const DEFAULT_REVENDA_SETTINGS: RevendaSettings = {
  dados: {
    nome_revenda: "",
    responsavel: "",
    whatsapp_suporte: "",
    cidade: "",
    site: "",
    observacoes: "",
  },
  atendimento: {
    horario_semana: "09:00 às 21:00",
    horario_domingo: "10:00 às 18:00",
    aceita_audio: true,
    aceita_ligacao: false,
    texto_audio: "Se preferir, pode mandar áudio que eu escuto e respondo aqui mesmo.",
    texto_fora_horario:
      "Olá! Estou fora do horário de atendimento agora. Te respondo assim que voltar dentro do horário ({horario_semana}).",
    texto_pedir_print: "Consegue me mandar um print da tela? Assim consigo te ajudar mais rápido.",
    texto_pedir_nome_app: "Você lembra o nome do aplicativo que está usando para assistir?",
  },
  pagamento: {
    pix: "",
    recebedor: "",
    banco: "",
    aceita_pix: true,
    aceita_cartao: false,
    aceita_dinheiro: false,
    observacao_pagamento: "Após o pagamento, me envie o comprovante para liberar.",
  },
  planos: {
    plano_mensal_padrao: "Mensal",
    valor_mensal: "",
    valor_tela_extra: "",
    valor_app: "",
    valor_renovacao_app: "",
    texto_planos: "Plano mensal {valor_mensal}. Tela extra {valor_tela_extra}.",
    promocao_ativa: false,
    texto_promocao: "",
    data_fim_promocao: "",
  },
  regras: {
    exigir_aprovacao_manual: true,
    bloquear_envio_automatico: true,
    separar_app_pago: true,
    recuperar_apos_30: true,
    inativo_apos_60: true,
  },
};

function deepMerge<T>(base: T, patch: any): T {
  if (!patch || typeof patch !== "object") return base;
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) };
  for (const k of Object.keys(patch)) {
    const bv = (base as any)?.[k];
    const pv = patch[k];
    if (bv && typeof bv === "object" && !Array.isArray(bv) && pv && typeof pv === "object" && !Array.isArray(pv)) {
      out[k] = deepMerge(bv, pv);
    } else if (pv !== undefined) {
      out[k] = pv;
    }
  }
  return out as T;
}

export function getRevendaSettings(): RevendaSettings {
  if (typeof window === "undefined") return DEFAULT_REVENDA_SETTINGS;
  try {
    const raw = window.localStorage.getItem(REVENDA_SETTINGS_KEY);
    if (!raw) return DEFAULT_REVENDA_SETTINGS;
    const parsed = JSON.parse(raw);
    return deepMerge(DEFAULT_REVENDA_SETTINGS, parsed);
  } catch {
    return DEFAULT_REVENDA_SETTINGS;
  }
}

export function saveRevendaSettings(settings: RevendaSettings): RevendaSettings {
  if (typeof window === "undefined") return settings;
  const toSave: RevendaSettings = { ...settings, updated_at: new Date().toISOString() };
  try {
    window.localStorage.setItem(REVENDA_SETTINGS_KEY, JSON.stringify(toSave));
    window.dispatchEvent(new CustomEvent(REVENDA_SETTINGS_EVENT));
  } catch {
    // silencioso
  }
  return toSave;
}

export function resetRevendaSettings(): RevendaSettings {
  if (typeof window === "undefined") return DEFAULT_REVENDA_SETTINGS;
  try {
    window.localStorage.removeItem(REVENDA_SETTINGS_KEY);
    window.dispatchEvent(new CustomEvent(REVENDA_SETTINGS_EVENT));
  } catch {
    // silencioso
  }
  return DEFAULT_REVENDA_SETTINGS;
}

export function exportRevendaSettings(): string {
  const data = getRevendaSettings();
  const blob = new Blob([JSON.stringify({ system: "Cobrança IA", kind: "revenda_settings", version: 1, exportedAt: new Date().toISOString(), data }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  a.href = url;
  a.download = `configuracoes-revenda-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return a.download;
}

export async function importRevendaSettings(file: File): Promise<RevendaSettings> {
  const text = await file.text();
  const json = JSON.parse(text);
  const payload = json?.data && typeof json.data === "object" ? json.data : json;
  const merged = deepMerge(DEFAULT_REVENDA_SETTINGS, payload);
  return saveRevendaSettings(merged);
}

export type RevendaVariableContext = {
  cliente_nome?: string;
  app?: string;
  servidor?: string;
  valor?: string;
  vencimento?: string;
  telas?: string | number;
  [k: string]: string | number | undefined;
};

function fallback(v: string | undefined | null): string {
  const s = (v ?? "").toString().trim();
  return s.length === 0 ? "não informado" : s;
}

export function buildRevendaVariables(
  settings: RevendaSettings = getRevendaSettings(),
  context: RevendaVariableContext = {},
): Record<string, string> {
  const vars: Record<string, string> = {
    nome_revenda: fallback(settings.dados.nome_revenda),
    responsavel: fallback(settings.dados.responsavel),
    whatsapp_suporte: fallback(settings.dados.whatsapp_suporte),
    cidade: fallback(settings.dados.cidade),
    site: fallback(settings.dados.site),
    horario_semana: fallback(settings.atendimento.horario_semana),
    horario_domingo: fallback(settings.atendimento.horario_domingo),
    pix: fallback(settings.pagamento.pix),
    recebedor: fallback(settings.pagamento.recebedor),
    valor_mensal: fallback(settings.planos.valor_mensal),
    valor_tela_extra: fallback(settings.planos.valor_tela_extra),
    valor_app: fallback(settings.planos.valor_app),
    valor_renovacao_app: fallback(settings.planos.valor_renovacao_app),
    promocao: settings.planos.promocao_ativa ? fallback(settings.planos.texto_promocao) : "não informado",
    data_fim_promocao: fallback(settings.planos.data_fim_promocao),
  };
  for (const [k, v] of Object.entries(context)) {
    if (v === undefined || v === null) continue;
    vars[k] = fallback(String(v));
  }
  return vars;
}

export function applyRevendaVariables(
  text: string,
  context: RevendaVariableContext = {},
  settings: RevendaSettings = getRevendaSettings(),
): string {
  if (!text) return "";
  const vars = buildRevendaVariables(settings, context);
  // Não destrutivo: substitui apenas tokens conhecidos (revenda + contexto).
  // Placeholders desconhecidos permanecem intactos para outros renderizadores.
  return text.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name: string) => {
    const v = vars[name];
    return v !== undefined ? v : match;
  });
}

export const REVENDA_PREVIEW_TEMPLATES: { id: string; label: string; text: string }[] = [
  {
    id: "vencimento",
    label: "Mensagem de vencimento",
    text:
      "Oi {cliente_nome}, aqui é {responsavel} da {nome_revenda}. Seu plano {valor_mensal} vence em {vencimento}. Pode renovar pelo Pix {pix} ({recebedor}). Qualquer dúvida, me chama no {whatsapp_suporte}.",
  },
  {
    id: "teste_enviado",
    label: "Teste enviado",
    text:
      "Olá {cliente_nome}! Aqui é {responsavel} da {nome_revenda}. Acabei de te enviar o acesso de teste. Qualquer dúvida me chama aqui, atendo de {horario_semana}.",
  },
  {
    id: "audio",
    label: "Resposta com áudio",
    text: "{texto_audio_padrao}",
  },
  {
    id: "fora_horario",
    label: "Fora do horário",
    text: "{texto_fora_horario_padrao}",
  },
  {
    id: "app_vencendo",
    label: "App pago vencendo",
    text:
      "Oi {cliente_nome}, seu aplicativo pago está vencendo. A renovação fica {valor_renovacao_app}. Pix: {pix} ({recebedor}). Posso renovar pra você?",
  },
  {
    id: "renovacao_concluida",
    label: "Renovação concluída",
    text:
      "Tudo certo, {cliente_nome}! Renovei seu plano {valor_mensal}. Bom uso e qualquer coisa estou por aqui ({horario_semana}).",
  },
];

export function renderRevendaPreview(
  id: string,
  settings: RevendaSettings = getRevendaSettings(),
): string {
  const tpl = REVENDA_PREVIEW_TEMPLATES.find((t) => t.id === id);
  if (!tpl) return "";
  let text = tpl.text;
  // tokens "padrão" que vêm direto das configurações
  text = text
    .replace("{texto_audio_padrao}", settings.atendimento.texto_audio || "não informado")
    .replace("{texto_fora_horario_padrao}", settings.atendimento.texto_fora_horario || "não informado");
  return applyRevendaVariables(
    text,
    {
      cliente_nome: "Cliente Exemplo",
      vencimento: "amanhã",
      app: "App Exemplo",
      servidor: "Servidor Exemplo",
    },
    settings,
  );
}
