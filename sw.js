/* ═══════════════════════════════════════════════════════════════
   CURL CULT · Service Worker (lite)
   ───────────────────────────────────────────────────────────────
   Shell-only cache. 3D models and audio go straight to the network
   so the SW never hoards 250MB and fights the browser cache.
   ═══════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'curlcult-v20260418-shell';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './assets/logo.svg',
];

self.addEventListener('install', (event) => {
  // Install fast so the user never waits on the SW boot.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL).catch(() => { /* ok */ }))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // Purge any previous cache version; don't claim clients mid-session
  // (claiming can trigger a controllerchange that apps interpret as a
  // reload, which is exactly the "goes back to the beginning" bug).
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.map((n) => n === CACHE_NAME ? null : caches.delete(n)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 3D / media / audio: always go to network. Don't cache — these are
  // tens of MB each and fill up device storage fast.
  if (/\.(glb|usdz|mp3|mp4|wav|ogg|jpg|jpeg|png|webp)$/i.test(url.pathname)) {
    return; // let the browser handle it natively
  }

  // Shell: cache-first, no background refresh, no refetch loop.
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, clone));
      }
      return res;
    }).catch(() => {
      if (req.mode === 'navigate') return caches.match('./index.html');
    }))
  );
});
