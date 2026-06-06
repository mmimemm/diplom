const CACHE = 'itmania-v1';
// Кэшируем основные ресурсы для офлайн-работы
const STATIC = [
  '/',
  '/css/landing.css',
  '/css/app.css',
  '/js/landing.js',
  '/js/app.js',
  '/app/login.html'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
});

self.addEventListener('fetch', e => {
  // API запросы не кэшируем
  if (e.request.url.includes('/api/')) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
