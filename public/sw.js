/* Karban Service Worker — Phase 2.2 PWA
   استراتژی:
   • precache: منابع ثابت بحرانی (CSS، فونت، لوگو، manifest)
   • runtime stale-while-revalidate: تصاویر و صفحات HTML
   • network-first برای API و Supabase (همیشه تازه)
*/
const VERSION = 'karban-v1-2026-10-06';
const PRECACHE = `${VERSION}-precache`;
const RUNTIME = `${VERSION}-runtime`;

const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/assets/images/Gemini_Generated_Image_3xp4kz3xp4kz3xp4-removebg-preview.png',
  '/assets/images/hero-main.webp',
  '/assets/images/sec-services.webp',
  '/assets/images/sec-contracts.webp',
  '/assets/images/sec-knowledge.webp',
  '/assets/images/sec-requests.webp',
  '/fonts/Vazirmatn-Regular.woff2',
  '/fonts/Vazirmatn-Medium.woff2',
  '/fonts/Vazirmatn-Bold.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(PRECACHE).then((c) => c.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  /* فقط GET کش کن */
  if (req.method !== 'GET') return;

  /* Supabase / API / notify / otp: همیشه شبکه */
  if (url.hostname.includes('supabase.co') || url.pathname.startsWith('/api/')) {
    return; /* اجازه بده مرورگر خودش برود */
  }

  /* همینجا (same-origin): stale-while-revalidate */
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(RUNTIME).then(async (cache) => {
        const cached = await cache.match(req);
        const fetchPromise = fetch(req).then((res) => {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});
