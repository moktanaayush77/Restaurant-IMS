/*
 * Minimal service worker for installability.
 *
 * The app runs on a LAN with constant power, so we deliberately do NOT cache API
 * responses or order data — every screen must show live state. We only pre-cache
 * the app shell so a reload is instant; navigation falls back to the cached shell
 * if the network blips, and API/WebSocket traffic always goes straight to network.
 */
const SHELL = 'rms-shell-v1'
const SHELL_URLS = ['/', '/index.html']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_URLS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Never intercept the API or WebSocket upgrade — always live.
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws') || url.pathname.startsWith('/media')) {
    return
  }

  // SPA navigations: network-first, fall back to the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')))
    return
  }

  // Static assets: cache-first.
  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request).then((hit) =>
        hit ||
        fetch(request).then((res) => {
          const copy = res.clone()
          caches.open(SHELL).then((c) => c.put(request, copy))
          return res
        }),
      ),
    )
  }
})
