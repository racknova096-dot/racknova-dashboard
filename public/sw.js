const CACHE_VERSION = "racknova-pwa-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const scopeUrl = new URL(self.registration.scope);
const appRoot = scopeUrl.pathname.endsWith("/")
  ? scopeUrl.pathname
  : `${scopeUrl.pathname}/`;

const appShellUrl = new URL("./", self.registration.scope).toString();

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll([
        appShellUrl,
        new URL("manifest.webmanifest?v=2", self.registration.scope).toString(),
        new URL("racknova-icon-192-v2.png", self.registration.scope).toString(),
        new URL("racknova-icon-512-v2.png", self.registration.scope).toString(),
      ])
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter(
                (key) =>
                  key.startsWith("racknova-pwa-") &&
                  key !== STATIC_CACHE &&
                  key !== RUNTIME_CACHE
              )
              .map((key) => caches.delete(key))
          )
        ),
      self.clients.claim(),
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== scopeUrl.origin || !url.pathname.startsWith(appRoot)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          return (
            (await caches.match(request)) ||
            (await caches.match(appShellUrl)) ||
            Response.error()
          );
        })
    );
    return;
  }

  const cacheableDestination = ["script", "style", "image", "font"].includes(
    request.destination
  );
  if (!cacheableDestination) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached || Response.error());

      return cached || network;
    })
  );
});
