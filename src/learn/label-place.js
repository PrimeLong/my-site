/* РАССТАНОВКА ПОДПИСЕЙ на графике «Разбора графика» (src/learn-graph.jsx). Раньше подпись точки всегда
   стояла справа сверху от неё, а подпись кривой — у её конца, и они налезали друг на друга и на
   соседние линии (жалоба «на графиках текст накладывается на другой»). Теперь каждая подпись пробует
   несколько мест — вокруг точки или вдоль кривой — и берёт то, где меньше всего задевает уже
   поставленные подписи, точки и линии и не выходит за поле. Размер текста оценивается по числу знаков:
   браузер для этого не нужен, поэтому модуль чистый и проверяется тестами. */

// прямоугольник текста: x, y — точка привязки (базовая линия), anchor — start | middle | end
export function textBox(text, x, y, size, anchor = 'start') {
  const w = String(text).length * size * 0.56 + 3;
  const x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  // строка с запасом на выносные элементы: браузер считает её выше самих букв
  return { x0, x1: x0 + w, y0: y - size, y1: y + size * 0.3 };
}
export const boxOverlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
export const dotBox = (x, y, r) => ({ x0: x - r, x1: x + r, y0: y - r, y1: y + r });

// места вокруг точки (cx, cy): справа сверху, слева сверху, справа снизу, слева снизу, над, под
export const aroundPoint = (cx, cy, d = 9) => [
  { x: cx + d, y: cy - d, anchor: 'start' }, { x: cx - d, y: cy - d, anchor: 'end' },
  { x: cx + d, y: cy + d + 10, anchor: 'start' }, { x: cx - d, y: cy + d + 10, anchor: 'end' },
  { x: cx, y: cy - d - 5, anchor: 'middle' }, { x: cx, y: cy + d + 15, anchor: 'middle' },
];

/* items — подписи по важности: { id, text, size, cands: [{ x, y, anchor }] } (первое место — желанное).
   fixed — то, что не двигается и что нельзя закрывать (другие тексты, точки); lines — образцы линий
   (маленькие квадраты вдоль кривых): задевать их можно, но дороже, чем стоять на желанном месте.
   Ответ — { id: { x, y, anchor } }. */
export function placeLabels(items, { fixed = [], lines = [], bounds = null } = {}) {
  const taken = [...fixed];
  const out = {};
  items.forEach((it) => {
    let best = null;
    it.cands.forEach((c, i) => {
      const b = textBox(it.text, c.x, c.y, it.size, c.anchor);
      let score = i * 4;
      taken.forEach((t) => { score += boxOverlap(b, t) * 40; });
      lines.forEach((t) => { score += boxOverlap(b, t) * 3; });
      if (bounds) score += 300 * (Math.max(0, bounds.x0 - b.x0) + Math.max(0, b.x1 - bounds.x1) + Math.max(0, bounds.y0 - b.y0) + Math.max(0, b.y1 - bounds.y1));
      if (!best || score < best.score) best = { x: c.x, y: c.y, anchor: c.anchor, score, box: b };
    });
    if (!best) return;
    out[it.id] = { x: best.x, y: best.y, anchor: best.anchor };
    taken.push(best.box);
  });
  return out;
}

// подписи делений, которые налезают на важное (название оси, значение у пунктира), не показываем
export const freeTicks = (ticks, important) => ticks.filter((t) => !important.some((b) => boxOverlap(t.box, b) > 0));
