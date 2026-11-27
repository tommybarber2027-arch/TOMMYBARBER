// Tommy Barber service worker — network-first so updates always show, cache only as offline fallback.
const CACHE = 'tommy-v6';
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "css/tailwind.css", "css/base.css", "css/theme.css", "assets/logo-gold.webp", "assets/logo-ink.webp", "js/core.js", "js/payroll.js", "js/pos.js", "js/invoices.js", "js/clients.js", "js/reports.js", "js/catalog.js", "js/staff.js", "js/users-settings.js", "js/names.js", "js/invoice-settings.js", "js/data-tools.js", "js/app.js", "js/icons.js", "js/theme.js", "js/ui.js"];
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES).catch(() => {})));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then(r => r || caches.match('index.html')))
  );
});
