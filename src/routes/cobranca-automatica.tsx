import { createFileRoute } from "@tanstack/react-router";
import { Bell, Clock, CreditCard, RefreshCcw, BarChart3, Check } from "lucide-react";
import { PublicShell, PublicCTA } from "@/components/landing/PublicShell";

export const Route = createFileRoute("/cobranca-automatica")({
  component: CobrancaPage,
  head: () => ({
    meta: [
      {
        title:
          "Cobrança automática no WhatsApp — Reduza inadimplência | CobraEasy",
      },
      {
        name: "description",
        content:
          "Automatize sua cobrança: lembretes antes, no dia e depois do vencimento, Pix do Mercado Pago, renovação automática e controle total. Teste grátis no CobraEasy.",
      },
      {
        property: "og:title",
        content: "Cobrança automática no WhatsApp — CobraEasy",
      },
      {
        property: "og:description",
        content:
          "Lembretes automáticos, Pix do Mercado Pago e renovação sem esforço.",
      },
      { property: "og:url", content: "https://cobraeasy.com.br/cobranca-automatica" },
    ],
    links: [
      { rel: "canonical", href: "https://cobraeasy.com.br/cobranca-automatica" },
    ],
  }),
});

function CobrancaPage() {
  return (
    <PublicShell>
      <section className="bg-surface-muted py-16 md:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center md:px-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            <Bell className="h-3.5 w-3.5" /> Cobrança automática
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            Cobrança automática que reduz a inadimplência
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
            O CobraEasy cobra seus clientes no WhatsApp antes, no dia e depois do vencimento,
            envia Pix do Mercado Pago e renova o plano automaticamente após o pagamento.
          </p>
        </div>
      </section>

      <section className="bg-background py-16 md:py-20">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 md:grid-cols-2 md:px-6">
          {[
            {
              i: Clock,
              t: "Lembretes inteligentes",
              d: "Mensagens automáticas em D-3, D-1, no dia e D+1, D+3 e D+7 do vencimento.",
            },
            {
              i: CreditCard,
              t: "Pix Mercado Pago",
              d: "Cobre via Pix e receba a confirmação na hora, sem entrar na conta.",
            },
            {
              i: RefreshCcw,
              t: "Renovação automática",
              d: "Após o pagamento, o cliente é renovado e notificado sem você fazer nada.",
            },
            {
              i: BarChart3,
              t: "Controle total",
              d: "Veja quem pagou, quem está atrasado e a projeção do mês em tempo real.",
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
            Por que funciona
          </h2>
          <ul className="mt-6 space-y-3">
            {[
              "Clientes recebem na hora certa, sem você precisar lembrar",
              "Mensagens personalizadas por plano, grupo e vencimento",
              "Pix com confirmação automática elimina conferência manual",
              "Renovação imediata reduz cancelamentos e atrasos",
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
        title="Automatize sua cobrança agora"
        subtitle="Configure em minutos e veja a inadimplência cair."
      />
    </PublicShell>
  );
}
