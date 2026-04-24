// SW stub: ล้าง cache เก่าและ unregister ตัวเองเพื่อรอ sw.js จาก production build ใหม่
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
