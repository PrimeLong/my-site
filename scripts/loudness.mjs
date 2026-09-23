/* Замер громкости саундтрека.

   Каждая пьеса рендерится целиком в OfflineAudioContext настоящего Chromium (тот же
   движок, что играет в игре, только без колонок), после чего считается стробируемый
   RMS и пик. Так выравнивание громкости опирается на измерение, а не на слух.

     npm run loudness            — таблица: сырая громкость, действующая и новая поправка
     npm run loudness -- --write — пересчитать поправки в src/audio/loudness.js
     npm run loudness -- dawn    — только выбранные пьесы

   Поправки считаются от сырого сигнала (без компрессора и без старых поправок), так что
   повторный запуск с --write сходится к тем же числам, а не накапливает ошибку. */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const write = args.includes('--write');
const only = args.filter((a) => !a.startsWith('--'));
const root = fileURLToPath(new URL('..', import.meta.url));

// общая цель для всех пьес — дБ полной шкалы на шине музыки до мастер-компрессора
const TARGET = -31;
// потолок поправки: пьеса, которая требует больше, — повод переписать аранжировку
const MAX_BOOST = 6; const MAX_CUT = 9;
// выравнивание — не уравниловка: тихие настроения чуть тише, тревожные чуть плотнее,
// но ни одна пьеса не выпрыгивает из общего уровня
const MOOD_OFFSET = { frost: -1.5, calm: -0.5, slump: -0.5, crisis: 1, war: 0.5, totalitarian: 1, authoritarian: 0.5 };
const WORKERS = 4;

const server = await createServer({ root, logLevel: 'error', server: { port: 5199, strictPort: false } });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
try {
  const ctxs = await Promise.all(Array.from({ length: WORKERS }, async () => {
    const page = await browser.newPage();
    await page.goto(url);
    return page;
  }));
  const ids = await ctxs[0].evaluate(async () => Object.keys((await import('/src/audio/tracks.js')).TRACKS));
  const current = await ctxs[0].evaluate(async () => (await import('/src/audio/loudness.js')).TRACK_GAIN_DB);
  const list = only.length ? ids.filter((id) => only.includes(id)) : ids;
  const rows = []; const queue = [...list];
  await Promise.all(ctxs.map(async (page) => {
    while (queue.length) {
      const id = queue.shift();
      const t0 = Date.now();
      const r = await page.evaluate(async (tid) => {
        const eng = await import('/src/audio/engine.js');
        // одинаковое зерно для случайностей (гуманизация, шумы) — замер воспроизводим
        let s = 0x9e3779b9;
        const rnd = Math.random;
        Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        try {
          const raw = eng.measureBuffer(await eng.renderTrackOffline(tid, { trackGain: false }));
          const { TRACKS } = await import('/src/audio/tracks.js');
          return { raw, seconds: eng.trackSeconds(tid), mood: TRACKS[tid].mood };
        } finally { Math.random = rnd; }
      }, id);
      // без компрессора шина линейна: текущая громкость = сырая + действующая поправка
      const now = Math.round((r.raw.rms + (current[id] || 0)) * 10) / 10;
      const goal = TARGET + (MOOD_OFFSET[r.mood] || 0);
      const gain = Math.max(-MAX_CUT, Math.min(MAX_BOOST, Math.round((goal - r.raw.rms) * 2) / 2));
      rows.push({ id, ...r, now, gain });
      process.stdout.write(`${id.padEnd(12)} ${String(Math.round(r.seconds)).padStart(4)}с  сырой ${String(r.raw.rms).padStart(6)} дБ  пик ${String(r.raw.peak).padStart(5)}  сейчас ${String(now).padStart(6)} дБ  → поправка ${String(gain).padStart(5)}   (${Math.round((Date.now() - t0) / 1000)}с)\n`);
    }
  }));
  rows.sort((a, b) => list.indexOf(a.id) - list.indexOf(b.id));
  // заставки звучат поверх тишины — их общий уровень ставится на децибел выше цели пьес
  const stingers = await ctxs[0].evaluate(async () => {
    const eng = await import('/src/audio/engine.js');
    const { STINGERS } = await import('/src/audio/tracks.js');
    const out = [];
    for (const id of Object.keys(STINGERS)) out.push({ id, ...eng.measureBuffer(await eng.renderStingerOffline(id)) });
    return out;
  });
  stingers.forEach((x) => {
    x.gain = Math.max(-MAX_CUT, Math.min(MAX_BOOST, Math.round((TARGET + 1 - x.rms) * 2) / 2));
    console.log(`заставка ${x.id.padEnd(15)} ${String(x.rms).padStart(6)} дБ  пик ${String(x.peak).padStart(5)}  → поправка ${x.gain}`);
  });
  const med = [...rows].sort((a, b) => a.raw.rms - b.raw.rms)[rows.length >> 1].raw.rms;
  console.log(`\nмедиана сырой громкости ${med} дБ`);
  const spreadOf = (xs) => (Math.max(...xs) - Math.min(...xs)).toFixed(1);
  console.log(`разброс громкости: сырой ${spreadOf(rows.map((r) => r.raw.rms))} дБ, с действующими поправками ${spreadOf(rows.map((r) => r.now))} дБ, с новыми ${spreadOf(rows.map((r) => r.raw.rms + r.gain))} дБ (цель ${TARGET} дБ)`);
  if (write && !only.length) {
    const body = rows.map((r) => `  ${r.id}: ${r.gain},`).join('\n');
    writeFileSync(new URL('../src/audio/loudness.js', import.meta.url),
      `/* Поправки громкости пьес в дБ — сгенерировано scripts/loudness.mjs (npm run loudness -- --write).
   Не править руками: перезапустить скрипт после изменения аранжировки. Цель ${TARGET} дБ полной шкалы. */
export const TRACK_GAIN_DB = {
${body}
};
export const STINGER_GAIN_DB = {
${stingers.map((x) => `  ${x.id}: ${x.gain},`).join('\n')}
};
`);
    console.log('поправки записаны в src/audio/loudness.js');
  }
} finally {
  await browser.close();
  await server.close();
}
