/* РАЗДЕЛЫ ГЛАВЫ: чистая функция над деревом блоков — её зовут и учебник (content.js), и
   сборка (scripts/textbook-sections-plugin.js), которая кладёт в меню лёгкий указатель
   разделов с минутами, чтобы «Продолжить учиться» считало время так же, как учебник. */
import { collectBlocks, collectInline } from './markdown.js';

/* Разделы главы — заголовки второго уровня. У каждого: якорь (свой {#…} или sec-N), всё до
   следующего заголовка, вопрос на вспоминание в конце и сколько примерно минут на чтение
   (график, схема-цепочка или схема-иллюстрация — плюс две минуты).
   По разделам с вопросом считается прогресс: раздел пройден, когда на его вопрос ответ совпал с эталоном («совпало»). */
export const plain = (nodes) => nodes.map((n) => (n.t === 'text' || n.t === 'math' ? n.v : n.c ? plain(n.c) : n.label || '')).join('');
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
