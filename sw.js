/* Jeep Transfer: funcionamento offline */
const V = 'jt-v1';
const FONTS = 'jt-fonts';
const SHELL = ['./', './index.html', './core.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== V && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // usa o que está salvo na hora e atualiza em segundo plano
    e.respondWith(
      caches.open(V).then((c) =>
        c.match(req, { ignoreSearch: true }).then((hit) => {
          const net = fetch(req)
            .then((r) => { if (r && r.ok) c.put(req, r.clone()); return r; })
            .catch(() => hit || c.match('./index.html'));
          return hit || net;
        })
      )
    );
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONTS).then((c) =>
        c.match(req).then((hit) => hit || fetch(req).then((r) => { c.put(req, r.clone()); return r; }))
      )
    );
  }
  // chamadas ao Google Apps Script passam direto para a rede
});
