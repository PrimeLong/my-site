/* ПРЕДВОСХИЩЕНИЕ: обёртка учёбы — лавка, копилка, страховка серии — сама учит экономике. Ученик
   сначала пользуется механикой, а когда до её темы доходит урок, Инфля вспоминает её на шаге, где
   тема объясняется: «Две недели вы пользовались сложным процентом — вот как он устроен».
   step — id шага урока (:::idea), на котором звучит напоминание; null — заготовка для юнита,
   чьи уроки ещё не готовы (шаг впишется, когда юнит выйдет на Путь). uses — чем ученик должен
   был уже пользоваться: без этого напоминать нечего, и шаг идёт как обычно. Модуль чистый. */
import { piggyUsed } from './rewards.js';

const DAY_MS = 86400000;
const sumMap = (m) => Object.values(m || {}).reduce((a, b) => a + b, 0);
const USED = {
  // покупал в лавке — видел подпись цены отказа под ценой
  shop: (s) => Object.keys(s.owned || {}).length > 0 || sumMap(s.spent) > 0,
  piggy: (s) => piggyUsed(s),
  insurance: (s) => sumMap(s.freezeBuy) > 0,
};
const since = (s, uses) => {
  const first = uses === 'piggy' ? Math.min(...Object.keys(s.piggy || {}).map(Number)) : null;
  return first && Number.isFinite(first) ? Math.max(1, Math.round((Date.now() - first) / DAY_MS)) : null;
};
const daysText = (d) => (d >= 14 ? `${Math.round(d / 7)} недели` : d >= 7 ? 'неделю' : d === 1 ? 'день' : `${d} ${d < 5 ? 'дня' : 'дней'}`);
export const CALLBACKS = [
  { id: 'opportunity', unit: 'scarcity', topic: 'альтернативная стоимость', step: 'sc-i1-oc', uses: 'shop',
    text: () => 'Помните подпись под ценой в лавке — «≈ 3 урока»? Это и есть альтернативная стоимость: вещь стоит не только монет, но и уроков ради них и процентов, которые они принесли бы в копилке.' },
  { id: 'compound', unit: 'money-banks', topic: 'сложный процент', step: null, uses: 'piggy',
    text: (s) => { const d = since(s, 'piggy'); return `${d ? `${daysText(d)} назад вы впервые положили монеты в копилку` : 'Вы уже пользовались копилкой Инфли'} — это и был сложный процент: 2% каждый день начислялись на накопленное. Вот как он устроен.`; } },
  { id: 'insurance', unit: null, topic: 'страхование', step: null, uses: 'insurance',
    text: () => 'Помните «Страховку серии»? Вы платили немного заранее, чтобы не потерять много потом, — так устроено любое страхование.' },
];
// напоминание для шага урока: только если ученик уже пользовался механикой
export function callbackFor(stepId, learn) {
  if (!stepId || !learn) return null;
  const c = CALLBACKS.find((x) => x.step === stepId);
  return c && USED[c.uses](learn) ? { id: c.id, text: c.text(learn) } : null;
}
