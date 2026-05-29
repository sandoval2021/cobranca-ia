/**
 * Auto-update do PWA CobraEasy.
 *
 * - Registra /sw.js apenas em produção, fora de iframe e fora de hosts de preview.
 * - Detecta nova versão de duas formas:
 *     1) Evento updatefound do próprio Service Worker.
 *     2) Polling do HTML do "/" comparando os hashes dos <script>/<link>
 *        atualmente carregados com os do HTML servido pelo servidor.
 * - Quando há nova versão, dispara um CustomEvent("cobraeasy:update-available")
 *   no window. Um componente de UI (UpdatePrompt) escuta e mostra o aviso.
 */

const UPDATE_EVENT = "cobraeasy:update-available";
const CHECK_INTERVAL_MS = 3 * 60 * 1000; // 3 minutos

let currentAssetSignature: string | null = null;
let updateNotified = false;
let registration: ServiceWorkerRegistration | null = null;

function isPreviewHost(): boolean {
  if (typeof window === "undefined") return true;
  const h = window.location.hostname;
  return (
    h.includes("id-preview--") ||
    h.includes("lovableproject.com") ||
    h.includes("lovable.app") &&
      (h.includes("id-preview") || h.includes("-dev."))
  );
}

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function captureCurrentAssetSignature(): string {
  // Combina os src/href de scripts e stylesheets carregados na página atual.
  // Como Vite emite filenames com hash de conteúdo, qualquer rebuild muda isto.
  const scripts = Array.from(document.querySelectorAll("script[src]"))
    .map((s) => (s as HTMLScriptElement).getAttribute("src") ?? "")
    .filter((s) => s.startsWith("/"));
  const links = Array.from(
    document.querySelectorAll('link[rel="stylesheet"][href], link[rel="modulepreload"][href]'),
  )
    .map((l) => (l as HTMLLinkElement).getAttribute("href") ?? "")
    .filter((s) => s.startsWith("/"));
  return [...scripts, ...links].sort().join("|");
}

function extractAssetSignatureFromHtml(html: string): string {
  const scripts = Array.from(html.matchAll(/<script[^>]+src=["']([^"']+)["']/g))
    .map((m) => m[1])
    .filter((s) => s.startsWith("/"));
  const links = Array.from(
    html.matchAll(
      /<link[^>]+(?:rel=["'](?:stylesheet|modulepreload)["'])[^>]+href=["']([^"']+)["']/g,
    ),
  )
    .map((m) => m[1])
    .filter((s) => s.startsWith("/"));
  // também tenta href antes de rel:
  const links2 = Array.from(
    html.matchAll(
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:stylesheet|modulepreload)["']/g,
    ),
  )
    .map((m) => m[1])
    .filter((s) => s.startsWith("/"));
  return [...scripts, ...links, ...links2].sort().join("|");
}

function notifyUpdateAvailable() {
  if (updateNotified) return;
  updateNotified = true;
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
}

async function checkServerVersion() {
  if (updateNotified) return;
  try {
    const res = await fetch("/?__v=" + Date.now(), {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "text/html" },
    });
    if (!res.ok) return;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html")) return;
    const html = await res.text();
    const serverSig = extractAssetSignatureFromHtml(html);
    if (!serverSig || !currentAssetSignature) return;
    if (serverSig !== currentAssetSignature) {
      notifyUpdateAvailable();
    }
  } catch {
    // offline / ignore
  }
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });

    // Se já existe um worker "waiting" no momento do registro, é nova versão.
    if (registration.waiting && navigator.serviceWorker.controller) {
      notifyUpdateAvailable();
    }

    registration.addEventListener("updatefound", () => {
      const installing = registration?.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (
          installing.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          notifyUpdateAvailable();
        }
      });
    });

    // Quando o novo SW assume controle, recarrega a página uma vez.
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  } catch (err) {
    console.warn("[pwa] SW register failed", err);
  }
}

async function unregisterAnyServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {
    // ignore
  }
}

export function initPwaUpdater() {
  if (typeof window === "undefined") return;

  // NUNCA registrar SW em iframe ou em hosts de preview/dev — regra Lovable.
  if (isInIframe() || isPreviewHost() || import.meta.env.DEV) {
    void unregisterAnyServiceWorker();
    return;
  }

  currentAssetSignature = captureCurrentAssetSignature();

  void registerServiceWorker();

  // Verifica nova versão ao abrir, ao voltar foco, ao ficar online e a cada 3 min.
  void checkServerVersion();
  window.addEventListener("focus", () => void checkServerVersion());
  window.addEventListener("online", () => void checkServerVersion());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkServerVersion();
  });
  setInterval(() => void checkServerVersion(), CHECK_INTERVAL_MS);

  // Também pede ao SW para checar update do próprio /sw.js periodicamente.
  setInterval(() => {
    registration?.update().catch(() => {});
  }, CHECK_INTERVAL_MS);
}

/** Chamado pelo botão "Atualizar agora" do UpdatePrompt. */
export async function applyUpdateNow() {
  try {
    // Pede ao SW em waiting para ativar imediatamente.
    if (registration?.waiting) {
      registration.waiting.postMessage("SKIP_WAITING");
    } else if (registration) {
      try {
        await registration.update();
      } catch {
        // ignore
      }
      if (registration.waiting) {
        registration.waiting.postMessage("SKIP_WAITING");
      }
    }

    // Limpa caches do navegador.
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } finally {
    // Se controllerchange não disparar (sem SW novo), força reload mesmo assim.
    setTimeout(() => window.location.reload(), 400);
  }
}

export const PWA_UPDATE_EVENT = UPDATE_EVENT;
