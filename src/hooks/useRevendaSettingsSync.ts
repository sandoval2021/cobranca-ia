// Sync DB-first para revenda_settings (singleton por empresa).
import { useCallback } from "react";
import { useDbFirstSync } from "@/hooks/useDbFirstSync";
import {
  getRevendaSettingsDb,
  saveRevendaSettingsDb,
} from "@/lib/revenda-settings.functions";
import {
  REVENDA_SETTINGS_KEY,
  REVENDA_SETTINGS_EVENT,
  DEFAULT_REVENDA_SETTINGS,
  type RevendaSettings,
} from "@/lib/revenda-settings";

const UPLOADED_FLAG = "cobraeasy.revenda_settings.synced";

function readLocal(): RevendaSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(REVENDA_SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RevendaSettings;
  } catch { return null; }
}

function writeLocal(s: RevendaSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(REVENDA_SETTINGS_KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent(REVENDA_SETTINGS_EVENT));
}

function isMeaningful(s: RevendaSettings | null): boolean {
  if (!s) return false;
  const d = s.dados;
  return Boolean(
    d?.nome_revenda?.trim() ||
    d?.responsavel?.trim() ||
    d?.whatsapp_suporte?.trim() ||
    s.pagamento?.pix?.trim(),
  );
}

export function useRevendaSettingsSync() {
  const hydrate = useCallback(async (companyId: string) => {
    const row = await getRevendaSettingsDb({ data: { companyId } });
    if (!row) return;
    try {
      const parsed = JSON.parse(row.dataJson) as Partial<RevendaSettings>;
      // mantém defaults para chaves ausentes
      const merged = { ...DEFAULT_REVENDA_SETTINGS, ...parsed } as RevendaSettings;
      writeLocal(merged);
    } catch { /* mantém cache */ }
  }, []);

  const uploadLegacy = useCallback(async (companyId: string) => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(UPLOADED_FLAG + ":" + companyId) === "1") return;
    const local = readLocal();
    if (!isMeaningful(local)) {
      localStorage.setItem(UPLOADED_FLAG + ":" + companyId, "1");
      return;
    }
    await saveRevendaSettingsDb({
      data: { companyId, dataJson: JSON.stringify(local) },
    });
    localStorage.setItem(UPLOADED_FLAG + ":" + companyId, "1");
  }, []);

  useDbFirstSync({ table: "revenda_settings", hydrate, uploadLegacy });
}
