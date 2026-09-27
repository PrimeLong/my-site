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
    return [
      { id: 'dA', label: 'Сдвиг спроса', min: -span, max: span, step: 1, def: 0, fmt: (v) => `${v > 0 ? '+' : ''}${v} ед.` },
      { id: 'dC', label: 'Сдвиг предложения', min: -span, max: span, step: 1, def: 0, fmt: (v) => `${v > 0 ? '+' : ''}${v} ед.` },
      { id: 'ceil', label: 'Потолок цены', min: Math.round(P * 0.4), max: Math.round(P * 2), step: 1, def: Math.round(P * 2),
        fmt: (v) => (v >= Math.round(P * 2) ? 'нет' : `${v}`) },
    ];
  },
  build: (A, v) => {
    const a = num(A, 'a', 100); const b = num(A, 'b', 2); const c = num(A, 'c', -20); const d = num(A, 'd', 4);
    const a1 = a + v.dA; const c1 = c + v.dC;
    const base = sdEquilibrium(a, b, c, d);
    const eq = sdEquilibrium(a1, b, c1, d);
    const Pmax = Math.ceil((a + a * 0.4) / b / 10) * 10;
    const Qmax = Math.ceil((a * 1.4) / 10) * 10;
    // кривые в осях «количество по горизонтали, цена по вертикали»
    const dem = (aa) => line((P) => P, 0, aa / b).map(({ x }) => ({ x: aa - b * x, y: x }));
    const sup = (cc) => line((P) => P, Math.max(0, -cc / d), (Qmax - cc) / d).map(({ x }) => ({ x: cc + d * x, y: x }));
    const moved = v.dA !== 0 || v.dC !== 0;
    const ceilOn = v.ceil < Math.round(base.P * 2);
    const curves = [
      ...(moved ? [{ id: 'D0', points: dem(a), ghost: true, color: 'blue' }, { id: 'S0', points: sup(c), ghost: true, color: 'rust' }] : []),
      { id: 'D', label: 'D', points: dem(a1), color: 'blue' },
      { id: 'S', label: 'S', points: sup(c1), color: 'rust' },
    ];
    const readout = [
      { label: 'Равновесная цена', value: r1(eq.P) },
      { label: 'Равновесное количество', value: r1(eq.Q) },
    ];
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
      { id: 'pe', label: 'Ожидаемые цены Pᵉ', min: Math.round(p.P * 0.6 * 20) / 20, max: Math.round(p.P * 1.6 * 20) / 20, step: 0.05, def: p.P, fmt: (v) => r2(v) },
      { id: 'longrun', label: 'Длинный период: ожидания догоняют цены', button: true },
    ];
  },
  // «длинный период»: Pᵉ = цене, при которой AD пересекает потенциал
  onButton: (A, v) => {
    const p = islmParams(A); const ybar = num(A, 'ybar', islmEquilibrium(p).Y);
    let lo = 0.05; let hi = 50;
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (adOutput(p, v.M, mid) > ybar) lo = mid; else hi = mid; }
    return { ...v, pe: Math.round(((lo + hi) / 2) * 100) / 100 };
  },
  build: (A, v) => {
    const p = islmParams(A);
    const ybar = num(A, 'ybar', islmEquilibrium(p).Y); const s = num(A, 's', 1);
    const eq = adasEquilibrium(p, v.M, v.pe, ybar, s);
    const Pmax = p.P * 2.4; const Ymin = ybar * 0.6; const Ymax = ybar * 1.4;
    const AD = (M) => Array.from({ length: 40 }, (_, i) => { const P = 0.35 * p.P + (Pmax - 0.35 * p.P) * i / 39; return { x: adOutput(p, M, P), y: P }; })
      .filter((pt) => pt.x >= Ymin && pt.x <= Ymax);
    const SRAS = (pe) => line((Y) => pe * (1 + (s * (Y - ybar)) / ybar), Ymin, Ymax).map((pt) => ({ ...pt, y: clampV(pt.y, 0, Pmax) }));
    const moved = v.M !== p.M || Math.abs(v.pe - p.P) > 1e-9;
    return {
      xDomain: [Ymin, Ymax], yDomain: [0, Pmax], xLabel: 'Y', yLabel: 'P',
      curves: [
        ...(moved ? [{ id: 'AD0', points: AD(p.M), ghost: true, color: 'blue' }, { id: 'SRAS0', points: SRAS(p.P), ghost: true, color: 'rust' }] : []),
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

export const CHARTS = { 'supply-demand': supplyDemand, elasticity, 'is-lm': isLm, 'ad-as': adAs };
export const chartDefaults = (type, attrs) => Object.fromEntries(CHARTS[type].controls(attrs).filter((c) => !c.button).map((c) => [c.id, c.def]));
