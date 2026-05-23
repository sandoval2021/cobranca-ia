import {
  LayoutDashboard,
  Users,
  CalendarClock,
  Receipt,
  MessageCircle,
  Sparkles,
  CreditCard,
  Server,
  AppWindow,
  BarChart3,
  Building2,
  TrendingUp,
  ListTodo,
  AlertTriangle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  hint?: string;
};

export const ownerNav: NavItem[] = [
  { to: "/", label: "Início", icon: LayoutDashboard, hint: "Visão geral do seu negócio" },
  { to: "/clientes", label: "Clientes", icon: Users, hint: "Sua base de clientes" },
  { to: "/vencimentos", label: "Vencimentos", icon: CalendarClock, hint: "Quem vence em breve" },
  { to: "/cobrancas", label: "Cobranças", icon: Receipt, hint: "Cobranças enviadas e pagas" },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle, hint: "Mensagens automáticas" },
  { to: "/assistente", label: "Assistente", icon: Sparkles, hint: "Ajuda inteligente" },
  { to: "/pagamentos", label: "Pagamentos", icon: CreditCard, hint: "Pagamentos recebidos" },
  { to: "/servidores", label: "Servidores", icon: Server, hint: "Seus servidores cadastrados" },
  { to: "/aplicativos", label: "Aplicativos", icon: AppWindow, hint: "Aplicativos disponíveis" },
  { to: "/resultados", label: "Resultados", icon: BarChart3, hint: "Métricas do negócio" },
];

export const ownerBottomNav: NavItem[] = [
  { to: "/", label: "Início", icon: LayoutDashboard },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/cobrancas", label: "Cobranças", icon: Receipt },
  { to: "/whatsapp", label: "Chat", icon: MessageCircle },
  { to: "/resultados", label: "Métricas", icon: BarChart3 },
];

export const adminNav: NavItem[] = [
  { to: "/admin", label: "Visão geral", icon: LayoutDashboard },
  { to: "/admin/empresas", label: "Empresas", icon: Building2 },
  { to: "/admin/receita", label: "Receita", icon: TrendingUp },
  { to: "/admin/filas", label: "Filas", icon: ListTodo },
  { to: "/admin/falhas", label: "Falhas", icon: AlertTriangle },
];
