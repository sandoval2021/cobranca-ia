// Assistente de Configuração Inicial — 100% local (localStorage). Sem API, sem Supabase.

import { getRevendaSettings } from "./revenda-settings";
import { getLocalSecuritySettings, isProtectedModeActive } from "./local-security";
import { listServers } from "./server-catalog";
import { listDomains, listDnsRoutes } from "./dns-routes";
import { listFinanceEntries, listFinanceGoals, getFinanceSettings } from "./financeiro-local";
import { listAllScreens } from "./app-screens";
import { listTrialLeads } from "./trial-leads";
import { getDiagnosticsSummary } from "./system-diagnostics";

export const SETUP_WIZARD_KEY = "cobranca_ia_setup_wizard_v1";
export const SETUP_WIZARD_EVENT = "cobranca_ia_setup_wizard:changed";
const LAST_BACKUP_KEY = "cobranca_ia_last_backup_at_v1";

export type SetupStepId =
  | "revenda"
  | "seguranca"
  | "backup"
  | "apps"
  | "servidores"
  | "dns"
  | "regras"
  | "financeiro"
  | "base_ia"
  | "clientes"
  | "testes"
  | "diagnostico"
  | "preparacao_backend";

export type SetupStepState = {
  step_id: SetupStepId;
  completed: boolean;
  skipped: boolean;
  completed_at?: string;
  skipped_at?: string;
  notes?: string;
};

export type SetupWizardData = {
  steps: Record<string, SetupStepState>;
  updated_at?: string;
};

export type SetupStep = {
  id: SetupStepId;
  title: string;
  description: string;
  link: string;
  detectLabel: string;
  detect: () => boolean;
};

const APPS_CATALOG_ROUTE = "/clientes"; // /catalogo-apps não existe — fallback /clientes

export const SETUP_STEPS: SetupStep[] = [
  {
    id: "revenda",
    title: "Configurar Minha Revenda",
    description:
      "Cadastre nome da revenda, WhatsApp, Pix, horários, planos e regras.",
    link: "/configuracoes-revenda",
    detectLabel: "Dados básicos da revenda preenchidos",
    detect: () => {
      const r = getRevendaSettings();
      return !!(r.dados.nome_revenda?.trim() || r.dados.whatsapp_suporte?.trim());
    },
  },
  {
    id: "seguranca",
    title: "Ativar Segurança Local",
    description:
      "Configure PIN e modo protegido para proteger senhas, keys e financeiro.",
    link: "/seguranca-local",
    detectLabel: "PIN ativo ou modo protegido habilitado",
    detect: () => {
      const s = getLocalSecuritySettings();
      return (s.enabled && !!s.pin_hash) || isProtectedModeActive();
    },
  },
  {
    id: "backup",
    title: "Fazer Backup Geral",
    description:
      "Exporte um backup completo antes de cadastrar muitos dados.",
    link: "/backup-geral",
    detectLabel: "Último backup registrado neste navegador",
    detect: () => {
      try {
        return !!window.localStorage.getItem(LAST_BACKUP_KEY);
      } catch {
        return false;
      }
    },
  },
  {
    id: "apps",
    title: "Configurar Apps",
    description:
      "Revise apps pagos/grátis, MAC/Key, vencimento do app e instruções.",
    link: APPS_CATALOG_ROUTE,
    detectLabel: "Telas/Apps cadastrados",
    detect: () => {
      const all = listAllScreens();
      return Object.values(all).some(
        (list) => Array.isArray(list) && list.length > 0,
      );
    },
  },
  {
    id: "servidores",
    title: "Configurar Servidores",
    description:
      "Cadastre servidores, painéis, usuário e senha protegidos.",
    link: "/catalogo-servidores",
    detectLabel: "Pelo menos 1 servidor ativo",
    detect: () => listServers().some((s) => s.status === "ativo"),
  },
  {
    id: "dns",
    title: "Configurar DNS e Rotas",
    description:
      "Cadastre domínios, subdomínios e rotas principais por servidor.",
    link: "/admin-dns-rotas",
    detectLabel: "Pelo menos 1 domínio e 1 rota cadastrados",
    detect: () => listDomains().length > 0 && listDnsRoutes().length > 0,
  },
  {
    id: "regras",
    title: "Configurar Regras de Disparo",
    description:
      "Defina quando sugerir mensagens: D-7, D-3, D0, D+7, recuperação e retorno.",
    link: "/regras-disparo",
    detectLabel: "Marcação manual (regras revisadas)",
    detect: () => false,
  },
  {
    id: "financeiro",
    title: "Configurar Financeiro",
    description:
      "Defina custos, objetivos, reserva e simulação de lucro.",
    link: "/financeiro",
    detectLabel: "Lançamentos ou objetivos cadastrados",
    detect: () => {
      try {
        if (listFinanceEntries().length > 0) return true;
        if (listFinanceGoals().length > 0) return true;
        const s = getFinanceSettings();
        return !!(s && (s as any).updated_at);
      } catch {
        return false;
      }
    },
  },
  {
    id: "base_ia",
    title: "Configurar Base da IA",
    description:
      "Organize respostas, regras de atendimento e triagem futura.",
    link: "/base-conhecimento",
    detectLabel: "Marcação manual (base revisada)",
    detect: () => false,
  },
  {
    id: "clientes",
    title: "Importar ou cadastrar clientes",
    description:
      "Cadastre clientes ou importe uma lista para gerar agenda manual.",
    link: "/importar-clientes",
    detectLabel: "Clientes/telas cadastrados",
    detect: () => {
      const all = listAllScreens();
      return Object.keys(all).length > 0;
    },
  },
  {
    id: "testes",
    title: "Criar teste/leads",
    description:
      "Cadastre pessoas que pediram teste e acompanhe até fechar.",
    link: "/testes",
    detectLabel: "Pelo menos 1 lead/teste cadastrado",
    detect: () => listTrialLeads().length > 0,
  },
  {
    id: "diagnostico",
    title: "Rodar Diagnóstico",
    description:
      "Verifique saúde dos dados, segurança, DNS, financeiro e operação.",
    link: "/diagnostico",
    detectLabel: "Diagnóstico sem alertas críticos",
    detect: () => {
      try {
        const d = getDiagnosticsSummary();
        return d.modulos > 0 && d.critico === 0;
      } catch {
        return false;
      }
    },
  },
  {
    id: "preparacao_backend",
    title: "Revisar Preparação Backend",
    description:
      "Veja o mapa para futura migração segura para Supabase/backend.",
    link: "/preparacao-backend",
    detectLabel: "Marcação manual (mapa revisado)",
    detect: () => false,
  },
];

function readData(): SetupWizardData {
  if (typeof window === "undefined") return { steps: {} };
  try {
    const raw = window.localStorage.getItem(SETUP_WIZARD_KEY);
    if (!raw) return { steps: {} };
    const parsed = JSON.parse(raw);
    return { steps: parsed?.steps ?? {}, updated_at: parsed?.updated_at };
  } catch {
    return { steps: {} };
  }
}

function writeData(data: SetupWizardData) {
  if (typeof window === "undefined") return;
  const toSave: SetupWizardData = { ...data, updated_at: new Date().toISOString() };
  try {
    window.localStorage.setItem(SETUP_WIZARD_KEY, JSON.stringify(toSave));
    window.dispatchEvent(new Event(SETUP_WIZARD_EVENT));
  } catch {
    /* noop */
  }
}

function getStepState(data: SetupWizardData, id: SetupStepId): SetupStepState {
  return (
    data.steps[id] ?? {
      step_id: id,
      completed: false,
      skipped: false,
    }
  );
}

export type SetupStepProgress = {
  step: SetupStep;
  state: SetupStepState;
  detected: boolean;
  status: "concluido" | "pulado" | "pendente";
};

export type SetupProgress = {
  steps: SetupStepProgress[];
  total: number;
  completed: number;
  skipped: number;
  pending: number;
  percent: number;
  updated_at?: string;
};

export function getSetupProgress(): SetupProgress {
  const data = readData();
  const steps: SetupStepProgress[] = SETUP_STEPS.map((step) => {
    const state = getStepState(data, step.id);
    let detected = false;
    try {
      detected = step.detect();
    } catch {
      detected = false;
    }
    const concluded = state.completed || detected;
    const status: SetupStepProgress["status"] = concluded
      ? "concluido"
      : state.skipped
        ? "pulado"
        : "pendente";
    return { step, state, detected, status };
  });
  const total = steps.length;
  const completed = steps.filter((s) => s.status === "concluido").length;
  const skipped = steps.filter((s) => s.status === "pulado").length;
  const pending = steps.filter((s) => s.status === "pendente").length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { steps, total, completed, skipped, pending, percent, updated_at: data.updated_at };
}

export function markSetupStepDone(stepId: SetupStepId, notes?: string) {
  const data = readData();
  const prev = getStepState(data, stepId);
  data.steps[stepId] = {
    ...prev,
    step_id: stepId,
    completed: true,
    skipped: false,
    completed_at: new Date().toISOString(),
    notes: notes ?? prev.notes,
  };
  writeData(data);
}

export function markSetupStepSkipped(stepId: SetupStepId, notes?: string) {
  const data = readData();
  const prev = getStepState(data, stepId);
  data.steps[stepId] = {
    ...prev,
    step_id: stepId,
    completed: false,
    skipped: true,
    skipped_at: new Date().toISOString(),
    notes: notes ?? prev.notes,
  };
  writeData(data);
}

export function clearSetupStep(stepId: SetupStepId) {
  const data = readData();
  delete data.steps[stepId];
  writeData(data);
}

export function setSetupStepNote(stepId: SetupStepId, notes: string) {
  const data = readData();
  const prev = getStepState(data, stepId);
  data.steps[stepId] = { ...prev, step_id: stepId, notes };
  writeData(data);
}

export function resetSetupProgress() {
  writeData({ steps: {} });
}

export type SetupRecommendation = {
  step_id: SetupStepId;
  message: string;
};

export function getSetupRecommendations(): SetupRecommendation[] {
  const progress = getSetupProgress();
  const recs: SetupRecommendation[] = [];
  const byId = new Map(progress.steps.map((s) => [s.step.id, s]));
  const pending = (id: SetupStepId) => byId.get(id)?.status === "pendente";

  if (pending("revenda"))
    recs.push({ step_id: "revenda", message: "Comece cadastrando os dados da sua revenda." });
  if (pending("seguranca"))
    recs.push({ step_id: "seguranca", message: "Proteja senhas e financeiro com PIN." });
  if (pending("backup"))
    recs.push({ step_id: "backup", message: "Faça um backup geral antes de continuar." });
  if (pending("servidores"))
    recs.push({ step_id: "servidores", message: "Cadastre servidores antes de vincular telas." });
  if (pending("dns"))
    recs.push({
      step_id: "dns",
      message: "Configure rotas públicas para evitar trocar link cliente por cliente.",
    });
  if (pending("financeiro"))
    recs.push({
      step_id: "financeiro",
      message: "Configure custos e objetivos para saber o lucro real.",
    });
  try {
    const d = getDiagnosticsSummary();
    if (d.critico > 0) {
      recs.push({
        step_id: "diagnostico",
        message: "Revise os alertas críticos antes de avançar.",
      });
    }
  } catch {
    /* noop */
  }

  return recs;
}

export function getNextRecommendation(): SetupRecommendation | null {
  return getSetupRecommendations()[0] ?? null;
}

export function exportSetupChecklist(): string {
  const progress = getSetupProgress();
  const recs = getSetupRecommendations();
  const date = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const lines: string[] = [];
  lines.push("Cobrança IA — Checklist de Configuração Inicial");
  lines.push(`Gerado em: ${date.toLocaleString("pt-BR")}`);
  lines.push("");
  lines.push(
    `Progresso: ${progress.percent}% (${progress.completed}/${progress.total} concluídos, ${progress.skipped} pulado(s), ${progress.pending} pendente(s))`,
  );
  lines.push("");

  const done = progress.steps.filter((s) => s.status === "concluido");
  const skipped = progress.steps.filter((s) => s.status === "pulado");
  const pending = progress.steps.filter((s) => s.status === "pendente");

  lines.push("CONCLUÍDOS");
  if (done.length === 0) lines.push("- (nenhum)");
  for (const s of done) {
    const when = s.state.completed_at
      ? new Date(s.state.completed_at).toLocaleString("pt-BR")
      : s.detected
        ? "detectado automaticamente"
        : "manual";
    lines.push(`- ${s.step.title} (${when})`);
    if (s.state.notes) lines.push(`  Obs: ${s.state.notes}`);
  }

  lines.push("");
  lines.push("PENDENTES");
  if (pending.length === 0) lines.push("- (nenhum)");
  for (const s of pending) {
    lines.push(`- ${s.step.title} — ${s.step.link}`);
    if (s.state.notes) lines.push(`  Obs: ${s.state.notes}`);
  }

  lines.push("");
  lines.push("PULADOS");
  if (skipped.length === 0) lines.push("- (nenhum)");
  for (const s of skipped) {
    const when = s.state.skipped_at
      ? new Date(s.state.skipped_at).toLocaleString("pt-BR")
      : "";
    lines.push(`- ${s.step.title}${when ? ` (${when})` : ""}`);
    if (s.state.notes) lines.push(`  Obs: ${s.state.notes}`);
  }

  lines.push("");
  lines.push("RECOMENDAÇÕES");
  if (recs.length === 0) lines.push("- Nenhuma recomendação no momento.");
  for (const r of recs) lines.push(`- ${r.message}`);

  const txt = lines.join("\n");
  if (typeof window !== "undefined") {
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `checklist-configuracao-cobranca-ia-${ymd}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return txt;
}
