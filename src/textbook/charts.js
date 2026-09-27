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

// что показывает график числами — по этим величинам проверяются графические задачи
supplyDemand.measure = (A, v) => {
  const e = sdEquilibrium(num(A, 'a', 100) + (v.dA || 0), num(A, 'b', 2), num(A, 'c', -20) + (v.dC || 0), num(A, 'd', 4));
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
  const p = islmParams(A); const ybar = num(A, 'ybar', islmEquilibrium(p).Y);
  const e = adasEquilibrium(p, v.M, v.pe, ybar, num(A, 's', 1));
  return { Y: e.Y, P: e.P };
};

// как называть величины графика в ответе графической задачи
supplyDemand.measureNames = { P: 'цена', Q: 'количество' };
elasticity.measureNames = { P: 'цена', Q: 'количество', R: 'выручка', E: 'эластичность' };
isLm.measureNames = { Y: 'выпуск', r: 'ставка' };
adAs.measureNames = { Y: 'выпуск', P: 'уровень цен' };
costs.measureNames = { avcMin: 'минимум AVC', atcMin: 'минимум ATC', qEff: 'выпуск при минимуме ATC', Q: 'выпуск', profit: 'прибыль' };
monopolyChart.measureNames = { P: 'цена', Q: 'выпуск', profit: 'прибыль', dwl: 'безвозвратные потери' };
cournotChart.measureNames = { q1: 'выпуск фирмы 1', q2: 'выпуск фирмы 2', P: 'цена', pi1: 'прибыль фирмы 1', pi2: 'прибыль фирмы 2' };

export const CHARTS = { 'supply-demand': supplyDemand, elasticity, 'is-lm': isLm, 'ad-as': adAs, costs, monopoly: monopolyChart, cournot: cournotChart };
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
