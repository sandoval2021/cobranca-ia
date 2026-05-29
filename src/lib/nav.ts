import {
  LayoutDashboard,
  Building2,
  Users,
  Receipt,
  MessageCircle,
  Sparkles,
  Settings,
  Activity,
  Upload,
  ListChecks,
  BarChart3,
  CalendarClock,
  Megaphone,
  AlertCircle,
  BookOpen,
  SlidersHorizontal,
  Server,
  Beaker,
  Gift,
  Wallet,
  HardDrive,
  Store,
  ShieldCheck,
  Network,
  RefreshCcw,
  Database,
  Wand2,
  LifeBuoy,
  Tv,
  UserCog,
  Send,
  Smartphone,
  Bot,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  hint?: string;
  superAdminOnly?: boolean;
};

export const ownerNav: NavItem[] = [
  { to: "/", label: "Início", icon: LayoutDashboard, hint: "Visão geral do ambiente" },
  { to: "/configuracao-inicial", label: "Configuração Inicial", icon: Wand2, hint: "Configure os passos essenciais antes de usar o sistema", superAdminOnly: true },
  { to: "/empresas", label: "Contas de donos", icon: Building2, hint: "Gestão SaaS de contas (super admin)", superAdminOnly: true },
  { to: "/meus-dados", label: "Meus dados", icon: UserCog, hint: "Dados da sua conta — editáveis a qualquer momento" },
  { to: "/minha-assinatura", label: "Minha assinatura", icon: Wallet, hint: "Plano CobraEasy, uso de IA e pacotes extras" },
  { to: "/saas-planos", label: "Planos SaaS", icon: Sparkles, hint: "Catálogo de planos vendidos (super admin)", superAdminOnly: true },
  { to: "/clientes", label: "Clientes", icon: Users, hint: "Sua base de clientes" },
  { to: "/cadastros-servicos", label: "Cadastros · Serviços", icon: Tv, hint: "Cadastre seus planos/valores (ex.: 1 tela R$ 12)" },
  { to: "/gestao-servicos", label: "Gestão Serviços", icon: Tv, hint: "Renove, edite e acompanhe cada serviço" },
  { to: "/operacao-dia", label: "Operação do dia", icon: CalendarClock, hint: "Quem precisa de atenção hoje" },
  { to: "/operacao-filas", label: "Operação · Filas", icon: ListChecks, hint: "Mensagens e renovações em fila, falhas e reprocessamento", superAdminOnly: true },
  { to: "/renovacoes-paineis", label: "Renovações e painéis", icon: RefreshCcw, hint: "Fila de renovações IPTV e credenciais dos painéis" },
  { to: "/apps-portal", label: "Aplicativos pagos", icon: Smartphone, hint: "Cadastre os aplicativos pagos que seus clientes usam (Bob, IBO, Vu, etc.)" },
  { to: "/campanhas-manuais", label: "Campanhas manuais", icon: Megaphone, hint: "Monte listas e copie mensagens" },
  { to: "/pendencias", label: "Pendências", icon: AlertCircle, hint: "Tudo que precisa de atenção" },
  { to: "/importar-clientes", label: "Importar clientes", icon: Upload, hint: "Importar clientes a partir de PDF/Excel" },
  
  { to: "/cobrancas", label: "Cobranças", icon: Receipt, hint: "Cobranças geradas", superAdminOnly: true },
  { to: "/pagamentos/mercado-pago", label: "Pagamentos · Mercado Pago", icon: Wallet, hint: "Conecte sua conta e receba via Pix/cartão" },
  { to: "/pagamentos/historico", label: "Histórico de pagamentos", icon: Receipt, hint: "Cobranças online geradas e seus status" },
  { to: "/admin/marketplace", label: "Marketplace (Admin)", icon: Store, hint: "Visão consolidada do marketplace MP", superAdminOnly: true },
  { to: "/mensagens", label: "Mensagens", icon: MessageCircle, hint: "Mensagens enviadas", superAdminOnly: true },
  { to: "/ia", label: "IA Cobrança", icon: Sparkles, hint: "Mensagens geradas pela IA", superAdminOnly: true },
  { to: "/fila-simulada", label: "Fila simulada", icon: ListChecks, hint: "Cobranças planejadas antes de envio", superAdminOnly: true },
  { to: "/relatorio", label: "Relatório", icon: BarChart3, hint: "Relatório da simulação", superAdminOnly: true },
  { to: "/base-conhecimento", label: "Base da IA", icon: BookOpen, hint: "Respostas e regras para o atendimento", superAdminOnly: true },
  { to: "/ia-config", label: "Configurar IA", icon: Bot, hint: "Tabelas de preço, indicação, apps e instruções da IA" },
  { to: "/treinar-ia", label: "Treinar IA", icon: Sparkles, hint: "Ensine sua IA com conhecimento, FAQs, regras e apps da empresa" },
  { to: "/catalogo-servidores", label: "Meus servidores", icon: Server, hint: "Cadastre os servidores que você usa para vincular aos clientes" },
  { to: "/testes", label: "Testes", icon: Beaker, hint: "Pessoas em teste/leads" },
  { to: "/indicacoes", label: "Indicações", icon: Gift, hint: "Indicações e bonificações" },
  { to: "/financeiro", label: "Financeiro", icon: Wallet, hint: "Receitas, custos, lucro e objetivos" },
  { to: "/regras-disparo", label: "Regras de disparo", icon: SlidersHorizontal, hint: "Quando sugerir mensagens manuais", superAdminOnly: true },
  { to: "/backup-geral", label: "Backup Geral", icon: HardDrive, hint: "Exportar/importar backup local de tudo", superAdminOnly: true },
  { to: "/configuracoes-revenda", label: "Minha Revenda", icon: Store, hint: "Dados, planos e regras da sua revenda" },
  { to: "/seguranca-local", label: "Segurança", icon: ShieldCheck, hint: "PIN e modo protegido (apenas neste navegador)", superAdminOnly: true },
  { to: "/admin-dns-rotas", label: "DNS e Rotas", icon: Network, hint: "Super Admin: domínios, subdomínios e rotas dos servidores", superAdminOnly: true },
  { to: "/configuracoes", label: "Configurações", icon: Settings, hint: "Ajustes do ambiente", superAdminOnly: true },
  { to: "/whatsapp", label: "WhatsApp", icon: Smartphone, hint: "Conecte sua instância do WhatsApp" },
  { to: "/diagnostico", label: "Diagnóstico", icon: Activity, hint: "Saúde dos dados, segurança, rotas, financeiro e operação local", superAdminOnly: true },
  { to: "/preparacao-backend", label: "Preparação Backend", icon: Database, hint: "Mapeie dados locais e prepare a futura migração segura para banco de dados", superAdminOnly: true },
  { to: "/migracao-empresa", label: "Migração Empresa", icon: Database, hint: "Vincule dados locais antigos a uma empresa", superAdminOnly: true },
  { to: "/ajuda-ia", label: "Ajuda com IA", icon: Sparkles, hint: "Tire dúvidas sobre o CobraEasy com IA" },
  { to: "/ajuda", label: "Ajuda", icon: LifeBuoy, hint: "Aprenda como usar cada parte do sistema" },
];

// Bottom nav do Dono — 5 atalhos principais + botão "Mais" (renderizado pelo MobileBottomNav).
export const ownerBottomNav: NavItem[] = [
  { to: "/", label: "Início", icon: LayoutDashboard },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/testes", label: "Testes", icon: Beaker },
  { to: "/cadastros-servicos", label: "Serviços", icon: Tv },
  { to: "/operacao-dia", label: "Cobranças", icon: Receipt },
];

// Itens que aparecem dentro do drawer "Mais" do bottom nav.
// Concentra TODAS as funções extras antes acessadas pelo menu lateral
// no mobile (que foi removido do header). Cada item tem um `hint` curto que
// é mostrado como descrição. Filtro por papel e por módulo do plano é
// aplicado no componente que renderiza a sheet.
export const ownerMoreNav: NavItem[] = [
  // Conta e revenda
  { to: "/meus-dados", label: "Minha conta", icon: UserCog, hint: "Seus dados pessoais e contato" },
  { to: "/minha-assinatura", label: "Minha assinatura", icon: Wallet, hint: "Plano, uso de IA e pacotes" },
  { to: "/configuracoes-revenda", label: "Minha revenda", icon: Store, hint: "Dados e regras da sua revenda" },

  // Operação do dia a dia
  { to: "/operacao-dia", label: "Operação do dia", icon: CalendarClock, hint: "Quem precisa de atenção hoje" },
  { to: "/pendencias", label: "Pendências", icon: AlertCircle, hint: "Tudo que precisa de atenção" },
  { to: "/gestao-servicos", label: "Gestão de serviços", icon: Tv, hint: "Renove, edite e acompanhe serviços" },
  { to: "/renovacoes-paineis", label: "Renovações de painéis", icon: RefreshCcw, hint: "Fila de renovações IPTV" },
  { to: "/apps-portal", label: "Aplicativos pagos", icon: Smartphone, hint: "Apps que seus clientes usam" },

  // Comunicação
  { to: "/whatsapp", label: "WhatsApp", icon: Smartphone, hint: "Conecte seu WhatsApp" },
  { to: "/campanhas-manuais", label: "Mensagens", icon: MessageCircle, hint: "Monte listas e copie mensagens" },
  { to: "/agenda-disparo", label: "Agenda de disparo", icon: Send, hint: "Programe envios automáticos" },
  { to: "/templates-automaticos", label: "Templates automáticos", icon: MessageCircle, hint: "Cobrança, renovação, apps e testes — tudo em um só lugar" },

  // IA
  { to: "/ia-config", label: "Configurar IA", icon: Bot, hint: "Preços, indicação e instruções da IA" },
  { to: "/treinar-ia", label: "Treinar IA", icon: Sparkles, hint: "Ensine sua IA com conhecimento e regras" },
  { to: "/ajuda-ia", label: "Ajuda com IA", icon: Sparkles, hint: "Tire dúvidas com a IA" },

  // Dados e dinheiro
  { to: "/importar-clientes", label: "Importar clientes", icon: Upload, hint: "Importar de PDF ou planilha" },
  { to: "/catalogo-servidores", label: "Meus servidores", icon: Server, hint: "Servidores vinculados aos clientes" },
  { to: "/financeiro", label: "Financeiro", icon: Wallet, hint: "Receitas, custos e lucro" },
  { to: "/indicacoes", label: "Indicações", icon: Gift, hint: "Indicações e bonificações" },
  { to: "/pagamentos/mercado-pago", label: "Pagamentos", icon: Wallet, hint: "Receba via Pix ou cartão" },
  { to: "/pagamentos/historico", label: "Histórico de pagamentos", icon: Receipt, hint: "Cobranças online e status" },

  // Sistema
  { to: "/backup", label: "Backup", icon: HardDrive, hint: "Cópia de segurança dos seus dados" },
  { to: "/ajuda", label: "Ajuda", icon: LifeBuoy, hint: "Aprenda como usar cada parte" },

  // Apenas super admin
  { to: "/configuracao-inicial", label: "Configuração inicial", icon: Wand2, hint: "Passos essenciais do sistema", superAdminOnly: true },
  { to: "/empresas", label: "Contas de donos", icon: Building2, hint: "Gestão de contas", superAdminOnly: true },
  { to: "/saas-planos", label: "Planos SaaS", icon: Sparkles, hint: "Catálogo de planos", superAdminOnly: true },
  { to: "/admin/marketplace", label: "Marketplace", icon: Store, hint: "Visão do marketplace", superAdminOnly: true },
  { to: "/regras-disparo", label: "Regras de disparo", icon: SlidersHorizontal, hint: "Quando enviar mensagens", superAdminOnly: true },
  { to: "/base-conhecimento", label: "Base da IA", icon: BookOpen, hint: "Respostas e regras", superAdminOnly: true },
  { to: "/fila-simulada", label: "Fila simulada", icon: ListChecks, hint: "Cobranças planejadas", superAdminOnly: true },
  { to: "/relatorio", label: "Relatório", icon: BarChart3, hint: "Relatório da simulação", superAdminOnly: true },
  { to: "/backup-geral", label: "Backup geral", icon: HardDrive, hint: "Exportar/importar tudo", superAdminOnly: true },
  { to: "/seguranca-local", label: "Segurança", icon: ShieldCheck, hint: "PIN e modo protegido", superAdminOnly: true },
  { to: "/admin-dns-rotas", label: "DNS e rotas", icon: Network, hint: "Domínios e rotas", superAdminOnly: true },
  { to: "/configuracoes", label: "Configurações", icon: Settings, hint: "Ajustes do ambiente", superAdminOnly: true },
  { to: "/diagnostico", label: "Diagnóstico", icon: Activity, hint: "Saúde do sistema", superAdminOnly: true },
  { to: "/preparacao-backend", label: "Preparação backend", icon: Database, hint: "Preparar migração", superAdminOnly: true },
  { to: "/migracao-empresa", label: "Migração empresa", icon: Database, hint: "Vincular dados antigos", superAdminOnly: true },
];



export const adminNav: NavItem[] = ownerNav;

export function filterNavByRole(items: NavItem[], role: "super_admin" | "owner"): NavItem[] {
  if (role === "super_admin") return items;
  return items.filter((i) => !i.superAdminOnly);
}
