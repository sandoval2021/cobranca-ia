import { createFileRoute } from "@tanstack/react-router";
import { PublicShell, PublicCTA } from "@/components/landing/PublicShell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/faq")({
  component: FaqPage,
  head: () => ({
    meta: [
      { title: "FAQ — Perguntas frequentes sobre o CobraEasy" },
      {
        name: "description",
        content:
          "Tire suas dúvidas sobre o CobraEasy: WhatsApp, IA atendente, Mercado Pago, planos, segurança e teste grátis.",
      },
      { property: "og:title", content: "FAQ CobraEasy" },
      {
        property: "og:description",
        content:
          "Perguntas frequentes sobre o CobraEasy: planos, WhatsApp, IA e pagamentos.",
      },
      { property: "og:url", content: "https://cobraeasy.com.br/faq" },
    ],
    links: [{ rel: "canonical", href: "https://cobraeasy.com.br/faq" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
});

const FAQ = [
  {
    q: "Preciso instalar algo?",
    a: "Não. O CobraEasy roda 100% online no navegador, em qualquer dispositivo.",
  },
  {
    q: "Funciona no celular?",
    a: "Sim. A plataforma é otimizada para mobile e pode ser instalada como app (PWA).",
  },
  {
    q: "Posso usar meu próprio WhatsApp?",
    a: "Sim. Você conecta seu número via QR Code, sem API oficial paga.",
  },
  {
    q: "Como funciona o Mercado Pago?",
    a: "Você vincula sua conta Mercado Pago e o sistema gera Pix com confirmação automática.",
  },
  {
    q: "A IA realmente responde meus clientes?",
    a: "Sim. A IA é treinada com sua base e atende no WhatsApp 24h, envia Pix e fecha renovações.",
  },
  {
    q: "Posso treinar minha IA?",
    a: "Sim. Cada empresa tem sua própria base treinável, isolada e segura.",
  },
  {
    q: "Tem teste grátis?",
    a: "Sim. Você tem 5 dias para testar todos os recursos sem precisar de cartão.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim. Não há fidelidade. Você cancela direto no painel a qualquer momento.",
  },
  {
    q: "Meus dados estão seguros?",
    a: "Sim. Cada empresa é isolada, com permissões e opção de backup local exportável.",
  },
];

function FaqPage() {
  return (
    <PublicShell>
      <section className="bg-surface-muted py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-4 md:px-6">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              FAQ
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
              Perguntas frequentes
            </h1>
            <p className="mt-3 text-base text-muted-foreground">
              Tudo o que você precisa saber antes de começar.
            </p>
          </div>

          <Accordion type="single" collapsible className="mt-10 space-y-2">
            {FAQ.map((f, i) => (
              <AccordionItem
                key={f.q}
                value={`item-${i}`}
                className="overflow-hidden rounded-xl border border-border bg-card px-4"
              >
                <AccordionTrigger className="text-left text-base font-semibold">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
      <PublicCTA />
    </PublicShell>
  );
}
