// Sync DB-first para auto_templates. Mapeia local.id <-> DB.template_id.
import { useCallback } from "react";
import { useDbFirstSync } from "@/hooks/useDbFirstSync";
import {
  listAutoTemplatesDb,
  bulkUpsertAutoTemplatesDb,
} from "@/lib/auto-templates.functions";
import type { AutoTemplate } from "@/lib/auto-templates";

const STORAGE_KEY = "cobraeasy.auto-templates.v1";
const EVENT = "cobraeasy:auto-templates-changed";
const UPLOADED_FLAG = "cobraeasy.auto-templates.synced";

function readLocal(): AutoTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeLocal(items: AutoTemplate[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVENT));
}

function dtoToLocal(d: {
  template_id: string; categoria: string; ativo: boolean;
  body: string | null; channelsJson: string; timeWindowJson: string; extraJson: string;
}): AutoTemplate {
  let channels: AutoTemplate["channels"] = { whatsapp: true, email: false, ia: false };
  try { const c = JSON.parse(d.channelsJson); if (c && typeof c === "object") channels = { ...channels, ...c }; } catch {}
  let win: { sendStart?: string; sendEnd?: string } = {};
  try { const w = JSON.parse(d.timeWindowJson); if (w && typeof w === "object") win = w; } catch {}
  let extra: Record<string, unknown> = {};
  try { const e = JSON.parse(d.extraJson); if (e && typeof e === "object") extra = e as Record<string, unknown>; } catch {}
  return {
    id: d.template_id,
    key: (extra.key as string) ?? d.template_id.replace(/^default-/, ""),
    name: (extra.name as string) ?? d.template_id,
    description: extra.description as string | undefined,
    category: d.categoria as AutoTemplate["category"],
    offsetHours: extra.offsetHours as number | undefined,
    scope: extra.scope as string | undefined,
    channels,
    active: Boolean(d.ativo),
    sendStart: win.sendStart,
    sendEnd: win.sendEnd,
    body: d.body ?? "",
    isDefault: extra.isDefault as boolean | undefined,
  };
}

function localToDb(t: AutoTemplate) {
  const extra = {
    key: t.key,
    name: t.name,
    description: t.description,
    offsetHours: t.offsetHours,
    scope: t.scope,
    isDefault: t.isDefault,
  };
  return {
    template_id: t.id,
    categoria: t.category,
    ativo: t.active,
    body: t.body ?? null,
    channelsJson: JSON.stringify(t.channels),
    timeWindowJson: JSON.stringify({ sendStart: t.sendStart, sendEnd: t.sendEnd }),
    extraJson: JSON.stringify(extra),
  };
}

export function useAutoTemplatesSync() {
  const hydrate = useCallback(async (companyId: string) => {
    const rows = await listAutoTemplatesDb({ data: { companyId } });
    if (!rows || rows.length === 0) return; // preserva cache local se DB vier vazio
    writeLocal(rows.map(dtoToLocal));
  }, []);

  const uploadLegacy = useCallback(async (companyId: string) => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(UPLOADED_FLAG + ":" + companyId) === "1") return;
    const local = readLocal();
    if (local.length === 0) {
      localStorage.setItem(UPLOADED_FLAG + ":" + companyId, "1");
      return;
    }
    await bulkUpsertAutoTemplatesDb({
      data: { companyId, items: local.map(localToDb) },
    });
    localStorage.setItem(UPLOADED_FLAG + ":" + companyId, "1");
  }, []);

  useDbFirstSync({ table: "auto_templates", hydrate, uploadLegacy });
}
