// Local-only model for Trial Leads (Testes).
// No backend, no API calls — pure localStorage.

const STORAGE_KEY = "cobranca_ia_trial_leads_v1";
const FOLLOWUP_KEY = "cobranca_ia_trial_followups_v1";

export const TRIAL_ORIGINS = [
  "Anúncio",
  "Instagram",
  "Facebook",
  "Indicação",
  "Grupo",
  "Cliente antigo",
  "Outro",
] as const;
export type TrialOrigin = (typeof TRIAL_ORIGINS)[number];

export const TRIAL_STATUSES = [
  "Novo contato",
  "Teste solicitado",
  "Teste enviado",
  "Em teste",
  "Aguardando resposta",
  "Fechou",
  "Não fechou",
  "Perdido",
  "Convertido em cliente",
] as const;
export type TrialStatus = (typeof TRIAL_STATUSES)[number];

export const TRIAL_INTERESTS = ["Frio", "Morno", "Quente"] as const;
export type TrialInterest = (typeof TRIAL_INTERESTS)[number];

export type TrialLead = {
  id: string;
  company_id?: string | null;
  nome?: string;
  whatsapp: string;
  origem: TrialOrigin;
  status: TrialStatus;
  data_contato?: string;
  data_inicio?: string;
  data_fim?: string;
  app?: string;
  servidor?: string;
  servidor_adicional?: string;
  usuario?: string;
  senha?: string;
  valor_cents?: number;
  horas_teste?: number;
  observacao?: string;
  indicado_por_cliente_id?: string;
  indicado_por_nome?: string;
  indicado_por_whatsapp?: string;
  interesse: TrialInterest;
  ultimo_contato?: string;
  proxima_acao?: string;
  arquivado?: boolean;
  criado_em: string;
  atualizado_em: string;
};

export type FollowUpType =
  | "boas_vindas"
  | "meio_teste"
  | "fim_teste"
  | "recuperacao_1d"
  | "recuperacao_3d"
  | "ultimo_7d";

export const FOLLOWUP_LABEL: Record<FollowUpType, string> = {
  boas_vindas: "Teste enviado",
  meio_teste: "Meio do teste",
  fim_teste: "Fim do teste",
  recuperacao_1d: "Recuperação +1d",
  recuperacao_3d: "Última chamada +3d",
  ultimo_7d: "Marcar como frio +7d",
};

export type FollowUpStatus = "Pendente" | "Copiado" | "Ignorado" | "Resolvido";

export type FollowUp = {
  id: string;
  lead_id: string;
  type: FollowUpType;
  data_planejada: string; // ISO date
  status: FollowUpStatus;
  atualizado_em: string;
};

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "00000000-0000-4000-8000-" + Math.random().toString(16).slice(2, 14).padEnd(12, "0");
}

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, items: T[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(items));
  try {
    window.dispatchEvent(new CustomEvent("trial-leads:changed"));
  } catch {
    // ignore
  }
}

import { getCurrentRole } from "./local-auth";
import { getActiveCompanyId } from "./company-scope";
import { mirror } from "./sync/mirror";
import { upsertTrialLeadDb, deleteTrialLeadDb, bulkUpsertTrialFollowupsDb } from "./trial-leads/trial-leads.functions";

function leadToDb(l: TrialLead) {
  return {
    id: l.id, nome: l.nome ?? null, whatsapp: l.whatsapp,
    origem: l.origem ?? null, status: l.status ?? null,
    data_contato: l.data_contato ?? null, data_inicio: l.data_inicio ?? null, data_fim: l.data_fim ?? null,
    app: l.app ?? null, servidor: l.servidor ?? null, servidor_adicional: l.servidor_adicional ?? null,
    usuario: l.usuario ?? null, senha: l.senha ?? null,
    valor_cents: l.valor_cents ?? null, horas_teste: l.horas_teste ?? null,
    interesse: l.interesse ?? null, observacoes: l.observacao ?? null,
    extraJson: JSON.stringify({
      indicado_por_cliente_id: l.indicado_por_cliente_id,
      indicado_por_nome: l.indicado_por_nome,
      indicado_por_whatsapp: l.indicado_por_whatsapp,
      ultimo_contato: l.ultimo_contato,
      proxima_acao: l.proxima_acao,
      arquivado: l.arquivado,
      criado_em: l.criado_em,
      atualizado_em: l.atualizado_em,
    }),
  };
}

function scopedFilter<T extends { company_id?: string | null }>(list: T[]): T[] {
  const role = getCurrentRole();
  const activeId = getActiveCompanyId();
  if (role === "super_admin" && !activeId) return list;
  if (!activeId) return [];
  return list.filter((r) => r.company_id === activeId);
}

export function listTrialLeads(): TrialLead[] {
  return scopedFilter(read<TrialLead>(STORAGE_KEY));
}

export function listAllTrialLeadsRaw(): TrialLead[] {
  return read<TrialLead>(STORAGE_KEY);
}

export function listFollowUps(leadId?: string): FollowUp[] {
  const all = read<FollowUp>(FOLLOWUP_KEY);
  return leadId ? all.filter((f) => f.lead_id === leadId) : all;
}

function saveAllFollowUps(items: FollowUp[]) {
  write(FOLLOWUP_KEY, items);
}

export function buildTrialFollowUpSchedule(lead: TrialLead): FollowUp[] {
  const start = lead.data_inicio ? new Date(lead.data_inicio) : new Date();
  const end = lead.data_fim ? new Date(lead.data_fim) : addDays(start, 1);
  const mid = new Date((start.getTime() + end.getTime()) / 2);
  const now = new Date().toISOString();
  const make = (type: FollowUpType, date: Date): FollowUp => ({
    id: uid(),
    lead_id: lead.id,
    type,
    data_planejada: date.toISOString(),
    status: "Pendente",
    atualizado_em: now,
  });
  return [
    make("boas_vindas", start),
    make("meio_teste", mid),
    make("fim_teste", end),
    make("recuperacao_1d", addDays(end, 1)),
    make("recuperacao_3d", addDays(end, 3)),
    make("ultimo_7d", addDays(end, 7)),
  ];
}

function addDays(d: Date, n: number) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

export function saveTrialLead(
  input: Partial<TrialLead> & { whatsapp: string },
): TrialLead {
  const list = listAllTrialLeadsRaw();
  const now = new Date().toISOString();
  const activeId = getActiveCompanyId();
  const lead: TrialLead = {
    id: uid(),
    company_id: input.company_id ?? activeId ?? null,
    nome: input.nome,
    whatsapp: input.whatsapp,
    origem: (input.origem as TrialOrigin) ?? "Outro",
    status: (input.status as TrialStatus) ?? "Teste solicitado",
    data_contato: input.data_contato ?? now,
    data_inicio: input.data_inicio,
    data_fim: input.data_fim,
    app: input.app,
    servidor: input.servidor,
    servidor_adicional: input.servidor_adicional,
    usuario: input.usuario,
    senha: input.senha,
    valor_cents: input.valor_cents,
    horas_teste: input.horas_teste,
    observacao: input.observacao,
    indicado_por_cliente_id: input.indicado_por_cliente_id,
    indicado_por_nome: input.indicado_por_nome,
    indicado_por_whatsapp: input.indicado_por_whatsapp,
    interesse: (input.interesse as TrialInterest) ?? "Morno",
    criado_em: now,
    atualizado_em: now,
  };
  list.unshift(lead);
  write(STORAGE_KEY, list);
  const fups = listFollowUps();
  fups.push(...buildTrialFollowUpSchedule(lead));
  saveAllFollowUps(fups);
  return lead;
}

export function updateTrialLead(id: string, patch: Partial<TrialLead>): TrialLead | null {
  const list = listAllTrialLeadsRaw();
  const idx = list.findIndex((l) => l.id === id);
  if (idx < 0) return null;
  const prev = list[idx];
  const updated = {
    ...prev,
    ...patch,
    company_id: patch.company_id ?? prev.company_id,
    atualizado_em: new Date().toISOString(),
  };
  list[idx] = updated;
  write(STORAGE_KEY, list);
  return updated;
}

export function archiveTrialLead(id: string) {
  return updateTrialLead(id, { arquivado: true });
}

export function markTrialLeadClosed(id: string) {
  return updateTrialLead(id, { status: "Fechou" });
}

export function markTrialLeadLost(id: string) {
  return updateTrialLead(id, { status: "Não fechou" });
}

export function updateFollowUpStatus(id: string, status: FollowUpStatus) {
  const list = listFollowUps();
  const idx = list.findIndex((f) => f.id === id);
  if (idx < 0) return;
  list[idx] = { ...list[idx], status, atualizado_em: new Date().toISOString() };
  saveAllFollowUps(list);
}

export function exportTrialLeads() {
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    leads: listTrialLeads(),
    followups: listFollowUps(),
  };
}

export function importTrialLeads(
  payload: unknown,
  mode: "merge" | "replace" = "merge",
) {
  if (!payload || typeof payload !== "object") throw new Error("Formato inválido");
  const p = payload as { leads?: unknown; followups?: unknown };
  if (!Array.isArray(p.leads)) throw new Error("Sem campo leads[]");
  const leads = p.leads as TrialLead[];
  const fups = Array.isArray(p.followups) ? (p.followups as FollowUp[]) : [];
  if (mode === "replace") {
    write(STORAGE_KEY, leads);
    saveAllFollowUps(fups);
    return { imported: leads.length };
  }
  const existing = listTrialLeads();
  const existingIds = new Set(existing.map((l) => l.id));
  const merged = [...existing, ...leads.filter((l) => !existingIds.has(l.id))];
  write(STORAGE_KEY, merged);
  const existingF = listFollowUps();
  const exFids = new Set(existingF.map((f) => f.id));
  saveAllFollowUps([...existingF, ...fups.filter((f) => !exFids.has(f.id))]);
  return { imported: leads.length };
}

// ------- Message templates -------

export const TRIAL_TEMPLATES: Record<FollowUpType, string> = {
  boas_vindas:
    "Olá {nome}, tudo bem? 😊\n\nSeu teste já está liberado.\nQualquer dificuldade para acessar, me chama por aqui e me diga qual aplicativo está usando.",
  meio_teste:
    "Olá {nome}, tudo certo? 😊\n\nConseguiu testar os canais, filmes e séries?\nSe travou ou apareceu algum erro, me manda o nome do app e um print da tela que eu te ajudo.",
  fim_teste:
    "Olá {nome}, tudo bem? 😊\n\nSeu teste está chegando ao fim.\nGostou do acesso? Posso te passar os planos para você continuar usando sem interrupção.",
  recuperacao_1d:
    "Olá {nome}, tudo bem? 😊\n\nVi que você fez o teste, mas ainda não ativou.\nSe quiser continuar com os canais, filmes e séries, posso te ajudar a escolher o melhor plano.",
  recuperacao_3d:
    "Olá {nome}, tudo bem? 😊\n\nPassando só para saber se ainda tem interesse em ativar o acesso.\nSe quiser, posso liberar as informações para você continuar.",
  ultimo_7d:
    "Olá {nome}, tudo bem? 😊\n\nÚltima mensagem por aqui — me avise se ainda tem interesse no acesso. Caso contrário, vou arquivar o contato.",
};

export const INDICADO_TEMPLATE =
  "Olá {nome}, tudo bem? 😊\n\nVocê veio por indicação, então vou te ajudar a testar da melhor forma.\nSe tiver qualquer dificuldade, me chama por aqui.";

import { applyRevendaVariables } from "./revenda-settings";

export function renderTemplate(tpl: string, lead: TrialLead) {
  const base = tpl
    .replaceAll("{nome}", lead.nome?.trim() || "tudo bem")
    .replaceAll("{whatsapp}", lead.whatsapp || "")
    .replaceAll("{app}", lead.app || "")
    .replaceAll("{servidor}", lead.servidor || "");
  return applyRevendaVariables(base);
}

export function waLink(whatsapp: string) {
  const digits = (whatsapp || "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}
