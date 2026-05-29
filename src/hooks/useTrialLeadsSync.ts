// Sync DB-first para trial_leads + trial_followups.
// Local IDs (base36) são convertidos para UUID na primeira subida;
// o id reescrito é persistido de volta no localStorage para consistência.
import { useCallback } from "react";
import { useDbFirstSync } from "@/hooks/useDbFirstSync";
import {
  listTrialLeadsDb,
  bulkUpsertTrialLeadsDb,
  listTrialFollowupsDb,
  bulkUpsertTrialFollowupsDb,
  type TrialLeadDto,
} from "@/lib/trial-leads/trial-leads.functions";
import type { TrialLead, FollowUp } from "@/lib/trial-leads";

const STORAGE_KEY = "cobranca_ia_trial_leads_v1";
const FOLLOWUP_KEY = "cobranca_ia_trial_followups_v1";
const UPLOADED_FLAG = "cobraeasy.trial_leads.synced";

function isBrowser() { return typeof window !== "undefined"; }
function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "00000000-0000-4000-8000-" + Math.random().toString(16).slice(2, 14).padEnd(12, "0");
}

function readArr<T>(key: string): T[] {
  if (!isBrowser()) return [];
  try { const r = localStorage.getItem(key); const p = r ? JSON.parse(r) : []; return Array.isArray(p) ? p : []; }
  catch { return []; }
}
function writeArr<T>(key: string, items: T[]) {
  if (!isBrowser()) return;
  localStorage.setItem(key, JSON.stringify(items));
  try { window.dispatchEvent(new CustomEvent("trial-leads:changed")); } catch { /* noop */ }
}

function dtoToLocal(d: TrialLeadDto): TrialLead {
  let extra: Record<string, unknown> = {};
  try { extra = JSON.parse(d.extraJson) as Record<string, unknown>; } catch { /* noop */ }
  return {
    id: d.id,
    company_id: d.company_id,
    nome: d.nome ?? undefined,
    whatsapp: d.whatsapp,
    origem: (extra.origem as TrialLead["origem"]) ?? (d.origem as TrialLead["origem"]) ?? "Outro",
    status: (extra.status as TrialLead["status"]) ?? (d.status as TrialLead["status"]) ?? "Teste solicitado",
    data_contato: d.data_contato ?? undefined,
    data_inicio: d.data_inicio ?? undefined,
    data_fim: d.data_fim ?? undefined,
    app: d.app ?? undefined,
    servidor: d.servidor ?? undefined,
    servidor_adicional: d.servidor_adicional ?? undefined,
    usuario: d.usuario ?? undefined,
    senha: d.senha ?? undefined,
    valor_cents: d.valor_cents ?? undefined,
    horas_teste: d.horas_teste ?? undefined,
    observacao: d.observacoes ?? undefined,
    interesse: (extra.interesse as TrialLead["interesse"]) ?? (d.interesse as TrialLead["interesse"]) ?? "Morno",
    indicado_por_cliente_id: extra.indicado_por_cliente_id as string | undefined,
    indicado_por_nome: extra.indicado_por_nome as string | undefined,
    indicado_por_whatsapp: extra.indicado_por_whatsapp as string | undefined,
    ultimo_contato: extra.ultimo_contato as string | undefined,
    proxima_acao: extra.proxima_acao as string | undefined,
    arquivado: extra.arquivado as boolean | undefined,
    criado_em: (extra.criado_em as string) ?? d.created_at,
    atualizado_em: (extra.atualizado_em as string) ?? d.updated_at,
  };
}

function localToDb(l: TrialLead): {
  id?: string; nome: string | null; whatsapp: string; origem: string | null; status: string | null;
  data_contato: string | null; data_inicio: string | null; data_fim: string | null;
  app: string | null; servidor: string | null; servidor_adicional: string | null;
  usuario: string | null; senha: string | null; valor_cents: number | null; horas_teste: number | null;
  interesse: string | null; observacoes: string | null; extraJson: string;
} {
  return {
    id: isUuid(l.id) ? l.id : undefined,
    nome: l.nome ?? null,
    whatsapp: l.whatsapp,
    origem: l.origem ?? null,
    status: l.status ?? null,
    data_contato: l.data_contato ?? null,
    data_inicio: l.data_inicio ?? null,
    data_fim: l.data_fim ?? null,
    app: l.app ?? null,
    servidor: l.servidor ?? null,
    servidor_adicional: l.servidor_adicional ?? null,
    usuario: l.usuario ?? null,
    senha: l.senha ?? null,
    valor_cents: l.valor_cents ?? null,
    horas_teste: l.horas_teste ?? null,
    interesse: l.interesse ?? null,
    observacoes: l.observacao ?? null,
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

export function useTrialLeadsSync() {
  const hydrate = useCallback(async (companyId: string) => {
    const rows = await listTrialLeadsDb({ data: { companyId } });
    if (!rows || rows.length === 0) return;
    // mescla por whatsapp para preservar entradas locais não-uploadadas ainda
    const local = readArr<TrialLead>(STORAGE_KEY);
    const fromDb = rows.map(dtoToLocal);
    const seen = new Set(fromDb.map((l) => l.whatsapp));
    const merged = [...fromDb, ...local.filter((l) => !seen.has(l.whatsapp) && !isUuid(l.id))];
    writeArr(STORAGE_KEY, merged);
    try {
      const fups = await listTrialFollowupsDb({ data: { companyId } });
      if (fups && fups.length > 0) {
        writeArr<FollowUp>(FOLLOWUP_KEY, fups.map((f) => ({
          id: f.id, lead_id: f.lead_id, type: f.tipo as FollowUp["type"],
          data_planejada: f.data_planejada,
          status: f.status as FollowUp["status"],
          atualizado_em: f.atualizado_em,
        })));
      }
    } catch { /* noop */ }
  }, []);

  const uploadAll = useCallback(async (companyId: string) => {
    if (!isBrowser()) return;
    const local = readArr<TrialLead>(STORAGE_KEY);
    if (local.length === 0) return;
    // Atribui UUIDs aos leads locais que ainda não têm
    let mutated = false;
    const remapped = local.map((l) => {
      if (isUuid(l.id)) return l;
      mutated = true;
      return { ...l, id: newId() };
    });
    if (mutated) writeArr(STORAGE_KEY, remapped);

    const items = remapped.map(localToDb);
    await bulkUpsertTrialLeadsDb({ data: { companyId, items } });

    const fups = readArr<FollowUp>(FOLLOWUP_KEY);
    if (fups.length > 0) {
      const leadIds = new Set(remapped.map((l) => l.id));
      const fupItems = fups
        .filter((f) => leadIds.has(f.lead_id))
        .map((f) => ({
          id: isUuid(f.id) ? f.id : newId(),
          lead_id: f.lead_id,
          tipo: f.type,
          data_planejada: f.data_planejada,
          status: f.status,
          atualizado_em: f.atualizado_em,
        }));
      if (fupItems.length > 0) {
        try { await bulkUpsertTrialFollowupsDb({ data: { companyId, items: fupItems } }); }
        catch { /* noop */ }
      }
    }
  }, []);

  const uploadLegacy = useCallback(async (companyId: string) => {
    if (!isBrowser()) return;
    if (localStorage.getItem(UPLOADED_FLAG + ":" + companyId) === "1") return;
    await uploadAll(companyId);
    localStorage.setItem(UPLOADED_FLAG + ":" + companyId, "1");
  }, [uploadAll]);

  useDbFirstSync({
    table: "trial_leads",
    hydrate,
    uploadLegacy,
    mirror: uploadAll,
    mirrorEvents: ["trial-leads:changed"],
  });
}
