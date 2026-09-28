/* Тексты глав: chapters/<id>.md, разобранные в дерево блоков. Файлы подтягиваются
   сборщиком как строки (?raw) и едут в том же ленивом чанке, что и экран учебника.
   Приложения, написанные текстом (appendices/<id>.md), — так же. */
import { parseChapter, collectBlocks } from './markdown.js';
import { sectionsOf, plain } from './sections.js';
import { CHAPTERS } from './toc.js';

const RAW = import.meta.glob('./chapters/*.md', { query: '?raw', import: 'default', eager: true });
const RAW_APPENDIX = import.meta.glob('./appendices/*.md', { query: '?raw', import: 'default', eager: true });
const byFile = (raw) => Object.fromEntries(Object.entries(raw).map(([path, text]) => [path.replace(/^.*\/|\.md$/g, ''), text]));

export const CHAPTER_TEXT = byFile(RAW);
export const CHAPTER_BLOCKS = Object.fromEntries(Object.entries(CHAPTER_TEXT).map(([id, text]) => [id, parseChapter(text)]));
export const APPENDIX_BLOCKS = Object.fromEntries(Object.entries(byFile(RAW_APPENDIX)).map(([id, text]) => [id, parseChapter(text)]));

// задачи глав: id → { chapter, block }
export const PROBLEMS = {};
// вопросы на вспоминание: id → { chapter, section, block }
export const RECALLS = {};

export { sectionsOf };
export const CHAPTER_SECTIONS = {};

CHAPTERS.forEach((c) => {
  const blocks = CHAPTER_BLOCKS[c.id];
  if (!blocks) return;
  collectBlocks(blocks, (b) => b.type === 'problem').forEach((b) => { PROBLEMS[b.id] = { chapter: c.id, block: b }; });
  CHAPTER_SECTIONS[c.id] = sectionsOf(blocks);
  CHAPTER_SECTIONS[c.id].forEach((s) => {
    collectBlocks(s.blocks, (b) => b.type === 'recall').forEach((b) => { RECALLS[b.id] = { chapter: c.id, section: s.id, block: b }; });
  });
});
export const problemsOf = (chapterId) => Object.keys(PROBLEMS).filter((id) => PROBLEMS[id].chapter === chapterId);
// разделы, по которым считается прогресс (с вопросом на вспоминание)
export const studySections = (chapterId) => (CHAPTER_SECTIONS[chapterId] || []).filter((s) => s.recall);
export const plainText = plain;
