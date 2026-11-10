// Service worker template. The build (vite.config.js) fills in the list of files and a version
// made from that list, then writes the result to dist/sw.js. After the first visit the whole game
// is on the device and opens with no network.
const FILES = __FILES__;
const CACHE = "inkfall-__VERSION__";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("inkfall-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(request.mode === "navigate" ? "./" : request);
      return hit || fetch(request);
    }),
  );
});
