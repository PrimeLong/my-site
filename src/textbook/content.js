/* Тексты глав: chapters/<id>.md, разобранные в дерево блоков. Файлы подтягиваются
   сборщиком как строки (?raw) и едут в том же ленивом чанке, что и экран учебника.
   Приложения, написанные текстом (appendices/<id>.md), — так же. */
import { parseChapter, collectBlocks, collectInline } from './markdown.js';
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

/* Разделы главы — заголовки второго уровня. У каждого: якорь (свой {#…} или sec-N), всё до
   следующего заголовка, вопрос на вспоминание в конце и сколько примерно минут на чтение
   (график, схема-цепочка или схема-иллюстрация — плюс две минуты).
   По разделам с вопросом считается прогресс: раздел пройден, когда на его вопрос ответ совпал с эталоном («совпало»). */
const plain = (nodes) => nodes.map((n) => (n.t === 'text' || n.t === 'math' ? n.v : n.c ? plain(n.c) : n.label || '')).join('');
// учебный текст читают медленнее обычного: с формулами, графиком и попыткой понять — около 80 слов в минуту
const WORDS_PER_MIN = 80;
export function sectionsOf(blocks) {
  const out = [];
  let cur = null;
  blocks.forEach((b) => {
    if (b.type === 'h2') {
      cur = { id: b.anchor || `sec-${out.length + 1}`, title: plain(b.inline), blocks: [] };
      out.push(cur);
    } else if (cur) cur.blocks.push(b);
  });
  return out.map((s) => {
    const recall = s.blocks.find((b) => b.type === 'recall');
    const text = collectInline(s.blocks.filter((b) => b.type !== 'problem' && b.type !== 'recall'), (n) => n.t === 'text').map((n) => n.v).join(' ');
    const words = text.split(/\s+/).filter(Boolean).length;
    const charts = collectBlocks(s.blocks, (b) => b.type === 'chart' || b.type === 'flow' || b.type === 'diagram').length;
    const formulas = collectBlocks(s.blocks.filter((b) => b.type !== 'problem'), (b) => b.type === 'math').length;
    return { ...s, recall: recall ? recall.id : null, minutes: Math.max(1, Math.round(words / WORDS_PER_MIN + charts * 2 + formulas * 0.5)) };
  });
}
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
