import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ShieldCheck, ArrowRight } from "lucide-react";
import { PublicShell, PublicCTA } from "@/components/landing/PublicShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/planos")({
  component: PlanosPublicPage,
  head: () => ({
    meta: [
      { title: "Planos CobraEasy — Cobrança automática a partir de R$ 49,90/mês" },
      {
        name: "description",
        content:
          "Conheça os planos do CobraEasy: Essencial, Profissional e Escala. Cobrança automática no WhatsApp, IA atendente e Mercado Pago. Teste 5 dias grátis.",
      },
      { property: "og:title", content: "Planos CobraEasy — A partir de R$ 49,90/mês" },
      {
        property: "og:description",
        content:
          "Escolha o plano ideal: cobrança automática, WhatsApp, IA e Mercado Pago. 5 dias grátis.",
      },
      { property: "og:url", content: "https://cobraeasy.com.br/planos" },
    ],
    links: [{ rel: "canonical", href: "https://cobraeasy.com.br/planos" }],
  }),
});

const PLANS = [
  {
    name: "Essencial",
    slug: "essencial",
    price: "49,90",
    desc: "Para quem está começando a organizar a cobrança.",
    features: [
      "Até 100 clientes",
      "WhatsApp 1 número",
      "Cobranças automáticas",
      "Relatórios básicos",
      "IA com 2.000 caracteres",
      "Suporte por e-mail",
    ],
    highlight: false,
  },
  {
    name: "Profissional",
    slug: "profissional",
    price: "119,90",
    desc: "Para revendas em crescimento que precisam escalar.",
    features: [
      "Até 1.000 clientes",
      "WhatsApp + Mercado Pago",
      "IA com 20.000 caracteres",
      "Mensagens por vencimento",
      "Relatórios completos",
      "Suporte prioritário",
    ],
    highlight: true,
  },
  {
    name: "Escala",
    slug: "escala",
    price: "249,90",
    desc: "Para equipes e operações de alto volume.",
    features: [
      "Clientes ilimitados",
      "IA com 200.000 caracteres",
      "Mercado Pago + split",
      "Indicações e campanhas",
      "Relatórios avançados",
      "Suporte dedicado",
    ],
    highlight: false,
  },
];

function PlanosPublicPage() {
  return (
    <PublicShell>
      <section className="bg-surface-muted py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              Planos
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
              Planos do CobraEasy
            </h1>
            <p className="mt-3 text-base text-muted-foreground md:text-lg">
              Escolha o plano que combina com o tamanho da sua operação. Comece grátis, cancele
              quando quiser e pague só quando aprovar.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.slug}
                className={`relative flex flex-col rounded-2xl border bg-card p-6 shadow-card transition-all hover:-translate-y-1 ${
                  p.highlight
                    ? "border-primary/40 ring-2 ring-primary/20 shadow-pop"
                    : "border-border"
                }`}
              >
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground shadow">
                    Mais escolhido
                  </div>
                )}
                <div className="text-xs font-bold uppercase tracking-wider text-primary">
                  Plano {p.name}
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-sm font-semibold text-muted-foreground">R$</span>
                  <span className="text-5xl font-bold tracking-tight text-foreground">
                    {p.price.split(",")[0]}
                  </span>
                  <span className="text-lg font-semibold text-foreground">
                    ,{p.price.split(",")[1]}
                  </span>
                  <span className="ml-1 text-sm text-muted-foreground">/mês</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>

                <ul className="mt-5 flex-1 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-foreground">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  size="lg"
                  variant={p.highlight ? "default" : "outline"}
                  className="mt-6 h-12 w-full rounded-xl text-base"
                >
                  <Link to="/login" search={{ mode: "signup", plan: p.slug }}>
                    Começar grátis
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-success" />
            5 dias grátis para testar • cancele quando quiser • sem cartão no cadastro
          </p>
        </div>
      </section>
      <PublicCTA />
    </PublicShell>
  );
}
