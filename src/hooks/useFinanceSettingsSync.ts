// DB-first sync para finance_settings.
// - Banco é a fonte oficial. localStorage é apenas cache para UX.
// - Hidrata banco → cache no mount/focus/troca de empresa.
// - Espelha cache → banco em writes (debounced) via FINANCE_EVENT.
// - Se banco vazio e localStorage com dados da empresa atual: faz upload UMA vez.
import { useCallback } from "react";
import { useDbFirstSync } from "@/hooks/useDbFirstSync";
import {
  getFinanceSettingsDb,
  upsertFinanceSettingsDb,
} from "@/lib/finance-settings/finance-settings.functions";
import { FINANCE_EVENT, type FinanceSettings } from "@/lib/financeiro-local";

const SETTINGS_KEY = "cobranca_ia_finance_settings_v1";
const UPLOADED_FLAG = "cobraeasy.finance_settings.synced";

function isBrowser() { return typeof window !== "undefined"; }
function readLocal(): FinanceSettings | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? (JSON.parse(raw) as FinanceSettings) : null;
  } catch { return null; }
}
function writeLocal(s: FinanceSettings) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    window.dispatchEvent(new CustomEvent(FINANCE_EVENT));
  } catch { /* noop */ }
}

export function useFinanceSettingsSync() {
  const hydrate = useCallback(async (companyId: string) => {
    try {
      const row = await getFinanceSettingsDb({ data: { companyId } });
      if (row && row.settings && typeof row.settings === "object") {
        // banco vence sobre cache antigo
        writeLocal(row.settings as unknown as FinanceSettings);
      }
      // Se row é null, NÃO apagamos o cache local — uploadLegacy cuidará de
      // promover o cache para o banco caso seja da empresa atual.
    } catch { /* noop */ }
  }, []);

  const mirror = useCallback(async (companyId: string) => {
    const local = readLocal();
    if (!local) return;
    try {
      await upsertFinanceSettingsDb({
        data: { companyId, settings: local as unknown as Record<string, unknown> as never },
      });
    } catch { /* noop */ }
  }, []);

  const uploadLegacy = useCallback(async (companyId: string) => {
    if (!isBrowser()) return;
    const flag = UPLOADED_FLAG + ":" + companyId;
    if (localStorage.getItem(flag) === "1") return;
    const local = readLocal();
    if (!local) { localStorage.setItem(flag, "1"); return; }
    // Só sobe se banco estiver vazio — banco vence sobre cache antigo.
    try {
      const existing = await getFinanceSettingsDb({ data: { companyId } });
      if (!existing) {
        await upsertFinanceSettingsDb({
          data: { companyId, settings: local as unknown as Record<string, unknown> as never },
        });
      }
      localStorage.setItem(flag, "1");
    } catch { /* noop — retentará no próximo ciclo */ }
  }, []);

  useDbFirstSync({
    table: "finance_settings",
    hydrate,
    uploadLegacy,
    mirror,
    mirrorEvents: [FINANCE_EVENT],
  });
}
