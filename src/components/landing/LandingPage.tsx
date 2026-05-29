import { useEffect, useState } from "react";
import {
  Menu,
  X,
  Check,
  Users,
  MessageCircle,
  Bot,
  CreditCard,
  BarChart3,
  Gift,
  Bell,
  Zap,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";

const NAV = [
  { id: "inicio", label: "Início" },
  { id: "como-funciona", label: "Como funciona" },
  { id: "recursos", label: "Recursos" },
  { id: "planos", label: "Planos" },
  { id: "depoimentos", label: "Depoimentos" },
  { id: "faq", label: "FAQ" },
];

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.title = "CobraEasy | Cobrança Automática, WhatsApp e IA para Revendas";
    const setMeta = (name: string, content: string, attr: "name" | "property" = "name") => {
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    setMeta(
      "description",
      "Automatize cobranças, clientes, WhatsApp, IA, Mercado Pago e renovações em um painel simples, profissional e fácil de usar.",
    );
    setMeta("og:title", "CobraEasy | Cobrança Automática, WhatsApp e IA para Revendas", "property");
    setMeta(
      "og:description",
      "Automatize cobranças, clientes, WhatsApp, IA, Mercado Pago e renovações em um painel simples, profissional e fácil de usar.",
      "property",
    );
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* HEADER */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all ${
          scrolled
            ? "bg-white/85 backdrop-blur-lg border-b border-border shadow-sm"
            : "bg-white/70 backdrop-blur-md"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
          <button
            onClick={() => scrollToId("inicio")}
            className="flex items-center gap-2"
            aria-label="CobraEasy"
          >
            <BrandLogo variant="mark" className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight text-foreground">
              Cobra<span className="text-primary">Easy</span>
            </span>
          </button>

          <nav className="hidden items-center gap-7 lg:flex">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => scrollToId(n.id)}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                {n.label}
              </button>
            ))}
          </nav>

          <div className="hidden lg:block">
            <Button asChild size="lg" className="rounded-full px-5 shadow-sm">
              <Link to="/login">Acessar plataforma</Link>
            </Button>
          </div>

          <button
            className="rounded-lg p-2 text-foreground lg:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-border bg-white lg:hidden">
            <div className="mx-auto max-w-7xl px-4 py-3">
              <nav className="flex flex-col gap-1">
                {NAV.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      setMenuOpen(false);
                      setTimeout(() => scrollToId(n.id), 50);
                    }}
                    className="rounded-lg px-3 py-3 text-left text-base font-medium text-foreground hover:bg-primary-soft hover:text-primary"
                  >
                    {n.label}
                  </button>
                ))}
                <Button onClick={goToApp} className="mt-2 h-12 w-full rounded-xl text-base">
                  Acessar plataforma
                </Button>
              </nav>
            </div>
          </div>
        )}
      </header>

      {/* HERO */}
      <section
        id="inicio"
        className="relative overflow-hidden pt-24 md:pt-28"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.22 0.08 260) 0%, oklch(0.16 0.06 260) 100%)",
        }}
      >
        {/* Grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        {/* Glows */}
        <div className="pointer-events-none absolute -left-32 top-20 h-80 w-80 rounded-full bg-primary/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-info/30 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-10 md:px-6 md:pb-24 md:pt-16">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/85 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Plataforma para revendas, cobranças e atendimento automatizado
            </div>

            <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
              Automatize cobranças, clientes e renovações{" "}
              <span className="block bg-gradient-to-r from-[oklch(0.78_0.16_252)] to-[oklch(0.85_0.14_200)] bg-clip-text text-transparent">
                em um só painel
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/75 md:text-lg">
              Organize clientes, envie cobranças automáticas, conecte{" "}
              <span className="font-semibold text-white">WhatsApp + IA + Mercado Pago</span> e
              acompanhe tudo com inteligência.
            </p>

            <div className="mx-auto mt-8 flex max-w-md flex-col items-stretch justify-center gap-3 sm:max-w-none sm:flex-row">
              <Button
                onClick={goToApp}
                size="lg"
                className="h-12 rounded-xl px-7 text-base shadow-lg shadow-primary/30"
              >
                Começar grátis
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <Button
                onClick={() => scrollToId("recursos")}
                size="lg"
                variant="outline"
                className="h-12 rounded-xl border-white/25 bg-white/5 px-7 text-base text-white hover:bg-white/10 hover:text-white hover:border-white/40"
              >
                Ver demonstração
              </Button>
            </div>

            {/* prova/cards pequenos */}
            <div className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-3">
              {[
                { icon: Users, label: "Clientes organizados" },
                { icon: Bell, label: "Cobranças automáticas" },
                { icon: MessageCircle, label: "WhatsApp conectado" },
                { icon: Bot, label: "IA atendente" },
                { icon: CreditCard, label: "Pagamentos online" },
                { icon: BarChart3, label: "Controle financeiro" },
              ].map((c) => (
                <div
                  key={c.label}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left text-xs font-medium text-white/85 backdrop-blur"
                >
                  <c.icon className="h-4 w-4 shrink-0 text-[oklch(0.78_0.16_252)]" />
                  <span className="truncate">{c.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* MOCKUP */}
          <div className="relative mx-auto mt-14 max-w-5xl md:mt-20">
            <div className="absolute -inset-x-10 -inset-y-8 rounded-[2rem] bg-gradient-to-tr from-primary/20 to-info/20 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[oklch(0.20_0.04_260)] shadow-2xl shadow-black/40">
              {/* browser bar */}
              <div className="flex items-center gap-2 border-b border-white/10 bg-[oklch(0.22_0.04_260)] px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                <div className="ml-3 flex-1 truncate rounded-md bg-white/5 px-3 py-1 text-center text-xs text-white/60">
                  app.cobraeasy.com.br
                </div>
              </div>
              {/* fake dashboard */}
              <div className="grid grid-cols-12 gap-3 p-3 md:p-5">
                <div className="col-span-12 grid grid-cols-2 gap-3 md:col-span-3 md:grid-cols-1">
                  {[
                    { label: "Dashboard", active: true },
                    { label: "Clientes" },
                    { label: "WhatsApp" },
                    { label: "Financeiro" },
                    { label: "IA" },
                    { label: "Indicações" },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className={`rounded-lg px-3 py-2 text-xs font-medium ${
                        m.active
                          ? "bg-primary text-primary-foreground"
                          : "bg-white/5 text-white/70"
                      }`}
                    >
                      {m.label}
                    </div>
                  ))}
                </div>
                <div className="col-span-12 space-y-3 md:col-span-9">
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
                    {[
                      { l: "Em dia", v: "R$ 12.340", c: "from-success to-success" },
                      { l: "A vencer", v: "R$ 3.210", c: "from-info to-primary" },
                      { l: "Vencidos", v: "R$ 980", c: "from-warning to-warning" },
                      { l: "Renovados", v: "R$ 8.760", c: "from-primary to-info" },
                    ].map((s) => (
                      <div
                        key={s.l}
                        className={`rounded-lg bg-gradient-to-br ${s.c} p-3 text-white shadow`}
                      >
                        <div className="text-[10px] opacity-80 md:text-xs">{s.l}</div>
                        <div className="mt-0.5 text-sm font-bold md:text-base">{s.v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs font-semibold text-white">Vencendo em 7 dias</div>
                      <div className="text-[10px] text-white/50">12 clientes</div>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        ["João Silva", "R$ 49,90", "WhatsApp"],
                        ["Maria Souza", "R$ 119,90", "Mercado Pago"],
                        ["Carlos Lima", "R$ 79,90", "WhatsApp"],
                        ["Ana Pereira", "R$ 49,90", "Mercado Pago"],
                      ].map(([n, v, c]) => (
                        <div
                          key={n}
                          className="flex items-center justify-between rounded-md bg-white/5 px-2.5 py-1.5 text-[11px] text-white/80"
                        >
                          <span className="truncate font-medium text-white">{n}</span>
                          <span className="hidden text-white/50 md:inline">{c}</span>
                          <span className="font-semibold text-success">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="bg-surface-muted py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Como funciona
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
              Em 3 passos sua operação roda no automático
            </h2>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              {
                n: "01",
                t: "Cadastre seus clientes",
                d: "Importe sua base ou cadastre clientes e planos em segundos.",
              },
              {
                n: "02",
                t: "Conecte WhatsApp e Mercado Pago",
                d: "Vincule seu número e sua conta em poucos cliques, sem APIs complicadas.",
              },
              {
                n: "03",
                t: "Deixe o sistema cobrar e responder",
                d: "A IA atende, cobra, envia Pix e renova — você acompanha tudo no painel.",
              },
            ].map((s) => (
              <div
                key={s.n}
                className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-pop"
              >
                <div className="text-4xl font-bold text-primary/15">{s.n}</div>
                <h3 className="mt-2 text-lg font-bold text-foreground">{s.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RECURSOS */}
      <section id="recursos" className="bg-background py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              Recursos
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
              Tudo que você precisa para vender e cobrar melhor
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Uma plataforma completa, pensada para revendas e equipes pequenas que precisam
              escalar sem perder o controle.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { i: Bell, t: "Cobrança automática", d: "Lembretes antes, no dia e depois do vencimento." },
              { i: Users, t: "Gestão de clientes", d: "Base centralizada com planos, status e histórico." },
              { i: MessageCircle, t: "WhatsApp integrado", d: "Conecte seu número e dispare em massa ou 1 a 1." },
              { i: Bot, t: "IA atendente", d: "Treine sua IA para responder e fechar renovações." },
              { i: CreditCard, t: "Mercado Pago", d: "Cobre via Pix com confirmação automática." },
              { i: BarChart3, t: "Relatórios", d: "Veja faturamento, inadimplência e projeções." },
              { i: Gift, t: "Indicações", d: "Programa de indicação para crescer mais rápido." },
              { i: Zap, t: "Mensagens por vencimento", d: "Modelos prontos por grupo, plano e data." },
            ].map((f) => (
              <div
                key={f.t}
                className="group rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-pop"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <f.i className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-bold text-foreground">{f.t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" className="bg-surface-muted py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              Planos
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
              Simples, transparente e sem surpresas
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Escolha o plano que combina com o tamanho da sua operação. Cancele quando quiser.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-3">
            {[
              {
                name: "Inicial",
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
            ].map((p) => (
              <div
                key={p.name}
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
                  onClick={goToApp}
                  size="lg"
                  variant={p.highlight ? "default" : "outline"}
                  className="mt-6 h-12 w-full rounded-xl text-base"
                >
                  Começar grátis
                </Button>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-success" />
            5 dias grátis para testar • cancele quando quiser
          </p>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section id="depoimentos" className="bg-background py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              Depoimentos
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
              Quem usa, recomenda
            </h2>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              {
                q: "A cobrança via WhatsApp resolveu um problema que consumia horas da minha semana. Hoje o sistema roda sozinho e eu só acompanho.",
                n: "Rafael M.",
                r: "Revenda IPTV",
              },
              {
                q: "A IA atende e renova clientes sem eu precisar responder. Reduziu a inadimplência e organizou tudo num painel só.",
                n: "Camila S.",
                r: "Empreendedora",
              },
              {
                q: "Migrei de planilhas para o CobraEasy e ganhei controle total do financeiro e das renovações. Não volto mais atrás.",
                n: "Diego A.",
                r: "Operação digital",
              },
            ].map((t, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border bg-card p-6 shadow-card"
              >
                <div className="text-3xl font-serif leading-none text-primary/40">"</div>
                <p className="mt-2 text-sm leading-relaxed text-foreground">{t.q}</p>
                <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
                    {t.n.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-foreground">{t.n}</div>
                    <div className="text-xs text-muted-foreground">{t.r}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-surface-muted py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-4 md:px-6">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              FAQ
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Perguntas frequentes
            </h2>
          </div>

          <div className="mt-10 space-y-3">
            {[
              {
                q: "Preciso instalar algo?",
                a: "Não. O CobraEasy roda 100% online. Basta acessar pelo navegador no celular, tablet ou computador.",
              },
              {
                q: "Funciona no celular?",
                a: "Sim. A plataforma é otimizada para mobile e você usa do jeito que preferir.",
              },
              {
                q: "Posso usar meu WhatsApp?",
                a: "Sim. Você conecta seu próprio número via QR Code, sem precisar de API oficial.",
              },
              {
                q: "Posso conectar Mercado Pago?",
                a: "Sim. Vincule sua conta em poucos cliques e receba Pix com confirmação automática.",
              },
              {
                q: "A IA responde meus clientes?",
                a: "Sim. A IA atende, tira dúvidas, envia Pix e ajuda na renovação 24h por dia.",
              },
              {
                q: "Posso treinar minha IA?",
                a: "Sim. Cada empresa tem sua própria base treinável, isolada e segura.",
              },
              {
                q: "Tem teste grátis?",
                a: "Sim. Você tem 5 dias grátis para testar a plataforma completa.",
              },
            ].map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section
        className="relative overflow-hidden py-16 md:py-24"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.22 0.08 260) 0%, oklch(0.30 0.12 252) 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-4 text-center md:px-6">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-5xl">
            Pronto para escalar sua cobrança?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/75 md:text-lg">
            Teste grátis por 5 dias. Sem cartão de crédito. Cancele quando quiser.
          </p>
          <Button
            onClick={goToApp}
            size="lg"
            className="mt-7 h-12 rounded-xl px-8 text-base shadow-lg shadow-black/30"
          >
            Começar grátis agora
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border bg-background py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 md:flex-row md:px-6">
          <div className="flex items-center gap-2">
            <BrandLogo variant="mark" className="h-7 w-7" />
            <span className="text-sm font-bold text-foreground">
              Cobra<span className="text-primary">Easy</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} CobraEasy — Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`overflow-hidden rounded-xl border bg-card transition-all ${
        open ? "border-primary/30 shadow-card" : "border-border"
      }`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="text-sm font-semibold text-foreground md:text-base">{q}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">{a}</div>
      )}
    </div>
  );
}
