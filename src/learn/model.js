/* ЖИВАЯ МОДЕЛЬ ЮНИТА и «ОТКРОЙ САМ». Модуль чистый: его читают тесты; экраны —
   src/learn-model.jsx.

   «Открой сам» — шаг, которым начинается первый урок юнита: ученик — Маша, один день в «Зерне»
   у метро «Торговая». Цену чашки капучино он ставит сам, покупателей считает скрытая кривая
   спроса с небольшим шумом; каждый день — точка «цена — сколько купили», после нескольких дней
   из точек проступает линия. Верного и неверного ответа нет.

   Живая модель — одна игрушка на юнит: рынок капучино у «Торговой». Каждый урок юнита
   добавляет деталь (таблица MODEL_PARTS); открытые детали крутятся ползунками в любой момент,
   закрытые видны силуэтом «откроется в уроке …». Спрос модели — тот же, что ученик нашёл сам
   в первый день: Q = 120 − 3P. */
import { LESSON_BY_ID, UNIT_BY_ID } from './course.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ------------------------------ ОТКРОЙ САМ ------------------------------ */
/* День в «Зерне»: цена от 10 до 35 крон; мимо кофейни за день проходят 110 человек, заходят —
   сколько скажет скрытый спрос, ± 4 человека шума. Двигаться дальше — с четырёх разных цен;
   линия проступает, когда разных цен четыре, или с пятого дня, если их хотя бы три. */
export const DAY = { min: 10, max: 35, start: 20, a: 120, b: 3, noise: 4, passers: 110, need: 4, lineDays: 5 };
export const hiddenDemand = (price) => DAY.a - DAY.b * price;
export function dayResult(price, rand = Math.random) {
  const p = clamp(Math.round(price), DAY.min, DAY.max);
  const n = Math.round(hiddenDemand(p) + (rand() * 2 - 1) * DAY.noise);
  return { price: p, bought: clamp(n, 0, DAY.passers) };
}
export const distinctPrices = (days) => new Set(days.map((d) => d.price)).size;
export const lineShown = (days) => distinctPrices(days) >= DAY.need || (days.length >= DAY.lineDays && distinctPrices(days) >= 3);
export const discoverDone = (days) => distinctPrices(days) >= DAY.need;
/* прямая по точкам методом наименьших квадратов: bought = a − b·price */
export function fitDemand(days) {
  const n = days.length;
  if (n < 2 || distinctPrices(days) < 2) return null;
  const mx = days.reduce((s, d) => s + d.price, 0) / n;
  const my = days.reduce((s, d) => s + d.bought, 0) / n;
  const sxx = days.reduce((s, d) => s + (d.price - mx) ** 2, 0);
  const sxy = days.reduce((s, d) => s + (d.price - mx) * (d.bought - my), 0);
  const slope = sxy / sxx;
  return { a: my - slope * mx, b: -slope };
}

/* ------------------------------ ЖИВАЯ МОДЕЛЬ ------------------------------
   Рынок капучино у «Торговой»: Q_D = 120 − 3P + сдвиги спроса, Q_S = −40 + 5P + сдвиги
   предложения; без сдвигов равновесие — 20 крон и 60 чашек в день. */
export const BASE = { a: 120, b: 3, c: -40, d: 5 };
export const MODEL_AXES = { pMax: 40, qMax: 140 };
/* Детали модели по порядку уроков юнита: какой урок что открывает. control — ползунок или
   кнопки детали; деталь из урока другого юнита (эластичность) видна силуэтом со ссылкой на
   тот урок. */
export const MODEL_PARTS = {
  'supply-demand': [
    { id: 'demand', lesson: 'sd-i1', title: 'Спрос', text: 'Кривая спроса — та, что вы нашли сами: чем дороже чашка, тем меньше покупают.' },
    { id: 'income', lesson: 'sd-l1', title: 'Доходы горожан', text: 'Доходы растут — спрос на капучино (нормальный товар) сдвигается вправо.' },
    { id: 'tea', lesson: 'sd-w', title: 'Цена чая', text: 'Чай — заменитель кофе: подорожал чай — спрос на капучино растёт.' },
    { id: 'supply', lesson: 'sd-i2', title: 'Предложение и равновесие', text: 'Кофейни предлагают больше по высокой цене; где кривые пересекаются — равновесие.' },
    { id: 'grain', lesson: 'sd-l3', title: 'Цена зерна', text: 'Зерно дорожает — каждая чашка обходится дороже, предложение сдвигается влево.' },
    { id: 'ceiling', lesson: 'sd-s1', title: 'Потолок цены', text: 'Потолок ниже равновесной цены: хотят купить больше, чем продают, — дефицит и очередь.' },
    { id: 'news', lesson: 'sd-l-radio', title: 'Новости «Вестника»', text: 'Новость двигает нужную кривую: решите, какую, — модель покажет.' },
    { id: 'trace', lesson: 'sd-g', title: 'След сдвига', text: 'Пунктир — рынок без сдвигов: видно, куда ушло равновесие.' },
    { id: 'board', lesson: 'sd-rev', title: 'Табло рынка', text: 'Цена, чашки в день и выручка кофеен — числами.' },
    { id: 'seal', lesson: 'sd-sum', title: 'Модель собрана', text: 'Все детали на месте — рынок работает целиком.' },
    { id: 'elastic', lesson: 'el-i1', title: 'Эластичность', text: 'Насколько сильно покупатели реагируют на цену: кривая круче или положе.' },
  ],
};
export const hasModel = (unitId) => !!MODEL_PARTS[unitId];
// новость двигает те же ползунки: так видно, какая кривая и куда
export const MODEL_NEWS = [
  { id: 'frost', title: 'Морозы на Южном архипелаге', set: { grain: 2 } },
  { id: 'study', title: 'Учёные: кофе помогает сосредоточиться', set: { taste: 1 } },
  { id: 'tea', title: 'Чай подешевел на треть', set: { tea: -2 } },
  { id: 'wages', title: 'Зарплаты в Велеграде выросли', set: { income: 2 } },
];
export const MODEL_DEFAULT = { price: 20, income: 0, tea: 0, taste: 0, grain: 0, ceiling: null, elastic: 3 };
// урок пройден — деталь открыта; locked — где откроется
export function modelParts(unitId, learn) {
  return (MODEL_PARTS[unitId] || []).map((p) => {
    const entry = ((learn && learn.lessons) || {})[p.lesson];
    const lesson = LESSON_BY_ID[p.lesson];
    const outside = lesson && lesson.unitId !== unitId ? UNIT_BY_ID[lesson.unitId] : null;
    return { ...p, open: !!(entry && entry.runs > 0), where: lesson ? lesson.title : p.lesson, outside: outside ? outside.title : null };
  });
}
// сколько деталей открыто из деталей самого юнита (деталь из другого юнита — бонус сверху)
export function modelProgress(unitId, learn) {
  const own = modelParts(unitId, learn).filter((p) => !p.outside);
  return { open: own.filter((p) => p.open).length, total: own.length };
}
// какие детали открыл этот урок — для экрана итогов
export const partsOfLesson = (lessonId) => Object.entries(MODEL_PARTS).flatMap(([unitId, list]) => list.filter((p) => p.lesson === lessonId).map((p) => ({ ...p, unitId })));

/* Рынок модели при положении ползунков: что открыто, то и действует. Эластичность поворачивает
   спрос вокруг исходного равновесия (20 крон, 60 чашек): b — наклон, a подбирается. */
export function modelMarket(st, open) {
  const on = (id) => open.has(id);
  const b = on('elastic') ? st.elastic : BASE.b;
  const a = on('elastic') ? 60 + b * 20 : BASE.a;
  const dA = (on('income') ? 15 * st.income : 0) + (on('tea') ? 8 * st.tea : 0) + (on('news') ? 12 * (st.taste || 0) : 0);
  const dC = on('grain') ? -12 * st.grain : 0;
  return { a, b, c: BASE.c, d: BASE.d, dA, dC };
}
export const mqd = (m, p) => m.a + m.dA - m.b * p;
export const mqs = (m, p) => m.c + m.dC + m.d * p;
export function modelEquilibrium(m) {
  const p = (m.a + m.dA - m.c - m.dC) / (m.b + m.d);
  return { p, q: m.a + m.dA - m.b * p };
}
/* Что показывает модель: без предложения — объём спроса при выбранной цене; с предложением —
   равновесие, а при потолке ниже него — цена потолка и дефицит. */
export function modelReadout(st, open) {
  const m = modelMarket(st, open);
  if (!open.has('supply')) {
    const p = clamp(st.price, 0, MODEL_AXES.pMax);
    return { m, mode: 'demand', p, qd: Math.max(0, mqd(m, p)) };
  }
  const eq = modelEquilibrium(m);
  if (open.has('ceiling') && st.ceiling != null && st.ceiling < eq.p) {
    const p = st.ceiling; const d = Math.max(0, mqd(m, p)); const s = Math.max(0, mqs(m, p));
    return { m, mode: 'ceiling', eq, p, qd: d, qs: s, sold: Math.min(d, s), shortage: Math.max(0, d - s) };
  }
  return { m, mode: 'equilibrium', eq, p: eq.p, qd: eq.q, qs: eq.q, sold: eq.q, shortage: 0 };
}
