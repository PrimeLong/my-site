/* ТЕРМИНЫ В УПРАЖНЕНИЯХ: как слова в Дуолинго — термин из словаря в тексте упражнения
   можно нажать и прочитать короткое определение. Русские слова склоняются, поэтому у
   каждого термина — основы его форм (регулярные выражения без окончаний). По тем же формам
   тест проверяет, что урок не спрашивает термин, которого ещё не вводила карточка идеи.
   Формы заданы для терминов юнитов Пути; термины без форм в тексте не ищутся. */
import { GLOSSARY } from '../textbook/glossary.js';

const L = '[а-яёa-z]*';
export const TERM_FORMS = {
  scarcity: [`ограниченност${L}`],
  opportunity: [`альтернативн${L} (?:стоимост|издержк)${L}`],
  sunk: [`невозвратн${L} (?:издержк|затрат)${L}`],
  marginalcost: [`предельн${L} издержк${L}`],
  ppf: ['кпв', `крив${L} производственных возможностей`],
  comparative: [`сравнительн${L} преимуществ${L}`],
  absolute: [`абсолютн${L} преимуществ${L}`],
  demand: ['спрос(?:а|у|ом|е|ы|ов|ам|ах)?'],
  supply: [`предложени${L}`],
  equilibrium: [`равновес${L}`],
  shortage: [`дефицит${L}`],
  glut: [`избыт${L}`, `излиш${L} товара`],
  ceteris: ['при прочих равных'],
  substitute: [`заменител${L}`],
  complement: [`дополняющ${L}`],
  normalgood: [`нормальн${L} товар${L}`],
  inferior: [`низш${L} товар${L}`],
  subeffect: [`эффект${L} замещения`],
  incomeeffect: [`эффект${L} дохода`],
  elasticity: [`эластичн${L}`],
  revenue: [`выручк${L}`],
  giffen: [`гиффен${L}`],
  budget: [`бюджетн${L} (?:лини|ограничени)${L}`],
  utility: [`полезност${L}`],
  indifference: [`крив${L} безразличия`],
  mrs: [`предельн${L} норм${L} замещения`],
  engel: [`закон${L} энгеля`],
  cs: [`излиш${L} потребител${L}`],
  ps: [`излиш${L} производител${L}`],
  deadweight: [`безвозвратн${L} потер${L}`],
  incidence: [`налогов${L} брем${L}`, `брем${L} налога`],
  externality: [`внешн${L} эффект${L}`],
  pigou: [`(?:налог|субсиди)${L} пигу`],
  publicgood: [`общественн${L} благ${L}`],
  freerider: [`безбилетник${L}`],
  coase: [`теорем${L} коуза`],
};

// одно регулярное выражение на все формы: длинные раньше коротких, чтобы «эффект замещения»
// не распался на части; граница слова — не буква с обеих сторон
const ENTRIES = Object.entries(TERM_FORMS).flatMap(([id, forms]) => forms.map((f) => ({ id, f }))).sort((a, b) => b.f.length - a.f.length);
const RE = new RegExp(`(?<![а-яёa-z])(?:${ENTRIES.map((e, k) => `(?<t${k}>${e.f})`).join('|')})(?![а-яёa-z])`, 'giu');

// [{ id, start, end, text }] — найденные термины в строке, без перекрытий
export function findTerms(text) {
  const out = [];
  if (!text) return out;
  RE.lastIndex = 0;
  let m;
  while ((m = RE.exec(text))) {
    const k = Object.keys(m.groups).find((g) => m.groups[g] !== undefined);
    out.push({ id: ENTRIES[Number(k.slice(1))].id, start: m.index, end: m.index + m[0].length, text: m[0] });
  }
  return out;
}

/* Разметка для подсказок: текстовые узлы строк разбиваются на текст и {t: 'term', id, v}.
   Формулы, ссылки и уже размеченное не трогаем. Работает и с блоками (p, ul, …), и с
   массивом строковых узлов. */
function markNodes(nodes) {
  return nodes.flatMap((n) => {
    if (n.t === 'text') {
      const found = findTerms(n.v);
      if (!found.length) return [n];
      const parts = [];
      let at = 0;
      found.forEach((f) => {
        if (f.start > at) parts.push({ t: 'text', v: n.v.slice(at, f.start) });
        parts.push({ t: 'term', id: f.id, v: f.text });
        at = f.end;
      });
      if (at < n.v.length) parts.push({ t: 'text', v: n.v.slice(at) });
      return parts;
    }
    if ((n.t === 'b' || n.t === 'i') && n.c) return [{ ...n, c: markNodes(n.c) }];
    return [n];
  });
}
export function markTerms(x) {
  if (!Array.isArray(x)) return x;
  if (x.length && x[0] && x[0].t) return markNodes(x);
  return x.map((b) => {
    if (!b || typeof b !== 'object') return b;
    const out = { ...b };
    if (Array.isArray(b.inline)) out.inline = markNodes(b.inline);
    if (Array.isArray(b.items)) out.items = b.items.map((it) => (Array.isArray(it) && (!it.length || it[0].t) ? markNodes(it) : it));
    return out;
  });
}

// все термины текста (узлы или блоки) — множество id
export function termsIn(x) {
  const ids = new Set();
  const walk = (v) => {
    if (!v) return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (typeof v !== 'object') return;
    if (v.t === 'text') { findTerms(v.v).forEach((f) => ids.add(f.id)); return; }
    if (v.t === 'math') return;
    if (v.c) walk(v.c);
    if (v.inline) walk(v.inline);
    if (v.items) walk(v.items);
  };
  walk(x);
  return ids;
}

export const termTitle = (id) => (GLOSSARY[id] || {}).title || id;
export const termText = (id) => (GLOSSARY[id] || {}).text || '';
