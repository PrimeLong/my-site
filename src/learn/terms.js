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
  cobbdouglas: [`полезност${L} кобба\\s?[—–-]\\s?дугласа`, `кобб${L}\\s?[—–-]\\s?дуглас${L}`],
  indifference: [`крив${L} безразличия`],
  mrs: [`предельн${L} норм${L} замещения`],
  engel: [`закон${L} энгеля`],
  cs: [`излиш${L} потребител${L}`],
  ps: [`излиш${L} производител${L}`],
  deadweight: [`безвозвратн${L} потер${L}`],
  incidence: [`налогов${L} брем${L}`, `брем${L} налога`],
  externality: [`внешн${L} эффект${L}`],
  pigou: [`(?:налог|субсиди)${L} пигу`],
  socialopt: [`общественно оптимальн${L} (?:выпуск|объ[её]м)${L}`, `общественн${L} оптимум${L}`],
  publicgood: [`общественн${L} благ${L}`],
  freerider: [`безбилетник${L}`],
  coase: [`теорем${L} коуза`],
  // инфляция: окончания перечислены — «инфляционные ожидания», «гиперинфляция» и «дезинфляция» — другие слова;
  // «инфляция спроса» и «издержек» длиннее и находятся раньше простой «инфляции»
  inflation: ['инфляци(?:ей|ям|ях|[яию])'],
  demandpull: [`инфляци${L} (?:со стороны )?спроса`],
  costpush: [`инфляци${L} (?:со стороны )?издержек`],
  deflation: ['дефляци(?:ей|[яию])'],
  hyperinflation: [`гиперинфляци${L}`],
  purchasing: [`покупательн${L} способност${L}`],
  basket: [`потребительск${L} корзин${L}`],
  cpi: ['ипц', `индекс${L} потребительских цен`],
  nominal: [`номинальн${L}`],
  real: [`реальн${L} (?:зарплат|доход|стоимост|величин|пенси|стипенди)${L}`],
  realrate: [`реальн${L} ставк${L}`],
  keyrate: [`ключев${L} ставк${L}`],
  inflationtarget: [`цел${L} по инфляции`],
  indexation: [`индексаци${L}`, `проиндексир${L}`],
  // деньги и банки; само слово «деньги» не размечаем — оно есть в каждом юните
  barter: [`бартер${L}`],
  exchangemedium: [`средств${L} обмена`],
  unitofaccount: [`мер${L} стоимости`],
  storeofvalue: [`средств${L} сбережения`],
  fiat: [`фидуциарн${L}`],
  monetarybase: [`денежн${L} баз${L}`],
  moneysupply: [`денежн${L} масс${L}`],
  moneymultiplier: [`(?:денежн${L} )?мультипликатор${L}`],
  reserveratio: [`норм${L} (?:обязательн${L} )?резерв${L}`],
  reserves: [`резерв${L}`],
  velocity: [`скорост${L} обращения`],
  exchangeeq: [`уравнени${L} обмена`],
  bankrun: [`набег${L} вкладчиков`],
  lastresort: [`кредитор${L} последней инстанции`],
  // издержки и прибыль (юнит «Пекарня»)
  fixedcost: [`постоянн${L} издержк${L}`],
  variablecost: [`переменн${L} издержк${L}`],
  averagecost: [`средн${L} (?:общ${L} |переменн${L} )?издержк${L}`],
  diminishing: [`убывающ${L} (?:предельн${L} )?отдач${L}`],
  accprofit: [`бухгалтерск${L} прибыл${L}`],
  econprofit: [`экономическ${L} прибыл${L}`],
  scale: [`эффект${L} масштаба`],
  // конкуренция и монополия (юнит «Биржа»); «естественная монополия» длиннее и находится раньше «монополии»
  perfectcomp: [`совершенн${L} конкуренци${L}`],
  pricetaker: [`ценополучател${L}`],
  mr: [`предельн${L} выручк${L}`],
  shutdown: [`правил${L} закрытия`],
  monopoly: [`монопол${L}`],
  naturalmonopoly: [`естественн${L} монопол${L}`],
  barriers: [`барьер${L} входа`],
  lerner: [`правил${L} лернера`],
  discrimination: [`ценов${L} дискриминаци${L}`],
  // не термин экономики, а слово мира: новичок не знает, что такое кроны и «кр.» (docs/world.md)
  krona: ['кр\\.', `крон(?:а|ы|е|у|ой|ам|ами|ах)?`],
  // и бытовое слово, которое школьник может не знать (жалоба mvfa5n5o: «что такое оклад?»)
  oklad: [`оклад${L}`],
};
/* Слова мира — нажимаются, как термины, но это не словарь учебника: определения здесь, в проверку
   «термин введён раньше, чем спрошен» не идут, а подсказкой нажатие не считается. */
export const WORLD_TERMS = {
  oklad: { title: 'Оклад', text: 'Зарплата, которая каждый месяц одна и та же — сколько бы работник ни сделал. Бухгалтер пекарни получает оклад и при ста круассанах в день, и при тысяче, поэтому для пекарни это постоянные издержки. Противоположность — сдельная оплата: платят за каждую партию или штуку.' },
  krona: { title: 'Крона (кр.)', text: 'Деньги страны Инфляции, где живут герои уроков: Тимур, Маша, Гриша. «кр.» — сокращение: 20 кр. — это 20 крон. Для понимания можно считать, что крона примерно как рубль: капучино у метро — около 20 кр., стипендия — около 900 кр. В лавке Инфли цены тоже в кронах, а платите вы монетами, заработанными за уроки, — по курсу дня.' },
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
export const isWorldTerm = (id) => !!WORLD_TERMS[id];

/* Разметка для подсказок: текстовые узлы строк разбиваются на текст и {t: 'term', id, v}.
   Формулы, ссылки и уже размеченное не трогаем. Работает и с блоками (p, ul, …), и с
   массивом строковых узлов. */
function markNodes(nodes, once = new Set()) {
  return nodes.flatMap((n) => {
    if (n.t === 'text') {
      // слово мира («кр.») — только первое в тексте: не подчёркивать каждую цену
      const found = findTerms(n.v).filter((f) => !isWorldTerm(f.id) || (!once.has(f.id) && once.add(f.id)));
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
    if ((n.t === 'b' || n.t === 'i') && n.c) return [{ ...n, c: markNodes(n.c, once) }];
    return [n];
  });
}
export function markTerms(x) {
  if (!Array.isArray(x)) return x;
  const once = new Set();
  if (x.length && x[0] && x[0].t) return markNodes(x, once);
  return x.map((b) => {
    if (!b || typeof b !== 'object') return b;
    const out = { ...b };
    if (Array.isArray(b.inline)) out.inline = markNodes(b.inline, once);
    if (Array.isArray(b.items)) out.items = b.items.map((it) => (Array.isArray(it) && (!it.length || it[0].t) ? markNodes(it, once) : it));
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
    if (v.t === 'text') { findTerms(v.v).forEach((f) => { if (!isWorldTerm(f.id)) ids.add(f.id); }); return; }
    if (v.t === 'math') return;
    if (v.c) walk(v.c);
    if (v.inline) walk(v.inline);
    if (v.items) walk(v.items);
  };
  walk(x);
  return ids;
}

export const termTitle = (id) => (WORLD_TERMS[id] || GLOSSARY[id] || {}).title || id;
export const termText = (id) => (WORLD_TERMS[id] || GLOSSARY[id] || {}).text || '';
export const termFormula = (id) => (GLOSSARY[id] || {}).formula || '';
