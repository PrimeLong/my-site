/* Записанные голоса (src/learn/voice-lines.js): список файлов public/voice/<id>.mp3 считается при
   сборке — положили MP3 в папку, и после сборки урок играет запись; руками ничего не перечислять. */
import fs from 'node:fs';
import path from 'node:path';

const ID = 'virtual:voice-files';
const DIR = path.resolve(import.meta.dirname, '../public/voice');

export function listVoiceFiles(dir = DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /\.mp3$/i.test(f)).map((f) => f.replace(/\.mp3$/i, '')).sort();
}

export default function voiceFiles() {
  return {
    name: 'voice-files',
    resolveId(id) { return id === ID ? `\0${ID}` : null; },
    load(id) {
      if (id !== `\0${ID}`) return null;
      if (fs.existsSync(DIR)) this.addWatchFile(DIR);
      return `export default ${JSON.stringify(listVoiceFiles())};`;
    },
  };
}
