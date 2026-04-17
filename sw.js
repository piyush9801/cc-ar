/* ═══════════════════════════════════════════════════════════════
   CURL CULT · Self-unregistering service worker
   ───────────────────────────────────────────────────────────────
   The previous SW versions had a cache-first / background-refresh
   pattern that triggered reload loops on mobile Safari. This shim
   exists so any browser that still has an old SW registered will
   replace it on next visit with one that immediately nukes every
   cache and removes itself — letting the page fall back to the
   browser's native HTTP cache (which is what we actually want).
   ═══════════════════════════════════════════════════════════════ */

self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    const regs = await self.registration.unregister();
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    // Don't force-reload; let the page finish the current flow.
    // Next navigation will load without any SW in the way.
  })());
});

// Passthrough: never intercept fetches.
self.addEventListener('fetch', () => { /* noop — browser handles */ });
