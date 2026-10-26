#!/usr/bin/env node
/* Портреты для «Персоналий» (src/learn/people.js): для каждого человека — главное фото его статьи в
   английской Википедии, если файл лежит на Wikimedia Commons и его лицензия свободная (общественное
   достояние, CC0, CC BY, CC BY-SA). Несвободные («fair use») пропускаются — у таких людей останется
   медальон с инициалами. Скачивает уменьшенную копию (480 px) в public/people/<id>.jpg и пишет
   src/learn/people-photos.js: автор, лицензия, ссылка на страницу файла — подпись под портретом.

   Запуск: node scripts/fetch-portraits.mjs   (нужен доступ к en.wikipedia.org, commons.wikimedia.org
   и upload.wikimedia.org). */
import { writeFile, mkdir } from 'node:fs/promises';
import { PEOPLE } from '../src/learn/people.js';

const UA = { 'User-Agent': 'InflatiaPortraits/1.0 (educational app; portraits with attribution)' };
const FREE = /public domain|^pd|cc0|cc[- ]by/i;
const NONFREE = /fair use|non-free|copyrighted/i;
const strip = (html = '') => String(html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const fileOf = (url) => {
  const parts = decodeURIComponent(new URL(url).pathname).split('/');
  const i = parts.indexOf('thumb');
  return i >= 0 ? parts[i + 3] : parts[parts.length - 1];
};

const out = {};
await mkdir(new URL('../public/people/', import.meta.url), { recursive: true });
for (const p of PEOPLE.flatMap((g) => g.people)) {
  try {
    const sum = await (await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(p.wiki)}`, { headers: UA })).json();
    const src = (sum.originalimage || sum.thumbnail || {}).source;
    if (!src || !src.includes('/wikipedia/commons/')) { console.log(`— ${p.id}: нет свободного фото на Commons`); continue; }
    const name = fileOf(src);
    const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=480&titles=${encodeURIComponent(`File:${name}`)}`;
    const info = Object.values((await (await fetch(api, { headers: UA })).json()).query.pages)[0].imageinfo[0];
    const meta = info.extmetadata || {};
    const license = strip((meta.LicenseShortName || {}).value);
    if (!FREE.test(license) || NONFREE.test(license)) { console.log(`— ${p.id}: лицензия «${license}» — пропускаю`); continue; }
    const img = await fetch(info.thumburl || info.url, { headers: UA });
    if (!img.ok) throw new Error(`HTTP ${img.status}`);
    await writeFile(new URL(`../public/people/${p.id}.jpg`, import.meta.url), Buffer.from(await img.arrayBuffer()));
    out[p.id] = { file: `/people/${p.id}.jpg`, author: strip((meta.Artist || {}).value) || 'неизвестен', license, source: info.descriptionurl };
    console.log(`✓ ${p.id}: ${license}`);
  } catch (e) { console.log(`× ${p.id}: ${e.message}`); }
}
const body = `/* Портреты «Персоналий»: id человека → файл в public/people, автор и лицензия. Файл пишет
   scripts/fetch-portraits.mjs — только с Wikimedia Commons и только общественное достояние или
   свободные лицензии (CC0, CC BY, CC BY-SA). Нет записи — у человека гравированный медальон с
   инициалами (src/learn-people.jsx), а не чужая картинка. */
export const PHOTOS = ${JSON.stringify(out, null, 2)};
`;
await writeFile(new URL('../src/learn/people-photos.js', import.meta.url), body);
console.log(`Готово: ${Object.keys(out).length} портретов.`);
