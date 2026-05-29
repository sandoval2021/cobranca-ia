// Central de Templates Automáticos — DB-first com cache local.
// Escrita: local + mirror fire-and-forget no banco (auto_templates).
import { mirror } from "./sync/mirror";
import {
  upsertAutoTemplateDb,
  deleteAutoTemplateDb,
  bulkUpsertAutoTemplatesDb,
} from "./auto-templates.functions";

const STORAGE_KEY = "cobraeasy.auto-templates.v1";

export type Channel = "whatsapp" | "email" | "ia";

export type AutoTemplate = {
  id: string;
  category: "cobranca" | "renovacao" | "app_cobranca" | "app_renovacao" | "teste";
  /** chave estável para identificar o template padrão (ex.: cob_d0, ren_global, app_cob, teste_1h) */
  key: string;
  name: string;
  description?: string;
  /** offset em horas/dias dependendo do contexto. Para cobranças/teste. */
  offsetHours?: number;
  /** opcional: vinculação a plano ou app específico */
  scope?: string;
  channels: Record<Channel, boolean>;
  active: boolean;
  /** janela horária preferida (HH:mm) */
  sendStart?: string;
  sendEnd?: string;
  body: string;
  isDefault?: boolean;
};

export const VARIABLES_DEFAULT = [
  "{nome}", "{telefone}", "{plano}", "{valor}", "{vencimento}",
  "{dias}", "{pix}", "{link_pagamento}", "{empresa}",
] as const;

export const VARIABLES_APP = [
  "{nome}", "{app}", "{mac}", "{key}", "{app_vencimento}", "{valor}", "{empresa}",
] as const;

export const VARIABLES_TESTE = [
  "{nome}", "{servico}", "{valor}", "{dias_restantes}",
  "{vencimento_teste}", "{empresa}",
] as const;

// ---------------- DEFAULTS ----------------

const cob = (key: string, name: string, offsetHours: number, body: string): AutoTemplate => ({
  id: `default-${key}`,
  category: "cobranca",
  key, name, offsetHours,
  channels: { whatsapp: true, email: false, ia: false },
  active: true,
  sendStart: "09:00", sendEnd: "20:00",
  body, isDefault: true,
});

const DEFAULTS: AutoTemplate[] = [
  // Cobranças
  cob("cob_d0", "Vence hoje", 0,
`Olá {nome} 👋

Seu plano *{plano}* vence hoje ({vencimento}).
💰 Valor: R$ {valor}

Pague pelo Pix: {pix}
Ou pelo link: {link_pagamento}

Equipe {empresa}`),
  cob("cob_dm1", "1 dia antes do vencimento", -24,
`Oi {nome} 😊

Lembrete amigável: seu plano *{plano}* vence amanhã ({vencimento}).
💰 Valor: R$ {valor}

Antecipe pelo Pix: {pix}

Equipe {empresa}`),
  cob("cob_dm3", "3 dias antes do vencimento", -72,
`Olá {nome}!

Faltam {dias} dias para o vencimento do seu plano *{plano}* ({vencimento}).
💰 Valor: R$ {valor}

Quando quiser, é só pagar: {link_pagamento}

Equipe {empresa}`),
  cob("cob_d1", "1 dia após vencimento", 24,
`Olá {nome},

Identificamos que seu plano *{plano}* venceu ontem ({vencimento}).
💰 Valor em aberto: R$ {valor}

Pague agora pelo Pix: {pix}

Equipe {empresa}`),
  cob("cob_d3", "3 dias após vencimento", 72,
`Oi {nome}, tudo bem?

Seu plano *{plano}* está em atraso há {dias} dias.
💰 R$ {valor}

Evite a suspensão pagando agora: {link_pagamento}

Equipe {empresa}`),
  cob("cob_d7", "7 dias após vencimento", 168,
`Olá {nome},

Seu plano *{plano}* está atrasado há {dias} dias.
💰 R$ {valor}

Para manter seu acesso, regularize hoje: {link_pagamento}

Equipe {empresa}`),
  cob("cob_d15", "15 dias após vencimento", 360,
`Olá {nome},

Você está há {dias} dias com pagamento em aberto.
💰 R$ {valor}

Podemos ajudar a negociar. Fale com a gente.

Equipe {empresa}`),
  cob("cob_d30", "30 dias após vencimento", 720,
`Olá {nome},

Esta é nossa última tentativa de contato amigável sobre o plano *{plano}* ({dias} dias em atraso).
💰 R$ {valor}

Entre em contato para regularizar: {telefone}

Equipe {empresa}`),

  // Renovação (padrão global)
  {
    id: "default-ren_global",
    category: "renovacao",
    key: "ren_global",
    name: "Renovação — Padrão (todos os planos)",
    channels: { whatsapp: true, email: true, ia: false },
    active: true,
    body:
`🎉 Renovação realizada com sucesso!

Olá {nome},

Seu acesso foi renovado.

📦 Plano: {plano}
💰 Valor: R$ {valor}
📅 Nova validade: {vencimento}

Obrigado pela confiança.

Equipe {empresa}`,
    isDefault: true,
  },

  // App — Cobrança
  {
    id: "default-app_cob",
    category: "app_cobranca",
    key: "app_cob",
    name: "Aplicativo — Cobrança (padrão)",
    channels: { whatsapp: true, email: false, ia: false },
    active: true,
    body:
`📱 Seu aplicativo está próximo do vencimento

Olá {nome},

Seu aplicativo precisa ser renovado.

📲 Aplicativo: {app}
🔑 MAC: {mac}
📅 Vencimento: {app_vencimento}
💰 Valor: R$ {valor}

Entre em contato para renovar.

Equipe {empresa}`,
    isDefault: true,
  },

  // App — Renovação
  {
    id: "default-app_ren",
    category: "app_renovacao",
    key: "app_ren",
    name: "Aplicativo — Renovação (padrão)",
    channels: { whatsapp: true, email: true, ia: false },
    active: true,
    body:
`🎉 Aplicativo renovado com sucesso

Olá {nome},

Seu aplicativo foi renovado.

📲 Aplicativo: {app}
🔑 MAC: {mac}
🔐 KEY: {key}
📅 Nova validade: {app_vencimento}

Obrigado pela preferência.

Equipe {empresa}`,
    isDefault: true,
  },

  // Testes (conversão)
  ten("teste_1h", "Após 1 hora", 1,
`👋 Olá {nome}

Percebemos que você iniciou seu teste.

Se precisar de ajuda para configurar ou entender qualquer função, estamos à disposição.

🚀 Aproveite para explorar todas as funcionalidades.

Equipe {empresa}`),
  ten("teste_6h", "Após 6 horas", 6,
`Oi {nome}! Já conseguiu testar as principais funções? Qualquer dúvida estamos por aqui. — Equipe {empresa}`),
  ten("teste_12h", "Após 12 horas", 12,
`Olá {nome}, como está o seu teste? Posso te mostrar algum recurso? — Equipe {empresa}`),
  ten("teste_24h", "Após 24 horas", 24,
`📈 Como está sendo sua experiência?

Olá {nome},

Você já testou:

✅ Cadastro de clientes
✅ Cobrança automática
✅ WhatsApp
✅ Relatórios
✅ Controle financeiro

Caso tenha dúvidas, estamos aqui para ajudar.

Equipe {empresa}`),
  ten("teste_2d", "Após 2 dias", 48,
`Olá {nome}, faltam {dias_restantes} dias para o fim do teste. Posso ajudar com algo? — Equipe {empresa}`),
  ten("teste_3d", "Após 3 dias", 72,
`Oi {nome}! Já está aproveitando o sistema? Em {dias_restantes} dias seu teste termina. — Equipe {empresa}`),
  ten("teste_5d", "Após 5 dias", 120,
`⏳ Seu período de teste está acabando

Olá {nome},

Faltam apenas {dias_restantes} dias para o término do seu teste.

Garanta seu acesso e continue utilizando todas as funcionalidades.

Equipe {empresa}`),
  ten("teste_7d", "Após 7 dias", 168,
`🎉 Gostou do sistema?

Seu período de teste chegou ao fim.

Caso deseje continuar utilizando:

💳 Plano mensal
📈 Cobrança automática
🤖 IA Atendente
📱 WhatsApp integrado

Entre em contato para ativar sua conta.

Equipe {empresa}`),
];

function ten(key: string, name: string, offsetHours: number, body: string): AutoTemplate {
  return {
    id: `default-${key}`,
    category: "teste",
    key, name, offsetHours,
    channels: { whatsapp: true, email: false, ia: false },
    active: offsetHours === 1 || offsetHours === 24 || offsetHours === 120 || offsetHours === 168,
    body, isDefault: true,
  };
}

// ---------------- STORAGE ----------------

function readRaw(): AutoTemplate[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AutoTemplate[]) : null;
  } catch { return null; }
}

function writeRaw(items: AutoTemplate[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("cobraeasy:auto-templates-changed"));
}

export function listTemplates(): AutoTemplate[] {
  const raw = readRaw();
  if (!raw) {
    writeRaw(DEFAULTS);
    return [...DEFAULTS];
  }
  // mescla: garante que todos os defaults existam (não sobrescreve customizados)
  const map = new Map(raw.map((t) => [t.key, t] as const));
  for (const d of DEFAULTS) if (!map.has(d.key)) map.set(d.key, d);
  const merged = Array.from(map.values());
  if (merged.length !== raw.length) writeRaw(merged);
  return merged;
}

export function upsertTemplate(t: AutoTemplate) {
  const all = listTemplates();
  const idx = all.findIndex((x) => x.id === t.id);
  if (idx >= 0) all[idx] = t; else all.push(t);
  writeRaw(all);
  mirrorTemplate(t);
}

export function removeTemplate(id: string) {
  const all = listTemplates().filter((x) => x.id !== id);
  writeRaw(all);
  mirror((companyId) => deleteAutoTemplateDb({ data: { companyId, template_id: id } }));
}

export function restoreDefault(key: string) {
  const all = listTemplates();
  const def = DEFAULTS.find((d) => d.key === key);
  if (!def) return;
  const idx = all.findIndex((x) => x.key === key);
  if (idx >= 0) all[idx] = { ...def };
  else all.push({ ...def });
  writeRaw(all);
  mirrorTemplate({ ...def });
}

export function restoreAllDefaults() {
  writeRaw([...DEFAULTS]);
  mirror((companyId) => bulkUpsertAutoTemplatesDb({
    data: { companyId, items: DEFAULTS.map(templateToDbItem) },
  }));
}

function templateToDbItem(t: AutoTemplate) {
  return {
    template_id: t.id,
    categoria: t.category,
    ativo: t.active,
    body: t.body ?? null,
    channelsJson: JSON.stringify(t.channels),
    timeWindowJson: JSON.stringify({ sendStart: t.sendStart, sendEnd: t.sendEnd }),
    extraJson: JSON.stringify({
      key: t.key, name: t.name, description: t.description,
      offsetHours: t.offsetHours, scope: t.scope, isDefault: t.isDefault,
    }),
  };
}

function mirrorTemplate(t: AutoTemplate) {
  mirror((companyId) =>
    upsertAutoTemplateDb({ data: { companyId, ...templateToDbItem(t) } }),
  );
}

export function previewTemplate(body: string, scope: "cobranca" | "renovacao" | "app" | "teste"): string {
  const sample: Record<string, string> = {
    "{nome}": "Maria Silva",
    "{telefone}": "(11) 99999-0000",
    "{plano}": "Mensal 1 Tela",
    "{valor}": "49,90",
    "{vencimento}": new Date().toLocaleDateString("pt-BR"),
    "{dias}": "3",
    "{pix}": "pix@suaempresa.com",
    "{link_pagamento}": "https://pag.suaempresa.com/abcd",
    "{empresa}": "Sua Empresa",
    "{app}": "IBO Player",
    "{mac}": "00:1A:79:11:22:33",
    "{key}": "ABCD-1234-XYZW",
    "{app_vencimento}": new Date(Date.now() + 7 * 86400000).toLocaleDateString("pt-BR"),
    "{dias_restantes}": "2",
  };
  let out = body;
  for (const [k, v] of Object.entries(sample)) out = out.split(k).join(v);
  return out;
}

export function categoryLabel(c: AutoTemplate["category"]): string {
  switch (c) {
    case "cobranca": return "Cobrança";
    case "renovacao": return "Renovação";
    case "app_cobranca": return "App · Cobrança";
    case "app_renovacao": return "App · Renovação";
    case "teste": return "Teste / Conversão";
  }
}
