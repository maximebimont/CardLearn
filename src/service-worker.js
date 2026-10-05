/* Service worker de CardLearn (modèle : vite.config.js y insère la version et la liste des fichiers au build).
   L'appli construite est mise en cache pour démarrer même sans connexion ; les pages passent
   d'abord par le réseau pour toujours recevoir la dernière version. Supabase et les polices
   (autres domaines) ne passent pas par ce cache. */
const CACHE = "cardlearn-__VERSION__";
const FILES = __FILES__;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("cardlearn-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/", { ignoreSearch: true })));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
