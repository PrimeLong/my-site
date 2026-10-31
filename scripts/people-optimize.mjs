/* Пережать портреты «Персоналий» (public/people): ширина не больше 480 px, JPEG не больше 80 КБ, без
   метаданных (EXIF, ICC, миниатюры). Рамка портрета на экране — около 170 px, на ПК в карточке — до 240;
   480 px хватает на экран с плотностью ×2. Исходник шире — уменьшается, уже — не растягивается.
   Качество подбирается: от лучшего (-q:v 3) вниз, пока файл не станет не больше 80 КБ.

   Нужен ffmpeg (тот же, что для scripts/voice-normalize.mjs). Запуск:
     node scripts/people-optimize.mjs            — все файлы, которые шире 480 px, тяжелее 80 КБ или не .jpg
     node scripts/people-optimize.mjs --force    — пережать все
     node scripts/people-optimize.mjs --check    — только проверить: код выхода 1, если есть что пережимать
   PNG и WebP становятся <id>.jpg (исходник удаляется). Подписи к фото — people/credits.csv: метаданные файла
   стираются, поэтому автора и лицензию переносите туда до пережатия (people/README.md). */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIR = path.resolve(import.meta.dirname, '../public/people');
export const MAX_WIDTH = 480;
export const MAX_BYTES = 80 * 1024;
const QUALITIES = [3, 4, 5, 6, 7, 8, 10, 12, 14];

const args = new Set(process.argv.slice(2));
const force = args.has('--force');
const checkOnly = args.has('--check');

function ffmpegOk() {
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; }
}
const width = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width', '-of', 'csv=p=0', file]).toString().trim());
const needs = (file) => !/\.jpe?g$/i.test(file) || fs.statSync(file).size > MAX_BYTES || width(file) > MAX_WIDTH;

function encode(src, dst, q) {
  // ширина — чётная (так требует кодек), высота — по пропорции; lanczos — резче при уменьшении
  const w = Math.min(MAX_WIDTH, width(src));
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-map_metadata', '-1', '-vf', `scale=${w - (w % 2)}:-2:flags=lanczos,format=yuvj420p`,
    '-frames:v', '1', '-q:v', String(q), dst], { stdio: ['ignore', 'ignore', 'inherit'] });
  return fs.statSync(dst).size;
}

function main() {
  if (!fs.existsSync(DIR)) { console.log('Нет папки public/people'); return; }
  const files = fs.readdirSync(DIR).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  if (!ffmpegOk()) { console.error('Нужен ffmpeg: https://ffmpeg.org/download.html (macOS: brew install ffmpeg)'); process.exit(2); }
  const todo = files.filter((f) => force || needs(path.join(DIR, f)));
  if (checkOnly) {
    todo.forEach((f) => console.log(`пережать: ${f} (${Math.round(fs.statSync(path.join(DIR, f)).size / 1024)} КБ, ${width(path.join(DIR, f))} px)`));
    console.log(todo.length ? `Нужно пережать: ${todo.length} из ${files.length}.` : `Все ${files.length} портретов — не шире ${MAX_WIDTH} px и не больше ${MAX_BYTES / 1024} КБ.`);
    process.exit(todo.length ? 1 : 0);
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'people-'));
  let before = 0; let after = 0;
  for (const f of todo) {
    const src = path.join(DIR, f);
    const id = f.replace(/\.[^.]+$/, '').toLowerCase();
    const out = path.join(tmp, `${id}.jpg`);
    const was = fs.statSync(src).size;
    let size = Infinity; let q = 0;
    for (const qq of QUALITIES) { q = qq; size = encode(src, out, qq); if (size <= MAX_BYTES) break; }
    if (size > MAX_BYTES) { console.error(`${f}: даже при -q:v ${q} — ${Math.round(size / 1024)} КБ; оставлен как есть`); continue; }
    const dst = path.join(DIR, `${id}.jpg`);
    fs.copyFileSync(out, dst);
    if (path.resolve(dst) !== path.resolve(src)) fs.unlinkSync(src);
    before += was; after += size;
    console.log(`${f} → ${id}.jpg: ${Math.round(was / 1024)} → ${Math.round(size / 1024)} КБ (q ${q})`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(todo.length ? `Готово: ${todo.length} файлов, ${Math.round(before / 1024)} → ${Math.round(after / 1024)} КБ.` : 'Пережимать нечего.');
}

main();
