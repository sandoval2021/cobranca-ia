import { PublicShell, PublicCTA } from "@/components/landing/PublicShell";
import { MessageCircle, QrCode, Send, ShieldCheck, Check } from "lucide-react";

export function PublicWhatsappPage() {
  return (
    <PublicShell>
      <section className="bg-surface-muted py-16 md:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center md:px-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            Cobrança no WhatsApp do seu jeito
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
            Conecte seu próprio número via QR Code, dispare mensagens em massa ou 1 a 1 e deixe
            a IA atender quando você não puder. Sem API oficial, sem complicação.
          </p>
        </div>
      </section>

      <section className="bg-background py-16 md:py-20">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 md:grid-cols-2 md:px-6">
          {[
            {
              i: QrCode,
              t: "Conexão por QR Code",
              d: "Conecte seu WhatsApp em segundos. Sem precisar de API oficial paga.",
            },
            {
              i: Send,
              t: "Disparo em massa",
              d: "Envie cobranças, promoções e avisos para listas filtradas por plano e status.",
            },
            {
              i: MessageCircle,
              t: "Atendimento 1 a 1",
              d: "Converse pelo painel ou deixe a IA responder com seu tom de voz.",
            },
            {
              i: ShieldCheck,
              t: "Seu número, sua base",
              d: "Os dados são da sua empresa. Você sai quando quiser e leva tudo.",
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
            O que dá pra fazer
          </h2>
          <ul className="mt-6 space-y-3">
            {[
              "Conectar 1 ou mais números (de acordo com o plano)",
              "Enviar Pix automático com o link do Mercado Pago",
              "Modelos prontos de cobrança por vencimento",
              "Campanhas manuais e segmentadas",
              "Atendimento da IA 24h, com escalonamento para humano",
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
        title="Conecte seu WhatsApp agora"
        subtitle="Em poucos cliques o sistema já está cobrando por você."
      />
    </PublicShell>
  );
}
