// Central de Diagnóstico do sistema local.
// Apenas leitura. Não altera dados, não envia nada, não chama API externa.

import {
  listAllScreens,
  appDueDays,
  isPaidApp,
  paidAppAlerts,
  type AppScreen,
} from "./app-screens";
import { listServers, getServerById } from "./server-catalog";
import {
  listDomains,
  listDnsRoutes,
  type DnsRoute,
} from "./dns-routes";
import { getLocalSecuritySettings } from "./local-security";
import { getLocalDataHealth, getModuleSummaries } from "./backup-geral";
import {
  listFinanceEntries,
  listFinanceGoals,
  filterEntriesByMonth,
  calculateFinanceSummary,
} from "./financeiro-local";
import { listTrialLeads, listFollowUps } from "./trial-leads";
import { listReferrals } from "./referrals";
import { getRevendaSettings } from "./revenda-settings";
import { getImportScheduleSummary } from "./import-schedule";

export type DiagnosticLevel = "ok" | "atencao" | "critico";

export type DiagnosticArea =
  | "dados"
  | "clientes"
  | "servidores"
  | "dns"
  | "seguranca"
  | "backup"
  | "financeiro"
  | "testes"
  | "indicacoes"
  | "operacao";

export const AREA_LABEL: Record<DiagnosticArea, string> = {
  dados: "Dados locais",
  clientes: "Clientes / Telas e Apps",
  servidores: "Servidores",
  dns: "DNS e Rotas",
  seguranca: "Segurança Local",
  backup: "Backup Geral",
  financeiro: "Financeiro",
  testes: "Testes",
  indicacoes: "Indicações",
  operacao: "Operação",
};

export type DiagnosticAlert = {
  id: string;
  area: DiagnosticArea;
  level: DiagnosticLevel;
  title: string;
  description: string;
  action?: string;
  to?: string;
  ctaLabel?: string;
};

export type ChecklistItem = {
  id: string;
  label: string;
  status: "ok" | "pendente" | "atencao";
  hint?: string;
};

export type DiagnosticsReport = {
  generated_at: string;
  totals: { ok: number; atencao: number; critico: number; modulos_com_dados: number };
  alerts: DiagnosticAlert[];
  checklist: ChecklistItem[];
  recommendations: string[];
  overall: DiagnosticLevel;
  stats: {
    clientes: number;
    screens: number;
    servidores: number;
    rotas: number;
    dominios: number;
    backupAt: string | null;
  };
};

const LAST_BACKUP_KEY = "cobranca_ia_last_backup_at_v1";

function todayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.floor((a - b) / 86400000);
}

// ---------- Coletores por área ----------

function checkDados(alerts: DiagnosticAlert[]) {
  if (typeof window === "undefined") return;
  try {
    const probe = "__cobranca_ia_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
  } catch {
    alerts.push({
      id: "dados-storage",
      area: "dados",
      level: "critico",
      title: "localStorage indisponível",
      description: "O navegador não permite armazenamento local. Vários módulos não funcionarão.",
      action: "Habilite o armazenamento local ou use outro navegador.",
    });
  }
}

function checkClientesTelas(alerts: DiagnosticAlert[]) {
  const all = listAllScreens();
  const servers = listServers();
  const activeServerIds = new Set(servers.filter((s) => s.status === "ativo").map((s) => s.id));
  const knownServerIds = new Set(servers.map((s) => s.id));

  let semApp = 0;
  let semVencimento = 0;
  let vencidas = 0;
  let semServidor = 0;
  let servidorInativo = 0;
  let pagoSemVenc = 0;
  let pagoVencido = 0;
  let pagoSemKey = 0;

  for (const screens of Object.values(all)) {
    for (const s of screens as AppScreen[]) {
      if (s.status === "arquivada") continue;
      if (!s.app) semApp++;
      if (!s.due_date) semVencimento++;
      else {
        const d = daysBetween(s.due_date, todayIso());
        if (d < 0) vencidas++;
      }
      const sids = s.server_ids || [];
      if (!sids.length && !s.primary_server_id) semServidor++;
      else {
        const refIds = [s.primary_server_id, ...sids].filter(Boolean) as string[];
        if (refIds.some((id) => knownServerIds.has(id) && !activeServerIds.has(id)))
          servidorInativo++;
      }
      if (isPaidApp(s)) {
        if (!s.app_due_date) pagoSemVenc++;
        else {
          const dd = appDueDays(s);
          if (dd != null && dd < 0) pagoVencido++;
        }
        const alertsP = paidAppAlerts(s);
        if (alertsP.includes("sem_mac_key")) pagoSemKey++;
      }
    }
  }

  if (semApp)
    alerts.push({
      id: "screens-sem-app",
      area: "clientes",
      level: "atencao",
      title: `${semApp} tela(s) sem app definido`,
      description: "Algumas telas estão sem aplicativo selecionado.",
      action: "Abra Clientes e complete o aplicativo da tela.",
      to: "/clientes",
      ctaLabel: "Abrir Clientes",
    });
  if (semVencimento)
    alerts.push({
      id: "screens-sem-vencimento",
      area: "clientes",
      level: "atencao",
      title: `${semVencimento} tela(s) sem vencimento`,
      description: "Telas sem data de vencimento atrapalham a operação do dia.",
      action: "Defina o vencimento em Clientes.",
      to: "/clientes",
      ctaLabel: "Abrir Clientes",
    });
  if (vencidas)
    alerts.push({
      id: "screens-vencidas",
      area: "clientes",
      level: "critico",
      title: `${vencidas} tela(s) vencidas`,
      description: "Existem telas com vencimento da lista no passado.",
      action: "Revise em Operação do dia.",
      to: "/operacao-dia",
      ctaLabel: "Abrir Operação",
    });
  if (semServidor)
    alerts.push({
      id: "screens-sem-servidor",
      area: "clientes",
      level: "atencao",
      title: `${semServidor} tela(s) sem servidor vinculado`,
      description: "Sem servidor, mensagens com rota pública saem incompletas.",
      action: "Vincule um servidor à tela.",
      to: "/clientes",
      ctaLabel: "Abrir Clientes",
    });
  if (servidorInativo)
    alerts.push({
      id: "screens-servidor-inativo",
      area: "clientes",
      level: "atencao",
      title: `${servidorInativo} tela(s) com servidor inativo`,
      description: "Servidor marcado como inativo no catálogo.",
      action: "Reative o servidor ou troque a tela.",
      to: "/catalogo-servidores",
      ctaLabel: "Abrir Servidores",
    });
  if (pagoSemVenc)
    alerts.push({
      id: "apps-pago-sem-venc",
      area: "clientes",
      level: "atencao",
      title: `${pagoSemVenc} app(s) pago(s) sem vencimento da licença`,
      description: "Apps pagos sem app_due_date não geram lembrete.",
      action: "Preencha o vencimento da licença do app.",
      to: "/clientes",
      ctaLabel: "Abrir Clientes",
    });
  if (pagoVencido)
    alerts.push({
      id: "apps-pago-vencido",
      area: "clientes",
      level: "critico",
      title: `${pagoVencido} app(s) pago(s) vencido(s)`,
      description: "Licenças de app pago no passado.",
      action: "Renove em Clientes.",
      to: "/clientes",
      ctaLabel: "Abrir Clientes",
    });
  if (pagoSemKey)
    alerts.push({
      id: "apps-pago-sem-key",
      area: "clientes",
      level: "atencao",
      title: `${pagoSemKey} app(s) pago(s) sem MAC/Key`,
      description: "Apps pagos sem credenciais não ativam para o cliente.",
      action: "Cadastre MAC/Key no Atendimento rápido ou Clientes.",
      to: "/clientes",
      ctaLabel: "Abrir Clientes",
    });
}

function checkServidoresEDns(alerts: DiagnosticAlert[]) {
  const servers = listServers().filter((s) => s.status === "ativo");
  const domains = listDomains();
  const routes = listDnsRoutes();

  // Servidores sem rota
  const routesByServer = new Map<string, DnsRoute[]>();
  for (const r of routes) {
    if (!r.server_id) continue;
    const arr = routesByServer.get(r.server_id) || [];
    arr.push(r);
    routesByServer.set(r.server_id, arr);
  }

  let semRota = 0;
  let semPrincipal = 0;
  let multiPrincipal = 0;
  let principalInativa = 0;
  for (const s of servers) {
    const rs = routesByServer.get(s.id) || [];
    if (!rs.length) {
      semRota++;
      continue;
    }
    const principais = rs.filter((r) => r.is_primary);
    if (!principais.length) semPrincipal++;
    if (principais.length > 1) multiPrincipal++;
    if (principais.length && principais.every((r) => !r.active)) principalInativa++;
  }
  if (semRota)
    alerts.push({
      id: "servers-sem-rota",
      area: "servidores",
      level: "atencao",
      title: `${semRota} servidor(es) sem rota`,
      description: "Servidores ativos sem qualquer rota configurada.",
      action: "Cadastre uma rota em DNS e Rotas.",
      to: "/admin-dns-rotas",
      ctaLabel: "Abrir DNS e Rotas",
    });
  if (semPrincipal)
    alerts.push({
      id: "servers-sem-principal",
      area: "servidores",
      level: "critico",
      title: `${semPrincipal} servidor(es) sem rota principal`,
      description: "Defina uma rota principal para usar em mensagens e atendimento.",
      action: "Abra DNS e Rotas e marque uma rota como principal.",
      to: "/admin-dns-rotas",
      ctaLabel: "Abrir DNS e Rotas",
    });
  if (multiPrincipal)
    alerts.push({
      id: "servers-multi-principal",
      area: "servidores",
      level: "atencao",
      title: `${multiPrincipal} servidor(es) com mais de uma rota principal`,
      description: "Apenas uma rota deve ficar como principal por servidor.",
      action: "Revise as rotas principais.",
      to: "/admin-dns-rotas",
      ctaLabel: "Abrir DNS e Rotas",
    });
  if (principalInativa)
    alerts.push({
      id: "servers-principal-inativa",
      area: "servidores",
      level: "critico",
      title: `${principalInativa} rota(s) principal(is) inativas`,
      description: "Rotas principais marcadas como inativas.",
      action: "Reative ou substitua a rota principal.",
      to: "/admin-dns-rotas",
      ctaLabel: "Abrir DNS e Rotas",
    });

  // Rotas sem domínio / sem servidor
  const domainIds = new Set(domains.map((d) => d.id));
  let rotaSemDom = 0;
  let rotaSemServ = 0;
  for (const r of routes) {
    if (!r.domain_id || !domainIds.has(r.domain_id)) rotaSemDom++;
    if (!r.server_id || !getServerById(r.server_id)) rotaSemServ++;
  }
  if (rotaSemDom)
    alerts.push({
      id: "routes-sem-dominio",
      area: "dns",
      level: "atencao",
      title: `${rotaSemDom} rota(s) sem domínio válido`,
      description: "Rotas referenciando domínio inexistente.",
      action: "Cadastre o domínio ou corrija a rota.",
      to: "/admin-dns-rotas",
      ctaLabel: "Abrir DNS e Rotas",
    });
  if (rotaSemServ)
    alerts.push({
      id: "routes-sem-servidor",
      area: "dns",
      level: "atencao",
      title: `${rotaSemServ} rota(s) sem servidor`,
      description: "Rotas sem servidor vinculado.",
      action: "Vincule um servidor à rota.",
      to: "/admin-dns-rotas",
      ctaLabel: "Abrir DNS e Rotas",
    });

  const dnsErro = domains.filter((d) => d.status === "erro").length;
  if (dnsErro)
    alerts.push({
      id: "dns-erro",
      area: "dns",
      level: "critico",
      title: `${dnsErro} domínio(s) com status de erro`,
      description: "Domínios marcados como erro no DNS local.",
      action: "Revise o status em DNS e Rotas.",
      to: "/admin-dns-rotas",
      ctaLabel: "Abrir DNS e Rotas",
    });
}

function checkSeguranca(alerts: DiagnosticAlert[]) {
  const s = getLocalSecuritySettings();
  if (!s.enabled || !s.pin_hash) {
    alerts.push({
      id: "sec-pin",
      area: "seguranca",
      level: "atencao",
      title: "PIN local não configurado",
      description: "Sem PIN, ações sensíveis ficam abertas neste navegador.",
      action: "Configure um PIN em Segurança.",
      to: "/seguranca-local",
      ctaLabel: "Abrir Segurança",
    });
    return;
  }
  if (!s.require_pin_on_backup)
    alerts.push({
      id: "sec-backup",
      area: "seguranca",
      level: "atencao",
      title: "Backup Geral não exige PIN",
      description: "Backup contém todos os dados locais.",
      action: "Ative PIN para Backup em Segurança.",
      to: "/seguranca-local",
      ctaLabel: "Abrir Segurança",
    });
  if (!s.require_pin_on_server_password || !s.require_pin_on_app_key)
    alerts.push({
      id: "sec-secrets",
      area: "seguranca",
      level: "atencao",
      title: "Senhas/Keys sem PIN",
      description: "Revelar senha de servidor ou key do app deveria exigir PIN.",
      action: "Ative as proteções em Segurança.",
      to: "/seguranca-local",
      ctaLabel: "Abrir Segurança",
    });
  if (!s.require_pin_on_sensitive_actions)
    alerts.push({
      id: "sec-sensitive",
      area: "seguranca",
      level: "atencao",
      title: "Ações sensíveis sem PIN",
      description: "Algumas ações sensíveis estão sem proteção.",
      action: "Ative “Exigir PIN em ações sensíveis”.",
      to: "/seguranca-local",
      ctaLabel: "Abrir Segurança",
    });
}

function checkBackup(alerts: DiagnosticAlert[]): string | null {
  let backupAt: string | null = null;
  try {
    backupAt = window.localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    backupAt = null;
  }
  if (!backupAt) {
    alerts.push({
      id: "backup-nenhum",
      area: "backup",
      level: "critico",
      title: "Nenhum backup geral exportado ainda",
      description: "Sem backup, perda de dados do navegador é irreversível.",
      action: "Exporte um backup agora.",
      to: "/backup-geral",
      ctaLabel: "Abrir Backup Geral",
    });
  } else {
    const days = Math.floor((Date.now() - new Date(backupAt).getTime()) / 86400000);
    if (days > 14)
      alerts.push({
        id: "backup-antigo",
        area: "backup",
        level: "atencao",
        title: `Último backup há ${days} dias`,
        description: "Recomendado exportar a cada 7–14 dias.",
        action: "Exporte um novo Backup Geral.",
        to: "/backup-geral",
        ctaLabel: "Abrir Backup Geral",
      });
  }
  const health = getLocalDataHealth();
  const firstMsg = health.issues[0]?.message;
  if (health.status === "review")
    alerts.push({
      id: "backup-health-review",
      area: "backup",
      level: "critico",
      title: "Saúde dos dados locais: revisar",
      description: firstMsg || "Há módulos com formato inesperado.",
      action: "Revise os módulos antes de continuar.",
      to: "/backup-geral",
      ctaLabel: "Abrir Backup Geral",
    });
  else if (health.status === "warning")
    alerts.push({
      id: "backup-health-warn",
      area: "backup",
      level: "atencao",
      title: "Saúde dos dados locais: atenção",
      description: firstMsg || "Alguns módulos sem dados.",
      action: "Confira os módulos no Backup Geral.",
      to: "/backup-geral",
      ctaLabel: "Abrir Backup Geral",
    });
  return backupAt;
}

function checkFinanceiro(alerts: DiagnosticAlert[]) {
  const entries = listFinanceEntries();
  const goals = listFinanceGoals();
  const semValor = entries.filter((e) => !e.amount_received || e.amount_received <= 0).length;
  const semTipo = entries.filter((e) => !e.type).length;
  const semData = entries.filter((e) => !e.date).length;
  if (semValor)
    alerts.push({
      id: "fin-sem-valor",
      area: "financeiro",
      level: "atencao",
      title: `${semValor} entrada(s) financeira(s) sem valor`,
      description: "Entradas sem valor distorcem o relatório.",
      action: "Revise no Financeiro.",
      to: "/financeiro",
      ctaLabel: "Abrir Financeiro",
    });
  if (semTipo)
    alerts.push({
      id: "fin-sem-tipo",
      area: "financeiro",
      level: "atencao",
      title: `${semTipo} entrada(s) sem tipo`,
      description: "Defina entrada/custo nas movimentações.",
      action: "Revise no Financeiro.",
      to: "/financeiro",
      ctaLabel: "Abrir Financeiro",
    });
  if (semData)
    alerts.push({
      id: "fin-sem-data",
      area: "financeiro",
      level: "atencao",
      title: `${semData} entrada(s) sem data`,
      description: "Entradas sem data ficam fora dos relatórios mensais.",
      action: "Revise no Financeiro.",
      to: "/financeiro",
      ctaLabel: "Abrir Financeiro",
    });

  // lucro mês
  const summary = calculateFinanceSummary(filterEntriesByMonth(entries, new Date()));
  if (summary.net_profit < 0)
    alerts.push({
      id: "fin-lucro-negativo",
      area: "financeiro",
      level: "atencao",
      title: "Lucro líquido do mês negativo",
      description: "Os custos estão acima das receitas no mês corrente.",
      action: "Revise custos e cobranças.",
      to: "/financeiro",
      ctaLabel: "Abrir Financeiro",
    });

  const semAlvo = goals.filter((g) => !g.target || g.target <= 0).length;
  if (semAlvo)
    alerts.push({
      id: "fin-goals-sem-alvo",
      area: "financeiro",
      level: "atencao",
      title: `${semAlvo} objetivo(s) sem valor alvo`,
      description: "Objetivos precisam de valor alvo para acompanhamento.",
      action: "Defina o alvo no Financeiro.",
      to: "/financeiro",
      ctaLabel: "Abrir Financeiro",
    });
  const hoje = todayIso();
  const venc = goals.filter(
    (g) => g.status !== "concluido" && g.deadline && g.deadline < hoje,
  ).length;
  if (venc)
    alerts.push({
      id: "fin-goals-vencidos",
      area: "financeiro",
      level: "atencao",
      title: `${venc} objetivo(s) com prazo vencido`,
      description: "Prazo passou e o objetivo segue ativo.",
      action: "Atualize ou conclua o objetivo.",
      to: "/financeiro",
      ctaLabel: "Abrir Financeiro",
    });
}

function checkTestesIndicacoes(alerts: DiagnosticAlert[]) {
  const leads = listTrialLeads();
  const semWa = leads.filter((l) => !l.whatsapp).length;
  if (semWa)
    alerts.push({
      id: "leads-sem-wa",
      area: "testes",
      level: "atencao",
      title: `${semWa} lead(s) sem WhatsApp`,
      description: "Sem WhatsApp não é possível enviar acompanhamentos.",
      action: "Atualize o contato em Testes.",
      to: "/testes",
      ctaLabel: "Abrir Testes",
    });
  const hoje = todayIso();
  let testesVencidos = 0;
  let quentesSemAcao = 0;
  for (const l of leads) {
    const ativo = l.status === "Em teste" || l.status === "Teste enviado" || l.status === "Aguardando resposta" || l.status === "Novo contato";
    if (!ativo) continue;
    const fim = l.data_fim;
    if (fim && fim.slice(0, 10) < hoje) {
      const fs = listFollowUps(l.id);
      if (!fs.some((f) => f.status === "Resolvido" || f.status === "Copiado"))
        testesVencidos++;
    }
    if (l.interesse === "Quente" && !l.proxima_acao) quentesSemAcao++;
  }
  if (testesVencidos)
    alerts.push({
      id: "leads-vencidos",
      area: "testes",
      level: "critico",
      title: `${testesVencidos} teste(s) vencidos sem acompanhamento`,
      description: "Testes terminaram e não houve follow-up resolvido.",
      action: "Abra Testes e copie um acompanhamento.",
      to: "/testes",
      ctaLabel: "Abrir Testes",
    });
  if (quentesSemAcao)
    alerts.push({
      id: "leads-quentes",
      area: "testes",
      level: "atencao",
      title: `${quentesSemAcao} lead(s) quente(s) sem próxima ação`,
      description: "Leads marcados como quente não têm ação agendada.",
      action: "Defina a próxima ação em Testes.",
      to: "/testes",
      ctaLabel: "Abrir Testes",
    });

  const refs = listReferrals();
  const semIndicador = refs.filter((r) => !r.indicador_nome && !r.indicador_cliente_id).length;
  const bonifPend = refs.filter((r) => r.status === "Bonificação pendente").length;
  if (semIndicador)
    alerts.push({
      id: "ref-sem-indicador",
      area: "indicacoes",
      level: "atencao",
      title: `${semIndicador} indicação(ões) sem indicador`,
      description: "Indicação precisa do nome de quem indicou.",
      action: "Atualize em Indicações.",
      to: "/indicacoes",
      ctaLabel: "Abrir Indicações",
    });
  if (bonifPend)
    alerts.push({
      id: "ref-bonif-pendente",
      area: "indicacoes",
      level: "atencao",
      title: `${bonifPend} bonificação(ões) pendente(s)`,
      description: "Há bonificações a aplicar.",
      action: "Revise em Indicações.",
      to: "/indicacoes",
      ctaLabel: "Abrir Indicações",
    });
}

function checkOperacao(alerts: DiagnosticAlert[]) {
  const all = listAllScreens();
  const hoje = todayIso();
  let venceHoje = 0;
  let venc30 = 0;
  let venc60 = 0;
  for (const screens of Object.values(all)) {
    for (const s of screens as AppScreen[]) {
      if (s.status === "arquivada" || !s.due_date) continue;
      const d = daysBetween(s.due_date, hoje);
      if (d === 0) venceHoje++;
      if (d <= -60) venc60++;
      else if (d <= -30) venc30++;
    }
  }
  if (venceHoje)
    alerts.push({
      id: "op-hoje",
      area: "operacao",
      level: "atencao",
      title: `${venceHoje} cliente(s) vencem hoje`,
      description: "Atenção à operação do dia.",
      action: "Abra Operação do dia.",
      to: "/operacao-dia",
      ctaLabel: "Abrir Operação",
    });
  if (venc30)
    alerts.push({
      id: "op-30",
      area: "operacao",
      level: "atencao",
      title: `${venc30} cliente(s) com 30+ dias de atraso`,
      description: "Considere campanha de recuperação.",
      action: "Abra Pendências.",
      to: "/pendencias",
      ctaLabel: "Abrir Pendências",
    });
  if (venc60)
    alerts.push({
      id: "op-60",
      area: "operacao",
      level: "critico",
      title: `${venc60} cliente(s) com 60+ dias de atraso`,
      description: "Risco alto de churn definitivo.",
      action: "Revise em Pendências.",
      to: "/pendencias",
      ctaLabel: "Abrir Pendências",
    });

  const sched = getImportScheduleSummary();
  if (sched && sched.pending > 0)
    alerts.push({
      id: "op-agenda",
      area: "operacao",
      level: "atencao",
      title: `${sched.pending} item(ns) pendentes na agenda da importação`,
      description: "Há disparos planejados ainda não tratados.",
      action: "Abra a Agenda da importação.",
      to: "/importar-clientes",
      ctaLabel: "Abrir Importação",
    });
}

import { listCompanies, getCurrentCompanyId } from "@/lib/companies";
import { getCompanyScopeSummary } from "@/lib/company-scope";

function checkMultiTenant(alerts: DiagnosticAlert[]) {
  const companies = listCompanies();
  const summary = getCompanyScopeSummary();
  if (companies.length === 0) {
    alerts.push({
      id: "mt-no-companies",
      area: "dados",
      level: "atencao",
      title: "Nenhuma empresa cadastrada",
      description: "O sistema simula multi-tenant, mas não há empresas locais.",
      action: "Cadastre em /empresas.",
      to: "/empresas",
      ctaLabel: "Abrir Empresas",
    });
  }
  for (const c of companies) {
    if (!c.dono_email) {
      alerts.push({
        id: `mt-no-owner-${c.id}`,
        area: "dados",
        level: "atencao",
        title: `Empresa "${c.nome}" sem dono`,
        description: "Vincule um dono à empresa.",
        to: "/empresas",
        ctaLabel: "Abrir Empresas",
      });
    }
  }
  if (summary.modulosComPendencia > 0) {
    alerts.push({
      id: "mt-unscoped",
      area: "dados",
      level: "atencao",
      title: `${summary.totalSemEmpresa} registro(s) sem empresa`,
      description: "Existem dados locais sem company_id em módulos não-globais.",
      action: "Use Migração Empresa para vincular.",
      to: "/migracao-empresa",
      ctaLabel: "Abrir Migração",
    });
    // alertas por módulo principal
    const moduleAreaMap: Record<string, { area: DiagnosticArea; label: string; to: string }> = {
      cobranca_ia_app_screens_v1: { area: "clientes", label: "Clientes/Telas", to: "/clientes" },
      cobranca_ia_finance_entries_v1: { area: "financeiro", label: "Financeiro", to: "/financeiro" },
      cobranca_ia_finance_goals_v1: { area: "financeiro", label: "Objetivos financeiros", to: "/financeiro" },
      cobranca_ia_trial_leads_v1: { area: "testes", label: "Testes/Leads", to: "/testes" },
      cobranca_ia_referrals_v1: { area: "indicacoes", label: "Indicações", to: "/indicacoes" },
      cobranca_ia_manual_renewal_history_v1: { area: "clientes", label: "Histórico de renovações", to: "/clientes" },
      cobranca_ia_import_schedule_items_v1: { area: "operacao", label: "Agenda da importação", to: "/importar-clientes" },
      cobranca_ia_quick_support_history_v1: { area: "clientes", label: "Atendimento rápido", to: "/clientes" },
      cobranca_ia_campaign_copied_v1: { area: "operacao", label: "Campanhas copiadas", to: "/campanhas-manuais" },
      cobranca_ia_pending_resolved_v1: { area: "operacao", label: "Pendências resolvidas", to: "/pendencias" },
    };
    for (const p of summary.preview) {
      const map = moduleAreaMap[p.key];
      if (!map || p.sem_empresa === 0) continue;
      alerts.push({
        id: `mt-unscoped-${p.key}`,
        area: map.area,
        level: "atencao",
        title: `${p.sem_empresa} ${map.label} sem company_id`,
        description: "Registros antigos não estão vinculados a uma empresa.",
        to: "/migracao-empresa",
        ctaLabel: "Migrar agora",
      });
    }
  }
  if (!getCurrentCompanyId() && companies.length > 0) {
    alerts.push({
      id: "mt-no-current",
      area: "dados",
      level: "atencao",
      title: "Super Admin sem empresa ativa",
      description: "Visualização global. Selecione uma empresa em /empresas para escopo local.",
      to: "/empresas",
      ctaLabel: "Abrir Empresas",
    });
  }
  alerts.push({
    id: "mt-rls-pending",
    area: "dados",
    level: "atencao",
    title: "Isolamento real pendente",
    description: "Multi-tenant local é apenas protótipo. Real exige Supabase + RLS + policies.",
    to: "/preparacao-backend",
    ctaLabel: "Preparar backend",
  });
}

// ---------- API pública ----------


export function runSystemDiagnostics(): DiagnosticsReport {
  const alerts: DiagnosticAlert[] = [];
  checkDados(alerts);
  checkClientesTelas(alerts);
  checkServidoresEDns(alerts);
  checkSeguranca(alerts);
  const backupAt = checkBackup(alerts);
  checkFinanceiro(alerts);
  checkTestesIndicacoes(alerts);
  checkOperacao(alerts);
  checkMultiTenant(alerts);

  const sec = getLocalSecuritySettings();
  const rev = getRevendaSettings();
  const servers = listServers();
  const routes = listDnsRoutes();
  const domains = listDomains();
  const all = listAllScreens();
  const clientes = Object.keys(all).length;
  const screens = Object.values(all).reduce((acc, s) => acc + (s as AppScreen[]).length, 0);

  const checklist: ChecklistItem[] = [
    {
      id: "ck-backup",
      label: "Backup Geral exportado recentemente",
      status: backupAt
        ? Math.floor((Date.now() - new Date(backupAt).getTime()) / 86400000) <= 14
          ? "ok"
          : "atencao"
        : "pendente",
    },
    {
      id: "ck-sec",
      label: "Segurança Local configurada (PIN)",
      status: sec.enabled && sec.pin_hash ? "ok" : "pendente",
    },
    {
      id: "ck-revenda",
      label: "Minha Revenda preenchida",
      status: rev.dados?.nome_revenda ? "ok" : "pendente",
    },
    {
      id: "ck-servers",
      label: "Servidores cadastrados",
      status: servers.length ? "ok" : "pendente",
    },
    {
      id: "ck-dns",
      label: "DNS/Rotas organizadas",
      status: domains.length && routes.length ? "ok" : "pendente",
    },
    {
      id: "ck-clientes",
      label: "Clientes com app/tela cadastrados",
      status: screens ? "ok" : "pendente",
    },
    {
      id: "ck-fin",
      label: "Financeiro configurado",
      status: listFinanceEntries().length ? "ok" : "pendente",
    },
    {
      id: "ck-test",
      label: "Testes e indicações funcionando",
      status: listTrialLeads().length || listReferrals().length ? "ok" : "pendente",
    },
    { id: "ck-no-real", label: "Nada real ativado (WhatsApp/IA/Pagamento/DNS)", status: "ok" },
    { id: "ck-no-backend", label: "Sem Supabase/backend nesta etapa", status: "ok" },
  ];

  const totals = {
    ok: 0,
    atencao: alerts.filter((a) => a.level === "atencao").length,
    critico: alerts.filter((a) => a.level === "critico").length,
    modulos_com_dados: getModuleSummaries().filter((m) => m.present && (m.count ?? 0) > 0).length,
  };
  const overall: DiagnosticLevel =
    totals.critico > 0 ? "critico" : totals.atencao > 0 ? "atencao" : "ok";

  const recommendations: string[] = [];
  if (!backupAt) recommendations.push("Fazer Backup Geral agora.");
  if (!sec.enabled || !sec.pin_hash) recommendations.push("Configurar PIN local em Segurança.");
  if (servers.length && routes.length === 0)
    recommendations.push("Cadastrar pelo menos uma rota principal em DNS e Rotas.");
  if (!rev.dados?.nome_revenda) recommendations.push("Completar dados em Minha Revenda.");
  if (alerts.some((a) => a.id === "screens-sem-servidor"))
    recommendations.push("Revisar telas sem servidor vinculado.");
  if (alerts.some((a) => a.id === "apps-pago-vencido"))
    recommendations.push("Renovar apps pagos vencidos.");
  if (alerts.some((a) => a.id === "leads-sem-wa"))
    recommendations.push("Atualizar leads sem WhatsApp.");
  recommendations.push("Exportar relatório de diagnóstico antes de mexer em algo grande.");

  return {
    generated_at: new Date().toISOString(),
    totals,
    alerts,
    checklist,
    recommendations,
    overall,
    stats: {
      clientes,
      screens,
      servidores: servers.length,
      rotas: routes.length,
      dominios: domains.length,
      backupAt,
    },
  };
}

export function getDiagnosticsSummary() {
  const r = runSystemDiagnostics();
  return {
    overall: r.overall,
    critico: r.totals.critico,
    atencao: r.totals.atencao,
    modulos: r.totals.modulos_com_dados,
    generated_at: r.generated_at,
  };
}

export function exportDiagnosticsTxt(): void {
  const r = runSystemDiagnostics();
  const lines: string[] = [];
  const date = new Date();
  const ymd = date.toISOString().slice(0, 10);
  lines.push("Cobrança IA — Diagnóstico do sistema local");
  lines.push(`Gerado em: ${date.toLocaleString("pt-BR")}`);
  lines.push("");
  lines.push("RESUMO GERAL");
  lines.push(`Status geral: ${r.overall.toUpperCase()}`);
  lines.push(`Alertas críticos: ${r.totals.critico}`);
  lines.push(`Itens de atenção: ${r.totals.atencao}`);
  lines.push(`Módulos com dados: ${r.totals.modulos_com_dados}`);
  lines.push(
    `Clientes: ${r.stats.clientes} | Telas: ${r.stats.screens} | Servidores: ${r.stats.servidores} | Rotas: ${r.stats.rotas} | Domínios: ${r.stats.dominios}`,
  );
  lines.push(`Último backup: ${r.stats.backupAt ? new Date(r.stats.backupAt).toLocaleString("pt-BR") : "nunca"}`);
  lines.push("");
  lines.push("ALERTAS POR ÁREA");
  const byArea = new Map<DiagnosticArea, DiagnosticAlert[]>();
  for (const a of r.alerts) {
    const arr = byArea.get(a.area) || [];
    arr.push(a);
    byArea.set(a.area, arr);
  }
  if (!r.alerts.length) lines.push("Nenhum alerta detectado.");
  for (const [area, items] of byArea.entries()) {
    lines.push("");
    lines.push(`# ${AREA_LABEL[area]}`);
    for (const a of items) {
      lines.push(`- [${a.level.toUpperCase()}] ${a.title}`);
      lines.push(`  ${a.description}`);
      if (a.action) lines.push(`  Ação: ${a.action}`);
    }
  }
  lines.push("");
  lines.push("CHECKLIST DE PRONTIDÃO");
  for (const c of r.checklist) {
    lines.push(`- [${c.status.toUpperCase()}] ${c.label}`);
  }
  lines.push("");
  lines.push("AÇÕES RECOMENDADAS");
  for (const x of r.recommendations) lines.push(`- ${x}`);
  lines.push("");
  lines.push("Observação: Nada real foi ativado. Nenhuma API externa foi chamada. Nenhum dado foi alterado.");

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `diagnostico-cobranca-ia-${ymd}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
