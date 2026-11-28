// Tommy Barber service worker — network-first so updates always show, cache only as offline fallback.
const CACHE = 'tommy-v26';
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "tailwind.css", "base.css", "theme.css", "logo-gold.webp", "logo-ink.webp", "receipt-logo.webp", "core.js", "payroll.js", "pos.js", "invoices.js", "clients.js", "reports.js", "catalog.js", "staff.js", "users-settings.js", "names.js", "invoice-settings.js", "data-tools.js", "attendance.js", "finance.js", "drawer.js", "bookings.js", "archive.js", "partners.js", "bookpage.js", "extras.js", "book.html", "app.js", "icons.js", "theme.js", "ui.js"];
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
const EXT = /^https:\/\/(www\.gstatic\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;
self.addEventListener('fetch', e => {
  const req = e.request;
  // مكتبات Firebase والخطوط: من الكاش أولاً (عشان البرنامج يشتغل أوفلاين) وتتحدّث في الخلفية
  if (req.method === 'GET' && EXT.test(req.url)) {
    e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
    return;
  }
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then(r => r || caches.match('index.html')))
  );
});
