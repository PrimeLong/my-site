import { describe, it, expect } from 'vitest';
import { renderServiceWorker } from '../../../scripts/sw-plugin.js';

// запускаем текст sw.js в игрушечном окружении service worker: кэш — Map
function runWorker(source, cached) {
  const handlers = {};
  const store = new Map([['inflatia-v1', new Map(cached.map((u) => [u, true]))], ['inflatia-old', new Map()]]);
  const cacheOf = (name) => {
    const m = store.get(name) || store.set(name, new Map()).get(name);
    return { keys: async () => [...m.keys()].map((url) => ({ url })), delete: async (r) => m.delete(r.url), put: async (r) => m.set(String(r), true), addAll: async (l) => l.forEach((u) => m.set(u, true)) };
  };
  const caches = { keys: async () => [...store.keys()], delete: async (k) => store.delete(k), open: async (k) => cacheOf(k) };
  const self = { addEventListener: (t, f) => { handlers[t] = f; }, location: { origin: 'https://inflatia.test' }, skipWaiting: () => {} };
  new Function('self', 'caches', source)(self, caches);
  return { handlers, store };
}

describe('service worker', () => {
  it('каждая сборка получает свой номер и список файлов', () => {
    const a = renderServiceWorker(['assets/index-A.js', 'assets/learn-A.js']);
    const b = renderServiceWorker(['assets/index-B.js', 'assets/learn-A.js']);
    expect(a).toContain('"assets/index-A.js"');
    expect(a).not.toContain('/*__BUILD__*/');
    expect(a.match(/"id":"(\w+)"/)[1]).not.toBe(b.match(/"id":"(\w+)"/)[1]);
  });
  it('при активации удаляет файлы прошлых сборок и чужие кэши, текущие и страницу оставляет', async () => {
    const src = renderServiceWorker(['assets/index-B.js', 'assets/learn-A.js']);
    const origin = 'https://inflatia.test';
    const { handlers, store } = runWorker(src, [`${origin}/`, `${origin}/assets/index-A.js`, `${origin}/assets/index-B.js`, `${origin}/assets/learn-A.js`, `${origin}/icon-192.png`]);
    let done;
    handlers.activate({ waitUntil: (p) => { done = p; } });
    await done;
    expect([...store.keys()]).toEqual(['inflatia-v1']);
    expect([...store.get('inflatia-v1').keys()].sort()).toEqual([`${origin}/`, `${origin}/assets/index-B.js`, `${origin}/assets/learn-A.js`, `${origin}/icon-192.png`]);
  });
});
