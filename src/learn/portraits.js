/* ПОРТРЕТЫ «ПЕРСОНАЛИЙ» С ВИКИПЕДИИ (docs/mechanics.md, «Персоналии»). Сначала — скачанные заранее
   (src/learn/people-photos.js, пишет scripts/fetch-portraits.mjs). Иначе браузер ученика сам берёт
   главное фото статьи английской Википедии (people.js, поле wiki): только файл с Wikimedia Commons и
   только со свободной лицензией — общественное достояние, CC0, CC BY, CC BY-SA; несвободное («fair use»)
   не показываем — остаётся гравированный медальон. Автор и лицензия — подписью под портретом.
   Ответ помнит устройство (ems-portraits-v1) на месяц: Википедию не спрашиваем при каждом открытии.
   Автотест (Playwright) в Википедию не ходит, если сам не попросил (ems-portraits-test). */
import { PHOTOS } from './people-photos.js';

const KEY = 'ems-portraits-v1';
const TTL = 30 * 24 * 3600 * 1000;
export const FREE_LICENSE = /public domain|^pd\b|^pd-|cc0|cc[- ]by/i;
export const NONFREE_LICENSE = /fair use|non-free|copyrighted|all rights reserved/i;
export const isFreeLicense = (s) => !!s && FREE_LICENSE.test(s) && !NONFREE_LICENSE.test(s);
// разметка Commons → текст: без тегов, сущности (&amp;, &#39;, &nbsp;…) — символами
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const strip = (html = '') => String(html).replace(/<[^>]+>/g, '')
  .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e.toLowerCase()] ?? m))
  .replace(/\s+/g, ' ').trim();
// имя файла Commons из ссылки на картинку (в том числе на уменьшенную копию …/thumb/a/ab/Имя.jpg/320px-Имя.jpg)
export function commonsFile(url) {
  try {
    const u = new URL(url);
    if (u.hostname !== 'upload.wikimedia.org' || !u.pathname.includes('/wikipedia/commons/')) return null;
    const parts = decodeURIComponent(u.pathname).split('/');
    const i = parts.indexOf('thumb');
    return i >= 0 ? parts[i + 3] : parts[parts.length - 1];
  } catch { return null; }
}
// ответ Commons (imageinfo с extmetadata) → портрет или null, если лицензия не свободная
export function photoFromCommons(info) {
  if (!info) return null;
  const meta = info.extmetadata || {};
  const license = strip((meta.LicenseShortName || {}).value);
  if (!isFreeLicense(license)) return null;
  const src = info.thumburl || info.url;
  if (!src || !String(src).startsWith('https://upload.wikimedia.org/')) return null;
  return { file: src, author: strip((meta.Artist || {}).value) || 'автор неизвестен', license, source: info.descriptionurl || '' };
}

const offline = () => {
  try { return typeof navigator !== 'undefined' && !!navigator.webdriver && localStorage.getItem('ems-portraits-test') !== '1'; } catch { return true; }
};
const readCache = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };
const writeCache = (id, v) => { try { const c = readCache(); c[id] = { ...v, at: Date.now() }; localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* приватный режим */ } };
const inflight = {};

// сразу, без сети: скачанный заранее или запомненный устройством; undefined — ещё не знаем
export function cachedPhoto(p) {
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
