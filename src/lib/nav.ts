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
  { to: "/empresas", label: "Empresas", icon: Building2, hint: "Empresas cadastradas" },
  { to: "/clientes", label: "Clientes", icon: Users, hint: "Sua base de clientes" },
  { to: "/operacao-dia", label: "Operação do dia", icon: CalendarClock, hint: "Quem precisa de atenção hoje" },
  { to: "/importar-clientes", label: "Importar clientes", icon: Upload, hint: "Importar clientes a partir de PDF" },
  { to: "/cobrancas", label: "Cobranças", icon: Receipt, hint: "Cobranças geradas" },
  { to: "/mensagens", label: "Mensagens", icon: MessageCircle, hint: "Mensagens enviadas" },
  { to: "/ia", label: "IA Cobrança", icon: Sparkles, hint: "Mensagens geradas pela IA" },
  { to: "/fila-simulada", label: "Fila simulada", icon: ListChecks, hint: "Cobranças planejadas antes de envio" },
  { to: "/relatorio", label: "Relatório", icon: BarChart3, hint: "Relatório da simulação" },
  { to: "/configuracoes", label: "Configurações", icon: Settings, hint: "Ajustes do ambiente" },
  { to: "/diagnostico", label: "Diagnóstico", icon: Activity, hint: "Testes de conexão" },
];

export const ownerBottomNav: NavItem[] = [
  { to: "/", label: "Início", icon: LayoutDashboard },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/operacao-dia", label: "Hoje", icon: CalendarClock },
  { to: "/cobrancas", label: "Cobranças", icon: Receipt },
  { to: "/mensagens", label: "Chat", icon: MessageCircle },
];

export const adminNav: NavItem[] = ownerNav;
