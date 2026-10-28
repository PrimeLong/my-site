/* Записанные голоса (src/learn/voice-lines.js) и записи книг полки (src/learn/book-audio.js): список
   файлов public/voice/<id>.mp3 и public/books/<id>.mp3 считается при сборке — положили MP3 в папку, и
   после сборки урок или книга играет запись; руками ничего не перечислять. */
import fs from 'node:fs';
import path from 'node:path';

const LISTS = [
  { id: 'virtual:voice-files', dir: path.resolve(import.meta.dirname, '../public/voice') },
  { id: 'virtual:book-audio', dir: path.resolve(import.meta.dirname, '../public/books') },
];

export function listVoiceFiles(dir = LISTS[0].dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /\.mp3$/i.test(f)).map((f) => f.replace(/\.mp3$/i, '')).sort();
}
export const listBookAudio = () => listVoiceFiles(LISTS[1].dir);

export default function voiceFiles() {
  return {
    name: 'voice-files',
    resolveId(id) { return LISTS.some((l) => l.id === id) ? `\0${id}` : null; },
    load(id) {
      const list = LISTS.find((l) => id === `\0${l.id}`);
      if (!list) return null;
      if (fs.existsSync(list.dir)) this.addWatchFile(list.dir);
      return `export default ${JSON.stringify(listVoiceFiles(list.dir))};`;
    },
  };
}
