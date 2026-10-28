/* Портреты с Wikimedia Commons: проверка свободной лицензии и разбор ответа Commons. Чистый модуль без
   браузера и сборки — его читают и приложение (src/learn/portraits.js), и скрипт сборки
   (scripts/fetch-portraits.mjs). */
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
