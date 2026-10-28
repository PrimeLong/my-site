#!/usr/bin/env node
/* Портреты для «Персоналий» (src/learn/people.js): для каждого человека — главное фото его статьи в
   английской Википедии, если файл лежит на Wikimedia Commons и его лицензия свободная (общественное
   достояние, CC0, CC BY, CC BY-SA). Несвободные («fair use») пропускаются — у таких людей останется
   медальон с инициалами. Скачивает уменьшенную копию (480 px) в public/people/<id>.jpg и пишет
   src/learn/people-photos.js: автор, лицензия, ссылка на страницу файла — подпись под портретом.
   Проверки лицензии и имени файла — те же, что у браузера (src/learn/portraits.js).

   Портреты, скачанные при сборке, приложение отдаёт со своего адреса: браузеру ученика не нужно ходить
   в Википедию (её могут не пустить сеть, школа или CSP — жалоба «у Персоналий всё так же нет фото»).
   Сборка на Vercel запускает скрипт сама (vercel.json, buildCommand) с ключом --soft: нет сети —
   прежний список остаётся, сборка идёт дальше.

   Фото, положенные в public/people руками (инструкция — people/README.md), скрипт не трогает и не
   перезаписывает: у такого человека он ничего не скачивает.

   Запуск: npm run portraits   (нужен доступ к en.wikipedia.org, commons.wikimedia.org
   и upload.wikimedia.org). */
import { writeFile, mkdir } from 'node:fs/promises';
import { PEOPLE } from '../src/learn/people.js';
import { commonsFile, photoFromCommons } from '../src/learn/commons.js';
import { PHOTOS } from '../src/learn/people-photos.js';
import { listPeoplePhotos } from './voice-files-plugin.js';

const soft = process.argv.includes('--soft');
const UA = { 'User-Agent': 'InflatiaPortraits/1.0 (educational app; portraits with attribution)' };
const get = (url) => fetch(url, { headers: UA, signal: AbortSignal.timeout(10000) });

const out = {};
let reached = false;
await mkdir(new URL('../public/people/', import.meta.url), { recursive: true });
// положенные руками: файл есть, а в прошлом списке скачанных его нет
const manual = new Set(Object.keys(listPeoplePhotos()).filter((id) => !PHOTOS[id]));
for (const p of PEOPLE.flatMap((g) => g.people)) {
  if (!p.wiki) continue;
  if (manual.has(p.id)) { console.log(`· ${p.id}: фото положено руками — не трогаю`); continue; }
  try {
    const res = await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(p.wiki)}`);
    reached = true;
    const sum = await res.json();
    const name = commonsFile((sum.originalimage || sum.thumbnail || {}).source || '');
    if (!name) { console.log(`— ${p.id}: нет фото на Commons`); continue; }
    const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=480&titles=${encodeURIComponent(`File:${name}`)}`;
    const page = Object.values(((await (await get(api)).json()).query || {}).pages || {})[0] || {};
    const ph = photoFromCommons((page.imageinfo || [])[0]);
    if (!ph) { console.log(`— ${p.id}: несвободная лицензия — пропускаю`); continue; }
    const img = await get(ph.file);
    if (!img.ok) throw new Error(`HTTP ${img.status}`);
    await writeFile(new URL(`../public/people/${p.id}.jpg`, import.meta.url), Buffer.from(await img.arrayBuffer()));
    out[p.id] = { ...ph, file: `/people/${p.id}.jpg` };
    console.log(`✓ ${p.id}: ${ph.license}`);
  } catch (e) {
    console.log(`× ${p.id}: ${e.message}`);
    // Википедия не ответила вовсе — дальше не ждём: остальные запросы упадут так же
    if (!reached) break;
  }
}
if (!Object.keys(out).length) {
  console.log(soft ? 'Портреты не обновлены (нет доступа к Википедии) — остаётся прежний список.' : 'Ни одного портрета не скачано.');
  process.exit(soft ? 0 : 1);
}
const body = `/* Портреты «Персоналий»: id человека → файл в public/people, автор и лицензия. Файл пишет
   scripts/fetch-portraits.mjs — только с Wikimedia Commons и только общественное достояние или
   свободные лицензии (CC0, CC BY, CC BY-SA). Нет записи — у человека гравированный медальон с
   инициалами (src/learn-people.jsx), а не чужая картинка. */
export const PHOTOS = ${JSON.stringify(out, null, 2)};
`;
await writeFile(new URL('../src/learn/people-photos.js', import.meta.url), body);
console.log(`Готово: ${Object.keys(out).length} портретов.`);
