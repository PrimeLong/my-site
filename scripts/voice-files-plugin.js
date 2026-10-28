/* Файлы, которые кладут руками и которые приложение должно узнать при сборке: записанные голоса
   (public/voice/<id>.mp3, src/learn/voice-lines.js), записи книг полки (public/books/<id>.mp3,
   src/learn/book-audio.js) и портреты «Персоналий» (public/people/<id>.jpg|png|webp с подписями из
   people/credits.csv, src/learn/portraits.js). Положили файл в папку — после сборки он в деле; руками
   ничего не перечислять. */
import fs from 'node:fs';
import path from 'node:path';

const VOICE_DIR = path.resolve(import.meta.dirname, '../public/voice');
const BOOKS_DIR = path.resolve(import.meta.dirname, '../public/books');
const PEOPLE_DIR = path.resolve(import.meta.dirname, '../public/people');
const CREDITS = path.resolve(import.meta.dirname, '../people/credits.csv');

export function listVoiceFiles(dir = VOICE_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /\.mp3$/i.test(f)).map((f) => f.replace(/\.mp3$/i, '')).sort();
}
export const listBookAudio = () => listVoiceFiles(BOOKS_DIR);

// портреты: id (имя файла без расширения, маленькими буквами) → имя файла; на один id — первый по алфавиту
export function listPeoplePhotos(dir = PEOPLE_DIR) {
  if (!fs.existsSync(dir)) return {};
  const out = {};
  fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort().forEach((f) => {
    const id = f.replace(/\.[^.]+$/, '').trim().toLowerCase();
    if (id && !out[id]) out[id] = f;
  });
  return out;
}
/* подписи к портретам: строки «id;автор;лицензия;ссылка», разделитель — точка с запятой; строка
   заголовка, пустые строки, строки с # и строки без автора и лицензии пропускаются */
export function parseCredits(text) {
  const out = {};
  String(text || '').split(/\r?\n/).forEach((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const [id, author = '', license = '', source = ''] = t.split(';').map((x) => x.trim());
    if (!id || id.toLowerCase() === 'id' || (!author && !license)) return;
    out[id.toLowerCase()] = { author, license, source: /^https:\/\//.test(source) ? source : '' };
  });
  return out;
}
export const readPhotoCredits = (file = CREDITS) => (fs.existsSync(file) ? parseCredits(fs.readFileSync(file, 'utf8')) : {});

const LISTS = {
  'virtual:voice-files': { watch: [VOICE_DIR], value: () => listVoiceFiles() },
  'virtual:book-audio': { watch: [BOOKS_DIR], value: () => listBookAudio() },
  'virtual:people-files': { watch: [PEOPLE_DIR, CREDITS], value: () => ({ files: listPeoplePhotos(), credits: readPhotoCredits() }) },
};

export default function voiceFiles() {
  return {
    name: 'voice-files',
    resolveId(id) { return LISTS[id] ? `\0${id}` : null; },
    load(id) {
      const list = id.startsWith('\0') ? LISTS[id.slice(1)] : null;
      if (!list) return null;
      list.watch.forEach((p) => { if (fs.existsSync(p)) this.addWatchFile(p); });
      return `export default ${JSON.stringify(list.value())};`;
    },
  };
}
