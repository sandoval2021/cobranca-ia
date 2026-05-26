// Empresas, planos e membros — 100% local (localStorage).
// Simula multi-tenant. Em produção: Supabase + RLS + company_id.

export type CompanyStatus = "teste" | "ativa" | "vencida" | "suspensa" | "cancelada";
export type MemberRole = "owner" | "atendente" | "financeiro" | "suporte";
export type MemberStatus = "ativo" | "pendente" | "bloqueado";

export type CompanyModuleKey =
  | "clientes"
  | "telas_app"
  | "atendimento_rapido"
  | "operacao_dia"
  | "campanhas"
  | "pendencias"
  | "testes"
  | "indicacoes"
  | "financeiro"
  | "backup"
  | "minha_revenda"
  | "base_ia"
  | "regras_disparo"
  | "dns_rotas"
  | "diagnostico"
  | "preparacao_backend"
  | "seguranca"
  | "servidores"
  | "ajuda";

export type CompanyPlan = {
  id: string;
  nome: string;
  preco_mensal: number;
  limite_clientes: number;
  limite_telas: number;
  limite_testes: number;
  limite_servidores: number;
  modulos: CompanyModuleKey[];
  permite_ia: boolean;
  permite_dns: boolean;
  permite_financeiro: boolean;
  permite_indicacoes: boolean;
  permite_backup: boolean;
  status: "ativo" | "arquivado";
};

export type Company = {
  id: string;
  nome: string;
  slug: string;
  dono_nome: string;
  dono_email: string;
  dono_whatsapp: string;
  status: CompanyStatus;
  plano_id: string;
  data_inicio: string;
  data_vencimento: string;
  observacao?: string;
  created_at: string;
  updated_at: string;
};

export type CompanyMember = {
  id: string;
  company_id: string;
  user_id?: string;
  nome: string;
  email: string;
  whatsapp: string;
  role: MemberRole;
  status: MemberStatus;
  created_at: string;
};

const COMPANIES_KEY = "cobranca_ia_companies_v1";
const MEMBERS_KEY = "cobranca_ia_company_members_v1";
const PLANS_KEY = "cobranca_ia_company_plans_v1";
const CURRENT_KEY = "cobranca_ia_current_company_v1";

export const COMPANIES_EVENT = "cobranca_ia_companies:changed";

function emit() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(COMPANIES_EVENT));
  }
}

function read<T>(key: string, fb: T): T {
  if (typeof window === "undefined") return fb;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fb;
    return JSON.parse(raw) as T;
  } catch {
    return fb;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* noop */
  }
}

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ---------- Planos padrão ----------

const DEFAULT_PLANS: CompanyPlan[] = [
  {
    id: "plan_basico",
    nome: "Básico",
    preco_mensal: 49,
    limite_clientes: 100,
    limite_telas: 200,
    limite_testes: 30,
    limite_servidores: 2,
    modulos: [
      "clientes",
      "telas_app",
      "atendimento_rapido",
      "operacao_dia",
      "pendencias",
      "backup",
      "minha_revenda",
      "ajuda",
    ],
    permite_ia: false,
    permite_dns: false,
    permite_financeiro: false,
    permite_indicacoes: false,
    permite_backup: true,
    status: "ativo",
  },
  {
    id: "plan_profissional",
    nome: "Profissional",
    preco_mensal: 89,
    limite_clientes: 500,
    limite_telas: 1000,
    limite_testes: 200,
    limite_servidores: 5,
    modulos: [
      "clientes",
      "telas_app",
      "atendimento_rapido",
      "operacao_dia",
      "campanhas",
      "pendencias",
      "testes",
      "indicacoes",
      "financeiro",
      "backup",
      "minha_revenda",
      "ajuda",
    ],
    permite_ia: false,
    permite_dns: false,
    permite_financeiro: true,
    permite_indicacoes: true,
    permite_backup: true,
    status: "ativo",
  },
  {
    id: "plan_premium",
    nome: "Premium",
    preco_mensal: 149,
    limite_clientes: 2000,
    limite_telas: 5000,
    limite_testes: 1000,
    limite_servidores: 20,
    modulos: [
      "clientes",
      "telas_app",
      "atendimento_rapido",
      "operacao_dia",
      "campanhas",
      "pendencias",
      "testes",
      "indicacoes",
      "financeiro",
      "backup",
      "minha_revenda",
      "base_ia",
      "ajuda",
    ],
    permite_ia: true,
    permite_dns: false,
    permite_financeiro: true,
    permite_indicacoes: true,
    permite_backup: true,
    status: "ativo",
  },
  {
    id: "plan_admin",
    nome: "Admin interno",
    preco_mensal: 0,
    limite_clientes: 999999,
    limite_telas: 999999,
    limite_testes: 999999,
    limite_servidores: 999999,
    modulos: [
      "clientes",
      "telas_app",
      "atendimento_rapido",
      "operacao_dia",
      "campanhas",
      "pendencias",
      "testes",
      "indicacoes",
      "financeiro",
      "backup",
      "minha_revenda",
      "base_ia",
      "regras_disparo",
      "dns_rotas",
      "diagnostico",
      "preparacao_backend",
      "seguranca",
      "servidores",
      "ajuda",
    ],
    permite_ia: true,
    permite_dns: true,
    permite_financeiro: true,
    permite_indicacoes: true,
    permite_backup: true,
    status: "ativo",
  },
];

export function listCompanyPlans(): CompanyPlan[] {
  const stored = read<CompanyPlan[]>(PLANS_KEY, []);
  if (stored.length === 0) {
    write(PLANS_KEY, DEFAULT_PLANS);
    return DEFAULT_PLANS;
  }
  return stored;
}

export function saveCompanyPlan(plan: CompanyPlan): CompanyPlan {
  const list = listCompanyPlans();
  const idx = list.findIndex((p) => p.id === plan.id);
  const next = idx >= 0 ? list.map((p) => (p.id === plan.id ? plan : p)) : [...list, plan];
  write(PLANS_KEY, next);
  emit();
  return plan;
}

export function getPlanById(id?: string | null): CompanyPlan | null {
  if (!id) return null;
  return listCompanyPlans().find((p) => p.id === id) ?? null;
}

// ---------- Empresas ----------

export function listCompanies(): Company[] {
  return read<Company[]>(COMPANIES_KEY, []);
}

export function getCompanyById(id?: string | null): Company | null {
  if (!id) return null;
  return listCompanies().find((c) => c.id === id) ?? null;
}

export type CompanyInput = Omit<Company, "id" | "created_at" | "updated_at"> &
  Partial<Pick<Company, "id">>;

export function saveCompany(input: CompanyInput): Company {
  const now = new Date().toISOString();
  const list = listCompanies();
  if (input.id) {
    const existing = list.find((c) => c.id === input.id);
    const updated: Company = {
      ...(existing as Company),
      ...input,
      id: input.id,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    write(
      COMPANIES_KEY,
      list.map((c) => (c.id === updated.id ? updated : c)),
    );
    emit();
    return updated;
  }
  const company: Company = {
    ...input,
    id: uid("co"),
    created_at: now,
    updated_at: now,
  };
  write(COMPANIES_KEY, [...list, company]);
  emit();
  return company;
}

export function updateCompany(id: string, patch: Partial<Company>): Company | null {
  const list = listCompanies();
  const existing = list.find((c) => c.id === id);
  if (!existing) return null;
  const updated: Company = { ...existing, ...patch, id, updated_at: new Date().toISOString() };
  write(COMPANIES_KEY, list.map((c) => (c.id === id ? updated : c)));
  emit();
  return updated;
}

export function archiveCompany(id: string) {
  updateCompany(id, { status: "cancelada" });
}

// ---------- Membros ----------

export function listAllMembers(): CompanyMember[] {
  return read<CompanyMember[]>(MEMBERS_KEY, []);
}

export function getCompanyMembers(company_id: string): CompanyMember[] {
  return listAllMembers().filter((m) => m.company_id === company_id);
}

export function saveCompanyMember(input: Omit<CompanyMember, "id" | "created_at"> & { id?: string }): CompanyMember {
  const list = listAllMembers();
  const now = new Date().toISOString();
  if (input.id) {
    const member: CompanyMember = { ...(list.find((m) => m.id === input.id) as CompanyMember), ...input, id: input.id, created_at: list.find((m) => m.id === input.id)?.created_at ?? now };
    write(MEMBERS_KEY, list.map((m) => (m.id === input.id ? member : m)));
    emit();
    return member;
  }
  const member: CompanyMember = { ...input, id: uid("mem"), created_at: now };
  write(MEMBERS_KEY, [...list, member]);
  emit();
  return member;
}

// ---------- Empresa atual ----------

export function getCurrentCompanyId(): string | null {
  return read<string | null>(CURRENT_KEY, null);
}

export function setCurrentCompany(id: string | null) {
  write(CURRENT_KEY, id);
  emit();
}

export function getCurrentCompany(): Company | null {
  return getCompanyById(getCurrentCompanyId());
}

export function getCompanyForUser(userEmail?: string | null): Company | null {
  if (!userEmail) return null;
  const e = userEmail.toLowerCase();
  const member = listAllMembers().find(
    (m) => m.email.toLowerCase() === e && m.role === "owner" && m.status === "ativo",
  );
  if (member) return getCompanyById(member.company_id);
  return null;
}

/**
 * Garante uma conta/base ativa para o usuário sem exigir cadastro manual de empresa.
 * Ordem de seleção:
 *  1. Conta já vinculada ao e-mail (owner ativo).
 *  2. Conta única existente (usar automaticamente).
 *  3. Conta chamada "TESTANDO" (ambiente de teste).
 *  4. Cria "Minha conta" e vincula como owner.
 */
export function ensureLocalAccount(
  userEmail?: string | null,
  userName?: string | null,
  userWhatsapp?: string | null,
): Company | null {
  if (!userEmail) return null;
  const existing = getCompanyForUser(userEmail);
  if (existing) return existing;

  const all = listCompanies();
  let chosen: Company | null = null;
  if (all.length === 1) {
    chosen = all[0]!;
  } else if (all.length > 1) {
    const testando = all.find((c) => c.nome.trim().toUpperCase() === "TESTANDO");
    if (testando) chosen = testando;
  }

  if (!chosen) {
    const plans = listCompanyPlans();
    const plan =
      plans.find((p) => p.id === "plan_premium") ??
      plans.find((p) => p.id === "plan_profissional") ??
      plans.find((p) => p.id === "plan_basico") ??
      plans[0]!;
    const today = new Date().toISOString().slice(0, 10);
    const inOneYear = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
    chosen = saveCompany({
      nome: "Minha conta",
      slug: slugify("minha-conta-" + Math.random().toString(36).slice(2, 6)),
      dono_nome: userName ?? "Titular",
      dono_email: userEmail,
      dono_whatsapp: userWhatsapp ?? "",
      status: "ativa",
      plano_id: plan.id,
      data_inicio: today,
      data_vencimento: inOneYear,
    });
  }

  // Garante vínculo de owner.
  const already = getCompanyMembers(chosen.id).find(
    (m) => m.email.toLowerCase() === userEmail.toLowerCase() && m.role === "owner",
  );
  if (!already) {
    saveCompanyMember({
      company_id: chosen.id,
      nome: userName ?? "Titular",
      email: userEmail,
      whatsapp: userWhatsapp ?? "",
      role: "owner",
      status: "ativo",
    });
  }
  return chosen;
}

// ---------- Permissões/limites ----------

export function canCompanyUseModule(company: Company | null, mod: CompanyModuleKey): boolean {
  if (!company) return false;
  const plan = getPlanById(company.plano_id);
  if (!plan) return false;
  return plan.modulos.includes(mod);
}

export function getCompanyLimits(company: Company | null) {
  const plan = getPlanById(company?.plano_id);
  return {
    clientes: plan?.limite_clientes ?? 0,
    telas: plan?.limite_telas ?? 0,
    testes: plan?.limite_testes ?? 0,
    servidores: plan?.limite_servidores ?? 0,
  };
}

export function getCompanyStatus(company: Company | null): CompanyStatus | "sem_empresa" {
  if (!company) return "sem_empresa";
  // Atualiza status virtual com base na data
  if (company.status === "ativa" && company.data_vencimento) {
    const venc = new Date(company.data_vencimento).getTime();
    if (!Number.isNaN(venc) && venc < Date.now()) return "vencida";
  }
  return company.status;
}

export function daysUntilDue(company: Company | null): number | null {
  if (!company?.data_vencimento) return null;
  const venc = new Date(company.data_vencimento).getTime();
  if (Number.isNaN(venc)) return null;
  return Math.floor((venc - Date.now()) / 86400000);
}

// Mapeia rota → módulo (apenas owner). Rotas ausentes daqui são liberadas por padrão.
export const ROUTE_TO_MODULE: Record<string, CompanyModuleKey> = {
  "/clientes": "clientes",
  "/operacao-dia": "operacao_dia",
  "/campanhas-manuais": "campanhas",
  "/pendencias": "pendencias",
  "/testes": "testes",
  "/indicacoes": "indicacoes",
  "/financeiro": "financeiro",
  "/backup-geral": "backup",
  "/configuracoes-revenda": "minha_revenda",
  "/ajuda": "ajuda",
};

// ---------- Export/Import ----------

export type CompaniesExport = {
  version: 1;
  exported_at: string;
  companies: Company[];
  members: CompanyMember[];
  plans: CompanyPlan[];
  current: string | null;
};

export function exportCompanies(): CompaniesExport {
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    companies: listCompanies(),
    members: listAllMembers(),
    plans: listCompanyPlans(),
    current: getCurrentCompanyId(),
  };
}

export function importCompanies(data: CompaniesExport, mode: "merge" | "replace") {
  if (!data || data.version !== 1) throw new Error("Formato inválido.");
  if (mode === "replace") {
    write(COMPANIES_KEY, data.companies ?? []);
    write(MEMBERS_KEY, data.members ?? []);
    write(PLANS_KEY, data.plans ?? []);
    write(CURRENT_KEY, data.current ?? null);
  } else {
    const mergeBy = <T extends { id: string }>(a: T[], b: T[]) => {
      const map = new Map(a.map((x) => [x.id, x] as const));
      for (const x of b) map.set(x.id, x);
      return Array.from(map.values());
    };
    write(COMPANIES_KEY, mergeBy(listCompanies(), data.companies ?? []));
    write(MEMBERS_KEY, mergeBy(listAllMembers(), data.members ?? []));
    write(PLANS_KEY, mergeBy(listCompanyPlans(), data.plans ?? []));
  }
  emit();
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}
