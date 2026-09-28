/* Указатель разделов учебника для меню: { глава: [{ id, title, minutes, recall }] } — только
   разделы с вопросом, по которым считается прогресс. Считается при сборке из тех же текстов
   и той же функцией, что и в учебнике, поэтому минуты на карточке «Продолжить учиться»
   совпадают с минутами в учебнике, а сами тексты глав в меню не попадают. */
import fs from 'node:fs';
import path from 'node:path';
import { parseChapter } from '../src/textbook/markdown.js';
import { sectionsOf } from '../src/textbook/sections.js';

const ID = 'virtual:textbook-sections';
const DIR = path.resolve(import.meta.dirname, '../src/textbook/chapters');

export function buildSectionIndex(dir = DIR) {
  const out = {};
  fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort().forEach((f) => {
    const secs = sectionsOf(parseChapter(fs.readFileSync(path.join(dir, f), 'utf8'))).filter((s) => s.recall);
    if (secs.length) out[f.replace(/\.md$/, '')] = secs.map(({ id, title, minutes, recall }) => ({ id, title, minutes, recall }));
  });
  return out;
}

export default function textbookSections() {
  return {
    name: 'textbook-sections',
    resolveId(id) { return id === ID ? `\0${ID}` : null; },
    load(id) {
      if (id !== `\0${ID}`) return null;
      fs.readdirSync(DIR).forEach((f) => this.addWatchFile(path.join(DIR, f)));
      return `export default ${JSON.stringify(buildSectionIndex())};`;
    },
  };
}
