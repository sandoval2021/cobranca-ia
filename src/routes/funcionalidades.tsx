import { createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  Users,
  MessageCircle,
  Bot,
  CreditCard,
  BarChart3,
  Gift,
  Zap,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { PublicShell, PublicCTA } from "@/components/landing/PublicShell";

export const Route = createFileRoute("/funcionalidades")({
  component: FuncionalidadesPage,
  head: () => ({
    meta: [
      { title: "Funcionalidades CobraEasy — Tudo para automatizar sua cobrança" },
      {
        name: "description",
        content:
          "Cobrança automática, WhatsApp integrado, IA atendente, Mercado Pago, relatórios financeiros, indicações e mensagens por vencimento — tudo em um só painel.",
      },
      { property: "og:title", content: "Funcionalidades CobraEasy" },
      {
        property: "og:description",
        content:
          "Cobrança automática, WhatsApp, IA, Mercado Pago e relatórios — tudo em um só painel.",
      },
      { property: "og:url", content: "https://cobraeasy.com.br/funcionalidades" },
    ],
    links: [{ rel: "canonical", href: "https://cobraeasy.com.br/funcionalidades" }],
  }),
});

const FEATURES = [
  { i: Bell, t: "Cobrança automática", d: "Lembretes antes, no dia e depois do vencimento, sem você levantar um dedo." },
  { i: Users, t: "Gestão de clientes", d: "Base centralizada com planos, status, vencimentos e histórico completo." },
  { i: MessageCircle, t: "WhatsApp integrado", d: "Conecte seu número via QR Code e dispare em massa ou 1 a 1." },
  { i: Bot, t: "IA atendente", d: "Treine sua IA para responder, tirar dúvidas e fechar renovações 24h." },
  { i: CreditCard, t: "Mercado Pago", d: "Cobre via Pix com confirmação automática e split de comissões." },
  { i: BarChart3, t: "Relatórios financeiros", d: "Faturamento, inadimplência, projeções e margem em tempo real." },
  { i: Gift, t: "Indicações", d: "Programa de indicação pronto para crescer com seus próprios clientes." },
  { i: Zap, t: "Mensagens por vencimento", d: "Modelos prontos por grupo, plano e data — totalmente personalizáveis." },
  { i: ShieldCheck, t: "Multi-empresa seguro", d: "Cada conta isolada, com permissões e backup local opcional." },
  { i: Sparkles, t: "Importação rápida", d: "Importe sua base de planilhas em minutos e comece a operar." },
];

function FuncionalidadesPage() {
  return (
    <PublicShell>
      <section className="bg-background py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              Funcionalidades
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
              Tudo o que você precisa para cobrar melhor
            </h1>
            <p className="mt-3 text-base text-muted-foreground md:text-lg">
              Uma plataforma completa para revendas e equipes pequenas que querem escalar sem
              perder o controle do dia a dia.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.t}
                className="rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-pop"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <f.i className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-base font-bold text-foreground">{f.t}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <PublicCTA />
    </PublicShell>
  );
}
