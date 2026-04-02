// This service worker unregisters itself to clear stale caches from old builds.
// A new sw.js will be generated automatically on the next production build (next build).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", async () => {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
  await self.registration.unregister();
  const clients = await self.clients.matchAll({ type: "window" });
  clients.forEach((client) => client.navigate(client.url));
});
