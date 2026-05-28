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
  { to: "/configuracao-inicial", label: "Configuração Inicial", icon: Wand2, hint: "Configure os passos essenciais antes de usar o sistema" },
  { to: "/empresas", label: "Contas de donos", icon: Building2, hint: "Gestão SaaS de contas (super admin)", superAdminOnly: true },
  { to: "/meus-dados", label: "Meus dados", icon: UserCog, hint: "Dados da sua conta — editáveis a qualquer momento" },
  { to: "/clientes", label: "Clientes", icon: Users, hint: "Sua base de clientes" },
  { to: "/cadastros-servicos", label: "Cadastros · Serviços", icon: Tv, hint: "Cadastre seus planos/valores (ex.: 1 tela R$ 12)" },
  { to: "/gestao-servicos", label: "Gestão Serviços", icon: Tv, hint: "Renove, edite e acompanhe cada serviço" },
  { to: "/operacao-dia", label: "Operação do dia", icon: CalendarClock, hint: "Quem precisa de atenção hoje" },
  { to: "/campanhas-manuais", label: "Campanhas manuais", icon: Megaphone, hint: "Monte listas e copie mensagens" },
  { to: "/pendencias", label: "Pendências", icon: AlertCircle, hint: "Tudo que precisa de atenção" },
  { to: "/importar-clientes", label: "Importar clientes", icon: Upload, hint: "Importar clientes a partir de PDF/Excel" },
  
  { to: "/cobrancas", label: "Cobranças", icon: Receipt, hint: "Cobranças geradas", superAdminOnly: true },
  { to: "/mensagens", label: "Mensagens", icon: MessageCircle, hint: "Mensagens enviadas", superAdminOnly: true },
  { to: "/ia", label: "IA Cobrança", icon: Sparkles, hint: "Mensagens geradas pela IA", superAdminOnly: true },
  { to: "/fila-simulada", label: "Fila simulada", icon: ListChecks, hint: "Cobranças planejadas antes de envio", superAdminOnly: true },
  { to: "/relatorio", label: "Relatório", icon: BarChart3, hint: "Relatório da simulação", superAdminOnly: true },
  { to: "/base-conhecimento", label: "Base da IA", icon: BookOpen, hint: "Respostas e regras para o atendimento", superAdminOnly: true },
  { to: "/ia-config", label: "Configurar IA", icon: Bot, hint: "Tabelas de preço, indicação, apps e instruções da IA" },
  { to: "/catalogo-servidores", label: "Servidores", icon: Server, hint: "Servidores e painéis usados nas telas", superAdminOnly: true },
  { to: "/testes", label: "Testes", icon: Beaker, hint: "Pessoas em teste/leads" },
  { to: "/indicacoes", label: "Indicações", icon: Gift, hint: "Indicações e bonificações" },
  { to: "/financeiro", label: "Financeiro", icon: Wallet, hint: "Receitas, custos, lucro e objetivos" },
  { to: "/regras-disparo", label: "Regras de disparo", icon: SlidersHorizontal, hint: "Quando sugerir mensagens manuais", superAdminOnly: true },
  { to: "/backup-geral", label: "Backup Geral", icon: HardDrive, hint: "Exportar/importar backup local de tudo" },
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

// Itens que aparecem dentro do drawer "Mais" do bottom nav (apenas o que o Dono deve ver).
export const ownerMoreNav: NavItem[] = [
  { to: "/whatsapp", label: "WhatsApp", icon: Smartphone },
  { to: "/importar-clientes", label: "Importar clientes", icon: Upload },
  { to: "/campanhas-manuais", label: "Mensagens", icon: MessageCircle },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/catalogo-servidores", label: "Servidores", icon: Server },
  { to: "/agenda-disparo", label: "Disparo", icon: Send },
  { to: "/testes", label: "Indicações", icon: Gift },
  { to: "/meus-dados", label: "Minha conta", icon: UserCog },
  { to: "/configuracoes-revenda", label: "Minha revenda", icon: Store },
  { to: "/backup", label: "Backup", icon: HardDrive },
  { to: "/ajuda", label: "Ajuda", icon: LifeBuoy },
];



export const adminNav: NavItem[] = ownerNav;

export function filterNavByRole(items: NavItem[], role: "super_admin" | "owner"): NavItem[] {
  if (role === "super_admin") return items;
  return items.filter((i) => !i.superAdminOnly);
}
