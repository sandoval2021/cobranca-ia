// Backend Readiness — 100% local/planejamento.
// Nenhum backend é criado, nenhuma chamada externa, nenhum dado é enviado.
// Apenas mapeia o que existe em localStorage e sugere entidades futuras.

import { BACKUP_MODULES } from "./backup-geral";

export type Priority = "critica" | "alta" | "media" | "baixa";
export type EntityStatus =
  | "local_apenas"
  | "pronto_para_modelar"
  | "precisa_revisar"
  | "futuro_backend";

export type LocalModuleMap = {
  key: string; // chave localStorage
  label: string; // nome amigável do módulo
  futureEntity: string; // entidade futura sugerida
  priority: Priority;
  risk: string;
  dependencies: string[];
  notes?: string;
};

export type FutureEntity = {
  name: string;
  description: string;
  origin: string; // origem local (chave ou módulo)
  mainFields: string[];
  status: EntityStatus;
  priority: Priority;
};

export type MigrationStep = {
  order: number;
  title: string;
  why: string;
  riskIfSkipped: string;
  dependencies: string[];
};

export type ChecklistItem = { id: string; label: string };

export type LocalModuleSummary = LocalModuleMap & {
  present: boolean;
  count: number;
};

export type ReadinessReport = {
  generated_at: string;
  modules: LocalModuleSummary[];
  entities: FutureEntity[];
  migrationOrder: MigrationStep[];
  risks: { title: string; description: string }[];
  blockers: { title: string; description: string }[];
  checklist: ChecklistItem[];
  totals: {
    modulosEncontrados: number;
    registrosEstimados: number;
    entidades: number;
    criticas: number;
    altas: number;
    riscosPerda: number;
    prontas: number;
    naoProntas: number;
  };
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const STATUS_LABEL: Record<EntityStatus, string> = {
  local_apenas: "Local apenas",
  pronto_para_modelar: "Pronto para modelar",
  precisa_revisar: "Precisa revisar",
  futuro_backend: "Futuro/backend",
};

// ---------- Mapeamento de módulos locais ----------
export const LOCAL_MODULE_MAP: LocalModuleMap[] = [
  {
    key: "cobranca_ia_app_screens_v1",
    label: "Telas e aplicativos",
    futureEntity: "customer_screens",
    priority: "critica",
    risk: "Dados de cliente/tela podem ser perdidos ao limpar navegador.",
    dependencies: ["customers", "app_catalog", "server_catalog"],
  },
  {
    key: "cobranca_ia_server_catalog_v1",
    label: "Catálogo de servidores",
    futureEntity: "server_catalog",
    priority: "critica",
    risk: "Perda do catálogo quebra vínculo de telas e rotas.",
    dependencies: [],
  },
  {
    key: "cobranca_ia_dns_domains_v1",
    label: "DNS — Domínios",
    futureEntity: "dns_domains",
    priority: "alta",
    risk: "Sem domínios não é possível resolver rotas públicas.",
    dependencies: [],
  },
  {
    key: "cobranca_ia_dns_routes_v1",
    label: "DNS — Rotas",
    futureEntity: "dns_routes",
    priority: "alta",
    risk: "Perda de rotas quebra links públicos enviados aos clientes.",
    dependencies: ["dns_domains", "server_catalog"],
  },
  {
    key: "cobranca_ia_dns_route_history_v1",
    label: "DNS — Histórico",
    futureEntity: "dns_route_history",
    priority: "media",
    risk: "Sem histórico de mudanças de rota.",
    dependencies: ["dns_routes"],
  },
  {
    key: "cobranca_ia_manual_renewal_history_v1",
    label: "Histórico de renovações",
    futureEntity: "manual_renewals",
    priority: "alta",
    risk: "Sem histórico de renovações dificulta auditoria de cobranças.",
    dependencies: ["customers", "customer_screens"],
  },
  {
    key: "cobranca_ia_trial_leads_v1",
    label: "Testes/leads",
    futureEntity: "trial_leads",
    priority: "alta",
    risk: "Perda de leads em teste.",
    dependencies: [],
  },
  {
    key: "cobranca_ia_trial_followups_v1",
    label: "Follow-ups de testes",
    futureEntity: "trial_followups",
    priority: "media",
    risk: "Sem follow-ups dos testes.",
    dependencies: ["trial_leads"],
  },
  {
    key: "cobranca_ia_referrals_v1",
    label: "Indicações",
    futureEntity: "referrals",
    priority: "alta",
    risk: "Perda de indicações e bonificações.",
    dependencies: ["customers"],
  },
  {
    key: "cobranca_ia_referral_rules_v1",
    label: "Regras de indicação",
    futureEntity: "referral_rules",
    priority: "media",
    risk: "Sem regras de bonificação.",
    dependencies: [],
  },
  {
    key: "cobranca_ia_finance_entries_v1",
    label: "Entradas financeiras",
    futureEntity: "finance_entries",
    priority: "critica",
    risk: "Perda total do financeiro.",
    dependencies: [],
  },
  {
    key: "cobranca_ia_finance_goals_v1",
    label: "Objetivos financeiros",
    futureEntity: "finance_goals",
    priority: "alta",
    risk: "Perda de metas e objetivos.",
    dependencies: [],
  },
  {
    key: "cobranca_ia_finance_settings_v1",
    label: "Configurações financeiras",
    futureEntity: "finance_settings",
    priority: "media",
    risk: "Sem regras de cálculo financeiro padrão.",
    dependencies: [],
  },
  {
    key: "cobranca_ia_finance_draft_v1",
    label: "Rascunho financeiro",
    futureEntity: "finance_drafts",
    priority: "baixa",
    risk: "Perda de rascunhos não confirmados.",
    dependencies: ["finance_entries"],
  },
  {
    key: "cobranca_ia_import_schedule_items_v1",
    label: "Agenda da importação",
    futureEntity: "import_schedule_items",
    priority: "alta",
    risk: "Perda da agenda planejada para disparos.",
    dependencies: ["customers"],
  },
  {
    key: "cobranca_ia_import_schedule_status_v1",
    label: "Status da agenda",
    futureEntity: "import_schedule_status",
    priority: "media",
    risk: "Sem status dos itens agendados.",
    dependencies: ["import_schedule_items"],
  },
  {
    key: "cobranca_ia_manual_dispatch_rules_v1",
    label: "Regras de disparo",
    futureEntity: "manual_dispatch_rules",
    priority: "alta",
    risk: "Sem regras de quando sugerir mensagens.",
    dependencies: [],
  },
  {
    key: "cobranca_ia_manual_dispatch_limits_v1",
    label: "Limites de disparo",
    futureEntity: "manual_dispatch_limits",
    priority: "media",
    risk: "Sem limites de envio diários.",
    dependencies: ["manual_dispatch_rules"],
  },
  {
    key: "cobranca_ia_kb_v1",
    label: "Base da IA",
    futureEntity: "knowledge_base_articles",
    priority: "alta",
    risk: "Perda da base de conhecimento da IA.",
    dependencies: [],
  },
  {
    key: "cobranca_ia_quick_support_history_v1",
    label: "Histórico de atendimento rápido",
    futureEntity: "quick_support_history",
    priority: "media",
    risk: "Perda do histórico de atendimentos rápidos.",
    dependencies: ["customers"],
  },
  {
    key: "cobranca_ia_campaign_copied_v1",
    label: "Campanhas copiadas",
    futureEntity: "campaign_logs",
    priority: "baixa",
    risk: "Sem registro do que foi copiado em campanhas.",
    dependencies: [],
  },
  {
    key: "cobranca_ia_pending_resolved_v1",
    label: "Pendências resolvidas",
    futureEntity: "pending_resolutions",
    priority: "media",
    risk: "Perda do estado de pendências resolvidas.",
    dependencies: [],
  },
  {
    key: "cobranca_ia_revenda_settings_v1",
    label: "Configurações da revenda",
    futureEntity: "revenda_settings",
    priority: "critica",
    risk: "Perda dos dados da revenda e planos.",
    dependencies: [],
  },
  {
    key: "cobranca_ia_local_security_v1",
    label: "Segurança local (PIN)",
    futureEntity: "security_settings",
    priority: "alta",
    risk: "PIN local não migra; precisa de auth real no backend.",
    dependencies: ["users"],
    notes: "No backend, substituir por autenticação real e permissões.",
  },
];

// ---------- Entidades futuras ----------
export const FUTURE_ENTITIES: FutureEntity[] = [
  {
    name: "companies",
    description: "Empresas/revendas (multi-tenant).",
    origin: "cobranca_ia_revenda_settings_v1",
    mainFields: ["id", "nome", "documento", "plano", "criado_em"],
    status: "futuro_backend",
    priority: "critica",
  },
  {
    name: "users",
    description: "Usuários e admins por empresa.",
    origin: "novo (sem origem local)",
    mainFields: ["id", "company_id", "nome", "email", "papel", "criado_em"],
    status: "futuro_backend",
    priority: "critica",
  },
  {
    name: "customers",
    description: "Clientes da revenda.",
    origin: "telas + agenda + atendimento rápido",
    mainFields: ["id", "company_id", "nome", "whatsapp", "documento", "criado_em"],
    status: "precisa_revisar",
    priority: "critica",
  },
  {
    name: "customer_screens",
    description: "Telas/assinaturas por cliente.",
    origin: "cobranca_ia_app_screens_v1",
    mainFields: ["id", "customer_id", "app_id", "server_id", "vencimento", "valor"],
    status: "pronto_para_modelar",
    priority: "critica",
  },
  {
    name: "app_catalog",
    description: "Aplicativos suportados.",
    origin: "uso embutido em telas",
    mainFields: ["id", "nome", "tipo", "ativo"],
    status: "precisa_revisar",
    priority: "alta",
  },
  {
    name: "server_catalog",
    description: "Servidores e painéis.",
    origin: "cobranca_ia_server_catalog_v1",
    mainFields: ["id", "company_id", "nome", "tipo", "credenciais_ref", "ativo"],
    status: "pronto_para_modelar",
    priority: "critica",
  },
  {
    name: "dns_domains",
    description: "Domínios cadastrados.",
    origin: "cobranca_ia_dns_domains_v1",
    mainFields: ["id", "company_id", "host", "provedor", "ativo"],
    status: "pronto_para_modelar",
    priority: "alta",
  },
  {
    name: "dns_routes",
    description: "Subdomínios/rotas por servidor.",
    origin: "cobranca_ia_dns_routes_v1",
    mainFields: ["id", "domain_id", "server_id", "subdomain", "valor", "principal"],
    status: "pronto_para_modelar",
    priority: "alta",
  },
  {
    name: "manual_renewals",
    description: "Histórico de renovações manuais.",
    origin: "cobranca_ia_manual_renewal_history_v1",
    mainFields: ["id", "customer_id", "screen_id", "valor", "data"],
    status: "pronto_para_modelar",
    priority: "alta",
  },
  {
    name: "trial_leads",
    description: "Leads/pessoas em teste.",
    origin: "cobranca_ia_trial_leads_v1",
    mainFields: ["id", "company_id", "nome", "whatsapp", "origem", "status"],
    status: "pronto_para_modelar",
    priority: "alta",
  },
  {
    name: "referrals",
    description: "Indicações entre clientes.",
    origin: "cobranca_ia_referrals_v1",
    mainFields: ["id", "indicador_id", "indicado_id", "status", "bonus"],
    status: "pronto_para_modelar",
    priority: "alta",
  },
  {
    name: "finance_entries",
    description: "Entradas e saídas financeiras.",
    origin: "cobranca_ia_finance_entries_v1",
    mainFields: ["id", "company_id", "tipo", "valor", "data", "categoria"],
    status: "pronto_para_modelar",
    priority: "critica",
  },
  {
    name: "finance_goals",
    description: "Objetivos financeiros.",
    origin: "cobranca_ia_finance_goals_v1",
    mainFields: ["id", "company_id", "titulo", "valor_alvo", "prazo"],
    status: "pronto_para_modelar",
    priority: "alta",
  },
  {
    name: "knowledge_base_articles",
    description: "Base de conhecimento da IA.",
    origin: "cobranca_ia_kb_v1",
    mainFields: ["id", "company_id", "titulo", "conteudo", "tags"],
    status: "pronto_para_modelar",
    priority: "alta",
  },
  {
    name: "import_schedule_items",
    description: "Itens da agenda de importação.",
    origin: "cobranca_ia_import_schedule_items_v1",
    mainFields: ["id", "company_id", "customer_id", "quando", "tipo"],
    status: "pronto_para_modelar",
    priority: "alta",
  },
  {
    name: "manual_dispatch_rules",
    description: "Regras de quando sugerir mensagens.",
    origin: "cobranca_ia_manual_dispatch_rules_v1",
    mainFields: ["id", "company_id", "condicao", "mensagem_id", "ativo"],
    status: "pronto_para_modelar",
    priority: "alta",
  },
  {
    name: "revenda_settings",
    description: "Configurações da revenda.",
    origin: "cobranca_ia_revenda_settings_v1",
    mainFields: ["company_id", "nome", "marca", "regras"],
    status: "pronto_para_modelar",
    priority: "critica",
  },
  {
    name: "security_settings",
    description: "Configurações de segurança por usuário.",
    origin: "Segurança Local (PIN)",
    mainFields: ["user_id", "mfa", "areas_protegidas"],
    status: "futuro_backend",
    priority: "alta",
  },
  {
    name: "audit_logs",
    description: "Logs de auditoria.",
    origin: "novo (sem origem local)",
    mainFields: ["id", "company_id", "user_id", "acao", "alvo", "ts"],
    status: "futuro_backend",
    priority: "alta",
  },
  {
    name: "backup_exports",
    description: "Registro de backups exportados.",
    origin: "Backup Geral local",
    mainFields: ["id", "company_id", "user_id", "ts", "tamanho"],
    status: "futuro_backend",
    priority: "media",
  },
];

// ---------- Ordem recomendada de migração ----------
export const MIGRATION_ORDER: MigrationStep[] = [
  {
    order: 1,
    title: "Autenticação e empresas",
    why: "Sem auth e tenant, qualquer dado vira inseguro.",
    riskIfSkipped: "Vazamento entre revendas, sem RLS.",
    dependencies: [],
  },
  {
    order: 2,
    title: "Clientes",
    why: "Base de quase tudo: telas, financeiro, atendimento.",
    riskIfSkipped: "Dados ficam órfãos, sem dono.",
    dependencies: ["companies", "users"],
  },
  {
    order: 3,
    title: "Telas e aplicativos",
    why: "Centro da operação diária.",
    riskIfSkipped: "Sem renovações, sem cobrança correta.",
    dependencies: ["customers", "server_catalog"],
  },
  {
    order: 4,
    title: "Servidores, DNS e Rotas",
    why: "Necessários para links públicos enviados aos clientes.",
    riskIfSkipped: "Mensagens com links quebrados.",
    dependencies: ["companies"],
  },
  {
    order: 5,
    title: "Renovações manuais",
    why: "Histórico financeiro/operacional.",
    riskIfSkipped: "Sem auditoria do que foi renovado.",
    dependencies: ["customer_screens"],
  },
  {
    order: 6,
    title: "Financeiro",
    why: "Visão de receita/custo/lucro real.",
    riskIfSkipped: "Sem indicadores reais de saúde do negócio.",
    dependencies: ["companies"],
  },
  {
    order: 7,
    title: "Testes e indicações",
    why: "Funil de aquisição e bonificações.",
    riskIfSkipped: "Perda de leads e regras de bônus.",
    dependencies: ["customers"],
  },
  {
    order: 8,
    title: "Agenda de disparos",
    why: "Organiza quando falar com cada cliente.",
    riskIfSkipped: "Cobrança bagunçada e cliente esquecido.",
    dependencies: ["customers"],
  },
  {
    order: 9,
    title: "Base da IA",
    why: "Conhecimento que alimenta sugestões.",
    riskIfSkipped: "IA sem contexto da revenda.",
    dependencies: ["companies"],
  },
  {
    order: 10,
    title: "Backup e auditoria",
    why: "Garantir rastreabilidade após migrar.",
    riskIfSkipped: "Sem trilha de auditoria nem recuperação.",
    dependencies: ["users"],
  },
  {
    order: 11,
    title: "Integrações reais (WhatsApp, IA, Pagamento, DNS)",
    why: "Só depois de tudo estável e auditado.",
    riskIfSkipped: "Disparos, cobranças e DNS podem causar dano real.",
    dependencies: ["audit_logs", "security_settings"],
  },
];

// ---------- Riscos e bloqueios ----------
export const LOCAL_RISKS: { title: string; description: string }[] = [
  { title: "Perda ao limpar cache", description: "Limpar dados do navegador apaga tudo." },
  { title: "Sem acesso multiaparelho", description: "Dados ficam só no aparelho/navegador atual." },
  { title: "Sem controle real por usuário", description: "Não há auth nem permissões reais." },
  { title: "Sem RLS", description: "Sem isolamento por revenda/usuário." },
  { title: "Sem auditoria real", description: "Sem trilha de quem alterou o quê." },
  { title: "Sem backup automático", description: "Depende do usuário lembrar de exportar." },
  { title: "Sem consistência entre usuários", description: "Cada usuário vê uma realidade diferente." },
  { title: "Sem fila real de mensagens", description: "Sem retry, sem persistência de envio." },
  { title: "Sem webhook de pagamento real", description: "Confirmação de pagamento é manual." },
  { title: "Sem DNS real automatizado", description: "Rotas precisam ser criadas manualmente." },
];

export const BACKEND_BLOCKERS: { title: string; description: string }[] = [
  { title: "Definir schema real", description: "Tabelas, tipos, índices e relacionamentos." },
  { title: "Definir multi-tenant", description: "Como isolar dados por revenda/empresa." },
  { title: "Definir permissões", description: "Papéis: owner, admin, operador." },
  { title: "Definir RPCs seguras", description: "Funções com SECURITY DEFINER, validadas." },
  { title: "Definir logs/auditoria", description: "Tabela de audit_logs e gatilhos." },
  { title: "Validar custo cloud", description: "Estimativa de uso/preço antes de habilitar." },
  { title: "Validar integrações reais separadas", description: "WhatsApp, IA, pagamento e DNS isolados por flag." },
];

export const PRE_SUPABASE_CHECKLIST: ChecklistItem[] = [
  { id: "backup", label: "Backup Geral exportado recentemente" },
  { id: "diag", label: "Diagnóstico sem críticos graves" },
  { id: "seg", label: "Segurança Local ativa" },
  { id: "revenda", label: "Minha Revenda preenchida" },
  { id: "entidades", label: "Entidades futuras revisadas" },
  { id: "campos", label: "Campos obrigatórios definidos" },
  { id: "multi", label: "Estratégia multiusuário definida" },
  { id: "tenant", label: "Regras de tenant definidas" },
  { id: "rls", label: "RLS planejada" },
  { id: "integracoes", label: "Integrações reais bloqueadas por padrão" },
  { id: "migrations", label: "Nenhuma migration criada no escuro" },
  { id: "mt-company-id", label: "company_id definido nas entidades principais" },
  { id: "mt-rls", label: "Policies RLS planejadas por company_id" },
  { id: "mt-rpc", label: "Funções RPC seguras planejadas (SECURITY DEFINER)" },
  { id: "mt-audit", label: "Logs/auditoria planejados" },
  { id: "mt-local-migration", label: "Migração local por empresa revisada" },
  { id: "mt-derived", label: "Módulos derivados também levam company_id (manual_renewals, import_schedule_items, quick_support_history, campaign_logs, pending_resolutions)" },
];

// ---------- Leitura local ----------
function readKey(key: string): unknown | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = window.localStorage.getItem(key);
  if (raw == null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function countOf(raw: unknown): number {
  if (Array.isArray(raw)) return raw.length;
  if (raw && typeof raw === "object") return Object.keys(raw as object).length;
  if (raw !== undefined && raw !== null) return 1;
  return 0;
}

export function getLocalModuleSummaries(): LocalModuleSummary[] {
  // Garante todas as chaves do backup geral também aparecem (caso alguma não esteja no map).
  const mapByKey = new Map(LOCAL_MODULE_MAP.map((m) => [m.key, m]));
  for (const b of BACKUP_MODULES) {
    if (!mapByKey.has(b.key)) {
      mapByKey.set(b.key, {
        key: b.key,
        label: b.label,
        futureEntity: "(a definir)",
        priority: "media",
        risk: "Dados locais sem mapeamento futuro definido.",
        dependencies: [],
      });
    }
  }
  const summaries: LocalModuleSummary[] = [];
  for (const m of mapByKey.values()) {
    const raw = readKey(m.key);
    summaries.push({
      ...m,
      present: raw !== undefined,
      count: countOf(raw),
    });
  }
  return summaries;
}

export function buildReadinessReport(): ReadinessReport {
  const modules = getLocalModuleSummaries();
  const presentes = modules.filter((m) => m.present);
  const registrosEstimados = presentes.reduce((acc, m) => acc + m.count, 0);
  const criticas = FUTURE_ENTITIES.filter((e) => e.priority === "critica").length;
  const altas = FUTURE_ENTITIES.filter((e) => e.priority === "alta").length;
  const prontas = FUTURE_ENTITIES.filter(
    (e) => e.status === "pronto_para_modelar",
  ).length;
  const naoProntas = FUTURE_ENTITIES.length - prontas;
  const riscosPerda = modules.filter(
    (m) => m.present && (m.priority === "critica" || m.priority === "alta"),
  ).length;

  return {
    generated_at: new Date().toISOString(),
    modules,
    entities: FUTURE_ENTITIES,
    migrationOrder: MIGRATION_ORDER,
    risks: LOCAL_RISKS,
    blockers: BACKEND_BLOCKERS,
    checklist: PRE_SUPABASE_CHECKLIST,
    totals: {
      modulosEncontrados: presentes.length,
      registrosEstimados,
      entidades: FUTURE_ENTITIES.length,
      criticas,
      altas,
      riscosPerda,
      prontas,
      naoProntas,
    },
  };
}

// ---------- Exportar plano TXT ----------
function pad(n: number) {
  return String(n).padStart(2, "0");
}
function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function buildReadinessTxt(report?: ReadinessReport): string {
  const r = report || buildReadinessReport();
  const L: string[] = [];
  L.push("Plano de Preparação para Backend — CobraEasy");
  L.push(`Gerado em: ${new Date(r.generated_at).toLocaleString("pt-BR")}`);
  L.push("");
  L.push("MÓDULOS LOCAIS ENCONTRADOS");
  for (const m of r.modules) {
    L.push(
      `- ${m.label} [${m.key}] — ${m.present ? `${m.count} item(ns)` : "vazio"} | prioridade ${PRIORITY_LABEL[m.priority]} | futura: ${m.futureEntity}`,
    );
    if (m.risk) L.push(`    risco: ${m.risk}`);
  }
  L.push("");
  L.push("ENTIDADES FUTURAS SUGERIDAS");
  for (const e of r.entities) {
    L.push(
      `- ${e.name} (${PRIORITY_LABEL[e.priority]} / ${STATUS_LABEL[e.status]}) — ${e.description}`,
    );
    L.push(`    campos: ${e.mainFields.join(", ")}`);
    L.push(`    origem: ${e.origin}`);
  }
  L.push("");
  L.push("ORDEM RECOMENDADA DE MIGRAÇÃO");
  for (const s of r.migrationOrder) {
    L.push(`${s.order}. ${s.title}`);
    L.push(`   por que: ${s.why}`);
    L.push(`   risco se fora de ordem: ${s.riskIfSkipped}`);
    if (s.dependencies.length)
      L.push(`   depende de: ${s.dependencies.join(", ")}`);
  }
  L.push("");
  L.push("RISCOS SE CONTINUAR SÓ LOCAL");
  for (const x of r.risks) L.push(`- ${x.title}: ${x.description}`);
  L.push("");
  L.push("BLOQUEIOS PARA BACKEND REAL");
  for (const x of r.blockers) L.push(`- ${x.title}: ${x.description}`);
  L.push("");
  L.push("CHECKLIST ANTES DE MEXER NO SUPABASE");
  for (const c of r.checklist) L.push(`[ ] ${c.label}`);
  L.push("");
  L.push("Observação: este plano NÃO criou backend real.");
  L.push("Nenhum dado foi enviado a servidor. Nenhuma migration foi executada.");
  return L.join("\n");
}

export function exportReadinessTxt() {
  if (typeof window === "undefined") return;
  const txt = buildReadinessTxt();
  const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `plano-backend-cobranca-ia-${todayStamp()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
