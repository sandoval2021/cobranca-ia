import { createFileRoute } from "@tanstack/react-router";
import { Bot, MessageCircle, Sparkles, Clock, ShieldCheck, Check } from "lucide-react";
import { PublicShell, PublicCTA } from "@/components/landing/PublicShell";

export const Route = createFileRoute("/ia-atendente")({
  component: IaAtendentePage,
  head: () => ({
    meta: [
      { title: "IA Atendente para WhatsApp — Cobre e renove no automático | CobraEasy" },
      {
        name: "description",
        content:
          "IA treinada com a sua base que atende clientes no WhatsApp 24h, envia Pix, fecha renovações e reduz inadimplência. Comece grátis no CobraEasy.",
      },
      { property: "og:title", content: "IA Atendente para WhatsApp — CobraEasy" },
      {
        property: "og:description",
        content:
          "IA que atende, cobra e renova clientes no WhatsApp 24h por dia. Treinável e segura.",
      },
      { property: "og:url", content: "https://cobraeasy.com.br/ia-atendente" },
    ],
    links: [{ rel: "canonical", href: "https://cobraeasy.com.br/ia-atendente" }],
  }),
});

function IaAtendentePage() {
  return (
    <PublicShell>
      <section className="bg-surface-muted py-16 md:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center md:px-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            <Bot className="h-3.5 w-3.5" /> IA Atendente
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            Uma IA que atende, cobra e renova por você
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
            A IA do CobraEasy é treinada com a sua própria base, conversa pelo WhatsApp 24h por
            dia, envia Pix, responde dúvidas e fecha renovações sem você precisar digitar nada.
          </p>
        </div>
      </section>

      <section className="bg-background py-16 md:py-20">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 md:grid-cols-2 md:px-6">
          {[
            {
              i: MessageCircle,
              t: "Atende no WhatsApp 24h",
              d: "Responde clientes na hora, qualquer dia, sem você precisar estar online.",
            },
            {
              i: Sparkles,
              t: "Treinada com sua base",
              d: "Aprende seus planos, preços, regras e tom de voz. Cada empresa tem sua IA.",
            },
            {
              i: Clock,
              t: "Fecha renovações",
              d: "Envia Pix, confirma pagamento e renova o cliente automaticamente.",
            },
            {
              i: ShieldCheck,
              t: "Seguro e isolado",
              d: "Sua base é privada. Conversas e treinamentos não saem da sua conta.",
            },
          ].map((f) => (
            <div
              key={f.t}
              className="rounded-2xl border border-border bg-card p-6 shadow-card"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <f.i className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-foreground">{f.t}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-surface-muted py-16">
        <div className="mx-auto max-w-3xl px-4 md:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            O que a IA faz por você
          </h2>
          <ul className="mt-6 space-y-3">
            {[
              "Responde dúvidas frequentes sobre planos e preços",
              "Envia link de pagamento e confirma o Pix",
              "Renova o cliente após o pagamento aprovado",
              "Identifica clientes inadimplentes e cobra com tom certo",
              "Encaminha para humano quando o caso exige",
            ].map((t) => (
              <li
                key={t}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-3"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span className="text-sm text-foreground">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <PublicCTA
        title="Ative sua IA agora"
        subtitle="Treine, conecte ao WhatsApp e comece a renovar clientes hoje."
      />
    </PublicShell>
  );
}
