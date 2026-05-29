import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/lib/use-auth";
import { LoginPage, SessionLoading } from "@/components/auth/LoginPage";
import { TrialGuard } from "@/components/auth/TrialGuard";
import { supabase } from "@/integrations/supabase/client";
import { initPwaUpdater } from "@/lib/pwa-updater";
import { UpdatePrompt } from "@/components/pwa/UpdatePrompt";
import { useServersSync } from "@/lib/servers/useServersSync";
import { useScreensSync } from "@/lib/screens/useScreensSync";
import { useServicesSync } from "@/lib/services/useServicesSync";
import { useManualRenewalsSync } from "@/lib/manual-renewals/useManualRenewalsSync";
import { useCustomerDueOverridesSync } from "@/lib/customer-due-overrides/useCustomerDueOverridesSync";
import { useReferralsSync } from "@/lib/referrals/useReferralsSync";
import { useKnowledgeBaseSync } from "@/lib/knowledge-base/useKnowledgeBaseSync";
import { useManualDispatchRulesSync } from "@/lib/manual-dispatch-rules/useManualDispatchRulesSync";
import { useImportedDueDatesSync } from "@/lib/imports/useImportedDueDatesSync";


// Rotas públicas (não exigem login). Renderizam direto via <Outlet/>.
// Rotas públicas (não exigem login). Renderizam direto via <Outlet/>.
const PUBLIC_ROUTES = new Set<string>([
  "/reset-password",
  "/login",
  "/planos",
  "/funcionalidades",
  "/ia-atendente",
  "/cobranca-automatica",
  "/faq",
  "/blog",
]);

import { LandingPage } from "@/components/landing/LandingPage";
import { PublicWhatsappPage } from "@/components/landing/PublicWhatsappPage";

function AuthGateApp() {
  const { loading, user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (PUBLIC_ROUTES.has(pathname)) return <Outlet />;
  if (loading) return <SessionLoading />;
  if (!user) {
    if (pathname === "/whatsapp") return <PublicWhatsappPage />;
    if (pathname === "/") return <LandingPage />;
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
    return <SessionLoading />;
  }
  return (
    <TrialGuard>
      <AuthedApp />
    </TrialGuard>
  );
}

function AuthedApp() {
  // Sincroniza catálogos com o banco em todo dispositivo logado.
  useServersSync();
  useScreensSync();
  useServicesSync();
  useManualRenewalsSync();
  useCustomerDueOverridesSync();
  useReferralsSync();
  useKnowledgeBaseSync();
  useManualDispatchRulesSync();
  useImportedDueDatesSync();
  return <AppShell />;
}




function NotFoundComponent() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6 py-[max(env(safe-area-inset-top),2rem)] pb-[max(env(safe-area-inset-bottom),2rem)]">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">Página não encontrada</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          A página que você tentou abrir não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Voltar para o início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const isInvalidToken = /Unauthorized:\s*Invalid token|invalid (JWT|token)|bad_jwt/i.test(
    `${error.message} ${error.stack ?? ""}`,
  );

  useEffect(() => {
    if (!isInvalidToken) return;
    async function recover() {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // ignore
      }
      window.location.replace("/login?auth=expired");
    }
    void recover();
  }, [isInvalidToken]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6 pt-[max(env(safe-area-inset-top),2.5rem)] pb-[max(env(safe-area-inset-bottom),2.5rem)]">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
        </div>
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-foreground">
          Não foi possível carregar
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Algo deu errado por aqui. Tente novamente ou volte para o início.
        </p>
        <div className="mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
          >
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}


export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#2563EB" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "CobraEasy" },
      { title: "CobraEasy — Cobrança inteligente para o seu negócio" },
      { name: "description", content: "CobraEasy: gestão de clientes, cobranças automáticas e mensagens inteligentes em um só painel." },
      { property: "og:site_name", content: "CobraEasy" },
      { property: "og:title", content: "CobraEasy — Cobrança inteligente para o seu negócio" },
      { property: "og:description", content: "CobraEasy: gestão de clientes, cobranças automáticas e mensagens inteligentes em um só painel." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://cobraeasy.com.br" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "CobraEasy — Cobrança inteligente para o seu negócio" },
      { name: "twitter:description", content: "CobraEasy: gestão de clientes, cobranças automáticas e mensagens inteligentes em um só painel." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/3996efa0-2943-48bb-b34c-8e562c2e8d30" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/3996efa0-2943-48bb-b34c-8e562c2e8d30" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", href: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/favicon-16.png", type: "image/png", sizes: "16x16" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@500;600;700&display=swap" },
      { rel: "canonical", href: "https://cobraeasy.com.br" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "CobraEasy",
          url: "https://cobraeasy.com.br",
          logo: "https://cobraeasy.com.br/apple-touch-icon.png",
          description: "Plataforma brasileira de cobrança inteligente com WhatsApp, IA e Mercado Pago.",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "CobraEasy",
          url: "https://cobraeasy.com.br",
        }),
      },
    ],


  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Auto-recuperação: se um server function falhar com "Invalid token"
  // (sessão obsoleta após rotação de chaves JWT do Supabase), limpamos a
  // sessão local e mandamos pra tela de login em vez de mostrar erro.
  useEffect(() => {
    function errorMessage(reason: unknown): string {
      if (reason instanceof Error) return reason.message;
      if (typeof reason === "string") return reason;
      if (typeof reason === "object" && reason) {
        const obj = reason as { message?: unknown; error?: unknown; stack?: unknown };
        return [obj.message, obj.error, obj.stack]
          .filter(Boolean)
          .map(String)
          .join(" ");
      }
      return "";
    }

    function isInvalidTokenError(reason: unknown): boolean {
      const msg =
        errorMessage(reason) ||
        (typeof reason === "object" && reason ? JSON.stringify(reason) : "");
      return /Unauthorized:\s*Invalid token|invalid (JWT|token)|bad_jwt/i.test(msg);
    }

    let recovering = false;
    async function recover() {
      if (recovering) return;
      recovering = true;
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // ignore
      }
      window.location.replace("/login?auth=expired");
    }

    const onRejection = (e: PromiseRejectionEvent) => {
      if (isInvalidTokenError(e.reason)) {
        e.preventDefault();
        void recover();
      }
    };
    const onError = (e: ErrorEvent) => {
      if (isInvalidTokenError(e.error ?? e.message)) {
        e.preventDefault();
        void recover();
      }
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  useEffect(() => {
    initPwaUpdater();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGateApp />
      <UpdatePrompt />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
