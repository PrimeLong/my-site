/* ПОРТРЕТЫ «ПЕРСОНАЛИЙ» С ВИКИПЕДИИ (docs/mechanics.md, «Персоналии»). Сначала — скачанные заранее
   (src/learn/people-photos.js, пишет scripts/fetch-portraits.mjs). Иначе браузер ученика сам берёт
   главное фото статьи английской Википедии (people.js, поле wiki): только файл с Wikimedia Commons и
   только со свободной лицензией — общественное достояние, CC0, CC BY, CC BY-SA; несвободное («fair use»)
   не показываем — остаётся гравированный медальон. Автор и лицензия — подписью под портретом.
   Ответ помнит устройство (ems-portraits-v1) на месяц: Википедию не спрашиваем при каждом открытии.
   Автотест (Playwright) в Википедию не ходит, если сам не попросил (ems-portraits-test).
   Первыми — фото, положенные руками в public/people/<id>.jpg (список считается при сборке,
   scripts/voice-files-plugin.js; подписи — people/credits.csv; инструкция — people/README.md): они
   приходят со своего адреса и не зависят от того, пускает ли сеть ученика в Википедию. */
import { PHOTOS } from './people-photos.js';
import PEOPLE_FILES from 'virtual:people-files';
import { commonsFile, photoFromCommons, isFreeLicense, FREE_LICENSE, NONFREE_LICENSE } from './commons.js';

export { commonsFile, photoFromCommons, isFreeLicense, FREE_LICENSE, NONFREE_LICENSE };

const KEY = 'ems-portraits-v1';
const TTL = 30 * 24 * 3600 * 1000;
const offline = () => {
  try { return typeof navigator !== 'undefined' && !!navigator.webdriver && localStorage.getItem('ems-portraits-test') !== '1'; } catch { return true; }
};
const readCache = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };
const writeCache = (id, v) => { try { const c = readCache(); c[id] = { ...v, at: Date.now() }; localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* приватный режим */ } };
const inflight = {};

// фото из public/people: подпись — из скачанных при сборке или из people/credits.csv (может и не быть)
export function localPhoto(id) {
  const file = (PEOPLE_FILES.files || {})[id];
  if (!file) return null;
  const c = PHOTOS[id] || (PEOPLE_FILES.credits || {})[id] || {};
  return { file: `/people/${file}`, author: c.author || '', license: c.license || '', source: c.source || '' };
}
// сразу, без сети: положенный руками, скачанный заранее или запомненный устройством; undefined — ещё не знаем
export function cachedPhoto(p) {
  const local = localPhoto(p.id);
  if (local) return local;
  if (PHOTOS[p.id]) return PHOTOS[p.id];
  const c = readCache()[p.id];
  if (c && Date.now() - c.at < TTL) return c.none ? null : c;
  return undefined;
}

export function loadPhoto(p) {
  const known = cachedPhoto(p);
  if (known !== undefined) return Promise.resolve(known);
  if (!p.wiki || offline() || typeof fetch === 'undefined') return Promise.resolve(null);
  if (!inflight[p.id]) {
    inflight[p.id] = (async () => {
      const sum = await (await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(p.wiki)}`)).json();
      const name = commonsFile((sum.originalimage || sum.thumbnail || {}).source || '');
      if (!name) return null;
      const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=480&titles=${encodeURIComponent(`File:${name}`)}`;
      const pages = ((await (await fetch(api)).json()).query || {}).pages || {};
      const page = Object.values(pages)[0] || {};
      return photoFromCommons((page.imageinfo || [])[0]);
    })().then((ph) => { writeCache(p.id, ph || { none: true }); return ph; })
      // сеть не ответила — медальон; спросим в другой раз
      .catch(() => null)
      .finally(() => { delete inflight[p.id]; });
  }
  return inflight[p.id];
}
