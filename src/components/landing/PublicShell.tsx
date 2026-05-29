import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";

const PUBLIC_NAV = [
  { to: "/", label: "Início" },
  { to: "/funcionalidades", label: "Funcionalidades" },
  { to: "/planos", label: "Planos" },
  { to: "/ia-atendente", label: "IA Atendente" },
  { to: "/cobranca-automatica", label: "Cobrança" },
  { to: "/whatsapp", label: "WhatsApp" },
  { to: "/faq", label: "FAQ" },
  { to: "/blog", label: "Blog" },
] as const;

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all ${
        scrolled
          ? "bg-white/85 backdrop-blur-lg border-b border-border shadow-sm"
          : "bg-white/70 backdrop-blur-md"
      }`}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">

        <Link to="/" className="flex items-center gap-2" aria-label="CobraEasy">
          <BrandLogo variant="mark" className="h-8 w-8" />
          <span className="text-lg font-bold tracking-tight text-foreground">
            Cobra<span className="text-primary">Easy</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-5 lg:flex">
          {PUBLIC_NAV.slice(1).map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              activeProps={{ className: "text-primary" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:block">
          <Button asChild size="lg" className="rounded-full px-5 shadow-sm">
            <Link to="/login">Acessar plataforma</Link>
          </Button>
        </div>

        <button
          className="rounded-lg p-2 text-foreground lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-white lg:hidden">
          <div className="mx-auto max-w-7xl px-4 py-3">
            <nav className="flex flex-col gap-1">
              {PUBLIC_NAV.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-left text-base font-medium text-foreground hover:bg-primary-soft hover:text-primary"
                >
                  {n.label}
                </Link>
              ))}
              <Button asChild className="mt-2 h-12 w-full rounded-xl text-base">
                <Link to="/login">Acessar plataforma</Link>
              </Button>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-background py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 md:px-6">
        <div className="grid gap-6 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <BrandLogo variant="mark" className="h-7 w-7" />
              <span className="text-sm font-bold text-foreground">
                Cobra<span className="text-primary">Easy</span>
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Plataforma de cobrança automática com WhatsApp, IA e Mercado Pago.
            </p>
          </div>
          <FooterCol
            title="Produto"
            links={[
              { to: "/funcionalidades", label: "Funcionalidades" },
              { to: "/planos", label: "Planos" },
              { to: "/ia-atendente", label: "IA Atendente" },
              { to: "/cobranca-automatica", label: "Cobrança automática" },
              { to: "/whatsapp", label: "WhatsApp" },
            ]}
          />
          <FooterCol
            title="Recursos"
            links={[
              { to: "/blog", label: "Blog" },
              { to: "/faq", label: "FAQ" },
            ]}
          />
          <FooterCol
            title="Conta"
            links={[
              { to: "/login", label: "Entrar" },
              { to: "/login?mode=signup", label: "Criar conta grátis" },
            ]}
          />
        </div>
        <div className="border-t border-border pt-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} CobraEasy — Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { to: string; label: string }[];
}) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider text-foreground">
        {title}
      </div>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.to + l.label}>
            <Link
              to={l.to}
              className="text-sm text-muted-foreground hover:text-primary"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <PublicHeader />
      <main className="pt-16">{children}</main>
      <PublicFooter />
    </div>
  );
}

export function PublicCTA({
  title,
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <section
      className="relative overflow-hidden py-16 md:py-20"
      style={{
        background:
          "linear-gradient(135deg, oklch(0.22 0.08 260) 0%, oklch(0.30 0.12 252) 100%)",
      }}
    >
      <div className="relative mx-auto max-w-3xl px-4 text-center md:px-6">
        <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
          {title ?? "Comece grátis em 2 minutos"}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base text-white/80">
          {subtitle ??
            "Teste por 5 dias sem cartão. Cancele quando quiser."}
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-12 rounded-xl px-7 text-base">
            <Link to="/login?mode=signup">
              Criar conta grátis
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 rounded-xl border-white/25 bg-white/5 px-7 text-base text-white hover:bg-white/10 hover:text-white"
          >
            <Link to="/login">Acessar plataforma</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
