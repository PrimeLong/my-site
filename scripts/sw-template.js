/* Офлайн для приложения на телефоне: уроки Пути, учебник и уже открытые экраны работают без
   сети. Файлы сборки (/assets, имена с хешем) — из кэша, а если их там нет — из сети с
   сохранением в кэш. Страница — сначала из сети (чтобы новая версия приходила сразу), без
   сети — последняя сохранённая. Запросы к серверу игры (/api) не трогаем.
   Это шаблон: сборка (scripts/sw-plugin.js) кладёт в BUILD список файлов /assets/ текущей
   версии, и при её активации файлы прошлых сборок удаляются из кэша — они не копятся. */
const BUILD = /*__BUILD__*/ { id: 'dev', assets: [] };
const CACHE = 'inflatia-v1';
const SHELL = ['/', '/site.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
// из кэша уходит всё, чего нет в текущей сборке: чужие версии кэша и старые файлы /assets/
const current = new Set(BUILD.assets.map((f) => `/${f}`));
async function cleanup() {
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
  const cache = await caches.open(CACHE);
  const reqs = await cache.keys();
  await Promise.all(reqs.filter((r) => { const p = new URL(r.url).pathname; return p.startsWith('/assets/') && !current.has(p); }).map((r) => cache.delete(r)));
}
self.addEventListener('activate', (e) => { e.waitUntil(cleanup()); });

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
