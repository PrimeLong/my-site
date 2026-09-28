/* Офлайн для приложения на телефоне: уроки Пути, учебник и уже открытые экраны работают без
   сети. Файлы сборки (/assets, имена с хешем) — из кэша, а если их там нет — из сети с
   сохранением в кэш. Страница — сначала из сети (чтобы новая версия приходила сразу), без
   сети — последняя сохранённая. Запросы к серверу игры (/api) не трогаем. */
const CACHE = 'inflatia-v1';
const SHELL = ['/', '/site.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
});

const put = (req, res) => {
  if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
  return res;
};
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => put('/', res)).catch(() => caches.match('/').then((r) => r || Response.error())));
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res))));
    return;
  }
  // иконки, манифест и прочая статика: из кэша сразу, в фоне — обновить
  e.respondWith(caches.match(req).then((hit) => {
    const net = fetch(req).then((res) => put(req, res)).catch(() => hit || Response.error());
    return hit || net;
  }));
});
