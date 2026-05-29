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
import { supabase } from "@/integrations/supabase/client";


// Rotas públicas (não exigem login). Renderizam direto via <Outlet/>.
const PUBLIC_ROUTES = new Set<string>(["/reset-password"]);

function AuthGateApp() {
  const { loading, user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (PUBLIC_ROUTES.has(pathname)) return <Outlet />;
  if (loading) return <SessionLoading />;
  if (!user) return <LoginPage />;
  return <AppShell />;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
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
      window.location.replace("/?auth=expired");
    }
    void recover();
  }, [isInvalidToken]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
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
      window.location.replace("/?auth=expired");
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

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGateApp />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
