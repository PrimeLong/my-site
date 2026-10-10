/* ПАРАЛЛЕЛЬНЫЕ ВАРИАНТЫ ЗАДАЧ для итоговой проверки и «задач вперемешку». Тот, кто решал
   главы, помнит ответы их задач; здесь тот же тип задачи, но числа каждый раз новые — из
   параметров, выбранных случайно. Ответы и ловушки считаются формулой, а у каждого типа есть
   независимая проверка (check): ответ подставляется обратно в условие другим путём. Тесты
   гоняют каждый тип на сотне случайных наборов (см. textbook.test.js).

   Тип задачи: { id, chapter, level, source, gen(rand) }. source — задача главы того же типа:
   ошибка в проверке отправляет на повторение её. gen возвращает
   { statement, solution — markdown; parts: [{ answer, tol, unit, pos }]; traps: [{ part, value, text }];
     check(answers) — независимая проверка }. pos — ответ обязан быть положительным. */
import { parseBlocks, parseInline } from './markdown.js';

// генератор случайных чисел с зерном: тот же seed — тот же вариант (для тестов и повтора)
export function seeded(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ri = (rand, a, b, step = 1) => a + step * Math.floor(rand() * (Math.floor((b - a) / step) + 1));
const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
const r2 = (x) => Math.round(x * 100) / 100;
// число в тексте: 2 знака, запятая, настоящий минус
const f = (x) => String(r2(x)).replace('.', ',').replace('-', '−');
// число в формуле: запятая в фигурных скобках, иначе KaTeX ставит после неё пробел
const m = (x) => String(r2(x)).replace('.', '{,}');
// линейная функция в формуле: c + dP
const lin = (c, d, v) => {
  const dv = d === 1 ? v : `${m(d)}${v}`;
  if (c === 0) return dv;
  return c < 0 ? `-${m(-c)} + ${dv}` : `${m(c)} + ${dv}`;
};
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const DEC = 0.01;
const hundredths = ' (с точностью до сотых)';
// повторять выбор параметров, пока условие не выполнено
function draw(rand, make, ok) {
  for (let k = 0; k < 500; k += 1) { const p = make(rand); if (ok(p)) return p; }
  throw new Error('не удалось подобрать параметры варианта');
}
const differs = (a, b, tol = 0) => Math.abs(a - b) > tol + Math.max(tol, 0.01 * Math.abs(a)) + 1e-9;

/* ------------------------------ МИКРО ------------------------------ */
const T = [];
/* Страховка поверх условий в самих типах: если в редком наборе ловушка совпала с ответом или
   «положительный» ответ вышел не больше нуля, берём следующие случайные числа. */
const valid = (v) => v.parts.every((pt) => Number.isFinite(pt.answer) && (!pt.pos || pt.answer > 0))
  && v.traps.every((tr) => Number.isFinite(tr.value) && differs(tr.value, v.parts[tr.part].answer, v.parts[tr.part].tol || 0));
const guarded = (gen) => (rand) => { for (let k = 0; k < 200; k += 1) { const v = gen(rand); if (valid(v)) return v; } throw new Error('вариант не сошёлся'); };

// альтернативная стоимость по производительности за час
T.push({ id: 'v-sc-oc', chapter: 'scarcity', level: 1, source: 'sc-oc', gen: (rand) => {
  const who = pick(rand, ['Катя', 'Олег', 'Нина', 'Артём']);
  const b = ri(rand, 2, 4); const k = ri(rand, 2, 6); const a = b * k;
  return {
    statement: `За час ${who} может испечь ${a} пирогов или сшить ${b} рубашки. Чему равна альтернативная стоимость одной рубашки в пирогах?`,
    parts: [{ answer: k, unit: 'пирогов', pos: true }],
    traps: [
      { part: 0, value: b / a, text: 'Это альтернативная стоимость пирога в рубашках. Спрашивали наоборот — сколько пирогов стоит рубашка.' },
      { part: 0, value: a * b, text: `Пироги и рубашки не перемножают. Рубашка занимает $1/${b}$ часа — за это время можно испечь $${a}/${b}$ пирогов.` },
    ],
    solution: `1. Альтернативная стоимость рубашки — сколько пирогов не испекут, пока её шьют.\n2. За час — либо ${a} пирогов, либо ${b} рубашки: одна рубашка занимает $1/${b}$ часа.\n3. За это время можно испечь $${a}/${b} = ${k}$ пирогов.`,
    check: ([x]) => near(x * b, a),
  };
} });

// средняя альтернативная стоимость на круговой КПВ (пифагоровы тройки)
const CIRCLES = [
  [5, [[0, 5], [3, 4], [4, 3], [5, 0]]],
  [10, [[0, 10], [6, 8], [8, 6], [10, 0]]],
  [13, [[0, 13], [5, 12], [12, 5], [13, 0]]],
  [25, [[0, 25], [7, 24], [15, 20], [20, 15], [24, 7], [25, 0]]],
];
T.push({ id: 'v-sc-ppf', chapter: 'scarcity', level: 2, source: 'sc-ppf-cost', gen: (rand) => {
  const p = draw(rand, () => {
    // круг не больше 30: корни из сотен извлекаются и в уме, и на калькуляторе без длинных чисел
    const [R, pts] = pick(rand, CIRCLES); const s = ri(rand, 1, Math.max(1, Math.floor(30 / R)));
    const i = ri(rand, 0, pts.length - 2); const j = ri(rand, i + 1, pts.length - 1);
    return { R: R * s, p1: pts[i].map((v) => v * s), p2: pts[j].map((v) => v * s) };
  }, ({ p1, p2 }) => p1[1] - p2[1] !== p2[0] - p1[0] && p2[1] > 0);
  const [x1, y1] = p.p1; const [x2, y2] = p.p2;
  const ans = (y1 - y2) / (x2 - x1);
  return {
    statement: `КПВ страны: $X^2 + Y^2 = ${p.R * p.R}$ ($X$ — хлеб, $Y$ — станки). Производство хлеба увеличили с ${x1} до ${x2}. Сколько станков в среднем стоила каждая дополнительная единица хлеба${hundredths}?`,
    parts: [{ answer: ans, tol: DEC, unit: 'станка', pos: true }],
    traps: [{ part: 0, value: 1 / ans, text: 'Вы поделили прибавку хлеба на потерю станков. Альтернативная стоимость хлеба — сколько станков отдали за единицу хлеба.' }],
    solution: `При $X = ${x1}$: $Y = \\sqrt{${p.R * p.R} - ${x1 * x1}} = \\sqrt{${y1 * y1}} = ${y1}$. При $X = ${x2}$: $Y = \\sqrt{${p.R * p.R} - ${x2 * x2}} = \\sqrt{${y2 * y2}} = ${y2}$. Станков меньше на ${y1 - y2}, хлеба больше на ${x2 - x1}: $${y1 - y2}/${x2 - x1} \\approx ${m(ans)}$ станка за единицу.`,
    check: ([x]) => near(x1 * x1 + y1 * y1, p.R * p.R) && near(x2 * x2 + y2 * y2, p.R * p.R) && near(x * (x2 - x1), y1 - y2),
  };
} });

// альтернативная стоимость курсов: плата, часы занятий и дороги, упущенный заработок
T.push({ id: 'v-sc-time', chapter: 'scarcity', level: 2, source: 'sc-oc', gen: (rand) => {
  const k = { n: ri(rand, 4, 12), h: ri(rand, 3, 8), t: ri(rand, 1, 3), w: ri(rand, 300, 900, 50), fee: ri(rand, 5000, 30000, 1000) };
  const ans = k.fee + k.n * (k.h + k.t) * k.w;
  return {
    statement: `Курсы длятся ${k.n} недель по ${k.h} ч в неделю и стоят ${k.fee} руб. На дорогу уходит ещё ${k.t} ч в неделю. В эти часы можно было бы подрабатывать за ${k.w} руб. в час. Какова альтернативная стоимость курсов?`,
    parts: [{ answer: ans, unit: 'руб.', pos: true }],
    traps: [
      { part: 0, value: k.fee, text: 'Это только плата. Часы занятий и дороги можно было бы работать — упущенный заработок тоже цена курсов.' },
      { part: 0, value: k.fee + k.n * k.h * k.w, text: `Вы забыли дорогу: эти ${k.t} ч в неделю тоже не работаете.` },
      { part: 0, value: k.n * (k.h + k.t) * k.w, text: 'Это только упущенный заработок. Плату за курсы тоже нужно прибавить: без курсов она осталась бы у вас.' },
    ],
    solution: `1. Альтернативная стоимость — всё, от чего отказываетесь: деньги за курсы и заработок за часы, которые на них уходят.\n2. Часы: $(${k.h} + ${k.t}) \\cdot ${k.n} = ${(k.h + k.t) * k.n}$ ч, упущенный заработок $${(k.h + k.t) * k.n} \\cdot ${k.w} = ${k.n * (k.h + k.t) * k.w}$ руб.\n3. Вместе с платой: $${k.fee} + ${k.n * (k.h + k.t) * k.w} = ${ans}$ руб.`,
    check: ([x]) => near(x - k.fee, k.n * (k.h + k.t) * k.w),
  };
} });
// выбор на предельном уровне: сколько часов работать, если выручка каждого следующего часа падает
T.push({ id: 'v-sc-marg', chapter: 'scarcity', level: 2, source: 'sc-sunk', gen: (rand) => {
  const k = draw(rand, () => ({ H: ri(rand, 6, 9), R: ri(rand, 3000, 6000, 500), d: ri(rand, 400, 900, 100), c: ri(rand, 1500, 3500, 100) }),
    ({ R, d, c }) => R > c && (R - c) % d !== 0 && (R - c) / d < 5);
  const extra = Math.floor((k.R - k.c) / k.d) + 1;
  const ans = k.H + extra;
  return {
    statement: `Кафе работает ${k.H} ч в день, и эти часы точно выгодны. Следующий, ${k.H + 1}-й час принесёт ${k.R} руб. выручки, а каждый час после него — на ${k.d} руб. меньше предыдущего. Каждый час работы стоит кафе ${k.c} руб. Сколько часов в день выгодно работать?`,
    parts: [{ answer: ans, unit: 'ч', pos: true }],
    traps: [{ part: 0, value: ans + 1, text: `Последний посчитанный час уже убыточен: его выручка $${k.R - extra * k.d} < ${k.c}$. Работают, пока выручка часа не ниже его издержек.` }],
    solution: `1. Решают по шагу: следующий час выгоден, пока его выручка не ниже его издержек (${k.c} руб.).\n2. Выручка часов после ${k.H}-го: ${Array.from({ length: extra + 1 }, (_, i) => k.R - i * k.d).join(', ')} руб.\n3. Выгодны первые ${extra}: дальше выручка часа меньше ${k.c}. Всего $${k.H} + ${extra} = ${ans}$ ч.`,
    check: ([x]) => { const n = x - k.H; return n >= 1 && k.R - (n - 1) * k.d >= k.c && k.R - n * k.d < k.c; },
  };
} });
// невозвратные издержки: сравниваются только будущие деньги
T.push({ id: 'v-sc-sunk1', chapter: 'scarcity', level: 2, source: 'sc-sunk', gen: (rand) => {
  const k = draw(rand, () => ({ S: ri(rand, 3, 12), C: ri(rand, 1, 6), R: ri(rand, 2, 12) }), ({ S, C, R }) => R > C && S + C > R);
  const ans = k.R - k.C;
  return {
    statement: `Фирма уже потратила на проект ${k.S} млн руб. — их не вернуть. Чтобы закончить, нужно ещё ${k.C} млн руб., после этого проект принесёт ${k.R} млн руб. На сколько миллионов фирма выиграет, если закончит проект, по сравнению с тем, чтобы бросить его сейчас?`,
    parts: [{ answer: ans, unit: 'млн руб.', pos: true }],
    traps: [{ part: 0, value: k.R - k.C - k.S, text: `Вы вычли ${k.S} млн, которые уже потрачены. Они одинаковы при любом решении — сравнивают только будущие деньги: $${k.R} - ${k.C}$.` }],
    solution: `1. ${k.S} млн — невозвратные издержки: они потрачены при любом решении и на выбор не влияют.\n2. Будущие деньги: закончить — получить ${k.R} и заплатить ещё ${k.C}; бросить — ноль.\n3. Выигрыш: $${k.R} - ${k.C} = ${ans}$ млн руб. Заканчивать выгодно, хотя весь проект $${k.S} + ${k.C} > ${k.R}$ убыточен.`,
    check: ([x]) => near(x, k.R - k.C),
  };
} });

// спрос и предложение с целым равновесием
const market = (rand, extra = () => true) => draw(rand, () => {
  const b = ri(rand, 2, 5); const d = ri(rand, 1, 4); const P = ri(rand, 10, 40); const Q = ri(rand, 20, 90);
  return { b, d, P, Q, a: Q + b * P, c: Q - d * P };
}, (x) => extra(x));
T.push({ id: 'v-sd-eq', chapter: 'supply-demand', level: 1, source: 'sd-equilibrium', gen: (rand) => {
  const k = market(rand, ({ Q, d, P, b, a: A, c }) => Q !== d * P && b !== d && differs((A + c) / (b + d), P));
  const wrongP = (k.a + k.c) / (k.b + k.d);
  return {
    statement: `Спрос $Q_D = ${k.a} - ${k.b}P$, предложение $Q_S = ${lin(k.c, k.d, 'P')}$.\n\nа) Найдите равновесную цену.\n\nб) Найдите равновесное количество.`,
    parts: [{ answer: k.P, unit: 'руб.', pos: true }, { answer: k.Q, unit: 'ед.', pos: true }],
    traps: [{ part: 0, value: wrongP, text: 'Похоже на ошибку знака при переносе: из $a - bP = c + dP$ получается $P = (a - c)/(b + d)$, а не $(a + c)/(b + d)$.' }],
    solution: `а) $${k.a} - ${k.b}P = ${lin(k.c, k.d, 'P')}$, откуда $${k.b + k.d}P = ${k.a - k.c}$, $P^* = ${k.P}$.\n\nб) $Q^* = ${k.a} - ${k.b} \\cdot ${k.P} = ${k.Q}$.`,
    check: ([P, Q]) => near(k.a - k.b * P, k.c + k.d * P) && near(Q, k.c + k.d * P),
  };
} });
T.push({ id: 'v-sd-floor', chapter: 'supply-demand', level: 2, source: 'sd-floor', gen: (rand) => {
  let fl = 0;
  const k = market(rand, (x) => { fl = x.P + ri(rand, 2, 8); const ans = (x.b + x.d) * (fl - x.P); return x.a - x.b * fl > 0 && ans !== x.c + x.d * fl && ans !== x.a - x.b * fl; });
  const qd = k.a - k.b * fl; const qs = k.c + k.d * fl;
  return {
    statement: `Спрос на зерно $Q_D = ${k.a} - ${k.b}P$, предложение $Q_S = ${lin(k.c, k.d, 'P')}$. Государство обещает скупать зерно по цене не ниже ${fl}. Каким будет избыток зерна?`,
    parts: [{ answer: qs - qd, unit: 'ед.', pos: true }],
    traps: [
      { part: 0, value: qs, text: `${qs} — это сколько предлагают по цене ${fl}. Избыток — разница предложения и спроса по этой цене.` },
      { part: 0, value: qd, text: `${qd} — это объём спроса по цене пола. Избыток — предложение минус спрос.` },
    ],
    solution: `1. Сначала равновесие: $P^* = ${k.P}$. Пол ${fl} выше него — значит, он действует, и цена встанет на ${fl}.\n2. По цене ${fl} покупают $${k.a} - ${k.b} \\cdot ${fl} = ${qd}$, предлагают $${qs}$.\n3. Избыток — предложение минус спрос: $${qs} - ${qd} = ${qs - qd}$.`,
    check: ([x]) => near(x, (k.c + k.d * fl) - (k.a - k.b * fl)) && fl > (k.a - k.c) / (k.b + k.d),
  };
} });

// бюджетное ограничение
T.push({ id: 'v-cons-budget', chapter: 'consumer', level: 1, source: 'cons-budget', gen: (rand) => {
  const k = draw(rand, () => ({ px: ri(rand, 5, 30, 5), py: ri(rand, 2, 10), x: ri(rand, 2, 15), y: ri(rand, 2, 20) }), ({ px, py }) => px !== py);
  const I = k.px * k.x + k.py * k.y;
  return {
    statement: `Доход ${I} руб., цена товара $X$ — ${k.px} руб., товара $Y$ — ${k.py} руб. Сколько единиц $Y$ можно купить, если купить ${k.x} единиц $X$ и потратить весь доход?`,
    parts: [{ answer: k.y, unit: 'ед.', pos: true }],
    traps: [{ part: 0, value: I / k.py - k.x, text: `Похоже, вы вычли ${k.x} штук $X$ из количества $Y$, забыв про цену $X$. Сначала деньги: на $X$ ушло $${k.x} \\cdot ${k.px}$ руб.` }],
    solution: `1. На бюджетной линии весь доход тратится: деньги на $X$ уменьшают то, что остаётся на $Y$.\n2. На $X$ уходит $${k.x} \\cdot ${k.px} = ${k.x * k.px}$ руб., остаётся $${I} - ${k.x * k.px} = ${k.y * k.py}$ руб.\n3. Это $${k.y * k.py}/${k.py} = ${k.y}$ единиц $Y$.`,
    check: ([y]) => near(k.px * k.x + k.py * y, I),
  };
} });
// Кобб — Дуглас: спрос на один товар после подорожания (доля дохода не меняется)
T.push({ id: 'v-cons-cdx', chapter: 'consumer', level: 2, source: 'cons-cd', gen: (rand) => {
  const k = draw(rand, () => ({ al: pick(rand, [0.2, 0.25, 0.4, 0.5, 0.6, 0.75]), I: ri(rand, 400, 3000, 100), p0: ri(rand, 4, 20), up: pick(rand, [1.25, 1.5, 2]) }),
    ({ al, I, p0, up }) => Number.isInteger(r2(al * I / (p0 * up))) && Number.isInteger(r2(al * I / p0)) && Number.isInteger(r2(p0 * up)));
  const p1 = r2(k.p0 * k.up); const x0 = r2(k.al * k.I / k.p0); const x1 = r2(k.al * k.I / p1);
  return {
    statement: `Полезность $U = x^{${m(k.al)}}\\,y^{${m(1 - k.al)}}$, доход ${k.I} руб. Товар $X$ подорожал с ${k.p0} до ${p1} руб. Сколько единиц $X$ купит потребитель теперь?`,
    parts: [{ answer: x1, unit: 'ед.', pos: true }],
    traps: [
      { part: 0, value: x0, text: `Это покупки до подорожания. Доля дохода на $X$ та же, а цена выше: $${m(k.al)} \\cdot ${k.I} / ${p1}$.` },
      { part: 0, value: r2(k.I / p1), text: `Это весь доход на $X$. У Кобба — Дугласа на $X$ уходит только доля ${f(k.al)} — показатель степени при $x$.` },
    ],
    solution: `1. У Кобба — Дугласа на товар уходит постоянная доля дохода — показатель степени: на $X$ — ${f(k.al)}.\n2. Эта доля от цены не зависит: на $X$ по-прежнему $${m(k.al)} \\cdot ${k.I} = ${m(k.al * k.I)}$ руб.\n3. По новой цене: $${m(k.al * k.I)} / ${p1} = ${f(x1)}$ единиц (было ${f(x0)}).`,
    check: ([x]) => near(x, x1),
  };
} });
// компенсация дохода: сколько нужно, чтобы прежний набор остался по карману
T.push({ id: 'v-cons-comp', chapter: 'consumer', level: 2, source: 'cons-budget', gen: (rand) => {
  const k = draw(rand, () => ({ px: ri(rand, 2, 20), py: ri(rand, 2, 20), x: ri(rand, 3, 20), y: ri(rand, 3, 20), up: pick(rand, [1.25, 1.5, 2]) }), ({ px, up }) => Number.isInteger(px * up));
  const I = k.px * k.x + k.py * k.y; const p1 = k.px * k.up; const ans = p1 * k.x + k.py * k.y;
  return {
    statement: `Доход ${I} руб. уходит целиком на ${k.x} единиц $X$ по ${k.px} руб. и ${k.y} единиц $Y$ по ${k.py} руб. Цена $X$ выросла до ${p1} руб. Какой доход нужен, чтобы прежний набор остался по карману?`,
    parts: [{ answer: ans, unit: 'руб.', pos: true }],
    traps: [
      { part: 0, value: I, text: 'Это прежний доход. При новой цене $X$ на него прежний набор уже не купить.' },
      { part: 0, value: r2(I * k.up), text: `Вы умножили весь доход на рост цены $X$, но подорожал только $X$: $Y$ стоит по-прежнему ${k.py} руб.` },
    ],
    solution: `1. Прежний набор по новым ценам: ${k.x} единиц $X$ по ${p1} руб. и ${k.y} единиц $Y$ по ${k.py} руб.\n2. $${k.x} \\cdot ${p1} + ${k.y} \\cdot ${k.py} = ${k.x * p1} + ${k.y * k.py}$.\n3. Нужен доход ${ans} руб. — на ${ans - I} больше прежнего. Так компенсируют доход в разложении Слуцкого.`,
    check: ([v]) => near(v, p1 * k.x + k.py * k.y),
  };
} });
// цена товара по точке на бюджетной линии
T.push({ id: 'v-cons-price', chapter: 'consumer', level: 2, source: 'cons-line', gen: (rand) => {
  const k = draw(rand, () => ({ px: ri(rand, 2, 30), py: ri(rand, 2, 20), x: ri(rand, 2, 15), y: ri(rand, 2, 20) }), ({ px, py }) => px !== py);
  const I = k.px * k.x + k.py * k.y;
  return {
    statement: `Доход ${I} руб., товар $Y$ стоит ${k.py} руб. Набор из ${k.x} единиц $X$ и ${k.y} единиц $Y$ лежит на бюджетной линии. Сколько стоит товар $X$?`,
    parts: [{ answer: k.px, unit: 'руб.', pos: true }],
    traps: [{ part: 0, value: r2(I / k.x), text: `Вы поделили на ${k.x} весь доход. Часть его уходит на $Y$: сначала вычтите $${k.y} \\cdot ${k.py}$.` }],
    solution: `1. На бюджетной линии тратится весь доход: расходы на $X$ и на $Y$ вместе дают ${I} руб.\n2. На $Y$: $${k.y} \\cdot ${k.py} = ${k.y * k.py}$ руб., на $X$ остаётся $${I} - ${k.y * k.py} = ${k.x * k.px}$ руб.\n3. Цена $X$: $${k.x * k.px} / ${k.x} = ${k.px}$ руб.`,
    check: ([v]) => near(v * k.x + k.py * k.y, I),
  };
} });
// Закон Энгеля: на сколько процентных пунктов падает доля еды с ростом дохода
T.push({ id: 'v-cons-engel', chapter: 'consumer', level: 2, source: 'cons-engel-index', gen: (rand) => {
  const k = draw(rand, () => ({ I0: ri(rand, 40, 80, 10), s0: pick(rand, [40, 45, 50, 60]), g: pick(rand, [1.5, 2]), s1: pick(rand, [25, 30, 35]) }),
    ({ I0, s0, g, s1 }) => s1 < s0 && Number.isInteger(I0 * s0 / 100) && Number.isInteger(I0 * g) && Number.isInteger(I0 * g * s1 / 100) && I0 * g * s1 > I0 * s0);
  const I1 = k.I0 * k.g; const F0 = k.I0 * k.s0 / 100; const F1 = I1 * k.s1 / 100;
  return {
    statement: `Семья тратила на еду ${F0} тыс. руб. из дохода ${k.I0} тыс. Доход вырос до ${I1} тыс., расходы на еду — до ${F1} тыс. Весь доход тратится. На сколько процентных пунктов упала доля еды в расходах?`,
    parts: [{ answer: k.s0 - k.s1, unit: 'п. п.', pos: true }],
    traps: [{ part: 0, value: r2(((F1 - F0) / F0) * 100), text: `Это рост самих расходов на еду, в процентах. Спрашивали про долю: было ${k.s0}%, стало ${k.s1}%.` }],
    solution: `1. Доля еды — расходы на еду, делённые на все расходы (здесь весь доход).\n2. Было: $${F0} / ${k.I0} = ${k.s0}\\%$. Стало: $${F1} / ${I1} = ${k.s1}\\%$.\n3. Доля упала на $${k.s0} - ${k.s1} = ${k.s0 - k.s1}$ процентных пунктов — хотя на еду тратят больше. Это закон Энгеля.`,
    check: ([x]) => near(x, k.s0 - k.s1),
  };
} });
// Кобб — Дуглас: доли дохода
T.push({ id: 'v-cons-cd', chapter: 'consumer', level: 2, source: 'cons-cd-share', gen: (rand) => {
  const k = draw(rand, () => ({ al: pick(rand, [0.2, 0.25, 0.4, 0.6, 0.75, 0.8]), I: ri(rand, 200, 2000, 100), px: ri(rand, 2, 20), py: ri(rand, 2, 20) }),
    ({ al, I, px, py }) => Number.isInteger(r2(al * I / px)) && Number.isInteger(r2((1 - al) * I / py)));
  const x = r2(k.al * k.I / k.px); const y = r2((1 - k.al) * k.I / k.py);
  return {
    statement: `Полезность $U = x^{${m(k.al)}}\\,y^{${m(1 - k.al)}}$, доход ${k.I} руб., цены $p_x = ${k.px}$, $p_y = ${k.py}$.\n\nа) Сколько единиц $X$ купит потребитель?\n\nб) Сколько единиц $Y$?`,
    parts: [{ answer: x, unit: 'ед.', pos: true }, { answer: y, unit: 'ед.', pos: true }],
    traps: [
      { part: 0, value: (1 - k.al) * k.I / k.px, text: `Перепутаны показатели: на $X$ тратится доля ${f(k.al)} — показатель степени при $x$.` },
      { part: 0, value: k.I / (2 * k.px), text: 'Половина дохода на каждый товар — только когда показатели равны ½. Здесь доля $X$ — его показатель степени.' },
    ],
    solution: `У Кобба — Дугласа на товар уходит доля дохода, равная его показателю: на $X$ — $${m(k.al)} \\cdot ${k.I} = ${m(k.al * k.I)}$ руб., это ${f(x)} единиц; на $Y$ — ${f((1 - k.al) * k.I)} руб., это ${f(y)} единиц.`,
    check: ([xx, yy]) => near(k.px * xx + k.py * yy, k.I) && near((k.al / (1 - k.al)) * (yy / xx), k.px / k.py),
  };
} });

// дуговая эластичность
T.push({ id: 'v-el-arc', chapter: 'elasticity', level: 1, source: 'el-arc', gen: (rand) => {
  const k = draw(rand, () => { const P1 = ri(rand, 4, 20); const Q1 = ri(rand, 60, 200, 10); return { P1, P2: P1 + ri(rand, 1, 6), Q1, Q2: Q1 - ri(rand, 5, 40, 5) }; },
    ({ P1, P2, Q1, Q2 }) => { const e = ((Q1 - Q2) / (Q1 + Q2)) / ((P2 - P1) / (P1 + P2)); const e0 = ((Q1 - Q2) / Q1) / ((P2 - P1) / P1); return differs(e0, e, DEC) && differs(1 / e, e, DEC); });
  const e = ((k.Q1 - k.Q2) / (k.Q1 + k.Q2)) / ((k.P2 - k.P1) / (k.P1 + k.P2));
  return {
    statement: `Цена выросла с ${k.P1} до ${k.P2}, а покупки упали с ${k.Q1} до ${k.Q2}. Найдите модуль дуговой эластичности спроса по цене${hundredths}.`,
    parts: [{ answer: e, tol: DEC, pos: true }],
    traps: [
      { part: 0, value: ((k.Q1 - k.Q2) / k.Q1) / ((k.P2 - k.P1) / k.P1), text: 'Проценты посчитаны от начальных значений. Дуговая эластичность считает от средних — иначе при росте и падении цены получались бы разные числа.' },
      { part: 0, value: 1 / e, text: 'Перевёрнуто: эластичность — процент изменения количества, делённый на процент изменения цены.' },
    ],
    // разбор по шагам: средние, проценты от средних, их отношение (жалоба: «непонятно, откуда модуль»)
    solution: (() => {
      const mp = (k.P1 + k.P2) / 2; const mq = (k.Q1 + k.Q2) / 2;
      const pq = (100 * (k.Q1 - k.Q2)) / mq; const pp = (100 * (k.P2 - k.P1)) / mp;
      return `1. Дуговая эластичность считает проценты от средних значений. Средняя цена: $(${k.P1} + ${k.P2})/2 = ${m(mp)}$, среднее количество: $(${k.Q1} + ${k.Q2})/2 = ${m(mq)}$.\n`
        + `2. Покупки упали на ${k.Q1 - k.Q2}: это $${k.Q1 - k.Q2}/${m(mq)} \\approx ${m(pq)}\\%$ от среднего. Цена выросла на ${k.P2 - k.P1}: это $${k.P2 - k.P1}/${m(mp)} \\approx ${m(pp)}\\%$ от средней.\n`
        + `3. Эластичность — процент изменения покупок, делённый на процент изменения цены: $|E_d| = ${m(pq)}/${m(pp)} \\approx ${m(e)}$.`;
    })(),
    check: ([x]) => near(x, ((k.Q1 - k.Q2) / (k.P2 - k.P1)) * ((k.P1 + k.P2) / (k.Q1 + k.Q2))),
  };
} });
// цена, при которой выручка максимальна (жалоба: одна и та же задача в повторах — теперь с новыми числами)
T.push({ id: 'v-el-rmax', chapter: 'elasticity', level: 1, source: 'el-revenue-max', gen: (rand) => {
  const b = pick(rand, [3, 4, 5]); const top = ri(rand, 10, 40) * 2; const a = b * top; const P = top / 2;
  return {
    statement: `Спрос $Q = ${a} - ${b}P$. При какой цене выручка максимальна?`,
    parts: [{ answer: P, unit: 'руб.', pos: true }],
    traps: [
      { part: 0, value: top, text: `При цене ${top} спрос равен нулю, и выручка тоже. Максимум — посередине прямой: $${a}/(2 \\cdot ${b})$.` },
      { part: 0, value: a / 2, text: 'Это количество при максимуме выручки, а спрашивали цену.' },
    ],
    solution: `Выручка максимальна в середине прямой спроса: $P = a/(2b) = ${a}/(2 \\cdot ${b}) = ${P}$. Там $Q = ${a / 2}$ и $|E| = 1$.`,
    check: ([x]) => { const R = (p) => p * (a - b * p); return R(x) >= R(x - 0.01) && R(x) >= R(x + 0.01); },
  };
} });
// точечная эластичность линейного спроса
T.push({ id: 'v-el-point', chapter: 'elasticity', level: 2, source: 'el-point', gen: (rand) => {
  const k = draw(rand, () => { const b = ri(rand, 1, 5); const top = ri(rand, 20, 80); return { a: b * top, b, top, P: ri(rand, 2, top - 2) }; },
    ({ a, b, P }) => { const e = (b * P) / (a - b * P); return differs(1 / e, e, DEC) && a - b * P > 0; });
  const Q = k.a - k.b * k.P; const e = (k.b * k.P) / Q;
  return {
    statement: `Спрос $Q = ${k.a} - ${k.b}P$.\n\nа) Найдите модуль эластичности при цене ${k.P}${hundredths}.\n\nб) При какой цене эластичность по модулю равна единице?`,
    parts: [{ answer: e, tol: DEC, pos: true }, { answer: k.top / 2, tol: DEC, unit: 'руб.', pos: true }],
    traps: [
      { part: 0, value: 1 / e, text: 'Перевёрнуто: в точке $|E| = bP/Q$, а не $Q/(bP)$.' },
      { part: 1, value: k.top, text: `При цене ${k.top} спрос равен нулю. Единичная эластичность — посередине прямой.` },
    ],
    solution: `а) $Q = ${Q}$, $|E| = ${k.b} \\cdot ${k.P}/${Q} \\approx ${m(e)}$.\n\nб) $${k.b}P = ${k.a} - ${k.b}P$, $P = ${m(k.top / 2)}$ — середина прямой.`,
    check: ([x, P1]) => { const h = 1e-4; const d = ((k.a - k.b * (k.P + h)) - (k.a - k.b * (k.P - h))) / (2 * h); return near(x, -d * k.P / Q, 1e-5) && near(k.b * P1, k.a - k.b * P1); },
  };
} });

// эластичность в одной точке прямой спроса — одним ответом (усложнение для «Практики» Пути)
T.push({ id: 'v-el-pt1', chapter: 'elasticity', level: 2, source: 'el-point', gen: (rand) => {
  const k = draw(rand, () => { const b = ri(rand, 1, 5); const top = ri(rand, 20, 80); return { a: b * top, b, top, P: ri(rand, 2, top - 2) }; },
    ({ a, b, P }) => { const e = (b * P) / (a - b * P); return differs(1 / e, e, DEC) && a - b * P > 0; });
  const Q = k.a - k.b * k.P; const e = (k.b * k.P) / Q;
  return {
    statement: `Спрос $Q = ${k.a} - ${k.b}P$, цена ${k.P} крон. Найдите модуль эластичности спроса в этой точке${hundredths}.`,
    parts: [{ answer: e, tol: DEC, pos: true }],
    traps: [{ part: 0, value: 1 / e, text: 'Перевёрнуто: в точке $|E| = bP/Q$, а не $Q/(bP)$.' }],
    solution: `Сначала количество: $Q = ${k.a} - ${k.b} \\cdot ${k.P} = ${Q}$. Эластичность в точке прямой $|E| = bP/Q = ${k.b} \\cdot ${k.P}/${Q} \\approx ${m(e)}$ — спрос ${e > 1 ? 'эластичный' : e < 1 ? 'неэластичный' : 'единичной эластичности'}.`,
    check: ([x]) => near(x, (k.b * k.P) / (k.a - k.b * k.P)),
  };
} });

// издержки: переменные и средние
T.push({ id: 'v-costs-types', chapter: 'costs', level: 1, source: 'costs-types', gen: (rand) => {
  const k = { F: ri(rand, 100, 800, 50), v: ri(rand, 5, 40), w: pick(rand, [0.5, 1, 2]), Q: ri(rand, 5, 30) };
  const VC = k.v * k.Q + k.w * k.Q * k.Q; const ATC = (k.F + VC) / k.Q;
  return {
    statement: `Общие издержки $TC = ${k.F} + ${k.v}Q + ${m(k.w)}Q^2$, выпуск ${k.Q}.\n\nа) Чему равны переменные издержки?\n\nб) Чему равны средние общие издержки${hundredths}?`,
    parts: [{ answer: VC, unit: 'руб.', pos: true }, { answer: ATC, tol: DEC, unit: 'руб.', pos: true }],
    traps: [
      { part: 0, value: k.F + VC, text: `Это общие издержки. Переменные — без постоянных ${k.F}.` },
      { part: 1, value: VC / k.Q, text: 'Это средние переменные издержки. Средние общие включают и постоянные.' },
    ],
    solution: `а) $VC = ${k.v} \\cdot ${k.Q} + ${m(k.w)} \\cdot ${k.Q * k.Q} = ${m(VC)}$.\n\nб) $TC = ${m(k.F + VC)}$, $ATC = ${m(k.F + VC)}/${k.Q} \\approx ${m(ATC)}$.`,
    check: ([vc, atc]) => near(vc, (k.F + k.v * k.Q + k.w * k.Q ** 2) - k.F) && near(atc * k.Q, k.F + vc),
  };
} });
// минимум средних общих издержек
T.push({ id: 'v-costs-atc', chapter: 'costs', level: 2, source: 'costs-atc-min', gen: (rand) => {
  const d = pick(rand, [0.5, 1, 2]); const q = ri(rand, 5, 30); const c = ri(rand, 2, 20); const F = d * q * q;
  const atc = (Q) => F / Q + c + d * Q;
  return {
    statement: `Общие издержки $TC = ${m(F)} + ${c}Q + ${m(d)}Q^2$.\n\nа) При каком выпуске средние общие издержки минимальны?\n\nб) Чему равен этот минимум?`,
    parts: [{ answer: q, unit: 'ед.', pos: true }, { answer: atc(q), tol: DEC, unit: 'руб.', pos: true }],
    traps: [{ part: 1, value: c + d * q, text: 'Это средние переменные издержки в этой точке — забыты постоянные $F/Q$.' }],
    solution: `$ATC = ${m(F)}/Q + ${c} + ${m(d)}Q$. Производная $-${m(F)}/Q^2 + ${m(d)} = 0$, $Q^2 = ${q * q}$, $Q = ${q}$. $ATC(${q}) = ${m(atc(q))}$ — там же $MC = ${c} + ${m(2 * d)}Q = ATC$.`,
    check: ([Q, A]) => near(A, atc(Q)) && atc(Q) <= atc(Q - 1) && atc(Q) <= atc(Q + 1) && near(c + 2 * d * Q, A),
  };
} });

// конкурентная фирма: выпуск и прибыль
T.push({ id: 'v-pc-basic', chapter: 'competition-monopoly', level: 1, source: 'pc-basic', gen: (rand) => {
  const c = ri(rand, 2, 20); const k = ri(rand, 1, 4); const Q = ri(rand, 5, 20); const P = c + k * Q; const atc = ri(rand, c + 1, P - 1);
  return {
    statement: `Конкурентная фирма продаёт по цене ${P} руб., её предельные издержки $MC = ${lin(c, k, 'Q')}$.\n\nа) Сколько единиц выгодно производить?\n\nб) Средние общие издержки при этом выпуске — ${atc} руб. Какой будет прибыль?`,
    parts: [{ answer: Q, unit: 'ед.', pos: true }, { answer: (P - atc) * Q, unit: 'руб.', pos: true }],
    traps: [
      { part: 1, value: P - atc, text: 'Это прибыль с единицы, $P - ATC$. Умножьте на выпуск.' },
      { part: 1, value: P * Q, text: 'Это выручка. Прибыль — выручка минус общие издержки.' },
    ],
    solution: `а) $${P} = ${lin(c, k, 'Q')}$, $Q = ${Q}$.\n\nб) $(${P} - ${atc}) \\cdot ${Q} = ${(P - atc) * Q}$.`,
    check: ([q, pr]) => near(c + k * q, P) && near(pr, P * q - atc * q),
  };
} });
// монополист с линейным спросом
T.push({ id: 'v-mon-price', chapter: 'competition-monopoly', level: 2, source: 'mon-price', gen: (rand) => {
  const b = ri(rand, 1, 3); const c = ri(rand, 10, 60); const Q = ri(rand, 10, 40); const a = c + 2 * b * Q; const P = a - b * Q;
  return {
    statement: `Спрос на продукцию монополиста $P = ${a} - ${b === 1 ? '' : b}Q$, предельные издержки постоянны и равны ${c}.\n\nа) Какой выпуск он выберет?\n\nб) Какую цену назначит?`,
    parts: [{ answer: Q, unit: 'ед.', pos: true }, { answer: P, unit: 'руб.', pos: true }],
    traps: [
      { part: 0, value: (a - c) / b, text: 'Это выпуск при конкуренции ($P = MC$). Монополист выбирает $MR = MC$, а $MR = a - 2bQ$.' },
      { part: 1, value: c, text: 'Это цена при конкуренции. Монополист берёт цену со спроса при своём выпуске.' },
    ],
    solution: `$MR = ${a} - ${2 * b}Q = ${c}$, $Q = ${Q}$. Цена со спроса: $${a} - ${b} \\cdot ${Q} = ${P}$.`,
    check: ([q, p]) => near(a - 2 * b * q, c) && near(p, a - b * q),
  };
} });

// Курно, симметричный
T.push({ id: 'v-olig-cournot', chapter: 'oligopoly', level: 1, source: 'olig-cournot-price', gen: (rand) => {
  const c = ri(rand, 5, 40); const q = ri(rand, 10, 40); const a = c + 3 * q; const P = a - 2 * q;
  return {
    statement: `Спрос $P = ${a} - Q$, две фирмы конкурируют по Курно, предельные издержки у обеих ${c}.\n\nа) Сколько выпустит каждая фирма?\n\nб) Какой будет цена?`,
    parts: [{ answer: q, unit: 'ед.', pos: true }, { answer: P, unit: 'руб.', pos: true }],
    traps: [
      { part: 0, value: (a - c) / 2, text: 'Это лучший ответ, если соперник ничего не выпускает. В равновесии каждая отвечает на выпуск другой: $q = (a - c - q)/2$.' },
      { part: 1, value: (a + c) / 2, text: 'Это монопольная цена. Две фирмы по Курно выпускают больше монополиста.' },
    ],
    solution: `Кривая реакции $q_1 = (${a - c} - q_2)/2$. В равновесии $q = ${a - c}/3 = ${q}$, суммарный выпуск ${2 * q}, цена $${a} - ${2 * q} = ${P}$.`,
    check: ([qq, p]) => near(qq, (a - c - qq) / 2) && near(p, a - 2 * qq),
  };
} });
// Курно с разными издержками
T.push({ id: 'v-olig-asym', chapter: 'oligopoly', level: 2, source: 'olig-cournot-asym', gen: (rand) => {
  const k = draw(rand, () => { const c1 = ri(rand, 10, 40); return { a: ri(rand, 100, 200), c1, c2: c1 + ri(rand, 5, 30) }; },
    ({ a, c1, c2 }) => (a - 2 * c1 + c2) % 3 === 0 && a - 2 * c2 + c1 > 0);
  const q1 = (k.a - 2 * k.c1 + k.c2) / 3; const q2 = (k.a - 2 * k.c2 + k.c1) / 3;
  return {
    statement: `Спрос $P = ${k.a} - Q$, дуополия Курно. Предельные издержки первой фирмы ${k.c1}, второй — ${k.c2}. Сколько выпустит первая фирма?`,
    parts: [{ answer: q1, unit: 'ед.', pos: true }],
    traps: [{ part: 0, value: (k.a - k.c1) / 2, text: 'Это лучший ответ первой фирмы, если вторая ничего не выпускает. Найдите равновесие обеих кривых реакции.' }],
    solution: `$q_1^* = (a - 2c_1 + c_2)/3 = (${k.a} - ${2 * k.c1} + ${k.c2})/3 = ${q1}$; вторая выпустит ${f(q2)}.`,
    check: ([x]) => near(x, (k.a - k.c1 - q2) / 2) && near(q2, (k.a - k.c2 - x) / 2),
  };
} });

// излишек потребителей
T.push({ id: 'v-mf-cs', chapter: 'market-failures', level: 1, source: 'mf-cs', gen: (rand) => {
  const b = pick(rand, [1, 2, 4, 5]); const top = ri(rand, 20, 80); const P = ri(rand, 5, top - 5); const a = b * top;
  const cs = 0.5 * (a - b * P) * (top - P);
  return {
    statement: `Спрос $Q_D = ${a} - ${b === 1 ? '' : b}P$, рыночная цена ${P}. Найдите излишек потребителей.`,
    parts: [{ answer: cs, tol: DEC, unit: 'руб.', pos: true }],
    traps: [{ part: 0, value: 2 * cs, text: 'Забыли ½: излишек — треугольник, а не прямоугольник.' }],
    solution: `Покупают $${a - b * P}$, спрос нулевой при $P = ${top}$. Излишек $\\tfrac12 \\cdot ${a - b * P} \\cdot ${top - P} = ${m(cs)}$.`,
    check: ([x]) => near(x, a * (top - P) - (b / 2) * (top * top - P * P)),
  };
} });
// бремя налога и потери
T.push({ id: 'v-mf-tax', chapter: 'market-failures', level: 2, source: 'mf-incidence', gen: (rand) => {
  let kk = 1;
  const k = market(rand, (x) => { kk = ri(rand, 1, 3); return x.Q - x.b * x.d * kk > 0; });
  const t = (k.b + k.d) * kk; const Pd = k.P + k.d * kk; const dQ = k.b * k.d * kk; const dwl = 0.5 * t * dQ;
  return {
    statement: `Спрос $Q_D = ${k.a} - ${k.b}P$, предложение $Q_S = ${lin(k.c, k.d, 'P')}$. Введён налог ${t} руб. с единицы.\n\nа) Какую цену будут платить покупатели?\n\nб) Найдите безвозвратные потери.`,
    parts: [{ answer: Pd, unit: 'руб.', pos: true }, { answer: dwl, tol: DEC, unit: 'руб.', pos: true }],
    traps: [
      { part: 0, value: k.P + t, text: 'Покупатели платят не весь налог: часть несут продавцы. Решите $Q_D(P_d) = Q_S(P_d - t)$.' },
      { part: 1, value: t * dQ, text: 'Забыли ½: потери — треугольник с высотой, равной налогу.' },
    ],
    solution: `Без налога $P = ${k.P}$, $Q = ${k.Q}$. С налогом: $${k.a} - ${k.b}P_d = ${lin(k.c, k.d, `(P_d - ${t})`)}$, $P_d = ${Pd}$, количество падает на ${dQ}. Потери $\\tfrac12 \\cdot ${t} \\cdot ${dQ} = ${m(dwl)}$.`,
    check: ([pd, x]) => near(k.a - k.b * pd, k.c + k.d * (pd - t)) && near(x, 0.5 * t * (k.Q - (k.a - k.b * pd))),
  };
} });

/* ------------------------------ МАКРО ------------------------------ */
T.push({ id: 'v-gdp-exp', chapter: 'gdp', level: 1, source: 'gdp-exp', gen: (rand) => {
  const k = { C: ri(rand, 400, 900, 10), I: ri(rand, 100, 300, 10), G: ri(rand, 100, 300, 10), X: ri(rand, 50, 200, 10), M: ri(rand, 50, 200, 10), Tr: ri(rand, 30, 150, 10) };
  const Y = k.C + k.I + k.G + k.X - k.M;
  return {
    statement: `За год (млрд руб., числа условные): потребление ${k.C}, инвестиции ${k.I}, госзакупки ${k.G}, экспорт ${k.X}, импорт ${k.M}, пенсии и пособия ${k.Tr}. Чему равен ВВП?`,
    parts: [{ answer: Y, unit: 'млрд руб.', pos: true }],
    traps: [
      { part: 0, value: Y + k.Tr, text: 'Пенсии и пособия — трансферты: за них ничего не произведено, в ВВП они не входят.' },
      { part: 0, value: Y + k.M, text: 'Не вычтен импорт: он произведён за границей.' },
    ],
    solution: `$Y = ${k.C} + ${k.I} + ${k.G} + (${k.X} - ${k.M}) = ${Y}$. Трансферты не входят.`,
    check: ([y]) => near(y - k.C - k.I - k.G, k.X - k.M),
  };
} });
T.push({ id: 'v-gdp-real', chapter: 'gdp', level: 2, source: 'gdp-approx', gen: (rand) => {
  const k = draw(rand, () => ({ g: ri(rand, 6, 24), p: ri(rand, 2, 18) }), ({ g, p }) => differs(g - p, ((1 + g / 100) / (1 + p / 100) - 1) * 100, DEC));
  const r = ((1 + k.g / 100) / (1 + k.p / 100) - 1) * 100;
  return {
    statement: `Номинальный ВВП вырос за год на ${k.g}%, дефлятор — на ${k.p}%. На сколько процентов вырос реальный ВВП? Посчитайте точно${hundredths}.`,
    parts: [{ answer: r, tol: DEC, unit: '%' }],
    traps: [
      { part: 0, value: k.g - k.p, text: `Это приближение $${k.g} - ${k.p}$. Точно: $(1 + g)/(1 + \\pi) - 1$.` },
      { part: 0, value: k.g, text: 'Это номинальный рост — в нём и рост цен.' },
    ],
    solution: `$${m(1 + k.g / 100)}/${m(1 + k.p / 100)} - 1 \\approx ${m(r / 100)}$, то есть ${f(r)}%.`,
    check: ([x]) => near((1 + x / 100) * (1 + k.p / 100), 1 + k.g / 100),
  };
} });
T.push({ id: 'v-mb-mult', chapter: 'money-banks', level: 1, source: 'mb-cash', gen: (rand) => {
  const k = { rr: pick(rand, [0.05, 0.1, 0.15, 0.2, 0.25]), cr: pick(rand, [0.05, 0.1, 0.2, 0.25, 0.3]), B: ri(rand, 200, 1000, 100) };
  const mm = (1 + k.cr) / (k.cr + k.rr);
  return {
    statement: `Денежная база ${k.B} млрд руб., норма резервов ${f(k.rr * 100)}%, люди держат наличными ${f(k.cr * 100)} копеек на каждый рубль вкладов.\n\nа) Найдите денежный мультипликатор${hundredths}.\n\nб) Найдите денежную массу (с точностью до целых).`,
    parts: [{ answer: mm, tol: DEC, pos: true }, { answer: mm * k.B, tol: 0.5, unit: 'млрд руб.', pos: true }],
    traps: [
      { part: 0, value: 1 / k.rr, text: '$1/rr$ — мультипликатор без наличных на руках. С наличными $m = (1 + cr)/(cr + rr)$.' },
      { part: 1, value: k.B / k.rr, text: 'Это масса без наличных на руках: наличные выпадают из цепочки кредитов.' },
    ],
    solution: `а) $m = ${m(1 + k.cr)}/${m(k.cr + k.rr)} \\approx ${m(mm)}$.\n\nб) $M = ${m(mm)} \\cdot ${k.B} \\approx ${m(mm * k.B)}$.`,
    check: ([x, M]) => { const D = k.B / (k.cr + k.rr); return near(M, k.cr * D + D, 1e-3) && near(x, M / k.B, 1e-3); },
  };
} });
T.push({ id: 'v-mb-qty', chapter: 'money-banks', level: 2, source: 'mb-qty-growth', gen: (rand) => {
  const k = draw(rand, () => ({ gm: ri(rand, 5, 30), gy: ri(rand, 1, 6) }), ({ gm, gy }) => gm > gy + 1 && differs(gm - gy, ((1 + gm / 100) / (1 + gy / 100) - 1) * 100, DEC));
  const pi = ((1 + k.gm / 100) / (1 + k.gy / 100) - 1) * 100;
  return {
    statement: `Денежная масса выросла за год на ${k.gm}%, скорость обращения не изменилась, реальный ВВП вырос на ${k.gy}%. Какой была инфляция? Посчитайте точно${hundredths}.`,
    parts: [{ answer: pi, tol: DEC, unit: '%', pos: true }],
    traps: [
      { part: 0, value: k.gm - k.gy, text: `Это приближение $${k.gm} - ${k.gy}$. Точно: $(1 + g_M)/(1 + g_Y) - 1$.` },
      { part: 0, value: k.gm + k.gy, text: 'Рост реального ВВП нужно вычесть: больше товаров — больше денег нужно при тех же ценах.' },
    ],
    solution: `$MV = PY$: $1 + \\pi = ${m(1 + k.gm / 100)}/${m(1 + k.gy / 100)}$, $\\pi \\approx ${m(pi)}\\%$.`,
    check: ([x]) => near((1 + x / 100) * (1 + k.gy / 100), 1 + k.gm / 100),
  };
} });
// инфляция: рост реальной зарплаты — приближённо, вычитанием
T.push({ id: 'v-in-real', chapter: 'inflation', level: 1, source: 'in-wage', gen: (rand) => {
  const k = draw(rand, () => ({ g: ri(rand, 3, 15), p: ri(rand, 2, 12) }), ({ g, p }) => g !== p);
  return {
    statement: `Зарплата выросла за год на ${k.g}%, а цены — на ${k.p}%. На сколько процентов примерно выросла реальная зарплата? Посчитайте приближённо — вычитанием.`,
    parts: [{ answer: k.g - k.p, unit: '%' }],
    traps: [
      { part: 0, value: k.g + k.p, text: 'Инфляцию нужно вычесть, а не прибавить: рост цен съедает часть прибавки.' },
      { part: 0, value: k.g, text: 'Это рост в деньгах — номинальный. Реальный — за вычетом инфляции.' },
    ],
    solution: `$${k.g} - ${k.p} = ${k.g - k.p}$%. ${k.g > k.p ? 'Зарплата обогнала цены.' : 'Цены обогнали зарплату: купить на неё можно меньше.'}`,
    check: ([x]) => near(x + k.p, k.g),
  };
} });
// инфляция: реальная ставка по кредиту — точно, по уравнению Фишера
T.push({ id: 'v-in-realrate', chapter: 'inflation', level: 2, source: 'in-loan', gen: (rand) => {
  const k = draw(rand, () => ({ i: ri(rand, 4, 24), p: ri(rand, 2, 20) }), ({ i, p }) => i !== p && differs(i - p, ((1 + i / 100) / (1 + p / 100) - 1) * 100, DEC));
  const r = ((1 + k.i / 100) / (1 + k.p / 100) - 1) * 100;
  return {
    statement: `Кредит выдан на год под ${k.i}%, инфляция за год оказалась ${k.p}%. Какой была реальная ставка? Посчитайте точно${hundredths}.`,
    parts: [{ answer: r, tol: DEC, unit: '%' }],
    traps: [
      { part: 0, value: k.i - k.p, text: `Это приближение $${k.i} - ${k.p}$. Точно: $(1 + i)/(1 + \\pi) - 1$.` },
      { part: 0, value: k.i + k.p, text: 'Инфляцию вычитают, а не прибавляют: она съедает часть процентов.' },
    ],
    solution: `$1 + r = ${m(1 + k.i / 100)}/${m(1 + k.p / 100)} \\approx ${m(1 + r / 100)}$, реальная ставка ${f(r)}%.`,
    check: ([x]) => near((1 + x / 100) * (1 + k.p / 100), 1 + k.i / 100),
  };
} });
T.push({ id: 'v-islm-cross', chapter: 'is-lm', level: 1, source: 'islm-cross', gen: (rand) => {
  const k = draw(rand, () => ({ c: pick(rand, [0.5, 0.6, 0.75, 0.8]), T: ri(rand, 60, 200, 20), I: ri(rand, 100, 300, 10), G: ri(rand, 100, 300, 10), Y: ri(rand, 800, 2400, 20) }),
    ({ c, T: tx, I, G, Y }) => { const c0 = (1 - c) * Y + c * tx - I - G; return c0 >= 20 && c0 <= 400 && Number.isInteger(r2(c0)); });
  const c0 = r2((1 - k.c) * k.Y + k.c * k.T - k.I - k.G);
  return {
    statement: `Ставка фиксирована. Потребление $C = ${m(c0)} + ${m(k.c)}(Y - T)$, инвестиции ${k.I}, госзакупки ${k.G}, налоги ${k.T}.\n\nа) Найдите равновесный выпуск.\n\nб) Чему равен мультипликатор госзакупок?`,
    parts: [{ answer: k.Y, pos: true }, { answer: 1 / (1 - k.c), tol: DEC, pos: true }],
    traps: [
      { part: 0, value: (c0 + k.I + k.G) / (1 - k.c), text: 'Забыты налоги: потребление зависит от располагаемого дохода $Y - T$.' },
      { part: 1, value: k.c / (1 - k.c), text: 'Это налоговый мультипликатор (по модулю). Мультипликатор госзакупок — $1/(1 - c)$.' },
    ],
    solution: `а) $Y = ${m(c0)} + ${m(k.c)}(Y - ${k.T}) + ${k.I} + ${k.G}$, $${m(1 - k.c)}Y = ${m((1 - k.c) * k.Y)}$, $Y = ${k.Y}$.\n\nб) $1/(1 - ${m(k.c)}) = ${m(1 / (1 - k.c))}$.`,
    check: ([y, mult]) => near(y, c0 + k.c * (y - k.T) + k.I + k.G, 1e-6) && near(mult * (1 - k.c), 1),
  };
} });
T.push({ id: 'v-islm-curves', chapter: 'is-lm', level: 2, source: 'islm-curves', gen: (rand) => {
  const k = draw(rand, () => ({ al: ri(rand, 20, 100, 10), be: ri(rand, 50, 200, 25), r: ri(rand, 2, 10), Y: ri(rand, 800, 2000, 50) }), ({ al, be }) => al !== be);
  const A = k.Y + k.al * k.r; const B = k.Y - k.be * k.r;
  return {
    statement: `Кривая IS: $Y = ${A} - ${k.al}r$, кривая LM: $Y = ${lin(B, k.be, 'r')}$.\n\nа) Найдите равновесную ставку.\n\nб) Найдите равновесный выпуск.`,
    parts: [{ answer: k.r, unit: '%', pos: true }, { answer: k.Y, pos: true }],
    traps: [{ part: 0, value: (A - B) / Math.abs(k.be - k.al), text: 'Похоже на ошибку знака: при переносе $r$ в одну сторону коэффициенты складываются, $r = (A - B)/(\\alpha + \\beta)$.' }],
    solution: `а) $${A} - ${k.al}r = ${lin(B, k.be, 'r')}$, $${k.al + k.be}r = ${A - B}$, $r = ${k.r}$.\n\nб) $Y = ${A} - ${k.al * k.r} = ${k.Y}$.`,
    check: ([r, y]) => near(y, A - k.al * r) && near(y, B + k.be * r),
  };
} });
T.push({ id: 'v-adas-okun', chapter: 'ad-as', level: 1, source: 'adas-okun', gen: (rand) => {
  const us = ri(rand, 3, 7); const gap = ri(rand, 2, 8, 2);
  return {
    statement: `Естественный уровень безработицы ${us}%. Выпуск на ${gap}% ниже потенциала. Какой будет безработица по закону Оукена (с коэффициентом 2)?`,
    parts: [{ answer: us + gap / 2, unit: '%', pos: true }],
    traps: [
      { part: 0, value: us + 2 * gap, text: 'Коэффициент Оукена делит разрыв, а не умножает: каждые 2% отставания выпуска — плюс 1 п.п. безработицы.' },
      { part: 0, value: us + gap, text: `Забыт коэффициент: ${gap}% отставания выпуска — это ${gap / 2} п.п. безработицы.` },
    ],
    solution: `$u = ${us} + ${gap}/2 = ${us + gap / 2}\\%$.`,
    check: ([u]) => near(2 * (u - us), gap),
  };
} });
T.push({ id: 'v-adas-lr', chapter: 'ad-as', level: 2, source: 'adas-lr-g', gen: (rand) => {
  const k = draw(rand, () => { const a = ri(rand, 500, 900, 50); return { a, b: pick(rand, [0.5, 1]), Yb: a + ri(rand, 100, 400, 50), M: ri(rand, 800, 2000, 100) }; },
    ({ a, b, Yb, M }) => differs((b * M) / Yb, (b * M) / (Yb - a), DEC));
  const P = (k.b * k.M) / (k.Yb - k.a);
  return {
    statement: `Кривая AD: $Y = ${k.a} + ${m(k.b)}\\,M/P$, денежная масса ${k.M}, потенциальный выпуск ${k.Yb}. Каким будет уровень цен в длинном периоде${hundredths}?`,
    parts: [{ answer: P, tol: DEC, pos: true }],
    traps: [{ part: 0, value: (k.b * k.M) / k.Yb, text: `Забыта автономная часть спроса ${k.a}: в длинном периоде $${k.a} + ${m(k.b)}M/P = ${k.Yb}$.` }],
    solution: `В длинном периоде выпуск на потенциале: $${k.a} + ${m(k.b * k.M)}/P = ${k.Yb}$, $P = ${m(k.b * k.M)}/${k.Yb - k.a} \\approx ${m(P)}$.`,
    check: ([p]) => near(k.a + k.b * k.M / p, k.Yb),
  };
} });


// кривая Филлипса с ожиданиями
T.push({ id: 'v-ph-pi', chapter: 'phillips', level: 1, source: 'ph-pi', gen: (rand) => {
  const k = { pe: ri(rand, 2, 10), us: ri(rand, 4, 7), beta: pick(rand, [0.5, 1, 1.5]), du: pick(rand, [-3, -2, -1, 1, 2, 3]) };
  const u = k.us + k.du; const pi = k.pe - k.beta * k.du;
  return {
    statement: `Ожидаемая инфляция ${k.pe}%, естественная безработица ${k.us}%, $\\beta = ${m(k.beta)}$, шоков нет. Какой будет инфляция при безработице ${u}%?`,
    parts: [{ answer: pi, tol: DEC, unit: '%' }],
    traps: [{ part: 0, value: k.pe + k.beta * k.du, text: `Знак перепутан: безработица ${k.du > 0 ? 'выше' : 'ниже'} естественной тянет инфляцию ${k.du > 0 ? 'вниз' : 'вверх'}, $\\pi = \\pi^e - \\beta\\,(u - u^*)$.` }],
    solution: `$\\pi = ${k.pe} - ${m(k.beta)} \\cdot (${u} - ${k.us}) = ${m(pi)}\\%$.`,
    check: ([x]) => near(x + k.beta * (u - k.us), k.pe),
  };
} });
// цена дезинфляции
T.push({ id: 'v-ph-sac', chapter: 'phillips', level: 2, source: 'ph-sacrifice', gen: (rand) => {
  const beta = pick(rand, [0.25, 0.5, 1]); const d = ri(rand, 2, 10); const okun = pick(rand, [2, 2.5, 3]);
  const py = d / beta;
  return {
    statement: `Инфляцию нужно снизить на ${d} пунктов. Ожидания адаптивные, $\\beta = ${m(beta)}$; закон Оукена: 1 пункт безработицы сверх естественной — ${f(okun)}% выпуска.\n\nа) Сколько пункт-лет лишней безработицы это потребует?\n\nб) Сколько процентов годового ВВП будет потеряно за всё время?`,
    parts: [{ answer: py, tol: DEC, unit: 'пункт-лет', pos: true }, { answer: py * okun, tol: DEC, unit: '% ВВП', pos: true }],
    traps: [
      { part: 0, value: d * beta, text: `Снижение инфляции умножено на $\\beta$. Один пункт-год снимает $\\beta = ${m(beta)}$ пункта, значит, нужно $${d} / ${m(beta)}$.` },
      { part: 1, value: py, text: 'Это пункт-годы безработицы. По закону Оукена каждый из них стоит нескольких процентов выпуска.' },
    ],
    solution: `а) $${d} / ${m(beta)} = ${m(py)}$ пункт-лет.\n\nб) $${m(py)} \\cdot ${m(okun)} = ${m(py * okun)}\\%$ годового ВВП.`,
    check: ([a, b]) => { let pi = d; let years = 0; while (pi > 1e-9 && years < 1000) { pi -= beta; years += 1; } return near(a, years) && near(b, a * okun); },
  };
} });
// правило Тейлора
T.push({ id: 'v-pol-taylor', chapter: 'policy', level: 1, source: 'pol-taylor', gen: (rand) => {
  const k = { rs: pick(rand, [1, 1.5, 2, 2.5]), tg: pick(rand, [2, 3, 4]), pi: ri(rand, 0, 14), gap: ri(rand, -4, 4) };
  const i = k.rs + k.pi + 0.5 * (k.pi - k.tg) + 0.5 * k.gap;
  return {
    statement: `Нейтральная реальная ставка ${f(k.rs)}%, цель по инфляции ${k.tg}%, инфляция ${k.pi}%, разрыв выпуска ${k.gap > 0 ? '+' : ''}${f(k.gap)}%.\n\nа) Какой должна быть ставка по правилу Тейлора?\n\nб) Какой будет реальная ставка (ставка минус инфляция)?`,
    parts: [{ answer: i, tol: DEC, unit: '%' }, { answer: i - k.pi, tol: DEC, unit: '%' }],
    traps: [{ part: 0, value: i - k.pi, text: 'Забыта сама инфляция: правило даёт номинальную ставку $r^* + \\pi + \\ldots$. Без неё получается реальная ставка.' }],
    solution: `а) $${m(k.rs)} + ${k.pi} + 0{,}5 \\cdot (${k.pi} - ${k.tg}) + 0{,}5 \\cdot (${k.gap}) = ${m(i)}\\%$.\n\nб) $${m(i)} - ${k.pi} = ${m(i - k.pi)}\\%$.`,
    check: ([a, b]) => near(b, k.rs + 0.5 * (k.pi - k.tg) + 0.5 * k.gap) && near(a - b, k.pi),
  };
} });
// мультипликатор с подоходным налогом
T.push({ id: 'v-pol-stab', chapter: 'policy', level: 2, source: 'pol-stab', gen: (rand) => {
  const c = pick(rand, [0.6, 0.75, 0.8, 0.9]); const t = pick(rand, [0.1, 0.2, 0.25, 0.3]); const dG = ri(rand, 10, 100, 10);
  const mult = 1 / (1 - c * (1 - t));
  return {
    statement: `Предельная склонность к потреблению ${f(c)}, налог на доход ${f(t * 100)}%, ставка не меняется.\n\nа) Чему равен мультипликатор госзакупок${hundredths}?\n\nб) На сколько вырастет выпуск, если госзакупки вырастут на ${dG}${hundredths}?`,
    parts: [{ answer: mult, tol: DEC, pos: true }, { answer: mult * dG, tol: DEC, pos: true }],
    traps: [
      { part: 0, value: 1 / (1 - c), text: `Это мультипликатор без налога. С налогом из рубля дохода тратится $${m(c)} \\cdot ${m(1 - t)}$.` },
      { part: 1, value: dG / (1 - c), text: 'Посчитано с мультипликатором без налога.' },
    ],
    solution: `а) $1/(1 - ${m(c)} \\cdot ${m(1 - t)}) \\approx ${m(mult)}$.\n\nб) $${m(mult)} \\cdot ${dG} \\approx ${m(mult * dG)}$.`,
    check: ([a, b]) => { let dy = 0; let r = dG; for (let k = 0; k < 2000; k += 1) { dy += r; r *= c * (1 - t); } return near(b, dy, 1e-6) && near(a, dy / dG, 1e-6); },
  };
} });
// устойчивое состояние Солоу при y = √k
T.push({ id: 'v-gr-steady', chapter: 'growth', level: 1, source: 'gr-steady', gen: (rand) => {
  const k = draw(rand, () => ({ R: ri(rand, 2, 8), d: pick(rand, [0.04, 0.05, 0.06]), n: pick(rand, [0, 0.01, 0.02]) }), ({ R, d, n }) => R * (d + n) <= 0.6 && R * (d + n) >= 0.1);
  const s = r2(k.R * (k.d + k.n)); const R = s / (k.d + k.n);
  return {
    statement: `Выпуск на работника $y = \\sqrt{k}$, норма сбережения ${f(s * 100)}%, износ ${f(k.d * 100)}%, население растёт на ${f(k.n * 100)}% в год.\n\nа) Найдите капитал на работника в устойчивом состоянии.\n\nб) Найдите потребление на работника${hundredths}.`,
    parts: [{ answer: R * R, tol: DEC, pos: true }, { answer: (1 - s) * R, tol: DEC, pos: true }],
    traps: [
      { part: 0, value: R, text: 'Это $\\sqrt{k^*}$, то есть выпуск на работника. Капитал — его квадрат.' },
      { part: 1, value: s * R, text: 'Это инвестиции $s\\,y^*$. Потребление — остальное: $(1 - s)\\,y^*$.' },
      ...(k.n > 0 ? [{ part: 0, value: (s / k.d) ** 2, text: 'Не учтён рост населения: выбытие — $(\\delta + n)\\,k$.' }] : []),
    ],
    solution: `$\\sqrt{k^*} = ${m(s)}/${m(k.d + k.n)} = ${m(R)}$: $k^* = ${m(R * R)}$, $y^* = ${m(R)}$, $c^* = ${m(1 - s)} \\cdot ${m(R)} = ${m((1 - s) * R)}$.`,
    check: ([kk, c]) => near(s * Math.sqrt(kk), (k.d + k.n) * kk) && near(c, (1 - s) * Math.sqrt(kk)),
  };
} });
// разложение роста
T.push({ id: 'v-gr-acc', chapter: 'growth', level: 2, source: 'gr-accounting', gen: (rand) => {
  const k = draw(rand, () => ({ gY: ri(rand, 2, 7), gK: ri(rand, 2, 8), gL: ri(rand, 0, 3), al: pick(rand, [0.3, 0.35, 0.4]) }),
    ({ gY, gK, gL, al }) => gY - al * gK - (1 - al) * gL > 0.2);
  const tfp = k.gY - k.al * k.gK - (1 - k.al) * k.gL;
  return {
    statement: `Выпуск вырос за год на ${k.gY}%, капитал — на ${k.gK}%, число работников — на ${k.gL}%. Доля капитала $\\alpha = ${m(k.al)}$. На сколько выросла совокупная факторная производительность${hundredths}?`,
    parts: [{ answer: tfp, tol: DEC, unit: '%', pos: true }],
    traps: [
      { part: 0, value: k.gY - k.gK - k.gL, text: 'Темпы роста факторов вычтены без долей: вклад капитала — $\\alpha\\,g_K$, труда — $(1 - \\alpha)\\,g_L$.' },
      { part: 0, value: k.gY - (1 - k.al) * k.gK - k.al * k.gL, text: 'Доли перепутаны: $\\alpha$ — доля капитала, $1 - \\alpha$ — труда.' },
    ],
    solution: `$g_A = ${k.gY} - ${m(k.al)} \\cdot ${k.gK} - ${m(1 - k.al)} \\cdot ${k.gL} = ${m(tfp)}\\%$.`,
    check: ([x]) => near(x + k.al * k.gK + (1 - k.al) * k.gL, k.gY),
  };
} });


// быстрый расчёт для уроков: объём спроса при цене и равновесная цена (одним числом)
T.push({ id: 'v-sd-qd', chapter: 'supply-demand', level: 1, source: 'sd-read', gen: (rand) => {
  const b = ri(rand, 2, 5); const top = ri(rand, 10, 40); const a = b * top; const P = ri(rand, 1, top - 1);
  const q = a - b * P;
  return {
    statement: `Спрос $Q_D = ${a} - ${b}P$. Сколько покупают при цене ${P}?`,
    parts: [{ answer: q, unit: 'ед.', pos: true }],
    traps: [
      { part: 0, value: a - P, text: `Цену нужно умножить на наклон ${b}: $${a} - ${b} \\cdot ${P}$.` },
      { part: 0, value: a + b * P, text: 'Цена вычитается, а не прибавляется: чем дороже, тем меньше покупают.' },
    ],
    solution: `1. Объём спроса при цене — подставляем цену в формулу спроса.\n2. $Q_D = ${a} - ${b} \\cdot ${P}$.\n3. $Q_D = ${q}$ ед.`,
    check: ([x]) => near(x + b * P, a),
  };
} });
T.push({ id: 'v-sd-eqp', chapter: 'supply-demand', level: 1, source: 'sd-equilibrium', gen: (rand) => {
  const k = market(rand, ({ Q, d, P, b, a: A, c }) => Q !== d * P && b !== d && differs((A + c) / (b + d), P));
  return {
    statement: `Спрос $Q_D = ${k.a} - ${k.b}P$, предложение $Q_S = ${lin(k.c, k.d, 'P')}$. Найдите равновесную цену.`,
    parts: [{ answer: k.P, unit: 'руб.', pos: true }],
    traps: [
      { part: 0, value: (k.a + k.c) / (k.b + k.d), text: 'Похоже на ошибку знака при переносе: $P = (a - c)/(b + d)$.' },
      { part: 0, value: k.Q, text: 'Это равновесное количество. Спрашивали цену.' },
    ],
    solution: `1. В равновесии объём спроса равен объёму предложения — приравниваем формулы.\n2. $${k.a} - ${k.b}P = ${lin(k.c, k.d, 'P')}$, переносим $P$ в одну сторону: $${k.b + k.d}P = ${k.a - k.c}$.\n3. $P^* = ${k.a - k.c}/${k.b + k.d} = ${k.P}$.`,
    check: ([P]) => near(k.a - k.b * P, k.c + k.d * P),
  };
} });

T.forEach((t) => { t.gen = guarded(t.gen); });
export const TEMPLATES = T;
export const TEMPLATE_BY_ID = Object.fromEntries(T.map((t) => [t.id, t]));
export const templatesOf = (chapterId) => T.filter((t) => t.chapter === chapterId);

/* Вариант как блок задачи — такой же, как задачи глав: его рисует тот же NumberProblem.
   Ловушку, совпавшую с верным ответом, выбрасываем (тесты следят, чтобы таких не было). */
const LABELS = ['а)', 'б)', 'в)', 'г)'];
export function makeVariant(tplId, seed) {
  const tpl = TEMPLATE_BY_ID[tplId];
  const v = tpl.gen(seeded(seed));
  const parts = v.parts.map((pt, k) => ({ label: v.parts.length > 1 ? LABELS[k] : '', answer: pt.answer, tol: pt.tol != null ? pt.tol : null, unit: pt.unit || '' }));
  const traps = v.traps.filter((tr) => differs(tr.value, parts[tr.part].answer, parts[tr.part].tol || 0))
    .map((tr) => ({ part: tr.part, value: tr.value, text: parseInline(tr.text) }));
  const one = parts.length === 1 ? parts[0] : null;
  return {
    type: 'problem', kind: 'number', id: `${tpl.id}:${seed}`, template: tpl.id, source: tpl.source, chapter: tpl.chapter, level: tpl.level,
    hints: [], news: null, statement: parseBlocks(v.statement), solution: parseBlocks(v.solution),
    parts, traps, answer: one ? one.answer : parts.map((x) => x.answer), tol: one ? one.tol : null, unit: one ? one.unit : '',
  };
}
export { differs as trapDiffers };
