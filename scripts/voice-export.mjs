#!/usr/bin/env node
/* Тексты для озвучки (src/learn/voice-lines.js): все сюжеты эфиров «Слушай» — по файлу на героя
   в папке voice/. У каждой реплики — имя будущей записи; готовую запись кладут в public/voice/ под этим
   именем, и после сборки урок играет её вместо голоса браузера. Отмечает, какие реплики уже записаны,
   и какие записи устарели (текст реплики поменяли — у неё новое имя, старый файл можно удалить).
   Порядок работы — voice/README.md.

   Запуск: npm run voice:export */
import { writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { listVoiceFiles } from './voice-files-plugin.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = new URL('../voice/', import.meta.url);
// курс собирается из глав через import.meta.glob — грузим его тем же Vite, что и сайт
const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' });
let lines; let cast;
try {
  const { LESSONS } = await server.ssrLoadModule('/src/learn/course.js');
  const { plainText } = await server.ssrLoadModule('/src/textbook/content.js');
  const { CAST, DEFAULT_VOICE } = await server.ssrLoadModule('/src/learn/cast.js');
  const { voiceLines } = await server.ssrLoadModule('/src/learn/voice-lines.js');
  const { HERO_VOICE } = await server.ssrLoadModule('/src/learn/voices.js');
  lines = voiceLines(LESSONS, plainText, DEFAULT_VOICE.listen);
  cast = Object.fromEntries(Object.entries(CAST).map(([id, c]) => [id, { ...c, voice: HERO_VOICE[id] }]));
} finally {
  await server.close();
}

const recorded = new Set(listVoiceFiles());
const ids = new Set(lines.map((l) => l.id));
const stale = [...recorded].filter((id) => !ids.has(id));
const speed = (r) => (r > 1.02 ? 'чуть быстрее обычного' : r < 0.97 ? 'чуть медленнее обычного' : 'обычный темп');
const pitch = (p) => (p > 1.08 ? 'выше' : p < 0.97 ? 'ниже' : 'обычный');
const voiceHint = (c) => [c.voice.female == null ? 'любой нейтральный голос' : c.voice.female ? 'женский голос' : 'мужской голос', speed(c.voice.rate), `тон ${pitch(c.voice.pitch)}`].join(', ');

await mkdir(out, { recursive: true });
// прошлая выгрузка: файлы героев переписываются целиком (README.md — не трогаем)
for (const f of await readdir(out)) if (f.endsWith('.txt') || f === 'lines.csv') await rm(new URL(f, out));

const byWho = Object.groupBy(lines, (l) => l.who);
const order = Object.keys(byWho).sort((a, b) => byWho[b].length - byWho[a].length);
for (const who of order) {
  const c = cast[who];
  const list = byWho[who];
  const done = list.filter((l) => recorded.has(l.id)).length;
  const head = [
    `${c.name} — ${c.role}`,
    `Голос: ${voiceHint(c)}.`,
    `Реплик: ${list.length}, записано: ${done}, символов: ${list.reduce((a, l) => a + l.tts.length, 0)}.`,
    'Каждую реплику озвучьте отдельно и сохраните в public/voice/ под именем из строки «файл».',
    '',
  ];
  const body = list.map((l, k) => [
    `${k + 1}. файл: ${l.id}.mp3${recorded.has(l.id) ? '   ✓ записано' : ''}`,
    `   урок: ${l.lesson}`,
    l.tts,
    '',
  ].join('\n'));
  await writeFile(new URL(`${who}.txt`, out), `${head.join('\n')}\n${body.join('\n')}`);
}
const csv = (s) => `"${String(s).replace(/"/g, '""')}"`;
// BOM — чтобы Excel открыл кириллицу
await writeFile(new URL('lines.csv', out), `\uFEFF${['file', 'who', 'lesson', 'recorded', 'text'].join(';')}\n${lines.map((l) => [`${l.id}.mp3`, l.who, l.lesson, recorded.has(l.id) ? 'yes' : 'no', csv(l.tts)].join(';')).join('\n')}\n`);

const total = lines.reduce((a, l) => a + l.tts.length, 0);
console.log(`Реплик: ${lines.length} (${total} символов), героев: ${order.length}, уже записано: ${lines.length - lines.filter((l) => !recorded.has(l.id)).length}.`);
order.forEach((who) => console.log(`  voice/${who}.txt — ${cast[who].name}: ${byWho[who].length}`));
if (stale.length) console.log(`Устаревшие записи (текст реплики поменялся) — можно удалить из public/voice/:\n${stale.map((id) => `  ${id}.mp3`).join('\n')}`);
