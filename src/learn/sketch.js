/* ЧЕРНОВИК НА ПОЛЯХ УРОКА (docs/mechanics.md, «Урок на ПК»). На ПК по бокам колонки урока остаются
   пустые поля. Кнопка «Черновик» внизу слева включает режим: на полях проступает сетка точек, и,
   зажав мышь, можно писать заметки и формулы — ручкой, маркером, стирать ластиком. Выключен —
   обычный курсор, поля не рисуют. Черновик живёт, пока открыт урок.
   Здесь — геометрия без DOM: инструменты, нажим ручки, сглаживание линии, список штрихов. */
export const SKETCH = { step: 1.5, maxPoints: 4000, maxStrokes: 600 };
// толщина в пикселях по инструменту и размеру; маркер полупрозрачный (на тёмной бумаге — плотнее)
export const SKETCH_TOOLS = {
  pen: { label: 'Ручка', sizes: { s: 2, m: 3.5, l: 6 } },
  marker: { label: 'Маркер', sizes: { s: 12, m: 18, l: 26 }, alpha: 0.32, dark: 0.5 },
  eraser: { label: 'Ластик', sizes: { s: 16, m: 30, l: 48 } },
};
export const SKETCH_SIZES = [{ id: 's', label: 'Тонко' }, { id: 'm', label: 'Средне' }, { id: 'l', label: 'Толсто' }];
// цвета — переменные темы урока: в тёмной теме чернила светлые, остальные мягче
export const SKETCH_COLORS = [
  { id: 'ink', label: 'Чернила', css: '--ds-ink' },
  { id: 'unit', label: 'Цвет юнита', css: '--u' },
  { id: 'red', label: 'Красный', css: '--ds-bad' },
  { id: 'blue', label: 'Синий', css: '--ds-blue' },
  { id: 'gold', label: 'Золотой', css: '--ds-gold' },
];
export const strokeWidth = (tool, size) => SKETCH_TOOLS[tool].sizes[size] || SKETCH_TOOLS[tool].sizes.m;

/* x точки — от середины слоя урока: колонка урока стоит по центру, и когда окно меняет ширину,
   запись остаётся на том же месте возле колонки. */
export const toLocal = (x, y, width) => ({ x: x - width / 2, y });

/* Нажим ручки — по скорости, как у настоящего пера: медленно — линия полнее, быстро — тоньше.
   w — множитель толщины; он плавно догоняет цель, чтобы толщина не прыгала между соседними кусками. */
export const INK = { start: 0.85, min: 0.5, max: 1.2, slow: 0.32, follow: 0.35 };
export function inkWeight(prev, dist, dt) {
  const v = dist / Math.max(dt, 1);
  const target = Math.min(INK.max, Math.max(INK.min, INK.max - v * INK.slow));
  return prev + (target - prev) * INK.follow;
}

// новая точка штриха; почти совпавшая с прошлой не нужна — это дрожь руки и лишняя память
export function addPoint(stroke, p) {
  const pts = stroke.points;
  const last = pts[pts.length - 1];
  const dist = last ? Math.hypot(p.x - last.x, p.y - last.y) : 0;
  if (pts.length >= SKETCH.maxPoints || (last && dist < SKETCH.step)) return false;
  const t = p.t || 0;
  pts.push({ x: p.x, y: p.y, t, w: last ? inkWeight(last.w, dist, t - last.t) : INK.start });
  return true;
}

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const weight = (p) => (p.w == null ? 1 : p.w);
/* Сглаживание: линия идёт через середины соседних отрезков, а сами точки служат опорными
   (квадратичные кривые Безье) — так ломаная из точек мыши становится ровной линией пера.
   Куски: «до середины первого отрезка», кривые между серединами, «от последней середины до
   конца»; у каждого — нажим w его опорной точки. Штрих из одной точки — круглая клякса. */
export function segmentsOf(points) {
  const n = points.length;
  if (!n) return [];
  const w = weight;
  if (n === 1) return [{ op: 'dot', x: points[0].x, y: points[0].y, w: w(points[0]) }];
  const out = [{ op: 'line', from: points[0], to: mid(points[0], points[1]), w: w(points[0]) }];
  for (let i = 1; i < n - 1; i += 1) out.push({ op: 'quad', from: mid(points[i - 1], points[i]), via: points[i], to: mid(points[i], points[i + 1]), w: w(points[i]) });
  out.push({ op: 'line', from: mid(points[n - 2], points[n - 1]), to: points[n - 1], w: w(points[n - 1]) });
  return out;
}
/* Ластик стирает на лету: после точки с номером k готов кусок, который кончается на середине
   отрезка (k − 1, k) — тот же, что при перерисовке всего штриха. Хвост дорисует конец штриха. */
export function pieceAt(points, k) {
  if (k === 0) return { op: 'dot', x: points[0].x, y: points[0].y, w: weight(points[0]) };
  if (k === 1) return { op: 'line', from: points[0], to: mid(points[0], points[1]), w: weight(points[0]) };
  return { op: 'quad', from: mid(points[k - 2], points[k - 1]), via: points[k - 1], to: mid(points[k - 1], points[k]), w: weight(points[k - 1]) };
}

// готовый штрих — в список; самые старые уходят, если черновик разросся сверх меры
export function pushStroke(list, stroke) {
  const next = [...list, stroke];
  return next.length > SKETCH.maxStrokes ? next.slice(next.length - SKETCH.maxStrokes) : next;
}
// «Стереть всё», а потом «Вернуть»: стёртое ложится под то, что успели нарисовать после
export const restoreStrokes = (cleared, list) => [...cleared, ...list];
