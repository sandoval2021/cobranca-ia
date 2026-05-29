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

function notifyUpdateAvailable() {
  if (updateNotified) return;
  updateNotified = true;
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
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

  // NÃO usamos mais polling de HTML para detectar nova versão — em SSR
  // os modulepreload/scripts variam por render e isso gerava o falso
  // "Nova versão disponível" preso em loop. Confiamos apenas no evento
  // nativo updatefound do Service Worker.
  setInterval(() => {
    registration?.update().catch(() => {});
  }, CHECK_INTERVAL_MS);
  window.addEventListener("focus", () => {
    registration?.update().catch(() => {});
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      registration?.update().catch(() => {});
    }
  });
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
