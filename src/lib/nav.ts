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



} from "lucide-react";

import type { LucideIcon } from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  hint?: string;
};

export const ownerNav: NavItem[] = [
  { to: "/", label: "Início", icon: LayoutDashboard, hint: "Visão geral do ambiente" },
  { to: "/configuracao-inicial", label: "Configuração Inicial", icon: Wand2, hint: "Configure os passos essenciais antes de usar o sistema" },
  { to: "/empresas", label: "Empresas", icon: Building2, hint: "Empresas cadastradas" },
  { to: "/clientes", label: "Clientes", icon: Users, hint: "Sua base de clientes" },
  { to: "/operacao-dia", label: "Operação do dia", icon: CalendarClock, hint: "Quem precisa de atenção hoje" },
  { to: "/campanhas-manuais", label: "Campanhas manuais", icon: Megaphone, hint: "Monte listas e copie mensagens" },
  { to: "/pendencias", label: "Pendências", icon: AlertCircle, hint: "Tudo que precisa de atenção" },
  { to: "/importar-clientes", label: "Importar clientes", icon: Upload, hint: "Importar clientes a partir de PDF" },
  { to: "/cobrancas", label: "Cobranças", icon: Receipt, hint: "Cobranças geradas" },
  { to: "/mensagens", label: "Mensagens", icon: MessageCircle, hint: "Mensagens enviadas" },
  { to: "/ia", label: "IA Cobrança", icon: Sparkles, hint: "Mensagens geradas pela IA" },
  { to: "/fila-simulada", label: "Fila simulada", icon: ListChecks, hint: "Cobranças planejadas antes de envio" },
  { to: "/relatorio", label: "Relatório", icon: BarChart3, hint: "Relatório da simulação" },
  { to: "/base-conhecimento", label: "Base da IA", icon: BookOpen, hint: "Respostas e regras para o atendimento" },
  { to: "/catalogo-servidores", label: "Servidores", icon: Server, hint: "Servidores e painéis usados nas telas" },
  { to: "/testes", label: "Testes", icon: Beaker, hint: "Pessoas em teste/leads" },
  { to: "/indicacoes", label: "Indicações", icon: Gift, hint: "Indicações e bonificações" },
  { to: "/financeiro", label: "Financeiro", icon: Wallet, hint: "Receitas, custos, lucro e objetivos" },
  { to: "/regras-disparo", label: "Regras de disparo", icon: SlidersHorizontal, hint: "Quando sugerir mensagens manuais" },
  { to: "/backup-geral", label: "Backup Geral", icon: HardDrive, hint: "Exportar/importar backup local de tudo" },
  { to: "/configuracoes-revenda", label: "Minha Revenda", icon: Store, hint: "Dados, planos e regras da sua revenda" },
  { to: "/seguranca-local", label: "Segurança", icon: ShieldCheck, hint: "PIN e modo protegido (apenas neste navegador)" },
  { to: "/admin-dns-rotas", label: "DNS e Rotas", icon: Network, hint: "Super Admin: domínios, subdomínios e rotas dos servidores" },
  { to: "/configuracoes", label: "Configurações", icon: Settings, hint: "Ajustes do ambiente" },
  { to: "/diagnostico", label: "Diagnóstico", icon: Activity, hint: "Saúde dos dados, segurança, rotas, financeiro e operação local" },
  { to: "/preparacao-backend", label: "Preparação Backend", icon: Database, hint: "Mapeie dados locais e prepare a futura migração segura para banco de dados" },
  { to: "/ajuda", label: "Ajuda", icon: LifeBuoy, hint: "Aprenda como usar cada parte do sistema" },



];

export const ownerBottomNav: NavItem[] = [
  { to: "/", label: "Início", icon: LayoutDashboard },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/operacao-dia", label: "Hoje", icon: CalendarClock },
  { to: "/cobrancas", label: "Cobranças", icon: Receipt },
  { to: "/mensagens", label: "Chat", icon: MessageCircle },
];

export const adminNav: NavItem[] = ownerNav;
