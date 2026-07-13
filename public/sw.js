const CACHE = 'alpha-portal-static-v6';
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/favicon-32.png',
  '/icon-192.png',
  '/icon-512.png',
  '/portal-logo.png',
  '/og-image.png',
];

function isSameOriginRequest(requestUrl) {
  return requestUrl.origin === self.location.origin;
}

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/assets/') ||
    /\.(?:css|js|mjs|png|jpg|jpeg|webp|svg|ico|woff2?|webmanifest)$/i.test(pathname)
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.allSettled(APP_SHELL_URLS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  if (!isSameOriginRequest(requestUrl)) return;

  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put('/index.html', responseClone)));
          }
          return response;
        })
        .catch(() => caches.match('/index.html').then((cachedResponse) => cachedResponse || caches.match('/'))),
    );
    return;
  }

  if (!isStaticAsset(requestUrl.pathname)) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(request).then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, responseClone)));
        }
        return response;
      });
    }),
  );
});
