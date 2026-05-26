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
  screens: RenewalScreenLog[];
  amount?: string;
  payment_method?: PaymentMethod;
  app_amount?: string;
  notes?: string;
  confirmation_message: string;
};

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

  const settings = getRevendaSettings();
  const template =
    settings.mensagens?.renovacao_confirmada?.trim() ||
    "Olá {cliente_nome}, tudo certo ✅\n\nSua renovação foi registrada.\n📅 Novo vencimento: {vencimento}{telas_linha}\n\nObrigado!";

  return applyRevendaVariables(template, {
    cliente_nome: rec.customer_name,
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
    screens: screensLog,
    amount: draft.amount,
    payment_method: draft.payment_method,
    app_amount: draft.app_amount,
    notes: draft.notes,
    confirmation_message: "",
  };
  rec.confirmation_message = buildConfirmationMessage(rec);

  const store = readAll();
  const list = store[draft.customer_id] ?? [];
  list.push(rec);
  store[draft.customer_id] = list;
  writeAll(store);

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
