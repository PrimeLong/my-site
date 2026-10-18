/* ЧЕРНОВИК НА ПОЛЯХ УРОКА (docs/mechanics.md, «Урок на ПК»). На ПК по бокам колонки урока остаются
   пустые поля: зажал мышь на поле — пишешь, как в Paint, заметки и формулы. Внизу появляется панель:
   кисть с тремя цветами, ластик и «Стереть всё». Черновик живёт, пока открыт урок.
   Здесь — геометрия без DOM: точки штриха, сглаживание линии, список штрихов. */
export const SKETCH = { pen: 3, eraser: 28, step: 1.5, maxPoints: 4000, maxStrokes: 600 };
// цвета кисти — переменные темы урока: чернила, цвет юнита и красный, в тёмной теме — свои
export const SKETCH_COLORS = [
  { id: 'ink', label: 'Чернила', css: '--ds-ink' },
  { id: 'unit', label: 'Цвет юнита', css: '--u' },
  { id: 'red', label: 'Красный', css: '--ds-bad' },
];

/* x точки — от середины слоя урока: колонка урока стоит по центру, и когда окно меняет ширину,
   запись остаётся на том же месте возле колонки. */
export const toLocal = (x, y, width) => ({ x: x - width / 2, y });

// новая точка штриха; почти совпавшая с прошлой не нужна — это дрожь руки и лишняя память
export function addPoint(stroke, p) {
  const pts = stroke.points;
  const last = pts[pts.length - 1];
  if (pts.length >= SKETCH.maxPoints || (last && Math.hypot(p.x - last.x, p.y - last.y) < SKETCH.step)) return false;
  pts.push(p);
  return true;
}

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
/* Сглаживание: линия идёт через середины соседних отрезков, а сами точки служат опорными
   (квадратичные кривые Безье) — так ломаная из точек мыши становится ровной линией пера.
   Куски: «до середины первого отрезка», кривые между серединами, «от последней середины до
   конца». Штрих из одной точки — круглая клякса. */
export function segmentsOf(points) {
  const n = points.length;
  if (!n) return [];
  if (n === 1) return [{ op: 'dot', x: points[0].x, y: points[0].y }];
  const out = [{ op: 'line', from: points[0], to: mid(points[0], points[1]) }];
  for (let i = 1; i < n - 1; i += 1) out.push({ op: 'quad', from: mid(points[i - 1], points[i]), via: points[i], to: mid(points[i], points[i + 1]) });
  out.push({ op: 'line', from: mid(points[n - 2], points[n - 1]), to: points[n - 1] });
  return out;
}
/* Пока штрих рисуется, на холст ложится только новый кусок: после точки с номером k готов кусок,
   который кончается на середине отрезка (k − 1, k). Хвост до последней точки дорисует конец штриха. */
export function pieceAt(points, k) {
  if (k === 0) return { op: 'dot', x: points[0].x, y: points[0].y };
  if (k === 1) return { op: 'line', from: points[0], to: mid(points[0], points[1]) };
  return { op: 'quad', from: mid(points[k - 2], points[k - 1]), via: points[k - 1], to: mid(points[k - 1], points[k]) };
}

// готовый штрих — в список; самые старые уходят, если черновик разросся сверх меры
export function pushStroke(list, stroke) {
  const next = [...list, stroke];
  return next.length > SKETCH.maxStrokes ? next.slice(next.length - SKETCH.maxStrokes) : next;
}
// «Стереть всё», а потом «Вернуть»: стёртое ложится под то, что успели нарисовать после
export const restoreStrokes = (cleared, list) => [...cleared, ...list];
