/* Деньги на Пути — в кронах (docs/world.md, раздел 5). Учебник и его задачи остаются в рублях,
   а общие для учебника и Пути подписи — обозначения формул (src/textbook/symbols.js) и подписи
   графиков (src/textbook/charts.js) — на Пути переводятся этой функцией. */
const FORMS = [
  ['тыс. руб.', 'тыс. кр.'], ['руб.', 'кр.'], ['рублями', 'кронами'], ['рублях', 'кронах'], ['рублём', 'кроной'],
  ['на рубль', 'на крону'], ['рублю', 'кроне'], ['рублей', 'крон'], ['рубля', 'кроны'], ['рубль', 'крона'],
].map(([a, b]) => [new RegExp(`(^|[^А-Яа-яЁё])(${a.replace(/\./g, '\\.')})${a.endsWith('.') ? '' : '(?![А-Яа-яЁё])'}`, 'gi'), b]);
// с заглавной — тоже с заглавной: «Рубль на булочки…» → «Крона на булочки…»
const same = (orig, to) => (/^[А-ЯЁ]/.test(orig) ? to.charAt(0).toUpperCase() + to.slice(1) : to);
export const inCrowns = (s) => (typeof s === 'string'
  ? FORMS.reduce((t, [re, to]) => t.replace(re, (m, pre, word) => pre + same(word, to)), s).replace(/₽/g, 'кр.')
  : s);
// все строки сцены графика (подписи осей, кривых, табло) — в кронах; числа и точки не трогаем
export const sceneInCrowns = (v) => (typeof v === 'string' ? inCrowns(v)
  : Array.isArray(v) ? v.map(sceneInCrowns)
    : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === 'function' ? x : sceneInCrowns(x)])) : v);

/* Условные имена из задач учебника — на Пути герои из src/learn/cast.js: Аня и Катя → Маша,
   Борис → Тимур (род глаголов совпадает). */
const NAMES = [
  ['Аня', 'Маша'], ['Ани', 'Маши'], ['Ане', 'Маше'], ['Аню', 'Машу'], ['Аней', 'Машей'],
  ['Катя', 'Маша'], ['Кати', 'Маши'], ['Кате', 'Маше'], ['Катю', 'Машу'], ['Катей', 'Машей'],
  ['Борис', 'Тимур'], ['Бориса', 'Тимура'], ['Борису', 'Тимуру'], ['Борисом', 'Тимуром'],
].map(([a, b]) => [new RegExp(`(^|[^А-Яа-яЁё])${a}(?![А-Яа-яЁё])`, 'g'), `$1${b}`]);
export const pathWords = (s) => (typeof s === 'string' ? NAMES.reduce((t, [re, to]) => t.replace(re, to), inCrowns(s)) : s);
// разобранный текст (узлы { t, v, c … }) — с кронами и героями; служебные поля не трогаем
export const pathBlocks = (x) => JSON.parse(JSON.stringify(x), (k, v) => (typeof v === 'string' && !['t', 'id', 'kind', 'chart', 'source'].includes(k) ? pathWords(v) : v));
