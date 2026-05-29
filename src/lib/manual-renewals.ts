// Histórico local de renovações manuais (preview-only, localStorage).
// Nada é enviado para servidor. Nenhum login automático em painel.

import {
  AppScreen,
  APP_CATALOG,
  listScreens,
  upsertScreen,
} from "@/lib/app-screens";
import { getServerById } from "@/lib/server-catalog";
import { applyRevendaVariables, getRevendaSettings } from "@/lib/revenda-settings";

export type PaymentMethod = "pix" | "dinheiro" | "cartao" | "outro";

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  outro: "Outro",
};

export type RenewalServerLog = {
  server_id: string;
  server_name: string;
  status: "renovado" | "pulado";
};

export type RenewalScreenLog = {
  screen_id: string;
  screen_name: string;
  app_label: string;
  old_due_date?: string;
  new_due_date?: string;
  app_renewed: boolean;
  old_app_due_date?: string;
  new_app_due_date?: string;
  servers: RenewalServerLog[];
};

export type RenewalRecord = {
  id: string;
  company_id?: string | null;
  created_at: string;
  customer_id: string;
  customer_name: string;
  customer_whatsapp?: string | null;
  screens: RenewalScreenLog[];
  amount?: string;
  payment_method?: PaymentMethod;
  app_amount?: string;
  notes?: string;
  next_due_date?: string;
  confirmation_message: string;
};

// Formata "+5582988936713" => "(82) 98893-6713".
function formatPhonePretty(wa?: string | null): string {
  if (!wa) return "";
  const d = wa.replace(/\D+/g, "");
  // Remove DDI 55 se houver
  const local = d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return wa;
}

// Saudação amigável: usa o nome se for real; usa o telefone formatado quando
// o nome é genérico (ex.: "Cliente importado 87").
function friendlyGreetingName(name: string, whatsapp?: string | null): string {
  const isPlaceholder = !name || /^cliente importado/i.test(name.trim());
  if (isPlaceholder) {
    const pretty = formatPhonePretty(whatsapp);
    if (pretty) return pretty;
  }
  return name || "cliente";
}


const STORAGE_KEY = "cobranca_ia_manual_renewal_history_v1";
export const RENEWAL_EVENT = "cobranca_ia_manual_renewal:changed";

function readAll(): Record<string, RenewalRecord[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw);
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, RenewalRecord[]>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent(RENEWAL_EVENT));
  } catch {
    /* noop */
  }
}

// Escopo local por empresa
import { getCurrentRole } from "./local-auth";
import { getActiveCompanyId } from "./company-scope";

function inScope(r: RenewalRecord): boolean {
  const role = getCurrentRole();
  const activeId = getActiveCompanyId();
  if (role === "super_admin" && !activeId) return true;
  if (!activeId) return false;
  return r.company_id === activeId;
}

export function listRenewals(customerId: string): RenewalRecord[] {
  const all = readAll();
  return (all[customerId] ?? [])
    .filter(inScope)
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function listAllRenewalsRaw(): RenewalRecord[] {
  const all = readAll();
  const out: RenewalRecord[] = [];
  for (const list of Object.values(all)) out.push(...list);
  return out;
}

export function newRenewalId(): string {
  return `rnw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function fmtDateBR(d?: string): string {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(+dt)) return d;
  return dt.toLocaleDateString("pt-BR");
}

// ---------- Apply renewal ----------

export type RenewalDraftScreen = {
  screen_id: string;
  servers: RenewalServerLog[];
};

export type RenewalDraft = {
  customer_id: string;
  customer_name: string;
  customer_whatsapp?: string | null;
  new_due_date: string; // YYYY-MM-DD
  amount?: string;
  payment_method?: PaymentMethod;
  notes?: string;
  renew_app: boolean;
  new_app_due_date?: string;
  app_amount?: string;
  screens: RenewalDraftScreen[];
};


export function buildConfirmationMessage(rec: RenewalRecord): string {
  let telasLinha = "";
  let vencimento = "";
  if (rec.screens.length === 1) {
    const s = rec.screens[0];
    vencimento = s.new_due_date ? fmtDateBR(s.new_due_date) : "";
    telasLinha = s.screen_name ? `\n📺 Tela: ${s.screen_name}` : "";
    if (s.app_renewed && s.new_app_due_date) {
      telasLinha += `\n📱 App ${s.app_label} renovado até: ${fmtDateBR(s.new_app_due_date)}`;
    }
  } else if (rec.screens.length > 1) {
    vencimento = fmtDateBR(rec.screens[0].new_due_date);
    const lines: string[] = ["", "Telas renovadas:"];
    for (const s of rec.screens) {
      lines.push(`📺 ${s.screen_name} — vence ${fmtDateBR(s.new_due_date)}`);
    }
    const appRenewed = rec.screens.filter((s) => s.app_renewed && s.new_app_due_date);
    for (const s of appRenewed) {
      lines.push(`📱 App ${s.app_label} (${s.screen_name}) até ${fmtDateBR(s.new_app_due_date)}`);
    }
    telasLinha = lines.join("\n");
  }

  // Fallback: cliente sem telas — usa next_due_date do registro.
  if (!vencimento && rec.next_due_date) {
    vencimento = fmtDateBR(rec.next_due_date);
  }

  const settings = getRevendaSettings();
  const template =
    settings.mensagens?.renovacao_confirmada?.trim() ||
    "Olá {cliente_nome}, tudo certo ✅\n\nSua renovação foi registrada.\n📅 Novo vencimento: {vencimento}{telas_linha}\n\nObrigado!";

  return applyRevendaVariables(template, {
    cliente_nome: friendlyGreetingName(rec.customer_name, rec.customer_whatsapp),
    vencimento,
    telas_linha: telasLinha,
    telas: String(rec.screens.length),
  });

}

export function applyRenewal(draft: RenewalDraft): RenewalRecord {
  const all = listScreens(draft.customer_id);
  const byId = new Map(all.map((s) => [s.id, s]));
  const now = new Date().toISOString();
  const screensLog: RenewalScreenLog[] = [];

  for (const ds of draft.screens) {
    const s = byId.get(ds.screen_id);
    if (!s) continue;
    const updated: AppScreen = {
      ...s,
      due_date: draft.new_due_date || s.due_date,
      app_due_date:
        draft.renew_app && draft.new_app_due_date
          ? draft.new_app_due_date
          : s.app_due_date,
      status: "ativa",
      updated_at: now,
    };
    upsertScreen(updated);
    screensLog.push({
      screen_id: s.id,
      screen_name: s.name,
      app_label: APP_CATALOG[s.app]?.label ?? s.app,
      old_due_date: s.due_date,
      new_due_date: updated.due_date,
      app_renewed: !!(draft.renew_app && draft.new_app_due_date),
      old_app_due_date: s.app_due_date,
      new_app_due_date:
        draft.renew_app && draft.new_app_due_date
          ? draft.new_app_due_date
          : undefined,
      servers: ds.servers,
    });
  }

  const rec: RenewalRecord = {
    id: newRenewalId(),
    company_id: getActiveCompanyId() ?? null,
    created_at: now,
    customer_id: draft.customer_id,
    customer_name: draft.customer_name,
    customer_whatsapp: draft.customer_whatsapp ?? null,

    screens: screensLog,
    amount: draft.amount,
    payment_method: draft.payment_method,
    app_amount: draft.app_amount,
    notes: draft.notes,
    next_due_date: draft.new_due_date || undefined,
    confirmation_message: "",
  };
  rec.confirmation_message = buildConfirmationMessage(rec);

  const store = readAll();
  const list = store[draft.customer_id] ?? [];
  list.push(rec);
  store[draft.customer_id] = list;
  writeAll(store);

  // Write-through best-effort para o banco. Falhas são silenciosas — o banner
  // de migração ou o próximo sync vão re-tentar.
  const companyId = getActiveCompanyId();
  if (companyId && /^[0-9a-f-]{36}$/i.test(draft.customer_id)) {
    const amountNum = draft.amount ? Number(String(draft.amount).replace(",", ".")) : NaN;
    void import("@/lib/manual-renewals/manual-renewals.functions").then(({ createManualRenewalDb }) =>
      createManualRenewalDb({
        data: {
          companyId,
          customerId: draft.customer_id,
          new_due_date: draft.new_due_date,
          old_due_date: screensLog[0]?.old_due_date ?? null,
          amount_cents: Number.isFinite(amountNum) ? Math.round(amountNum * 100) : null,
          payment_method: draft.payment_method ?? null,
          note: draft.notes ?? null,
          payload: {
            customer_name: rec.customer_name,
            customer_whatsapp: rec.customer_whatsapp,
            screens: rec.screens,
            app_amount: rec.app_amount,
            amount: rec.amount,
            confirmation_message: rec.confirmation_message,
            notes: rec.notes,
          },
        },
      }).catch(() => {}),
    );
  }

  return rec;
}

export function formatRenewalSummary(rec: RenewalRecord): string {
  const lines: string[] = [];
  lines.push(`Renovação — ${rec.customer_name}`);
  lines.push(`Data: ${new Date(rec.created_at).toLocaleString("pt-BR")}`);
  if (rec.amount) lines.push(`Valor: ${rec.amount}`);
  if (rec.payment_method) lines.push(`Pagamento: ${PAYMENT_LABEL[rec.payment_method]}`);
  lines.push("");
  for (const s of rec.screens) {
    lines.push(`• ${s.screen_name} — ${fmtDateBR(s.old_due_date)} → ${fmtDateBR(s.new_due_date)}`);
    if (s.app_renewed) lines.push(`  App ${s.app_label} até ${fmtDateBR(s.new_app_due_date)}`);
    const ren = s.servers.filter((x) => x.status === "renovado").map((x) => x.server_name);
    const pul = s.servers.filter((x) => x.status === "pulado").map((x) => x.server_name);
    if (ren.length) lines.push(`  Servidores renovados: ${ren.join(", ")}`);
    if (pul.length) lines.push(`  Servidores pulados: ${pul.join(", ")}`);
  }
  if (rec.notes) {
    lines.push("");
    lines.push(`Obs: ${rec.notes}`);
  }
  return lines.join("\n");
}

export function exportCustomerRenewals(customerId: string, customerName: string): string {
  const recs = listRenewals(customerId);
  return JSON.stringify(
    {
      type: "cobranca-ia/manual-renewals",
      version: 1,
      generated_at: new Date().toISOString(),
      customer_id: customerId,
      customer_name: customerName,
      renewals: recs,
    },
    null,
    2,
  );
}

// Helper para enriquecer servidores de uma tela
export function listScreenServers(screen: AppScreen): { id: string; name: string; color: string }[] {
  const ids = screen.server_ids ?? [];
  return ids
    .map((id) => {
      const s = getServerById(id);
      return s ? { id: s.id, name: s.name, color: s.color } : null;
    })
    .filter((s): s is { id: string; name: string; color: string } => !!s);
}

// ============================================================
// Sincronização com o banco (manual_renewals)
// ============================================================

import {
  bulkUpsertManualRenewalsDb,
  type ManualRenewalDto,
} from "@/lib/manual-renewals/manual-renewals.functions";

export const MANUAL_RENEWALS_SYNC_EVENT = "cobranca_ia_manual_renewals:sync";

type RenewalsSyncState = { loaded: boolean; lastError: string | null; pendingLocal: number };
const renewalsSyncState: RenewalsSyncState = { loaded: false, lastError: null, pendingLocal: 0 };

function emitRenewalsSync() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(MANUAL_RENEWALS_SYNC_EVENT, { detail: { ...renewalsSyncState } }),
  );
}

export function getManualRenewalsSyncState(): RenewalsSyncState {
  return { ...renewalsSyncState };
}

export function markManualRenewalsSyncError(message: string) {
  renewalsSyncState.lastError = message;
  emitRenewalsSync();
}

function isUuid(v: string | null | undefined): v is string {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/**
 * Hidrata o cache local com a lista vinda do banco para a empresa ativa.
 * Se o banco está vazio mas há histórico local da empresa → preserva cache
 * e marca pendência para o banner de migração.
 */
export function hydrateManualRenewalsFromDb(companyId: string, rows: ManualRenewalDto[]): void {
  if (typeof window === "undefined") return;
  if (!isUuid(companyId)) return;

  const all = readAll();
  let localCount = 0;
  for (const list of Object.values(all)) {
    for (const r of list) if ((r.company_id ?? null) === companyId) localCount++;
  }

  if (rows.length === 0 && localCount > 0) {
    renewalsSyncState.loaded = true;
    renewalsSyncState.lastError = null;
    renewalsSyncState.pendingLocal = localCount;
    emitRenewalsSync();
    return;
  }

  // Mantém renovações de outras empresas; substitui só as desta empresa.
  const next: Record<string, RenewalRecord[]> = {};
  for (const [cid, list] of Object.entries(all)) {
    const others = list.filter((r) => (r.company_id ?? null) !== companyId);
    if (others.length > 0) next[cid] = others;
  }
  for (const r of rows) {
    const payload = (() => {
      try {
        return JSON.parse(r.payload ?? "{}");
      } catch {
        return {};
      }
    })();
    const rec: RenewalRecord = {
      id: r.id,
      company_id: r.company_id,
      created_at: r.created_at,
      customer_id: r.customer_id,
      customer_name: (payload.customer_name as string) ?? "",
      customer_whatsapp: (payload.customer_whatsapp as string | null) ?? null,
      screens: Array.isArray(payload.screens) ? (payload.screens as RenewalScreenLog[]) : [],
      amount:
        r.amount_cents != null
          ? (r.amount_cents / 100).toFixed(2)
          : ((payload.amount as string) ?? undefined),
      payment_method: (r.payment_method as PaymentMethod | null) ?? undefined,
      app_amount: (payload.app_amount as string | undefined) ?? undefined,
      notes: (r.note ?? (payload.notes as string | undefined)) ?? undefined,
      next_due_date: r.new_due_date,
      confirmation_message: (payload.confirmation_message as string) ?? "",
    };
    const arr = next[r.customer_id] ?? [];
    arr.push(rec);
    next[r.customer_id] = arr;
  }
  writeAll(next);
  renewalsSyncState.loaded = true;
  renewalsSyncState.lastError = null;
  renewalsSyncState.pendingLocal = 0;
  emitRenewalsSync();
}

/**
 * Envia para o banco todas as renovações locais desta empresa que ainda não
 * estão lá. Usa o próprio id local (uuid-like ou prefixado) — quando o id não
 * é um UUID, o backend gera um novo.
 */
export async function uploadLocalManualRenewalsToDb(): Promise<{ inserted: number; updated: number }> {
  const companyId = getActiveCompanyId();
  if (!companyId) return { inserted: 0, updated: 0 };
  const all = readAll();
  const renewals: Array<{
    id?: string;
    customerId: string;
    new_due_date: string;
    old_due_date?: string | null;
    amount_cents?: number | null;
    payment_method?: string | null;
    note?: string | null;
    payload: Record<string, unknown>;
  }> = [];
  for (const list of Object.values(all)) {
    for (const r of list) {
      if ((r.company_id ?? null) !== companyId) continue;
      if (!isUuid(r.customer_id)) continue;
      const new_due_date = r.next_due_date || r.screens[0]?.new_due_date;
      if (!new_due_date) continue;
      const amountNum = r.amount ? Number(String(r.amount).replace(",", ".")) : NaN;
      renewals.push({
        id: isUuid(r.id) ? r.id : undefined,
        customerId: r.customer_id,
        new_due_date,
        old_due_date: r.screens[0]?.old_due_date ?? null,
        amount_cents: Number.isFinite(amountNum) ? Math.round(amountNum * 100) : null,
        payment_method: r.payment_method ?? null,
        note: r.notes ?? null,
        payload: {
          customer_name: r.customer_name,
          customer_whatsapp: r.customer_whatsapp,
          screens: r.screens,
          app_amount: r.app_amount,
          amount: r.amount,
          confirmation_message: r.confirmation_message,
          notes: r.notes,
        },
      });
    }
  }
  if (renewals.length === 0) return { inserted: 0, updated: 0 };
  const res = await bulkUpsertManualRenewalsDb({ data: { companyId, renewals } });
  return res;
}

