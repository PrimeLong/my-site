/* «СБЕРЕГИ КОШЕЛЁК» — мини-игра юнита «Инфляция» (docs/mechanics.md, «Сбереги кошелёк»).
   У ученика 10 000 крон, чашка капучино стоит 100 крон — сбережений хватает на 100 чашек. Пять
   лет: каждый год «Вестник» даёт новость и прогноз инфляции, банк — ставку по вкладу, и ученик
   решает, где держать деньги год:
   - наличными дома — крон столько же, а купить на них можно на столько меньше, на сколько
     выросли цены: 1 / (1 + π);
   - во вкладе под r% — реально (1 + r) / (1 + π), примерно r − π;
   - купить впрок то, что всё равно понадобится (кофе, крупы), — запас дорожает вместе с ценами,
     но хранение и порча съедают 3% в год: реально 0,97.
   Лучший выбор зависит от того, что выше — ставка или ожидаемая инфляция: это и есть реальная
   ставка. Наличные лучшими не бывают — ловушка «под подушкой». Годы подобраны так, что верное
   решение видно уже по прогнозу (одно и то же на обоих краях прогноза), а лучший вариант
   опережает второй хотя бы на 2 п. п. Зачёт — лучший выбор хотя бы в четырёх годах из пяти. */
export const WALLET = { years: 5, start: 10000, cup: 100, store: 3, pass: 4, margin: 2 };
export const WALLET_OPTIONS = ['cash', 'deposit', 'stock'];
export const WALLET_LEVELS = ['high', 'mid', 'low'];
// прогноз «Вестника» по уровню новости: на сколько процентов вырастут цены за год
export const FORECAST = { low: [1, 4], mid: [6, 9], high: [12, 18] };

// реальный итог года — во сколько раз изменилось то, что можно купить на сбережения
export function realOf(opt, pi, r) {
  if (opt === 'cash') return 1 / (1 + pi / 100);
  if (opt === 'deposit') return (1 + r / 100) / (1 + pi / 100);
  return 1 - WALLET.store / 100;
}
// в кронах: наличные — те же, вклад — с процентами, запас стоит по новым ценам за вычетом порчи
export function nominalOf(opt, pi, r) {
  if (opt === 'cash') return 1;
  if (opt === 'deposit') return 1 + r / 100;
  return (1 + pi / 100) * (1 - WALLET.store / 100);
}
export const bestOf = (pi, r) => WALLET_OPTIONS.reduce((b, o) => (realOf(o, pi, r) > realOf(b, pi, r) ? o : b), 'cash');
// разрыв лучшего и второго варианта — в процентных пунктах реального итога
export function gapOf(pi, r) {
  const v = WALLET_OPTIONS.map((o) => realOf(o, pi, r)).sort((a, b) => b - a);
  return (v[0] - v[1]) * 100;
}

/* Типы лет: уровень новости, фактическая инфляция внутри прогноза и ставка банка. Вклад лучше,
   когда ставка заметно выше ожидаемой инфляции, запас — когда инфляция заметно выше ставки.
   Есть и «перевёртыши»: высокая инфляция, но центробанк поднял ставки ещё выше; умеренная
   инфляция, а вклад почти ничего не платит. */
const TYPES = [
  { id: 'low-deposit', level: 'low', best: 'deposit', rate: [6, 8] },
  { id: 'mid-deposit', level: 'mid', best: 'deposit', rate: [11, 13] },
  { id: 'mid-stock', level: 'mid', best: 'stock', rate: [0, 1] },
  { id: 'high-stock', level: 'high', best: 'stock', rate: [4, 8] },
  { id: 'high-deposit', level: 'high', best: 'deposit', rate: [21, 23] },
];
export const WALLET_TYPES = TYPES;
const ri = (rand, a, b) => a + Math.floor(rand() * (b - a + 1));
// решение видно по прогнозу: на обоих его краях лучший вариант тот же, что и по факту
const clearYear = (t, pi, r) => {
  const [lo, hi] = FORECAST[t.level];
  return bestOf(pi, r) === t.best && bestOf(lo, r) === t.best && bestOf(hi, r) === t.best && gapOf(pi, r) >= WALLET.margin - 1e-9;
};
function yearOf(t, rand) {
  for (let k = 0; k < 100; k += 1) {
    const [lo, hi] = FORECAST[t.level];
    const pi = ri(rand, lo, hi); const r = ri(rand, t.rate[0], t.rate[1]);
    if (clearYear(t, pi, r)) return { type: t.id, level: t.level, pi, r, best: t.best };
  }
  throw new Error(`год ${t.id} не сходится`);
}
const shuffle = (list, rand) => {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
/* Пять лет игры: три года, где лучше вклад, и два, где лучше запас, — и оба «перевёртыша», чтобы
   не сработал шаблон «высокая инфляция — значит, запас»: решает сравнение ставки с прогнозом.
   Новость года — из колоды главы своего уровня, без повторов. */
export function walletYears(items, rand = Math.random) {
  const byId = Object.fromEntries(TYPES.map((t) => [t.id, t]));
  const plan = shuffle(['low-deposit', rand() < 0.5 ? 'mid-deposit' : 'low-deposit', 'high-stock', 'high-deposit', 'mid-stock'], rand);
  const decks = Object.fromEntries(WALLET_LEVELS.map((lv) => [lv, shuffle(items.filter((it) => it.level === lv), rand)]));
  return plan.map((id) => {
    const y = yearOf(byId[id], rand);
    const item = decks[y.level].shift();
    if (!item) throw new Error(`в колоде мало новостей уровня ${y.level}`);
    return { ...y, key: item.key, text: item.text, raw: item.raw };
  });
}

/* Ход игры: кошелёк в кронах и цена чашки после каждого года; чашки — сколько можно купить. */
export function walletPath(years, choices) {
  let wallet = WALLET.start; let cup = WALLET.cup;
  const out = [{ wallet, cup, cups: wallet / cup }];
  choices.forEach((c, k) => {
    const y = years[k];
    wallet *= nominalOf(c, y.pi, y.r); cup *= 1 + y.pi / 100;
    out.push({ wallet, cup, cups: wallet / cup });
  });
  return out;
}
// итог игры: сколько лет выбор был лучшим, сколько чашек в конце; зачёт — от четырёх лучших
export function walletResult(years, choices) {
  const right = choices.filter((c, k) => c === years[k].best).length;
  const path = walletPath(years, choices);
  const cups = Math.round(path[path.length - 1].cups);
  return { right, answered: choices.length, cups, score: cups, ok: choices.length === years.length && right >= WALLET.pass };
}
// реальный итог варианта в процентах, со знаком: −6,4
export const realPct = (opt, pi, r) => Math.round((realOf(opt, pi, r) - 1) * 1000) / 10;
