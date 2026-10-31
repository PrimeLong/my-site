/* Выровнять громкость записей речи: эфиры «Слушай» (public/voice/*.mp3) и книги полки (public/books/*.mp3).
   Раньше книга Смита играла на −14,3 LUFS с пиком +0,5 dBFS (перегруз, 128 кбит/с), а эфиры — около −26 LUFS:
   после эфира книга оглушала, а эфир после книги было не расслышать.

   Цель для речи: −16 LUFS (интегральная громкость, EBU R128), истинный пик не выше −1,5 dBTP, моно,
   MP3 56 кбит/с, 44,1 кГц, без встроенной обложки и без тегов. Два прохода ffmpeg loudnorm: первый меряет,
   второй выравнивает по замеру (линейно, без «накачки», если хватает запаса по пику).

   Нужен ffmpeg (https://ffmpeg.org/download.html; macOS: brew install ffmpeg). Запуск:
     node scripts/voice-normalize.mjs              — все файлы, которые ещё не в норме
     node scripts/voice-normalize.mjs --check      — только проверить (таблица; код выхода 1, если есть что выравнивать)
     node scripts/voice-normalize.mjs --force      — переписать все
     node scripts/voice-normalize.mjs public/voice/host-026hwr8.mp3 …   — только эти файлы
   Файл в норме: громкость −16 ± 1 LUFS, пик не выше −1,5 dBTP, моно, 56 кбит/с, без картинки. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIRS = ['public/voice', 'public/books'].map((d) => path.join(ROOT, d));
export const TARGET = { I: -16, TP: -1.5, LRA: 11, kbps: 56, channels: 1, rate: 44100 };
const TOLERANCE_LU = 1;

const argv = process.argv.slice(2);
const force = argv.includes('--force');
const checkOnly = argv.includes('--check');
const given = argv.filter((a) => !a.startsWith('--'));

function tool(name, args) {
  const r = spawnSync(name, args, { encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${name} ${args.join(' ')}\n${(r.stderr || '').slice(-600)}`);
  return r;
}
const hasFfmpeg = () => { try { tool('ffmpeg', ['-version']); return true; } catch { return false; } };
const LOUDNORM = `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}`;

// первый проход: громкость, пик, диапазон и порог — json в конце stderr
function measure(file) {
  const err = tool('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-map', '0:a:0', '-af', `${LOUDNORM}:print_format=json`, '-f', 'null', '-']).stderr;
  const json = err.slice(err.lastIndexOf('{'), err.lastIndexOf('}') + 1);
  const m = JSON.parse(json);
  return { I: Number(m.input_i), TP: Number(m.input_tp), LRA: Number(m.input_lra), thresh: Number(m.input_thresh), offset: Number(m.target_offset) };
}
// формат: каналы, битрейт, есть ли картинка (обложка — видеопоток attached_pic)
function probe(file) {
  const out = tool('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,channels,bit_rate', '-of', 'json', file]).stdout;
  const streams = JSON.parse(out).streams || [];
  const a = streams.find((s) => s.codec_type === 'audio') || {};
  return { channels: Number(a.channels), kbps: Math.round(Number(a.bit_rate) / 1000), picture: streams.some((s) => s.codec_type === 'video') };
}
export const inNorm = (m, p) => Math.abs(m.I - TARGET.I) <= TOLERANCE_LU && m.TP <= TARGET.TP
  && p.channels === TARGET.channels && Math.abs(p.kbps - TARGET.kbps) <= 1 && !p.picture;

/* второй проход: выравнивание по замеру, моно, 56 кбит/с, без обложки и тегов. MP3-кодер добавляет
   межсэмпловые выбросы (+0,3…0,6 дБ к пику), поэтому потолок внутри loudnorm ниже цели; если после кодирования
   пик всё же выше −1,5 dBTP — ещё раз из исходника с потолком ниже на величину перебора. */
function encode(src, dst, m, tp, i) {
  const af = `loudnorm=I=${i.toFixed(2)}:TP=${tp.toFixed(2)}:LRA=${TARGET.LRA}:measured_I=${m.I}:measured_TP=${m.TP}:measured_LRA=${m.LRA}:measured_thresh=${m.thresh}:offset=${m.offset}:linear=true,aresample=${TARGET.rate}`;
  tool('ffmpeg', ['-hide_banner', '-nostats', '-y', '-i', src, '-map', '0:a:0', '-map_metadata', '-1', '-af', af,
    '-ac', String(TARGET.channels), '-ar', String(TARGET.rate), '-c:a', 'libmp3lame', '-b:a', `${TARGET.kbps}k`, '-id3v2_version', '0', '-write_xing', '1', dst]);
}
function normalize(file, m) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-'));
  const src = path.join(dir, `src-${path.basename(file)}`); const out = path.join(dir, path.basename(file));
  fs.copyFileSync(file, src);
  /* громкая по пикам речь не выравнивается линейно, и loudnorm в динамическом режиме недотягивает (−17 вместо
     −16): тогда цель поднимается на величину недобора — тоже из исходника, без второго сжатия результата */
  let tp = TARGET.TP - 0.5; let i = TARGET.I;
  for (let k = 0; k < 5; k += 1) {
    encode(src, out, m, tp, i);
    const got = measure(out);
    const peakOk = got.TP <= TARGET.TP; const loudOk = Math.abs(got.I - TARGET.I) <= 0.5;
    if (peakOk && loudOk) break;
    if (!peakOk) tp -= got.TP - TARGET.TP + 0.2;
    if (!loudOk) i = Math.min(-10, i + (TARGET.I - got.I));
  }
  fs.copyFileSync(out, file);
  fs.rmSync(dir, { recursive: true, force: true });
}

function files() {
  if (given.length) return given.map((f) => path.resolve(f));
  return DIRS.filter((d) => fs.existsSync(d)).flatMap((d) => fs.readdirSync(d).filter((f) => /\.mp3$/i.test(f)).sort().map((f) => path.join(d, f)));
}
const fmt = (m, p) => `${m.I.toFixed(1)} LUFS, пик ${m.TP > 0 ? '+' : ''}${m.TP.toFixed(1)} dBTP, ${p.channels === 1 ? 'моно' : `${p.channels} кан.`}, ${p.kbps} кбит/с${p.picture ? ', с обложкой' : ''}`;

function main() {
  if (!hasFfmpeg()) { console.error('Нужен ffmpeg: https://ffmpeg.org/download.html (macOS: brew install ffmpeg)'); process.exit(2); }
  const list = files();
  let todo = 0; let done = 0; let bytes = [0, 0];
  for (const f of list) {
    const rel = path.relative(ROOT, f);
    const m = measure(f); const p = probe(f);
    const ok = inNorm(m, p);
    if (ok && !force) { if (checkOnly) console.log(`в норме  ${rel}: ${fmt(m, p)}`); continue; }
    todo += 1;
    if (checkOnly) { console.log(`выровнять ${rel}: ${fmt(m, p)}`); continue; }
    const was = fs.statSync(f).size;
    normalize(f, m);
    const m2 = measure(f); const p2 = probe(f);
    bytes = [bytes[0] + was, bytes[1] + fs.statSync(f).size];
    done += 1;
    console.log(`${rel}: ${fmt(m, p)} → ${fmt(m2, p2)}${inNorm(m2, p2) ? '' : ' — НЕ В НОРМЕ'}`);
  }
  if (checkOnly) {
    console.log(todo ? `Выровнять: ${todo} из ${list.length}.` : `Все ${list.length} записей в норме: ${TARGET.I} LUFS, пик ≤ ${TARGET.TP} dBTP, моно, ${TARGET.kbps} кбит/с.`);
    process.exit(todo ? 1 : 0);
  }
  console.log(done ? `Готово: ${done} из ${list.length}, ${(bytes[0] / 1048576).toFixed(1)} → ${(bytes[1] / 1048576).toFixed(1)} МБ.` : `Выравнивать нечего: все ${list.length} в норме.`);
}

main();
