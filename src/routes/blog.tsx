import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell, PublicCTA } from "@/components/landing/PublicShell";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/blog")({
  component: BlogPage,
  head: () => ({
    meta: [
      { title: "Blog CobraEasy — Dicas de cobrança, WhatsApp e IA para revendas" },
      {
        name: "description",
        content:
          "Conteúdos sobre cobrança automática, WhatsApp, IA atendente, Mercado Pago e gestão de revendas. Aprenda a vender e cobrar melhor.",
      },
      { property: "og:title", content: "Blog CobraEasy" },
      {
        property: "og:description",
        content:
          "Dicas práticas de cobrança, WhatsApp, IA e gestão de revendas.",
      },
      { property: "og:url", content: "https://cobraeasy.com.br/blog" },
    ],
    links: [{ rel: "canonical", href: "https://cobraeasy.com.br/blog" }],
  }),
});

const POSTS = [
  {
    title: "Como reduzir a inadimplência em 30 dias com cobrança automática",
    excerpt:
      "Um passo a passo prático para configurar lembretes no WhatsApp e Pix automático com Mercado Pago.",
    tag: "Cobrança",
  },
  {
    title: "IA atendente: como treinar para vender e renovar mais",
    excerpt:
      "Boas práticas para treinar a IA com a sua base e deixar ela fechando renovações 24h.",
    tag: "IA",
  },
  {
    title: "WhatsApp para revendas: como cobrar sem ser bloqueado",
    excerpt:
      "Dicas para usar seu número com segurança, mensagens personalizadas e disparos saudáveis.",
    tag: "WhatsApp",
  },
  {
    title: "Mercado Pago: Pix automático e split de comissão",
    excerpt:
      "Como conectar sua conta, gerar Pix automático e usar o split para indicações.",
    tag: "Pagamentos",
  },
  {
    title: "Migração de planilha para o CobraEasy em 1 dia",
    excerpt:
      "Roteiro de importação para sair do Excel e operar tudo em um painel só.",
    tag: "Gestão",
  },
  {
    title: "Indicações: como crescer com seus próprios clientes",
    excerpt:
      "Configure um programa de indicação simples e ganhe novos clientes todo mês.",
    tag: "Crescimento",
  },
];

function BlogPage() {
  return (
    <PublicShell>
      <section className="bg-surface-muted py-16 md:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center md:px-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            Blog
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            Conteúdos para você cobrar e vender melhor
          </h1>
          <p className="mt-3 text-base text-muted-foreground md:text-lg">
            Dicas práticas sobre cobrança automática, WhatsApp, IA atendente e gestão de
            revendas.
          </p>
        </div>
      </section>

      <section className="bg-background py-16">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 md:grid-cols-2 md:px-6 lg:grid-cols-3">
          {POSTS.map((p) => (
            <article
              key={p.title}
              className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-pop"
            >
              <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
                {p.tag}
              </div>
              <h2 className="mt-2 text-lg font-bold leading-snug text-foreground">
                {p.title}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {p.excerpt}
              </p>
              <Link
                to="/login"
                search={{ mode: "signup" }}
                className="mt-4 inline-flex items-center text-sm font-semibold text-primary hover:underline"
              >
                Comece grátis para ver na prática
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl px-4 text-center text-xs text-muted-foreground">
          Em breve mais artigos. Quer ser avisado? Crie sua conta gratuita.
        </p>
      </section>

      <PublicCTA />
    </PublicShell>
  );
}
