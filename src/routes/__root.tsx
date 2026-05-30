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
import { useReferralRulesSync } from "@/lib/referrals/useReferralRulesSync";
import { useKnowledgeBaseSync } from "@/lib/knowledge-base/useKnowledgeBaseSync";
import { useManualDispatchRulesSync } from "@/lib/manual-dispatch-rules/useManualDispatchRulesSync";
import { useImportedDueDatesSync } from "@/lib/imports/useImportedDueDatesSync";
import { useAutoTemplatesSync } from "@/hooks/useAutoTemplatesSync";
import { useRevendaSettingsSync } from "@/hooks/useRevendaSettingsSync";
import { useCustomerExtrasSync } from "@/hooks/useCustomerExtrasSync";
import { useTrialLeadsSync } from "@/hooks/useTrialLeadsSync";
import { useFinanceSync } from "@/hooks/useFinanceSync";
import { useFinanceSettingsSync } from "@/hooks/useFinanceSettingsSync";
import { useDnsRoutesSync } from "@/hooks/useDnsRoutesSync";
import { useSetupWizardSync } from "@/lib/setup-wizard/useSetupWizardSync";



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
  useReferralRulesSync();
  useKnowledgeBaseSync();
  useManualDispatchRulesSync();
  useImportedDueDatesSync();
  // Fase B — módulos que estavam só no aparelho agora sincronizam com o banco.
  useAutoTemplatesSync();
  useRevendaSettingsSync();
  useCustomerExtrasSync();
  useTrialLeadsSync();
  useFinanceSync();
  useFinanceSettingsSync();
  useDnsRoutesSync();
  useSetupWizardSync();
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
  const msg = `${error.message} ${error.stack ?? ""}`;
  // ATENÇÃO: padrão MUITO restrito de propósito. Não casar "Unauthorized" genérico
  // — server fns podem responder 401 transitório enquanto a sessão hidrata, e
  // limpar a sessão por isso desloga o usuário sem motivo (bug recorrente em PWA/mobile).
  const isInvalidToken =
    /bad_jwt|JWT expired|invalid_grant|refresh_token_not_found|invalid refresh token/i.test(msg);
  // Bundle obsoleto preso em cache do PWA: chunks lazy referenciam arquivos
  // que não existem mais após deploy. Limpamos caches/SW e recarregamos.
  const isStaleChunk =
    /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
      msg,
    );

  useEffect(() => {
    if (!isInvalidToken && !isStaleChunk) return;
    async function recover() {
      if (isStaleChunk) {
        try {
          if ("caches" in window) {
            const names = await caches.keys();
            await Promise.all(names.map((n) => caches.delete(n)));
          }
        } catch {
          // ignore
        }
        try {
          if ("serviceWorker" in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.unregister()));
          }
        } catch {
          // ignore
        }
        // Reload uma vez (flag em sessionStorage evita loop infinito).
        const flag = "cobraeasy:stale-reload";
        if (sessionStorage.getItem(flag) !== "1") {
          sessionStorage.setItem(flag, "1");
          window.location.reload();
        }
        return;
      }
      // Token JWT comprovadamente inválido → encerra APENAS a sessão Supabase.
      // NUNCA usar localStorage.clear()/sessionStorage.clear(): apaga cache de
      // empresas/clientes/templates e quebra a UI inteira na próxima abertura.
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
      window.location.replace("/login?auth=expired");
    }
    void recover();
  }, [isInvalidToken, isStaleChunk]);


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
  head: () => {
    const TITLE = "CobraEasy: Cobrança Automática no WhatsApp com Pix e IA";
    const DESCRIPTION =
      "Sistema de cobrança automática no WhatsApp para revendas, provedores e prestadores de serviço. Pix Mercado Pago, IA atendente, lembretes e renovação. Teste grátis 5 dias.";
    const KEYWORDS =
      "cobrança automática, cobrança no whatsapp, sistema de cobrança, cobrança recorrente, pix automático, mercado pago, gestão de clientes, software para revenda, ia atendente whatsapp, plataforma de cobrança, lembrete de pagamento, renovação automática, cobraeasy";
    const LOGO = "https://cobraeasy.com.br/icon-512.png";
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        { name: "theme-color", content: "#2563EB" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
        { name: "apple-mobile-web-app-title", content: "CobraEasy" },
        { name: "application-name", content: "CobraEasy" },
        { title: TITLE },
        { name: "description", content: DESCRIPTION },
        { name: "keywords", content: KEYWORDS },
        { name: "author", content: "CobraEasy" },
        { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
        { name: "googlebot", content: "index, follow, max-image-preview:large, max-snippet:-1" },
        { httpEquiv: "content-language", content: "pt-BR" },
        { property: "og:site_name", content: "CobraEasy" },
        { property: "og:locale", content: "pt_BR" },
        { property: "og:title", content: TITLE },
        { property: "og:description", content: DESCRIPTION },
        { property: "og:type", content: "website" },
        { property: "og:url", content: "https://cobraeasy.com.br" },
        { property: "og:image", content: LOGO },
        { property: "og:image:width", content: "512" },
        { property: "og:image:height", content: "512" },
        { property: "og:image:alt", content: "Logo CobraEasy — Cobrança automática no WhatsApp" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: TITLE },
        { name: "twitter:description", content: DESCRIPTION },
        { name: "twitter:image", content: LOGO },
        { name: "twitter:image:alt", content: "Logo CobraEasy" },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "manifest", href: "/manifest.json" },
        { rel: "icon", href: "/favicon.ico?v=2", sizes: "any" },
        { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
        { rel: "icon", href: "/favicon-32.png?v=2", type: "image/png", sizes: "32x32" },
        { rel: "icon", href: "/favicon-16.png?v=2", type: "image/png", sizes: "16x16" },
        { rel: "icon", href: "/icon-192.png", type: "image/png", sizes: "192x192" },
        { rel: "icon", href: "/icon-512.png", type: "image/png", sizes: "512x512" },
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
            alternateName: "Cobra Easy",
            url: "https://cobraeasy.com.br",
            logo: {
              "@type": "ImageObject",
              url: LOGO,
              width: 512,
              height: 512,
            },
            image: LOGO,
            description: DESCRIPTION,
            sameAs: ["https://cobraeasy.com.br"],
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "CobraEasy",
            url: "https://cobraeasy.com.br",
            inLanguage: "pt-BR",
            potentialAction: {
              "@type": "SearchAction",
              target: "https://cobraeasy.com.br/?q={search_term_string}",
              "query-input": "required name=search_term_string",
            },
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "CobraEasy",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web, iOS, Android",
            offers: {
              "@type": "Offer",
              price: "49.90",
              priceCurrency: "BRL",
            },
            description: DESCRIPTION,
            image: LOGO,
            url: "https://cobraeasy.com.br",
          }),
        },
      ],
    };
  },
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
      // MUITO restrito: só dispara em erro REAL de token (JWT expirado / refresh inválido).
      // "Unauthorized" / "Invalid token" genéricos podem ocorrer em 401 transitório
      // durante a hidratação da sessão — não justifica deslogar o usuário.
      return /bad_jwt|JWT expired|invalid_grant|refresh_token_not_found|invalid refresh token/i.test(
        msg,
      );
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
      // NUNCA usar localStorage.clear()/sessionStorage.clear() — apaga cache local
      // (empresas, templates, clientes) e quebra a UI em todas as telas até o usuário
      // reabrir e refazer o cache. signOut() já remove a sessão Supabase do storage.
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
    // App carregou com sucesso — limpa flag de recovery de bundle obsoleto.
    try {
      sessionStorage.removeItem("cobraeasy:stale-reload");
    } catch {
      // ignore
    }
  }, []);

  // Captura ChunkLoadError fora de boundary do router (ex.: dynamic import
  // disparado por evento). Limpa caches e recarrega uma única vez.
  useEffect(() => {
    function isStaleChunk(reason: unknown): boolean {
      const msg =
        reason instanceof Error
          ? `${reason.message} ${reason.stack ?? ""}`
          : typeof reason === "string"
            ? reason
            : "";
      return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
        msg,
      );
    }
    let recovering = false;
    async function recoverStale() {
      if (recovering) return;
      recovering = true;
      const flag = "cobraeasy:stale-reload";
      if (sessionStorage.getItem(flag) === "1") return;
      sessionStorage.setItem(flag, "1");
      try {
        if ("caches" in window) {
          const names = await caches.keys();
          await Promise.all(names.map((n) => caches.delete(n)));
        }
      } catch {
        // ignore
      }
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
      } catch {
        // ignore
      }
      window.location.reload();
    }
    const onRej = (e: PromiseRejectionEvent) => {
      if (isStaleChunk(e.reason)) {
        e.preventDefault();
        void recoverStale();
      }
    };
    const onErr = (e: ErrorEvent) => {
      if (isStaleChunk(e.error ?? e.message)) {
        e.preventDefault();
        void recoverStale();
      }
    };
    window.addEventListener("unhandledrejection", onRej);
    window.addEventListener("error", onErr);
    return () => {
      window.removeEventListener("unhandledrejection", onRej);
      window.removeEventListener("error", onErr);
    };
  }, []);


  return (
    <QueryClientProvider client={queryClient}>
      <AuthGateApp />
      <UpdatePrompt />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
