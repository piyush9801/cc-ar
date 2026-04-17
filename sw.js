/* ═══════════════════════════════════════════════════════════════
   CURL CULT · Service Worker
   ───────────────────────────────────────────────────────────────
   Cache-first for the app shell + 3D assets so the experience
   works on a booth tablet with spotty wifi. Version-busted by
   bumping CACHE_NAME — old caches are pruned on activate.
   ═══════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'curlcult-v20260417r';
const SHELL_EXTRA = ['./audio.js'];

// App shell + core assets. 3D models and fonts get cached lazily
// on first fetch so the initial install doesn't stall.
const SHELL = [
  './',
  './index.html',
  './app.js?v=20260417i',
  './style.css?v=20260417g',
  './manifest.webmanifest',
  './assets/logo.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => { /* install-time failures shouldn't block the SW */ })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.map((n) => n === CACHE_NAME ? null : caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only GETs, only same-origin — leave model-viewer CDN + analytics alone.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first, network-fallback, write-through
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Refresh in background so the next visit has fresh content
        fetch(req).then((res) => {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then((c) => c.put(req, res.clone()));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone));
        }
        return res;
      }).catch(() => {
        // Final network failure — for navigations, return the cached shell
        if (req.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
