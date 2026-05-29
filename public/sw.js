/* CobraEasy Service Worker
 * Estratégia: NetworkFirst puro, sem precache.
 * - Sempre prioriza a rede; cache só serve como fallback offline.
 * - Nunca "trava" o usuário numa versão antiga porque não há lista de
 *   assets pré-cacheados que precise invalidar.
 * - skipWaiting + clients.claim => nova versão assume controle na hora.
 */

const RUNTIME_CACHE = "cobraeasy-runtime-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Apaga TODOS os caches antigos — não acumula versões.
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n !== RUNTIME_CACHE).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING" || event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data === "CLEAR_CACHES" || event.data?.type === "CLEAR_CACHES") {
    event.waitUntil(
      (async () => {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      })(),
    );
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Só interceptamos GET no mesmo origin.
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Nunca cachear rotas de API / webhooks / auth.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/lovable/") ||
    url.pathname.startsWith("/_server/") ||
    url.pathname.includes("/auth/")
  ) {
    return; // deixa o browser tratar normalmente
  }

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        // Só guarda cópia útil (200 OK, basic) para fallback offline.
        if (fresh && fresh.status === 200 && fresh.type === "basic") {
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(req, fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        // Para navegação, tenta servir o "/" cacheado como shell offline.
        if (req.mode === "navigate") {
          const shell = await caches.match("/");
          if (shell) return shell;
        }
        throw new Error("offline");
      }
    })(),
  );
});
