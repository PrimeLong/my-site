/* ИНТЕРАКТИВНЫЕ ГРАФИКИ УЧЕБНИКА: чистые модели без React. Каждый график — набор
   ползунков и функция build(attrs, values) → сцена в единицах данных: кривые, точки,
   пунктирные выноски к осям, закрашенные области и строки с числами под графиком.
   Рисует сцену textbook.jsx. Параметры приходят из главы (:::chart тип a=… b=…),
   поэтому график и разобранный пример в тексте считают одно и то же.

   Это учебные модели — линейные кривые из стандартного курса, а не формулы игры. */

const num = (attrs, k, def) => (attrs[k] != null && Number.isFinite(Number(attrs[k])) ? Number(attrs[k]) : def);
const line = (f, x0, x1, n = 2) => Array.from({ length: n }, (_, i) => { const x = x0 + (x1 - x0) * i / (n - 1); return { x, y: f(x) }; });
const r1 = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',');
const r2 = (v) => (Math.round(v * 100) / 100).toString().replace('.', ',');
const clampV = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ---------------- СПРОС И ПРЕДЛОЖЕНИЕ ----------------
   Qd = a − b·P, Qs = c + d·P. Ползунки сдвигают кривые по горизонтали (при каждой цене
   спрос или предложение больше на столько-то единиц) и ставят потолок цены. */
export function sdEquilibrium(a, b, c, d) {
  const P = (a - c) / (b + d);
  return { P, Q: a - b * P };
}
const supplyDemand = {
  title: 'Спрос и предложение',
  controls: (A) => {
    const a = num(A, 'a', 100);
    const span = Math.round(a * 0.4);
    const { P } = sdEquilibrium(a, num(A, 'b', 2), num(A, 'c', -20), num(A, 'd', 4));
    // режим «издержки»: единственный ползунок — на сколько подорожала каждая единица для продавцов
    if (A.cost != null) return [{ id: 'cost', label: 'Издержки на единицу выросли на', min: 0, max: Math.round(P), step: 1, def: 0, fmt: (v) => `${v} руб.` }];
    return [
      { id: 'dA', label: 'Сдвиг спроса', min: -span, max: span, step: 1, def: 0, fmt: (v) => `${v > 0 ? '+' : ''}${v} ед.` },
      { id: 'dC', label: 'Сдвиг предложения', min: -span, max: span, step: 1, def: 0, fmt: (v) => `${v > 0 ? '+' : ''}${v} ед.` },
      { id: 'ceil', label: 'Потолок цены', min: Math.round(P * 0.4), max: Math.round(P * 2), step: 1, def: Math.round(P * 2),
        fmt: (v) => (v >= Math.round(P * 2) ? 'нет' : `${v}`) },
    ];
  },
  build: (A, v) => {
    const a = num(A, 'a', 100); const b = num(A, 'b', 2); const c = num(A, 'c', -20); const d = num(A, 'd', 4);
    // рост издержек на единицу поднимает кривую предложения на столько же: Qs = c + d·(P − cost)
    const a1 = a + (v.dA || 0); const c1 = c + (v.dC || 0) - d * (v.cost || 0);
    const base = sdEquilibrium(a, b, c, d);
    const eq = sdEquilibrium(a1, b, c1, d);
    const Pmax = Math.ceil((a + a * 0.4) / b / 10) * 10;
    const Qmax = Math.ceil((a * 1.4) / 10) * 10;
    // кривые в осях «количество по горизонтали, цена по вертикали»
    const dem = (aa) => line((P) => P, 0, aa / b).map(({ x }) => ({ x: aa - b * x, y: x }));
    const sup = (cc) => line((P) => P, Math.max(0, -cc / d), (Qmax - cc) / d).map(({ x }) => ({ x: cc + d * x, y: x }));
    const moved = (v.dA || 0) !== 0 || (v.dC || 0) !== 0 || (v.cost || 0) !== 0;
    const ceilOn = v.ceil != null && v.ceil < Math.round(base.P * 2);
    const curves = [
      ...(moved ? [{ id: 'D0', points: dem(a), ghost: true, color: 'blue' }, { id: 'S0', points: sup(c), ghost: true, color: 'rust' }] : []),
      { id: 'D', label: 'D', points: dem(a1), color: 'blue' },
      { id: 'S', label: 'S', points: sup(c1), color: 'rust' },
    ];
    const readout = [
      { label: 'Равновесная цена', value: r1(eq.P) },
      { label: 'Равновесное количество', value: r1(eq.Q) },
    ];
    if (v.cost) {
      readout.push({ label: 'Цена выросла на', value: `${r1(eq.P - base.P)} из ${v.cost}` });
      readout.push({ label: 'Покупатели платят', value: `${Math.round(((eq.P - base.P) / v.cost) * 100)}% роста издержек` });
    }
    const segments = [];
    if (ceilOn) {
      const Pc = v.ceil;
      curves.push({ id: 'ceil', label: 'потолок', points: [{ x: 0, y: Pc }, { x: Qmax, y: Pc }], color: 'gold', dashed: true });
      if (Pc < eq.P) {
        const qd = a1 - b * Pc; const qs = Math.max(0, c1 + d * Pc);
        segments.push({ x0: qs, x1: qd, y: Pc, label: 'дефицит' });
        readout.push({ label: 'Дефицит при потолке', value: r1(qd - qs) });
      } else readout.push({ label: 'Потолок выше равновесия', value: 'не действует' });
    }
    return {
      xDomain: [0, Qmax], yDomain: [0, Pmax], xLabel: 'Q', yLabel: 'P', curves, segments,
      points: [{ x: eq.Q, y: eq.P, label: 'E', guide: true }],
      readout,
    };
  },
};

/* ---------------- ЭЛАСТИЧНОСТЬ НА ЛИНЕЙНОМ СПРОСЕ ----------------
   Q = a − b·P. Ползунок двигает цену вдоль кривой: под графиком эластичность в точке
   −b·P/Q и выручка P·Q (закрашенный прямоугольник). Верхняя половина прямой —
   эластичный участок, нижняя — неэластичный. */
export const pointElasticity = (a, b, P) => (-b * P) / (a - b * P);
const elasticity = {
  title: 'Эластичность и выручка',
  controls: (A) => {
    const a = num(A, 'a', 100); const b = num(A, 'b', 2);
    const Pmax = a / b;
    return [{ id: 'P', label: 'Цена', min: Math.round(Pmax * 0.05), max: Math.round(Pmax * 0.95), step: 1, def: num(A, 'p', Math.round(Pmax * 0.4)), fmt: (v) => `${v}` }];
  },
  build: (A, v) => {
    const a = num(A, 'a', 100); const b = num(A, 'b', 2);
    const Pmax = a / b; const P = v.P; const Q = a - b * P;
    const E = pointElasticity(a, b, P);
    const mid = Pmax / 2;
    return {
      xDomain: [0, a * 1.05], yDomain: [0, Pmax * 1.05], xLabel: 'Q', yLabel: 'P',
      rects: [{ x0: 0, x1: Q, y0: 0, y1: P, label: `выручка ${r1(P * Q)}` }],
      curves: [
        { id: 'el', label: 'эластичный участок', labelPos: 'mid', points: [{ x: 0, y: Pmax }, { x: a / 2, y: mid }], color: 'rust' },
        { id: 'inel', label: 'неэластичный', labelPos: 'mid', points: [{ x: a / 2, y: mid }, { x: a, y: 0 }], color: 'teal' },
      ],
      points: [{ x: Q, y: P, label: 'A', guide: true }, { x: a / 2, y: mid, label: '|E| = 1', small: true }],
      readout: [
        { label: 'Количество', value: r1(Q) },
        { label: 'Эластичность в точке', value: r2(E) },
        { label: 'Выручка P·Q', value: r1(P * Q) },
        { label: 'Если цену поднять', value: Math.abs(E) > 1.0001 ? 'выручка упадёт' : Math.abs(E) < 0.9999 ? 'выручка вырастет' : 'выручка на максимуме' },
      ],
    };
  },
};

/* ---------------- ЭЛАСТИЧНЫЙ ПРОТИВ НЕЭЛАСТИЧНОГО ----------------
   Две прямые спроса через одну и ту же точку (Q₀; P₀): крутая — неэластичный спрос,
   пологая — эластичный. Ползунок меняет цену на столько-то процентов, под графиком — на
   сколько процентов изменились покупки и выручка по каждой кривой. */
const compareParams = (A) => ({ p0: num(A, 'p0', 20), q0: num(A, 'q0', 60), eIn: num(A, 'ein', 0.4), eEl: num(A, 'eel', 2.5) });
const compareQ = (p, e, P) => Math.max(0, p.q0 - (e * p.q0 / p.p0) * (P - p.p0));
const elasticCompare = {
  title: 'Эластичный и неэластичный спрос',
  controls: () => [{ id: 'dp', label: 'Цена изменилась на', min: -30, max: 30, step: 5, def: 0, fmt: (v) => `${v > 0 ? '+' : ''}${v}%` }],
  measure: (A, v) => {
    const p = compareParams(A); const P = p.p0 * (1 + v.dp / 100);
    return { qIn: compareQ(p, p.eIn, P), qEl: compareQ(p, p.eEl, P), rIn: P * compareQ(p, p.eIn, P), rEl: P * compareQ(p, p.eEl, P) };
  },
  build: (A, v) => {
    const p = compareParams(A); const P = p.p0 * (1 + v.dp / 100);
    const qIn = compareQ(p, p.eIn, P); const qEl = compareQ(p, p.eEl, P);
    const Pmax = p.p0 * 1.6; const Qmax = p.q0 * 2;
    const lineFor = (e, h = 0.6) => { const b = e * p.q0 / p.p0; return [{ x: Math.min(Qmax, p.q0 + b * p.p0 * h), y: p.p0 * (1 - h) }, { x: Math.max(0, p.q0 - b * p.p0 * h), y: p.p0 * (1 + h) }]; };
    const pct = (a, b) => `${a >= b ? '+' : '−'}${r1(Math.abs((a / b - 1) * 100))}%`;
    const points = [{ x: p.q0, y: p.p0, label: 'сейчас', small: true }];
    if (v.dp !== 0) points.push({ x: qIn, y: P, label: 'A', guide: true }, { x: qEl, y: P, label: 'B', guide: true });
    return {
      xDomain: [0, Qmax], yDomain: [0, Pmax], xLabel: 'Q', yLabel: 'P',
      curves: [
        { id: 'in', label: `неэластичный, |E| = ${r1(p.eIn)}`, labelPos: 0.9, points: lineFor(p.eIn, 0.4), color: 'teal' },
        { id: 'el', label: `эластичный, |E| = ${r1(p.eEl)}`, labelPos: 0.04, points: lineFor(p.eEl), color: 'rust' },
        ...(v.dp !== 0 ? [{ id: 'P1', points: [{ x: 0, y: P }, { x: Qmax, y: P }], color: 'gold', dashed: true }] : []),
      ],
      points,
      readout: v.dp === 0 ? [{ label: 'Сдвиньте цену', value: 'и сравните две кривые' }] : [
        { label: 'Неэластичный: покупки', value: pct(qIn, p.q0) },
        { label: 'выручка', value: pct(P * qIn, p.p0 * p.q0) },
        { label: 'Эластичный: покупки', value: pct(qEl, p.q0) },
        { label: 'выручка', value: pct(P * qEl, p.p0 * p.q0) },
      ],
    };
  },
};

/* ---------------- КРИВАЯ ВЫРУЧКИ ----------------
   Выручка R = P·(a − bP) как функция цены: горка с вершиной в середине прямой спроса.
   Слева от вершины (неэластичный участок) рост цены увеличивает выручку, справа — уменьшает. */
const revenueCurve = {
  title: 'Выручка при разных ценах',
  controls: (A) => { const a = num(A, 'a', 100); const b = num(A, 'b', 2); const Pm = a / b; return [{ id: 'P', label: 'Цена', min: 1, max: Math.round(Pm) - 1, step: 1, def: num(A, 'p', Math.round(Pm * 0.3)), fmt: (v) => `${v}` }]; },
  measure: (A, v) => { const a = num(A, 'a', 100); const b = num(A, 'b', 2); return { P: v.P, R: v.P * (a - b * v.P) }; },
  build: (A, v) => {
    const a = num(A, 'a', 100); const b = num(A, 'b', 2); const Pm = a / b;
    const R = (P) => P * (a - b * P); const Rmax = R(Pm / 2);
    const curve = Array.from({ length: 60 }, (_, i) => { const P = Pm * i / 59; return { x: P, y: R(P) }; });
    const E = pointElasticity(a, b, v.P);
    return {
      xDomain: [0, Pm], yDomain: [0, Math.ceil((Rmax * 1.2) / 100) * 100], xLabel: 'P', yLabel: 'выручка',
      curves: [
        { id: 'inel', label: 'неэластичный участок', labelPos: 0.2, points: curve.filter((c) => c.x <= Pm / 2 + 1e-9), color: 'teal' },
        { id: 'el', label: 'эластичный', labelPos: 0.75, points: curve.filter((c) => c.x >= Pm / 2 - 1e-9), color: 'rust' },
      ],
      points: [{ x: v.P, y: R(v.P), label: `R = ${r1(R(v.P))}`, guide: true }, { x: Pm / 2, y: Rmax, label: 'максимум', small: true }],
      readout: [
        { label: 'Количество', value: r1(a - b * v.P) },
        { label: 'Выручка', value: r1(R(v.P)) },
        { label: '|E| в точке', value: r2(Math.abs(E)) },
        { label: 'Если цену поднять', value: Math.abs(E) > 1.0001 ? 'выручка упадёт' : Math.abs(E) < 0.9999 ? 'выручка вырастет' : 'выручка на максимуме' },
      ],
    };
  },
};

/* ---------------- IS-LM ----------------
   IS: Y = (A − b·r) / (1 − c), A = автономные расходы без G + G.
   LM: M/P = k·Y − h·r. Ползунки: госрасходы G (сдвигают IS) и денежная масса M
   (сдвигают LM). Переключатель «ЦБ держит ставку»: LM горизонтальна на исходной ставке —
   ЦБ подстраивает деньги под спрос на них. */
export function islmEquilibrium({ c, b, k, h, a0, G, M, P }) {
  const A = a0 + G; const m = M / P;
  const Y = (A + (b * m) / h) / (1 - c + (b * k) / h);
  return { Y, r: (k * Y - m) / h };
}
const islmParams = (A) => ({ c: num(A, 'c', 0.75), b: num(A, 'b', 25), k: num(A, 'k', 1), h: num(A, 'h', 100),
  a0: num(A, 'a0', 325), i0: num(A, 'i0', 200), G: num(A, 'g', 100), M: num(A, 'm', 1000), P: num(A, 'p', 2) });
const isLm = {
  title: 'IS-LM',
  controls: (A) => {
    const p = islmParams(A);
    return [
      { id: 'G', label: 'Госрасходы G', min: 0, max: Math.round(p.G * 2.5), step: 5, def: p.G, fmt: (v) => `${v}` },
      { id: 'M', label: 'Денежная масса M', min: Math.round(p.M * 0.5), max: Math.round(p.M * 1.6), step: 20, def: p.M, fmt: (v) => `${v}` },
      { id: 'hold', label: 'ЦБ держит ставку', toggle: true, def: false },
    ];
  },
  build: (A, v) => {
    const p = islmParams(A);
    const base = islmEquilibrium(p);
    const cur = { ...p, G: v.G, M: v.M };
    let eq = islmEquilibrium(cur);
    const isY = (G, r) => (p.a0 + G - p.b * r) / (1 - p.c);
    if (v.hold) eq = { Y: isY(v.G, base.r), r: base.r };
    const rMax = Math.ceil(base.r * 2.2);
    const Ymax = Math.ceil((base.Y * 1.6) / 100) * 100;
    const Ymin = Math.floor((base.Y * 0.5) / 100) * 100;
    const IS = (G) => line((r) => r, 0, rMax).map(({ x }) => ({ x: isY(G, x), y: x }));
    const LM = (M) => line((Y) => (p.k * Y - M / p.P) / p.h, Ymin, Ymax);
    const moved = v.G !== p.G || v.M !== p.M;
    const curves = [
      ...(moved ? [{ id: 'IS0', points: IS(p.G), ghost: true, color: 'blue' }] : []),
      ...(moved && !v.hold ? [{ id: 'LM0', points: LM(p.M), ghost: true, color: 'rust' }] : []),
      { id: 'IS', label: 'IS', points: IS(v.G), color: 'blue' },
      v.hold
        ? { id: 'LM', label: 'LM: ставка ЦБ', points: [{ x: Ymin, y: base.r }, { x: Ymax, y: base.r }], color: 'rust' }
        : { id: 'LM', label: 'LM', points: LM(v.M), color: 'rust' },
    ];
    const readout = [
      { label: 'Выпуск Y', value: r1(eq.Y) },
      { label: 'Ставка r, %', value: r2(eq.r) },
      { label: 'Инвестиции I = I₀ − b·r', value: r1(p.i0 - p.b * eq.r) },
    ];
    if (v.hold) readout.push({ label: 'Сколько денег нужно ЦБ', value: r1((p.k * eq.Y - p.h * eq.r) * p.P) });
    return { xDomain: [Ymin, Ymax], yDomain: [0, rMax], xLabel: 'Y', yLabel: 'r', curves, points: [{ x: eq.Y, y: eq.r, label: 'E', guide: true }], readout };
  },
};

/* ---------------- AD-AS ----------------
   AD выведена из IS-LM: при ценах P реальные деньги M/P, отсюда выпуск Y(P).
   SRAS: P = Pᵉ·(1 + s·(Y − Ȳ)/Ȳ) — цены выше ожидаемых, когда выпуск выше потенциала.
   LRAS — вертикаль на потенциале Ȳ. Ползунки: M (сдвигает AD) и ожидаемые цены Pᵉ
   (сдвигают SRAS, так выглядит шок издержек). Кнопка «длинный период»: ожидания
   догоняют цены, выпуск возвращается к потенциалу. */
export const adOutput = (p, M, P) => islmEquilibrium({ ...p, M, P }).Y;
export function adasEquilibrium(p, M, pe, ybar, s) {
  // SRAS растёт по P, AD падает по P: ищем пересечение делением отрезка
  let lo = 0.05; let hi = 50;
  const f = (P) => adOutput(p, M, P) - (ybar + ((P / pe - 1) * ybar) / s);
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; }
  const P = (lo + hi) / 2;
  return { P, Y: adOutput(p, M, P) };
}
const adAs = {
  title: 'AD-AS',
  controls: (A) => {
    const p = islmParams(A);
    return [
      { id: 'M', label: 'Денежная масса M', min: Math.round(p.M * 0.5), max: Math.round(p.M * 1.6), step: 20, def: p.M, fmt: (v) => `${v}` },
      { id: 'G', label: 'Госзакупки G', min: 0, max: Math.round(p.G * 2), step: 10, def: p.G, fmt: (v) => `${v}` },
      { id: 'pe', label: 'Ожидаемые цены Pᵉ', min: Math.round(p.P * 0.6 * 20) / 20, max: Math.round(p.P * 1.6 * 20) / 20, step: 0.05, def: p.P, fmt: (v) => r2(v) },
      { id: 'longrun', label: 'Длинный период: ожидания догоняют цены', button: true },
    ];
  },
  // «длинный период»: Pᵉ = цене, при которой AD пересекает потенциал
  onButton: (A, v) => {
    const p0 = islmParams(A); const ybar = num(A, 'ybar', islmEquilibrium(p0).Y); const p = { ...p0, G: v.G != null ? v.G : p0.G };
    let lo = 0.05; let hi = 50;
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (adOutput(p, v.M, mid) > ybar) lo = mid; else hi = mid; }
    return { ...v, pe: Math.round(((lo + hi) / 2) * 100) / 100 };
  },
  build: (A, v) => {
    const p0 = islmParams(A);
    const ybar = num(A, 'ybar', islmEquilibrium(p0).Y); const s = num(A, 's', 1);
    const G = v.G != null ? v.G : p0.G; const p = { ...p0, G };
    const eq = adasEquilibrium(p, v.M, v.pe, ybar, s);
    const Pmax = p.P * 2.4; const Ymin = ybar * 0.6; const Ymax = ybar * 1.4;
    const AD = (M, pp = p) => Array.from({ length: 40 }, (_, i) => { const P = 0.35 * p.P + (Pmax - 0.35 * p.P) * i / 39; return { x: adOutput(pp, M, P), y: P }; })
      .filter((pt) => pt.x >= Ymin && pt.x <= Ymax);
    const SRAS = (pe) => line((Y) => pe * (1 + (s * (Y - ybar)) / ybar), Ymin, Ymax).map((pt) => ({ ...pt, y: clampV(pt.y, 0, Pmax) }));
    const moved = v.M !== p0.M || G !== p0.G || Math.abs(v.pe - p0.P) > 1e-9;
    return {
      xDomain: [Ymin, Ymax], yDomain: [0, Pmax], xLabel: 'Y', yLabel: 'P',
      curves: [
        ...(moved ? [{ id: 'AD0', points: AD(p0.M, p0), ghost: true, color: 'blue' }, { id: 'SRAS0', points: SRAS(p0.P), ghost: true, color: 'rust' }] : []),
        { id: 'LRAS', label: 'LRAS', points: [{ x: ybar, y: 0 }, { x: ybar, y: Pmax }], color: 'gold', dashed: true },
        { id: 'AD', label: 'AD', points: AD(v.M), color: 'blue' },
        { id: 'SRAS', label: 'SRAS', points: SRAS(v.pe), color: 'rust' },
      ],
      points: [{ x: eq.Y, y: eq.P, label: 'E', guide: true }],
      readout: [
        { label: 'Выпуск Y', value: r1(eq.Y) },
        { label: 'Уровень цен P', value: r2(eq.P) },
        { label: 'Разрыв выпуска', value: `${r1(((eq.Y / ybar) - 1) * 100)}%` },
      ],
    };
  },
};

/* ---------------- ИЗДЕРЖКИ ФИРМЫ ----------------
   TC = FC + a·Q − b·Q² + c·Q³: кубическая функция из учебников — средние переменные и
   средние общие издержки U-образные, предельные пересекают обе в их минимумах.
   Ползунки: постоянные издержки FC (сдвигают только ATC) и цены сырья (прибавка к a:
   сдвигают AVC, ATC и MC). С атрибутом price — фирма на конкурентном рынке: линия цены,
   выпуск P = MC на растущем участке, прибыль или убыток прямоугольником, правило закрытия. */
export const costFns = ({ fc, a, b, c }) => ({
  TC: (q) => fc + a * q - b * q * q + c * q * q * q,
  MC: (q) => a - 2 * b * q + 3 * c * q * q,
  AVC: (q) => a - b * q + c * q * q,
  ATC: (q) => fc / q + a - b * q + c * q * q,
});
// минимум AVC — аналитически, минимум ATC — перебором с уточнением (кубическое уравнение)
export function costMinima(p) {
  const f = costFns(p);
  const qAvc = p.b / (2 * p.c);
  let lo = 0.01; let hi = 100;
  for (let i = 0; i < 200; i++) { const m1 = lo + (hi - lo) / 3; const m2 = hi - (hi - lo) / 3; if (f.ATC(m1) < f.ATC(m2)) hi = m2; else lo = m1; }
  const qAtc = (lo + hi) / 2;
  return { qAvc, avcMin: f.AVC(qAvc), qAtc, atcMin: f.ATC(qAtc) };
}
// конкурентная фирма при цене P: выпуск (0 — закрыться) и прибыль
export function competitiveFirm(p, P) {
  const f = costFns(p); const { avcMin } = costMinima(p);
  if (P < avcMin - 1e-9) return { Q: 0, profit: -p.fc, shut: true };
  const disc = 4 * p.b * p.b - 12 * p.c * (p.a - P);
  const Q = (2 * p.b + Math.sqrt(Math.max(0, disc))) / (6 * p.c);
  return { Q, profit: P * Q - f.TC(Q), shut: false };
}
const costParams = (A) => ({ fc: num(A, 'fc', 100), a: num(A, 'a', 20), b: num(A, 'b', 6), c: num(A, 'c', 1) });
const costs = {
  title: 'Издержки фирмы',
  controls: (A) => {
    const p = costParams(A);
    const ctl = [
      { id: 'fc', label: 'Постоянные издержки FC', min: 0, max: Math.round(p.fc * 2.5), step: 5, def: p.fc, fmt: (v) => `${v}` },
      { id: 'da', label: 'Цены сырья: прибавка к AVC', min: -10, max: 20, step: 1, def: 0, fmt: (v) => `${v > 0 ? '+' : ''}${v}` },
    ];
    if (A.price != null) ctl.unshift({ id: 'P', label: 'Рыночная цена P', min: 0, max: Math.round(num(A, 'price', 40) * 2.2), step: 1, def: num(A, 'price', 40), fmt: (v) => `${v}` });
    return ctl;
  },
  measure: (A, v) => {
    const p = { ...costParams(A), fc: v.fc, a: costParams(A).a + v.da };
    const m = costMinima(p);
    const out = { avcMin: m.avcMin, atcMin: m.atcMin, qEff: m.qAtc };
    if (v.P != null) { const f = competitiveFirm(p, v.P); out.Q = f.Q; out.profit = f.profit; }
    return out;
  },
  build: (A, v) => {
    const p0 = costParams(A);
    const p = { ...p0, fc: v.fc, a: p0.a + v.da };
    const f = costFns(p); const m = costMinima(p);
    const Qmax = Math.ceil(costMinima(p0).qAtc * 1.9);
    const yMax = Math.ceil((costMinima(p0).atcMin * 2.4) / 10) * 10;
    const samp = (fn, q0) => Array.from({ length: 60 }, (_, i) => { const q = q0 + (Qmax - q0) * i / 59; return { x: q, y: fn(q) }; });
    const curves = [
      { id: 'MC', label: 'MC', points: samp(f.MC, 0), color: 'rust' },
      { id: 'ATC', label: 'ATC', points: samp(f.ATC, Math.max(0.3, p.fc / yMax)), color: 'blue' },
      { id: 'AVC', label: 'AVC', points: samp(f.AVC, 0), color: 'teal' },
    ];
    const points = [
      { x: m.qAvc, y: m.avcMin, label: 'min AVC', small: true },
      { x: m.qAtc, y: m.atcMin, label: 'min ATC', small: true },
    ];
    const readout = [
      { label: 'Минимум AVC', value: `${r1(m.avcMin)} при Q = ${r1(m.qAvc)}` },
      { label: 'Минимум ATC', value: `${r1(m.atcMin)} при Q = ${r1(m.qAtc)}` },
    ];
    const rects = [];
    if (v.P != null) {
      const firm = competitiveFirm(p, v.P);
      curves.push({ id: 'P', label: 'P = MR', labelPos: 'start', points: [{ x: 0, y: v.P }, { x: Qmax, y: v.P }], color: 'gold', dashed: true });
      if (!firm.shut) {
        const atc = f.ATC(firm.Q);
        points.push({ x: firm.Q, y: v.P, label: 'P = MC', guide: true });
        rects.push({ x0: 0, x1: firm.Q, y0: Math.min(atc, v.P), y1: Math.max(atc, v.P), label: firm.profit >= 0 ? 'прибыль' : 'убыток', tone: firm.profit >= 0 ? 'gold' : 'rust' });
      }
      readout.unshift(
        { label: 'Выпуск', value: firm.shut ? '0 — закрыться' : r1(firm.Q) },
        { label: 'Прибыль', value: r1(firm.profit) },
      );
      readout.push({ label: 'Решение', value: firm.shut ? 'цена ниже min AVC: закрыться, потерять FC' : firm.profit >= 0 ? 'работать с прибылью' : 'работать в убыток: он меньше FC' });
    }
    return { xDomain: [0, Qmax], yDomain: [0, yMax], xLabel: 'Q', yLabel: 'руб.', curves, points, rects, readout };
  },
};

/* ---------------- МОНОПОЛИЯ ----------------
   Спрос P = A − B·Q, предельная выручка MR = A − 2B·Q, предельные издержки постоянны.
   Монополист выбирает MR = MC и берёт цену со спроса; при совершенной конкуренции P = MC.
   Треугольник между ними — безвозвратные потери. */
export function monopoly({ A, B, mc }) {
  const Q = Math.max(0, (A - mc) / (2 * B)); const P = A - B * Q;
  const Qc = Math.max(0, (A - mc) / B);
  return { Q, P, profit: (P - mc) * Q, Qc, Pc: mc, dwl: 0.5 * (P - mc) * (Qc - Q) };
}
const monoParams = (A) => ({ A: num(A, 'a', 100), B: num(A, 'b', 1), mc: num(A, 'mc', 20) });
const monopolyChart = {
  title: 'Монополия',
  controls: (A) => {
    const p = monoParams(A);
    return [
      { id: 'dA', label: 'Сдвиг спроса', min: -Math.round(p.A * 0.3), max: Math.round(p.A * 0.3), step: 1, def: 0, fmt: (v) => `${v > 0 ? '+' : ''}${v}` },
      { id: 'mc', label: 'Предельные издержки MC', min: 0, max: Math.round(p.A * 0.6), step: 1, def: p.mc, fmt: (v) => `${v}` },
    ];
  },
  measure: (A, v) => {
    const p = monoParams(A); const m = monopoly({ A: p.A + v.dA, B: p.B, mc: v.mc });
    return { P: m.P, Q: m.Q, profit: m.profit, dwl: m.dwl };
  },
  build: (A, v) => {
    const p0 = monoParams(A); const a = p0.A + v.dA; const B = p0.B;
    const m = monopoly({ A: a, B, mc: v.mc });
    const Qmax = Math.ceil((p0.A * 1.3) / B / 10) * 10; const Pmax = Math.ceil((p0.A * 1.3) / 10) * 10;
    const E = m.Q > 0 ? -(1 / B) * m.P / m.Q : 0;
    return {
      xDomain: [0, Qmax], yDomain: [0, Pmax], xLabel: 'Q', yLabel: 'P',
      rects: m.Q > 0 ? [{ x0: 0, x1: m.Q, y0: v.mc, y1: m.P, label: 'прибыль' }] : [],
      polys: m.Q > 0 ? [{ points: [{ x: m.Q, y: m.P }, { x: m.Qc, y: v.mc }, { x: m.Q, y: v.mc }], label: 'DWL' }] : [],
      curves: [
        { id: 'D', label: 'D', points: [{ x: 0, y: a }, { x: a / B, y: 0 }], color: 'blue' },
        { id: 'MR', label: 'MR', points: [{ x: 0, y: a }, { x: a / (2 * B), y: 0 }], color: 'teal', dashed: true },
        { id: 'MC', label: 'MC', points: [{ x: 0, y: v.mc }, { x: Qmax, y: v.mc }], color: 'rust' },
      ],
      points: [{ x: m.Q, y: m.P, label: 'M', guide: true }, { x: m.Qc, y: m.Pc, label: 'конкуренция', small: true }],
      readout: [
        { label: 'Выпуск монополиста', value: r1(m.Q) },
        { label: 'Цена', value: r1(m.P) },
        { label: 'Прибыль', value: r1(m.profit) },
        { label: 'Безвозвратные потери', value: r1(m.dwl) },
        { label: 'Лернер (P − MC)/P', value: m.P > 0 ? r2((m.P - v.mc) / m.P) : '—' },
        { label: '1/|E| в точке M', value: E ? r2(-1 / E) : '—' },
      ],
    };
  },
};

/* ---------------- ДУОПОЛИЯ КУРНО ----------------
   Спрос P = a − (q₁ + q₂), издержки c₁ и c₂ на единицу. Кривая реакции фирмы 1:
   q₁ = (a − c₁ − q₂)/2, фирмы 2 — симметрично. Равновесие Нэша — их пересечение. */
export function cournot({ a, c1, c2 }) {
  let q1 = (a - 2 * c1 + c2) / 3; let q2 = (a - 2 * c2 + c1) / 3;
  if (q2 < 0) { q2 = 0; q1 = Math.max(0, (a - c1) / 2); }
  if (q1 < 0) { q1 = 0; q2 = Math.max(0, (a - c2) / 2); }
  const P = a - q1 - q2;
  return { q1, q2, P, pi1: (P - c1) * q1, pi2: (P - c2) * q2 };
}
const cournotParams = (A) => ({ a: num(A, 'a', 120), c1: num(A, 'c1', 30), c2: num(A, 'c2', 30) });
const cournotChart = {
  title: 'Дуополия Курно',
  controls: (A) => {
    const p = cournotParams(A);
    return [
      { id: 'c1', label: 'Издержки фирмы 1', min: 0, max: Math.round(p.a * 0.6), step: 1, def: p.c1, fmt: (v) => `${v}` },
      { id: 'c2', label: 'Издержки фирмы 2', min: 0, max: Math.round(p.a * 0.6), step: 1, def: p.c2, fmt: (v) => `${v}` },
    ];
  },
  measure: (A, v) => { const e = cournot({ a: cournotParams(A).a, c1: v.c1, c2: v.c2 }); return { q1: e.q1, q2: e.q2, P: e.P, pi1: e.pi1, pi2: e.pi2 }; },
  build: (A, v) => {
    const { a } = cournotParams(A);
    const e = cournot({ a, c1: v.c1, c2: v.c2 });
    const max = Math.ceil((a * 0.75) / 10) * 10;
    const r1c = (a - v.c1); const r2c = (a - v.c2);
    const curves = [
      { id: 'R1', label: 'реакция 1', points: [{ x: r1c / 2, y: 0 }, { x: 0, y: r1c }], color: 'blue' },
      { id: 'R2', label: 'реакция 2', points: [{ x: 0, y: r2c / 2 }, { x: r2c, y: 0 }], color: 'rust' },
    ];
    // при одинаковых издержках — линия картеля: вместе производят монопольный объём
    if (v.c1 === v.c2) curves.push({ id: 'K', label: 'картель', points: [{ x: 0, y: r1c / 2 }, { x: r1c / 2, y: 0 }], color: 'gold', dashed: true });
    return {
      xDomain: [0, max], yDomain: [0, max], xLabel: 'q₁', yLabel: 'q₂', curves,
      points: [{ x: e.q1, y: e.q2, label: 'N', guide: true }],
      readout: [
        { label: 'Фирма 1: q₁', value: r1(e.q1) },
        { label: 'Фирма 2: q₂', value: r1(e.q2) },
        { label: 'Цена', value: r1(e.P) },
        { label: 'Прибыли', value: `${r1(e.pi1)} и ${r1(e.pi2)}` },
      ],
    };
  },
};

/* ---------------- КРИВАЯ ПРОИЗВОДСТВЕННЫХ ВОЗМОЖНОСТЕЙ ----------------
   Четверть эллипса x²/X² + y²/Y² = 1: вогнутая, потому что ресурсы специализированы и
   альтернативная стоимость растёт. Ползунки: сколько производить товара X (точка на
   границе) и технологии в каждой отрасли (сдвигают концы кривой). */
export const ppfY = (X, Y, x) => (x >= X ? 0 : Y * Math.sqrt(1 - (x * x) / (X * X)));
// альтернативная стоимость единицы X в единицах Y: наклон границы −dy/dx
export const ppfCost = (X, Y, x) => { const y = ppfY(X, Y, x); return y > 1e-9 ? (Y * Y * x) / (X * X * y) : Infinity; };
const ppfParams = (A) => ({ X: num(A, 'x', 100), Y: num(A, 'y', 100) });
const ppf = {
  title: 'Кривая производственных возможностей',
  controls: (A) => {
    const p = ppfParams(A);
    return [
      { id: 'x', label: 'Производство хлеба X', min: 0, max: p.X, step: 1, def: num(A, 'x0', Math.round(p.X * 0.6)), fmt: (v) => `${v}` },
      { id: 'tx', label: 'Технология в хлебе', min: -30, max: 50, step: 5, def: 0, fmt: (v) => `${v > 0 ? '+' : ''}${v}%` },
      { id: 'ty', label: 'Технология в станках', min: -30, max: 50, step: 5, def: 0, fmt: (v) => `${v > 0 ? '+' : ''}${v}%` },
    ];
  },
  measure: (A, v) => {
    const p = ppfParams(A); const X = p.X * (1 + v.tx / 100); const Y = p.Y * (1 + v.ty / 100);
    const x = Math.min(v.x, X);
    return { x, y: ppfY(X, Y, x), oc: ppfCost(X, Y, x) };
  },
  build: (A, v) => {
    const p = ppfParams(A); const X = p.X * (1 + v.tx / 100); const Y = p.Y * (1 + v.ty / 100);
    const x = Math.min(v.x, X); const y = ppfY(X, Y, x); const oc = ppfCost(X, Y, x);
    const curve = (XX, YY) => Array.from({ length: 60 }, (_, i) => { const xx = XX * i / 59; return { x: xx, y: ppfY(XX, YY, xx) }; });
    const moved = v.tx !== 0 || v.ty !== 0;
    const max = Math.ceil((Math.max(p.X, p.Y) * 1.55) / 10) * 10;
    return {
      xDomain: [0, max], yDomain: [0, max], xLabel: 'хлеб X', yLabel: 'станки Y',
      curves: [
        ...(moved ? [{ id: 'PPF0', points: curve(p.X, p.Y), ghost: true, color: 'blue' }] : []),
        { id: 'PPF', label: 'КПВ', labelPos: 0.3, points: curve(X, Y), color: 'blue' },
      ],
      points: [
        { x, y, label: 'A', guide: true },
        { x: x * 0.7, y: y * 0.7, label: 'неэффективно', small: true },
      ],
      readout: [
        { label: 'Хлеб X', value: r1(x) },
        { label: 'Станки Y', value: r1(y) },
        { label: 'Альтернативная стоимость единицы X', value: Number.isFinite(oc) ? `${r2(oc)} Y` : '∞' },
      ],
    };
  },
};

/* ---------------- ВЫБОР ПОТРЕБИТЕЛЯ ----------------
   Полезность Кобба — Дугласа U = x^α·y^(1−α), бюджет pₓ·x + p_y·y = I. Оптимум —
   касание кривой безразличия: x = αI/pₓ, y = (1 − α)I/p_y. Когда цена X меняется,
   график раскладывает изменение спроса по Слуцкому: компенсированный бюджет с новыми
   ценами проходит через старый набор, точка S — эффект замещения, от S до нового
   оптимума — эффект дохода. */
export function cdChoice({ a, I, px, py }) { const x = (a * I) / px; const y = ((1 - a) * I) / py; return { x, y, U: Math.pow(x, a) * Math.pow(y, 1 - a) }; }
export function slutsky({ a, I, px0, px1, py }) {
  const old = cdChoice({ a, I, px: px0, py }); const now = cdChoice({ a, I, px: px1, py });
  const Ic = px1 * old.x + py * old.y; const comp = cdChoice({ a, I: Ic, px: px1, py });
  return { old, now, comp, Ic, substitution: comp.x - old.x, income: now.x - comp.x };
}
const consParams = (A) => ({ a: num(A, 'alpha', 0.5), I: num(A, 'i', 120), px: num(A, 'px', 2), py: num(A, 'py', 1) });
const consumer = {
  title: 'Выбор потребителя',
  controls: (A) => {
    const p = consParams(A);
    return [
      { id: 'px', label: 'Цена товара X', min: Math.max(0.5, p.px * 0.25), max: p.px * 3, step: 0.25, def: p.px, fmt: (v) => r2(v) },
      { id: 'I', label: 'Доход I', min: Math.round(p.I * 0.4), max: Math.round(p.I * 1.8), step: 5, def: p.I, fmt: (v) => `${v}` },
    ];
  },
  measure: (A, v) => { const p = consParams(A); const c = cdChoice({ a: p.a, I: v.I, px: v.px, py: p.py }); return { x: c.x, y: c.y, U: c.U }; },
  build: (A, v) => {
    const p = consParams(A);
    const c = cdChoice({ a: p.a, I: v.I, px: v.px, py: p.py });
    const max = Math.ceil((Math.max(p.I * 1.8 / p.px, p.I * 1.8 / p.py) * 0.75) / 10) * 10;
    const budget = (I, px) => [{ x: 0, y: I / p.py }, { x: I / px, y: 0 }];
    const indiff = (U) => Array.from({ length: 70 }, (_, i) => { const x = max * (0.02 + 0.98 * i / 69); return { x, y: Math.pow(U / Math.pow(x, p.a), 1 / (1 - p.a)) }; });
    const curves = [];
    const points = [{ x: c.x, y: c.y, label: 'E', guide: true }];
    const readout = [{ label: 'Товар X', value: r1(c.x) }, { label: 'Товар Y', value: r1(c.y) }, { label: 'Полезность', value: r1(c.U) }];
    const priceMoved = Math.abs(v.px - p.px) > 1e-9 && Math.abs(v.I - p.I) < 1e-9;
    if (Math.abs(v.px - p.px) > 1e-9 || Math.abs(v.I - p.I) > 1e-9) {
      const o = cdChoice({ a: p.a, I: p.I, px: p.px, py: p.py });
      curves.push({ id: 'B0', points: budget(p.I, p.px), ghost: true, color: 'rust' }, { id: 'U0', points: indiff(o.U), ghost: true, color: 'teal' });
      points.push({ x: o.x, y: o.y, label: 'E₀', small: true });
    }
    if (priceMoved) {
      const sl = slutsky({ a: p.a, I: p.I, px0: p.px, px1: v.px, py: p.py });
      curves.push({ id: 'Bc', label: 'компенсированный', labelPos: 'start', points: budget(sl.Ic, v.px), color: 'gold', dashed: true });
      points.push({ x: sl.comp.x, y: sl.comp.y, label: 'S', small: true });
      readout.push({ label: 'Эффект замещения', value: r1(sl.substitution) }, { label: 'Эффект дохода', value: r1(sl.income) });
    }
    curves.push({ id: 'B', label: 'бюджет', points: budget(v.I, v.px), color: 'rust' }, { id: 'U', label: 'U', points: indiff(c.U), color: 'teal' });
    return { xDomain: [0, max], yDomain: [0, max], xLabel: 'X', yLabel: 'Y', curves, points, readout };
  },
};

/* ---------------- НАЛОГ, ИЗЛИШКИ И ПОТЕРИ ----------------
   Спрос Qd = a − bP, предложение Qs = c + dP, налог t с единицы: покупатели платят Pd,
   продавцы получают Ps = Pd − t. Закрашены излишек потребителей, излишек производителей,
   налоговые сборы и безвозвратные потери. Кто юридически платит налог — не важно:
   цены покупателей и продавцов и объём одинаковы. */
export function taxMarket({ a, b, c, d, t }) {
  const Pd = (a - c + d * t) / (b + d); const Ps = Pd - t; const Q = Math.max(0, a - b * Pd);
  const P0 = (a - c) / (b + d); const Q0 = a - b * P0;
  const pmaxD = a / b; const pminS = -c / d;
  return { Pd, Ps, Q, P0, Q0, cs: 0.5 * Q * (pmaxD - Pd), ps: 0.5 * Q * (Ps - pminS), rev: t * Q, dwl: 0.5 * t * (Q0 - Q), buyersShare: t > 0 ? (Pd - P0) / t : d / (b + d) };
}
const taxParams = (A) => ({ a: num(A, 'a', 100), b: num(A, 'b', 2), c: num(A, 'c', -20), d: num(A, 'd', 4) });
const tax = {
  title: 'Налог, излишки и потери',
  controls: (A) => {
    const p = taxParams(A); const P0 = (p.a - p.c) / (p.b + p.d);
    return [{ id: 't', label: 'Налог с единицы t', min: 0, max: Math.round(P0), step: 1, def: num(A, 't', 0), fmt: (v) => `${v}` }];
  },
  measure: (A, v) => { const m = taxMarket({ ...taxParams(A), t: v.t }); return { Pd: m.Pd, Ps: m.Ps, Q: m.Q, dwl: m.dwl, rev: m.rev, cs: m.cs, ps: m.ps }; },
  build: (A, v) => {
    const p = taxParams(A); const m = taxMarket({ ...p, t: v.t });
    const Pmax = Math.ceil((p.a / p.b * 1.1) / 10) * 10; const Qmax = Math.ceil((p.a * 1.05) / 10) * 10;
    const pminS = -p.c / p.d;
    const polys = [
      { points: [{ x: 0, y: p.a / p.b }, { x: 0, y: m.Pd }, { x: m.Q, y: m.Pd }], label: 'покупатели', tone: 'blue' },
      { points: [{ x: 0, y: Math.max(0, pminS) }, { x: 0, y: m.Ps }, { x: m.Q, y: m.Ps }], label: 'продавцы', tone: 'teal' },
    ];
    if (v.t > 0) polys.push({ points: [{ x: m.Q, y: m.Pd }, { x: m.Q0, y: m.P0 }, { x: m.Q, y: m.Ps }], label: 'DWL', tone: 'rust' });
    const rects = v.t > 0 ? [{ x0: 0, x1: m.Q, y0: m.Ps, y1: m.Pd, label: 'налог' }] : [];
    return {
      xDomain: [0, Qmax], yDomain: [0, Pmax], xLabel: 'Q', yLabel: 'P', polys, rects,
      curves: [
        { id: 'D', label: 'D', points: [{ x: 0, y: p.a / p.b }, { x: p.a, y: 0 }], color: 'blue' },
        { id: 'S', label: 'S', points: [{ x: Math.max(0, p.c), y: Math.max(0, pminS) }, { x: Qmax, y: (Qmax - p.c) / p.d }], color: 'rust' },
      ],
      points: v.t > 0 ? [{ x: m.Q, y: m.Pd, label: 'Pd', guide: true }, { x: m.Q, y: m.Ps, label: 'Ps', guide: true, below: true }] : [{ x: m.Q0, y: m.P0, label: 'E', guide: true }],
      readout: [
        { label: 'Цена покупателей', value: r1(m.Pd) },
        { label: 'Цена продавцов', value: r1(m.Ps) },
        { label: 'Количество', value: r1(m.Q) },
        { label: 'Сборы', value: r1(m.rev) },
        { label: 'Безвозвратные потери', value: r1(m.dwl) },
        { label: 'Доля налога на покупателях', value: `${Math.round(m.buyersShare * 100)}%` },
      ],
    };
  },
};

// что показывает график числами — по этим величинам проверяются графические задачи
supplyDemand.measure = (A, v) => {
  const d = num(A, 'd', 4);
  const e = sdEquilibrium(num(A, 'a', 100) + (v.dA || 0), num(A, 'b', 2), num(A, 'c', -20) + (v.dC || 0) - d * (v.cost || 0), d);
  return { P: e.P, Q: e.Q };
};
elasticity.measure = (A, v) => {
  const a = num(A, 'a', 100); const b = num(A, 'b', 2); const Q = a - b * v.P;
  return { P: v.P, Q, R: v.P * Q, E: pointElasticity(a, b, v.P) };
};
isLm.measure = (A, v) => {
  const p = islmParams(A);
  if (v.hold) { const base = islmEquilibrium(p); return { Y: (p.a0 + v.G - p.b * base.r) / (1 - p.c), r: base.r }; }
  const e = islmEquilibrium({ ...p, G: v.G, M: v.M });
  return { Y: e.Y, r: e.r };
};
adAs.measure = (A, v) => {
  const p0 = islmParams(A); const ybar = num(A, 'ybar', islmEquilibrium(p0).Y);
  const e = adasEquilibrium({ ...p0, G: v.G != null ? v.G : p0.G }, v.M, v.pe, ybar, num(A, 's', 1));
  return { Y: e.Y, P: e.P };
};

/* ОГИБАЮЩАЯ LRAC. Долгосрочные средние издержки — парабола LRAC(Q) = c + a(Q − m)², m —
   минимально эффективный масштаб. Завод размера K даёт краткосрочную кривую
   SRAC(Q) = LRAC(Q) + (s − a)(Q − K)²: она выше LRAC везде, кроме точки Q = K, где касается её.
   Минимум SRAC — в Q* = (a·m + (s − a)·K)/s: у заводов меньше m он правее точки касания, у заводов
   больше m — левее; точно в касании только у завода минимально эффективного масштаба. */
const lracParams = (A) => ({ c: num(A, 'c', 20), m: num(A, 'm', 60), a: num(A, 'a', 0.004), s: num(A, 's', 0.02) });
export function lracFns(p) {
  const lrac = (q) => p.c + p.a * (q - p.m) ** 2;
  const srac = (K) => (q) => lrac(q) + (p.s - p.a) * (q - K) ** 2;
  const sracMinQ = (K) => (p.a * p.m + (p.s - p.a) * K) / p.s;
  return { lrac, srac, sracMinQ };
}
const lrac = {
  title: 'Долгосрочные издержки: огибающая',
  controls: () => [{ id: 'K', label: 'Размер завода (на какой выпуск построен)', min: 10, max: 110, step: 10, def: 20, fmt: (v) => `${v}` }],
  measure: (A, v) => {
    const f = lracFns(lracParams(A)); const q = f.sracMinQ(v.K);
    return { lrac: f.lrac(v.K), sracMinQ: q, sracMin: f.srac(v.K)(q) };
  },
  build: (A, v) => {
    const p = lracParams(A); const f = lracFns(p);
    const Qmax = p.m * 2; const yMax = Math.ceil((p.c + p.a * p.m * p.m * 1.1) / 5) * 5;
    const samp = (fn) => Array.from({ length: 80 }, (_, i) => { const q = 2 + (Qmax - 2) * i / 79; return { x: q, y: fn(q) }; });
    const sizes = [p.m / 3, (2 * p.m) / 3, p.m, (4 * p.m) / 3, (5 * p.m) / 3].map(Math.round).filter((K) => K !== v.K);
    const q = f.sracMinQ(v.K);
    const part = v.K < p.m ? 'положительный эффект масштаба' : v.K > p.m ? 'отрицательный эффект масштаба' : 'минимально эффективный масштаб';
    return {
      // сверху — запас над последней отметкой шкалы, чтобы подпись оси не легла на число
      xDomain: [0, Qmax], yDomain: [Math.floor((p.c * 0.75) / 5) * 5, yMax + 2.5], xLabel: 'Q', yLabel: 'AC',
      curves: [
        ...sizes.map((K) => ({ id: `s${K}`, points: samp(f.srac(K)), color: 'blue', ghost: true })),
        { id: 'LRAC', label: 'LRAC', labelPos: 0.97, points: samp(f.lrac), color: 'gold' },
        { id: 'SRAC', label: `SRAC завода на ${v.K}`, labelPos: Math.max(0.05, Math.min(0.8, (v.K - 25) / Qmax)), points: samp(f.srac(v.K)), color: 'blue' },
      ],
      points: [
        { x: v.K, y: f.lrac(v.K), label: 'касание', guide: true },
        ...(Math.abs(q - v.K) > 1 ? [{ x: q, y: f.srac(v.K)(q), label: 'min SRAC', small: true, below: true }] : []),
      ],
      readout: [
        { label: 'Касание с LRAC', value: `Q = ${v.K}, средние ${r1(f.lrac(v.K))}` },
        { label: 'Минимум SRAC', value: `${r1(f.srac(v.K)(q))} при Q = ${r1(q)}` },
        { label: 'Участок LRAC', value: part },
      ],
    };
  },
};

/* ---------------- БЮДЖЕТНАЯ ЛИНИЯ ----------------
   p_x·x + p_y·y = I. Доход сдвигает линию параллельно, цена X поворачивает её вокруг
   точки на оси Y. Прежняя линия остаётся бледной, чтобы было видно, что изменилось. */
const budgetParams = (A) => ({ I: num(A, 'i', 120), px: num(A, 'px', 2), py: num(A, 'py', 1) });
const budgetChart = {
  title: 'Бюджетная линия',
  controls: (A) => {
    const p = budgetParams(A);
    return [
      { id: 'I', label: 'Доход I', min: Math.round(p.I * 0.4), max: Math.round(p.I * 1.6), step: 5, def: p.I, fmt: (v) => `${v}` },
      { id: 'px', label: 'Цена товара X', min: Math.max(0.5, p.px * 0.5), max: p.px * 3, step: 0.25, def: p.px, fmt: (v) => r2(v) },
    ];
  },
  measure: (A, v) => { const p = budgetParams(A); return { xMax: v.I / v.px, yMax: v.I / p.py, slope: v.px / p.py }; },
  build: (A, v) => {
    const p = budgetParams(A);
    const max = Math.ceil(Math.max((p.I * 1.6) / (p.px * 0.5), (p.I * 1.6) / p.py) * 0.72 / 10) * 10;
    const seg = (I, px) => [{ x: 0, y: I / p.py }, { x: I / px, y: 0 }];
    const moved = v.I !== p.I || Math.abs(v.px - p.px) > 1e-9;
    return {
      xDomain: [0, max], yDomain: [0, max], xLabel: 'X', yLabel: 'Y',
      curves: [
        ...(moved ? [{ id: 'B0', points: seg(p.I, p.px), ghost: true, color: 'rust' }] : []),
        { id: 'B', label: 'бюджетная линия', labelPos: 0.2, points: seg(v.I, v.px), color: 'rust' },
      ],
      polys: [{ points: [{ x: 0, y: 0 }, { x: 0, y: v.I / p.py }, { x: v.I / v.px, y: 0 }], label: 'доступные наборы', tone: 'gold' }],
      points: [
        { x: 0, y: v.I / p.py, label: `всё на Y: ${r1(v.I / p.py)}`, small: true },
        { x: v.I / v.px, y: 0, label: `всё на X: ${r1(v.I / v.px)}`, small: true },
      ],
      readout: [
        { label: 'Максимум X', value: r1(v.I / v.px) },
        { label: 'Максимум Y', value: r1(v.I / p.py) },
        { label: 'Цена X в единицах Y', value: r2(v.px / p.py) },
      ],
    };
  },
};

/* ---------------- ВЫБОР НА БЮДЖЕТНОЙ ЛИНИИ ----------------
   Полезность Кобба — Дугласа U = x^α·y^(1−α). Ползунок двигает точку A по бюджетной линии;
   через неё проходит своя кривая безразличия. Оптимум E — там, где MRS = p_x/p_y. */
const choiceChart = {
  title: 'Лучший набор на бюджетной линии',
  controls: (A) => { const p = consParams(A); return [{ id: 'x', label: 'Покупки X (остальное — на Y)', min: 0, max: Math.round((p.I / p.px) * 0.95), step: 1, def: Math.round((p.I / p.px) * 0.2), fmt: (v) => `${v}` }]; },
  measure: (A, v) => {
    const p = consParams(A); const y = (p.I - p.px * v.x) / p.py;
    return { U: Math.pow(Math.max(v.x, 1e-9), p.a) * Math.pow(Math.max(y, 1e-9), 1 - p.a), mrs: (p.a / (1 - p.a)) * (y / Math.max(v.x, 1e-9)) };
  },
  build: (A, v) => {
    const p = consParams(A);
    const c = cdChoice(p);
    const x = Math.max(0.5, v.x); const y = (p.I - p.px * x) / p.py;
    const U = Math.pow(x, p.a) * Math.pow(y, 1 - p.a);
    const mrs = (p.a / (1 - p.a)) * (y / x);
    const max = Math.ceil((Math.max(p.I / p.px, p.I / p.py) * 1.05) / 10) * 10;
    const indiff = (u) => Array.from({ length: 70 }, (_, i) => { const xx = max * (0.02 + 0.98 * i / 69); return { x: xx, y: Math.pow(u / Math.pow(xx, p.a), 1 / (1 - p.a)) }; });
    const ratio = p.px / p.py;
    const hint = Math.abs(mrs - ratio) < 0.05 * ratio ? 'это оптимум' : mrs > ratio ? 'выгоднее купить больше X' : 'выгоднее купить больше Y';
    const at = Math.abs(x - c.x) < 0.5;
    return {
      xDomain: [0, max], yDomain: [0, max], xLabel: 'X', yLabel: 'Y',
      curves: [
        { id: 'B', label: 'бюджет', labelPos: 0.1, points: [{ x: 0, y: p.I / p.py }, { x: p.I / p.px, y: 0 }], color: 'rust' },
        ...(at ? [] : [{ id: 'UA', label: 'через A', labelPos: 0.85, points: indiff(U), color: 'blue' }]),
        { id: 'UE', label: 'лучшая доступная', labelPos: 0.42, points: indiff(c.U), color: 'teal' },
      ],
      points: [
        ...(at ? [] : [{ x, y, label: 'A', guide: true }]),
        { x: c.x, y: c.y, label: 'E', small: at ? false : true },
      ],
      readout: [
        { label: 'MRS в точке A', value: r2(mrs) },
        { label: 'Отношение цен p_x/p_y', value: r2(ratio) },
        { label: 'Совет', value: hint },
      ],
    };
  },
};

/* ---------------- СПРОС: ВДОЛЬ КРИВОЙ И СДВИГ ----------------
   Q = a − b·P. Цена товара двигает точку вдоль кривой, доходы (и всё остальное) сдвигают кривую. */
const demandParams = (A) => ({ a: num(A, 'a', 100), b: num(A, 'b', 2), P: num(A, 'p', 20) });
const demandChart = {
  title: 'Движение вдоль кривой и сдвиг кривой',
  controls: (A) => {
    const p = demandParams(A);
    return [
      { id: 'P', label: 'Цена самого товара', min: 0, max: Math.round((p.a / p.b) * 0.9), step: 1, def: p.P, fmt: (v) => `${v} руб.` },
      { id: 'dA', label: 'Доходы покупателей: сдвиг спроса', min: -Math.round(p.a * 0.3), max: Math.round(p.a * 0.3), step: 5, def: 0, fmt: (v) => `${v > 0 ? '+' : ''}${v} ед.` },
    ];
  },
  measure: (A, v) => { const p = demandParams(A); return { Q: Math.max(0, p.a + v.dA - p.b * v.P) }; },
  build: (A, v) => {
    const p = demandParams(A);
    const Pmax = Math.ceil(((p.a * 1.3) / p.b) / 10) * 10; const Qmax = Math.ceil((p.a * 1.3) / 10) * 10;
    const D = (a) => [{ x: a, y: 0 }, { x: 0, y: a / p.b }];
    const q0 = Math.max(0, p.a - p.b * p.P); const q = Math.max(0, p.a + v.dA - p.b * v.P);
    const what = v.dA !== 0 && v.P !== p.P ? 'и сдвиг, и движение' : v.dA !== 0 ? 'сдвиг кривой: изменился спрос' : v.P !== p.P ? 'движение вдоль кривой: изменился объём спроса' : 'исходная точка';
    return {
      xDomain: [0, Qmax], yDomain: [0, Pmax], xLabel: 'Q', yLabel: 'P',
      curves: [
        ...(v.dA !== 0 ? [{ id: 'D0', points: D(p.a), ghost: true, color: 'blue' }] : []),
        { id: 'D', label: 'D', points: D(p.a + v.dA), color: 'blue' },
      ],
      points: [
        ...(v.dA !== 0 || v.P !== p.P ? [{ x: q0, y: p.P, label: 'было', small: true }] : []),
        { x: q, y: v.P, label: 'сейчас', guide: true },
      ],
      readout: [{ label: 'Объём спроса', value: `${r1(q)} ед.` }, { label: 'Что произошло', value: what }],
    };
  },
};

/* ---------------- КЕЙНСИАНСКИЙ КРЕСТ ----------------
   Планируемые расходы E = C₀ + c(Y − T) + I + G против линии Y = E (45°). Равновесие —
   пересечение; сдвиг расходов вверх на ΔG поднимает выпуск на ΔG/(1 − c). */
const crossParams = (A) => ({ c0: num(A, 'c0', 200), c: num(A, 'c', 0.75), I: num(A, 'inv', 50), G: num(A, 'g', 100), T: num(A, 't', 100) });
export const crossY = (p, G, T) => (p.c0 - p.c * T + p.I + G) / (1 - p.c);
const crossChart = {
  title: 'Кейнсианский крест',
  controls: (A) => {
    const p = crossParams(A);
    return [
      { id: 'G', label: 'Госзакупки G', min: 0, max: p.G * 2, step: 10, def: p.G, fmt: (v) => `${v}` },
      { id: 'T', label: 'Налоги T', min: 0, max: p.T * 2, step: 10, def: p.T, fmt: (v) => `${v}` },
    ];
  },
  measure: (A, v) => { const p = crossParams(A); return { Y: crossY(p, v.G, v.T) }; },
  build: (A, v) => {
    const p = crossParams(A);
    const y0 = crossY(p, p.G, p.T); const y = crossY(p, v.G, v.T);
    const Ymax = Math.ceil((crossY(p, p.G * 2, 0) * 1.1) / 100) * 100;
    const E = (G, T) => line((Y) => p.c0 + p.c * (Y - T) + p.I + G, 0, Ymax);
    const moved = v.G !== p.G || v.T !== p.T;
    return {
      // запас сверху — подпись оси не ложится на верхнее число шкалы
      xDomain: [0, Ymax], yDomain: [0, Ymax * 1.06], xLabel: 'Y', yLabel: 'E',
      curves: [
        { id: 'diag', label: 'Y = E', labelPos: 0.9, points: [{ x: 0, y: 0 }, { x: Ymax, y: Ymax }], color: 'gold', dashed: true },
        ...(moved ? [{ id: 'E0', points: E(p.G, p.T), ghost: true, color: 'blue' }] : []),
        { id: 'E', label: 'расходы E', labelPos: 0.05, points: E(v.G, v.T), color: 'blue' },
      ],
      points: [
        ...(moved ? [{ x: y0, y: y0, label: 'было', small: true, below: true }] : []),
        { x: y, y, label: 'равновесие', guide: true },
      ],
      readout: [
        { label: 'Выпуск Y', value: r1(y) },
        { label: 'Изменение выпуска', value: `${y - y0 >= 0 ? '+' : ''}${r1(y - y0)}` },
        { label: 'Мультипликатор 1/(1 − c)', value: r2(1 / (1 - p.c)) },
      ],
    };
  },
};

/* ---------------- ВНЕШНИЙ ЭФФЕКТ ----------------
   Спрос P = a − Q, частные предельные издержки MC = c₀ + Q, внешние издержки e на единицу:
   общественные SMC = c₀ + e + Q. Рынок выпускает там, где спрос = MC, общество хотело бы
   спрос = SMC; между ними — треугольник потерь. Налог Пигу t = e возвращает выпуск к оптимуму. */
const extParams = (A) => ({ a: num(A, 'a', 100), c0: num(A, 'c0', 10), e: num(A, 'ext', 20) });
export function externality({ a, c0, e }, tax = 0) {
  const qm = (a - c0 - tax) / 2; const qo = (a - c0 - e) / 2;
  // потери — треугольник между общественными издержками и спросом от оптимума до выпуска рынка
  return { qm, qo, dwl: 0.5 * Math.abs(qm - qo) * Math.abs(c0 + e + qm - (a - qm)) };
}
const extChart = {
  title: 'Внешний эффект и налог Пигу',
  controls: (A) => {
    const p = extParams(A);
    return [
      { id: 'e', label: 'Ущерб соседям от единицы', min: 0, max: Math.round(p.e * 2), step: 1, def: p.e, fmt: (v) => `${v} руб.` },
      { id: 'pigou', label: 'Налог Пигу = ущербу', toggle: true, def: false },
    ];
  },
  measure: (A, v) => { const p = extParams(A); const m = externality({ ...p, e: v.e }, v.pigou ? v.e : 0); return { Q: m.qm, dwl: m.dwl }; },
  build: (A, v) => {
    const p = extParams(A); const e = v.e; const tax = v.pigou ? e : 0;
    const m = externality({ ...p, e }, tax);
    const Qmax = p.a; const Pmax = p.a;
    const polys = !v.pigou && e > 0 ? [{ points: [{ x: m.qo, y: p.a - m.qo }, { x: m.qm, y: p.c0 + e + m.qm }, { x: m.qm, y: p.a - m.qm }], label: 'потери', tone: 'rust' }] : [];
    return {
      xDomain: [0, Qmax], yDomain: [0, Pmax], xLabel: 'Q', yLabel: 'P',
      polys,
      curves: [
        { id: 'D', label: 'спрос', labelPos: 0.08, points: line((q) => p.a - q, 0, Qmax), color: 'blue' },
        { id: 'MC', label: v.pigou ? 'MC + налог' : 'MC частные', labelPos: 0.2, points: line((q) => p.c0 + tax + q, 0, Qmax), color: 'teal' },
        ...(e > 0 ? [{ id: 'SMC', label: 'MC общества', labelPos: 0.6, points: line((q) => p.c0 + e + q, 0, Qmax), color: 'rust', dashed: true }] : []),
      ],
      points: [
        { x: m.qm, y: p.a - m.qm, label: 'рынок', guide: true },
        ...(Math.abs(m.qm - m.qo) > 0.5 ? [{ x: m.qo, y: p.a - m.qo, label: 'оптимум', small: true }] : []),
      ],
      readout: [
        { label: 'Выпуск рынка', value: r1(m.qm) },
        { label: 'Оптимум для общества', value: r1(m.qo) },
        { label: 'Безвозвратные потери', value: r1(m.dwl) },
      ],
    };
  },
};

/* ---------------- ОБЩАЯ КПВ ДВУХ ПРОИЗВОДИТЕЛЕЙ ----------------
   Каждый за час производит a пирогов или b рубашек (h часов). Первые рубашки шьёт тот, у
   кого рубашка дешевле в пирогах; общая граница — ломаная с изломом там, где он занят целиком. */
const tradeParams = (A) => ({ a1: num(A, 'a1', 4), b1: num(A, 'b1', 2), a2: num(A, 'a2', 1), b2: num(A, 'b2', 1), h: num(A, 'h', 8), n1: A.n1 || 'первый', n2: A.n2 || 'второй' });
export function jointPies(p, shirts) {
  // сначала рубашки шьёт тот, у кого альтернативная стоимость рубашки (a/b) ниже
  const ppl = [{ a: p.a1, b: p.b1, name: p.n1 || 'первый' }, { a: p.a2, b: p.b2, name: p.n2 || 'второй' }].sort((x, y) => x.a / x.b - y.a / y.b);
  let need = shirts; let pies = 0; const who = [];
  ppl.forEach((pp) => {
    const hours = Math.min(p.h, need / pp.b); need -= hours * pp.b;
    pies += (p.h - hours) * pp.a; if (hours > 0) who.push(pp.name);
  });
  return { pies: need > 1e-9 ? NaN : pies, who, first: ppl[0] };
}
const tradeChart = {
  title: 'Общая КПВ двух производителей',
  controls: (A) => { const p = tradeParams(A); return [{ id: 's', label: 'Сколько рубашек нужно', min: 0, max: (p.b1 + p.b2) * p.h, step: 1, def: Math.round(p.b2 * p.h / 2), fmt: (v) => `${v}` }]; },
  measure: (A, v) => ({ pies: jointPies(tradeParams(A), v.s).pies }),
  build: (A, v) => {
    const p = tradeParams(A);
    const smax = (p.b1 + p.b2) * p.h;
    const kinkS = jointPies(p, 0).first.b * p.h;
    const frontier = [0, kinkS, smax].map((x) => ({ x, y: jointPies(p, x).pies }));
    const r = jointPies(p, v.s);
    const firstName = r.first === undefined ? '' : r.first.name;
    return {
      // сверху запас над последней отметкой: подпись оси не ложится на число
      xDomain: [0, smax], yDomain: [0, (p.a1 + p.a2) * p.h * 1.15], xLabel: 'рубашки', yLabel: 'пироги',
      curves: [{ id: 'J', label: 'граница вдвоём', labelPos: 0.8, points: frontier, color: 'gold' }],
      points: [{ x: kinkS, y: frontier[1].y, label: 'излом', small: true }, { x: v.s, y: r.pies, label: 'выбор', guide: true }],
      readout: [
        { label: 'Пирогов при этом', value: r1(r.pies) },
        { label: 'Рубашки шьёт', value: v.s === 0 ? 'никто' : v.s <= kinkS ? `только ${firstName}: у него рубашка дешевле в пирогах` : 'оба' },
      ],
    };
  },
};

/* ---------------- НОМИНАЛЬНЫЙ И РЕАЛЬНЫЙ ВВП ----------------
   Реальный ВВП растёт на g в год, цены — на π. Номинальный = реальный × дефлятор. */
const gdpParams = (A) => ({ y0: num(A, 'y0', 100), g: num(A, 'g', 2), pi: num(A, 'pi', 8), n: num(A, 'n', 5) });
const gdpChart = {
  title: 'Номинальный и реальный ВВП',
  controls: (A) => {
    const p = gdpParams(A);
    return [
      { id: 'g', label: 'Реальный рост в год', min: -6, max: 10, step: 0.5, def: p.g, fmt: (v) => `${r1(v)}%` },
      { id: 'pi', label: 'Инфляция (рост дефлятора) в год', min: 0, max: 30, step: 1, def: p.pi, fmt: (v) => `${v}%` },
    ];
  },
  measure: (A, v) => { const p = gdpParams(A); const real = p.y0 * Math.pow(1 + v.g / 100, p.n); return { real, nominal: real * Math.pow(1 + v.pi / 100, p.n) }; },
  build: (A, v) => {
    const p = gdpParams(A);
    const real = (t) => p.y0 * Math.pow(1 + v.g / 100, t);
    const nom = (t) => real(t) * Math.pow(1 + v.pi / 100, t);
    const pts = (f) => Array.from({ length: p.n * 4 + 1 }, (_, i) => ({ x: i / 4, y: f(i / 4) }));
    const top = Math.max(nom(p.n), real(p.n), p.y0);
    return {
      xDomain: [0, p.n], yDomain: [0, Math.ceil((top * 1.15) / 20) * 20], xLabel: 'год', yLabel: 'ВВП',
      curves: [
        { id: 'N', label: 'номинальный', labelPos: 0.85, points: pts(nom), color: 'rust' },
        { id: 'R', label: 'реальный', labelPos: 0.6, points: pts(real), color: 'blue' },
      ],
      points: [{ x: p.n, y: nom(p.n), label: r1(nom(p.n)), small: true }, { x: p.n, y: real(p.n), label: r1(real(p.n)), small: true, below: true }],
      readout: [
        { label: `Номинальный рост за ${p.n} лет`, value: `${r1((nom(p.n) / p.y0 - 1) * 100)}%` },
        { label: 'Реальный рост', value: `${r1((real(p.n) / p.y0 - 1) * 100)}%` },
        { label: 'Дефлятор в конце (база = 100)', value: r1(Math.pow(1 + v.pi / 100, p.n) * 100) },
      ],
    };
  },
};

/* ---------------- ДЕНЕЖНЫЙ МУЛЬТИПЛИКАТОР ----------------
   m = (1 + cr)/(cr + rr): cr — наличные к депозитам, rr — резервы к депозитам.
   Денежная масса M = m·B при денежной базе B. Кривая — мультипликатор при разных нормах резервов. */
const moneyParams = (A) => ({ B: num(A, 'base', 100), rr: num(A, 'rr', 0.1), cr: num(A, 'cr', 0.2) });
export const moneyMultiplier = (cr, rr) => (1 + cr) / (cr + rr);
const moneyChart = {
  title: 'Денежный мультипликатор',
  controls: (A) => {
    const p = moneyParams(A);
    return [
      { id: 'rr', label: 'Норма резервов банков', min: 0.02, max: 0.5, step: 0.01, def: p.rr, fmt: (v) => `${Math.round(v * 100)}%` },
      { id: 'cr', label: 'Наличные к вкладам', min: 0, max: 1, step: 0.05, def: p.cr, fmt: (v) => `${Math.round(v * 100)}%` },
    ];
  },
  measure: (A, v) => { const p = moneyParams(A); const m = moneyMultiplier(v.cr, v.rr); return { m, M: m * p.B }; },
  build: (A, v) => {
    const p = moneyParams(A);
    const m = moneyMultiplier(v.cr, v.rr); const M = m * p.B; const D = M / (1 + v.cr);
    const pts = Array.from({ length: 60 }, (_, i) => { const rr = 0.02 + 0.48 * i / 59; return { x: rr * 100, y: moneyMultiplier(v.cr, rr) }; });
    return {
      xDomain: [0, 50], yDomain: [0, Math.max(8, Math.ceil(moneyMultiplier(v.cr, 0.02) * 1.1))], xLabel: 'резервы, %', yLabel: 'm',
      curves: [{ id: 'm', label: 'мультипликатор', labelPos: 0.35, points: pts, color: 'gold' }],
      points: [{ x: v.rr * 100, y: m, label: `m = ${r2(m)}`, guide: true }],
      readout: [
        { label: 'Мультипликатор', value: r2(m) },
        { label: `Денежная масса при базе ${p.B}`, value: r1(M) },
        { label: 'Вклады', value: r1(D) },
        { label: 'Наличные', value: r1(M - D) },
      ],
    };
  },
};

// как называть величины графика в ответе графической задачи
supplyDemand.measureNames = { P: 'цена', Q: 'количество' };
elasticity.measureNames = { P: 'цена', Q: 'количество', R: 'выручка', E: 'эластичность' };
isLm.measureNames = { Y: 'выпуск', r: 'ставка' };
adAs.measureNames = { Y: 'выпуск', P: 'уровень цен' };
costs.measureNames = { avcMin: 'минимум AVC', atcMin: 'минимум ATC', qEff: 'выпуск при минимуме ATC', Q: 'выпуск', profit: 'прибыль' };
monopolyChart.measureNames = { P: 'цена', Q: 'выпуск', profit: 'прибыль', dwl: 'безвозвратные потери' };
cournotChart.measureNames = { q1: 'выпуск фирмы 1', q2: 'выпуск фирмы 2', P: 'цена', pi1: 'прибыль фирмы 1', pi2: 'прибыль фирмы 2' };

ppf.measureNames = { x: 'хлеб', y: 'станки', oc: 'альтернативная стоимость хлеба' };
consumer.measureNames = { x: 'покупки X', y: 'покупки Y', U: 'полезность' };
tax.measureNames = { Pd: 'цена покупателей', Ps: 'цена продавцов', Q: 'количество', dwl: 'безвозвратные потери', rev: 'сборы', cs: 'излишек покупателей', ps: 'излишек продавцов' };

elasticCompare.measureNames = { qIn: 'покупки (неэластичный)', qEl: 'покупки (эластичный)', rIn: 'выручка (неэластичный)', rEl: 'выручка (эластичный)' };
revenueCurve.measureNames = { P: 'цена', R: 'выручка' };
lrac.measureNames = { lrac: 'долгосрочные средние издержки', sracMinQ: 'выпуск при минимуме SRAC', sracMin: 'минимум SRAC' };
budgetChart.measureNames = { xMax: 'максимум X', yMax: 'максимум Y', slope: 'цена X в единицах Y' };
choiceChart.measureNames = { U: 'полезность', mrs: 'MRS' };
demandChart.measureNames = { Q: 'объём спроса' };
crossChart.measureNames = { Y: 'выпуск' };
extChart.measureNames = { Q: 'выпуск', dwl: 'безвозвратные потери' };
tradeChart.measureNames = { pies: 'пироги' };
gdpChart.measureNames = { real: 'реальный ВВП', nominal: 'номинальный ВВП' };
moneyChart.measureNames = { m: 'мультипликатор', M: 'денежная масса' };
export const CHARTS = { 'supply-demand': supplyDemand, elasticity, 'elastic-compare': elasticCompare, revenue: revenueCurve, 'is-lm': isLm, 'ad-as': adAs, costs, monopoly: monopolyChart, cournot: cournotChart, ppf, consumer, tax, lrac, budget: budgetChart, choice: choiceChart, demand: demandChart, cross: crossChart, externality: extChart, 'trade-ppf': tradeChart, gdp: gdpChart, money: moneyChart };
export const chartDefaults = (type, attrs) => Object.fromEntries(CHARTS[type].controls(attrs).filter((c) => !c.button).map((c) => [c.id, c.def]));

/* ГРАФИЧЕСКАЯ ЗАДАЧА: игрок двигает ползунки, ответ — направления изменения величин
   графика относительно исходного положения. expect: «P:+ Q:-» (+ растёт, − падает,
   0 не меняется, ? любое); still — ползунки, которые трогать нельзя (условие задачи
   их не меняет). Возвращает по каждой величине, что получилось, и общий вердикт. */
export const parseExpect = (s) => (s || '').trim().split(/\s+/).filter(Boolean).map((t) => { const [key, dir] = t.split(':'); return { key, dir }; });
export function checkGraph(type, attrs, values, { expect, still = [] }) {
  const def = CHARTS[type];
  const base = def.measure(attrs, chartDefaults(type, attrs));
  const cur = def.measure(attrs, values);
  const defaults = chartDefaults(type, attrs);
  const moved = Object.keys(defaults).some((k) => values[k] !== defaults[k]);
  const touched = still.filter((k) => values[k] !== defaults[k]);
  const rows = expect.map(({ key, dir }) => {
    const d = cur[key] - base[key];
    const eps = 1e-6 * (1 + Math.abs(base[key]));
    const got = d > eps ? '+' : d < -eps ? '-' : '0';
    return { key, dir, got, ok: dir === '?' || dir === got };
  });
  return { moved, touched, rows, ok: moved && touched.length === 0 && rows.every((r) => r.ok) };
}
