// Service worker shell — Phase 1: register only, no offline caching yet.
// Phase 2 will add cache-first strategies for static assets and app shell.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
