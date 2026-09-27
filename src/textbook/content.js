/* Тексты глав: chapters/<id>.md, разобранные в дерево блоков. Файлы подтягиваются
   сборщиком как строки (?raw) и едут в том же ленивом чанке, что и экран учебника. */
import { parseChapter, collectBlocks } from './markdown.js';
import { CHAPTERS } from './toc.js';

const RAW = import.meta.glob('./chapters/*.md', { query: '?raw', import: 'default', eager: true });

export const CHAPTER_TEXT = Object.fromEntries(Object.entries(RAW).map(([path, text]) => [path.replace(/^.*\/|\.md$/g, ''), text]));
export const CHAPTER_BLOCKS = Object.fromEntries(Object.entries(CHAPTER_TEXT).map(([id, text]) => [id, parseChapter(text)]));

// задачи глав: id → { chapter, block }
export const PROBLEMS = {};
CHAPTERS.forEach((c) => {
  const blocks = CHAPTER_BLOCKS[c.id];
  if (!blocks) return;
  collectBlocks(blocks, (b) => b.type === 'problem').forEach((b) => { PROBLEMS[b.id] = { chapter: c.id, block: b }; });
});
export const problemsOf = (chapterId) => Object.keys(PROBLEMS).filter((id) => PROBLEMS[id].chapter === chapterId);
