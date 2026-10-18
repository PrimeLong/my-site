// Черновик на полях урока: инструменты, нажим ручки, сглаживание линии, кусок для ластика на лету, список штрихов
import { describe, it, expect } from 'vitest';
import { SKETCH, SKETCH_TOOLS, SKETCH_COLORS, INK, strokeWidth, toLocal, inkWeight, addPoint, segmentsOf, pieceAt, pushStroke, restoreStrokes } from '../sketch.js';

const stroke = (pts, tool = 'pen') => ({ tool, color: 'ink', size: 'm', points: pts.map(([x, y]) => ({ x, y })) });

describe('черновик: инструменты', () => {
  it('у каждого инструмента три толщины по возрастанию; маркер полупрозрачный, на тёмной бумаге — плотнее', () => {
    for (const tool of Object.keys(SKETCH_TOOLS)) {
      const { s, m, l } = SKETCH_TOOLS[tool].sizes;
      expect(s).toBeLessThan(m); expect(m).toBeLessThan(l);
      expect(strokeWidth(tool, 'm')).toBe(m);
    }
    expect(strokeWidth('pen', 'нет такого')).toBe(SKETCH_TOOLS.pen.sizes.m);
    expect(SKETCH_TOOLS.marker.alpha).toBeLessThan(SKETCH_TOOLS.marker.dark);
    expect(SKETCH_TOOLS.marker.dark).toBeLessThan(1);
    expect(strokeWidth('pen', 'l')).toBeLessThan(strokeWidth('marker', 's'));
  });
  it('цвета — переменные темы урока, без повторов', () => {
    expect(new Set(SKETCH_COLORS.map((c) => c.id)).size).toBe(SKETCH_COLORS.length);
    SKETCH_COLORS.forEach((c) => expect(c.css).toMatch(/^--/));
  });
});

describe('черновик: точки и нажим', () => {
  it('x — от середины слоя урока: при смене ширины окна запись остаётся у колонки', () => {
    expect(toLocal(100, 40, 1440)).toEqual({ x: -620, y: 40 });
    expect(toLocal(720, 0, 1440)).toEqual({ x: 0, y: 0 });
  });
  it('медленно — линия полнее, быстро — тоньше; толщина в пределах и меняется плавно', () => {
    let slow = INK.start; let fast = INK.start;
    for (let i = 0; i < 30; i += 1) { slow = inkWeight(slow, 2, 16); fast = inkWeight(fast, 60, 16); }
    expect(slow).toBeGreaterThan(1.1);
    expect(fast).toBeLessThan(0.55);
    expect(fast).toBeGreaterThanOrEqual(INK.min);
    expect(slow).toBeLessThanOrEqual(INK.max);
    // один резкий рывок не роняет толщину сразу до минимума
    expect(inkWeight(1, 200, 16)).toBeGreaterThan(0.8);
    // время не идёт (одно событие) — без деления на ноль
    expect(Number.isFinite(inkWeight(1, 5, 0))).toBe(true);
  });
  it('почти совпавшая с прошлой точка не нужна; у штриха есть предел точек; нажим считается по ходу', () => {
    const s = stroke([]);
    expect(addPoint(s, { x: 0, y: 0, t: 0 })).toBe(true);
    expect(addPoint(s, { x: 1, y: 0.5, t: 8 })).toBe(false);
    expect(addPoint(s, { x: 3, y: 0, t: 16 })).toBe(true);
    expect(s.points).toHaveLength(2);
    expect(s.points[0].w).toBe(INK.start);
    expect(s.points[1].w).toBeCloseTo(inkWeight(INK.start, 3, 16));
    const long = stroke([]);
    for (let i = 0; i < SKETCH.maxPoints + 50; i += 1) addPoint(long, { x: i * 2, y: 0, t: i * 8 });
    expect(long.points).toHaveLength(SKETCH.maxPoints);
  });
});

describe('черновик: сглаживание', () => {
  it('одна точка — клякса, пустой штрих — ничего', () => {
    expect(segmentsOf([])).toEqual([]);
    expect(segmentsOf([{ x: 5, y: 6 }])).toEqual([{ op: 'dot', x: 5, y: 6, w: 1 }]);
  });
  it('линия непрерывна: от первой точки до последней, кривые — между серединами отрезков', () => {
    const pts = stroke([[0, 0], [10, 0], [20, 10], [30, 10], [40, 0]]).points;
    const segs = segmentsOf(pts);
    expect(segs).toHaveLength(pts.length);
    expect(segs[0].from).toEqual(pts[0]);
    expect(segs[segs.length - 1].to).toEqual(pts[pts.length - 1]);
    for (let i = 1; i < segs.length; i += 1) expect(segs[i].from).toEqual(segs[i - 1].to);
    // опорные точки кривых — сами точки мыши
    expect(segs.filter((s) => s.op === 'quad').map((s) => s.via)).toEqual(pts.slice(1, -1));
  });
  it('у куска — нажим его опорной точки', () => {
    const pts = [{ x: 0, y: 0, w: 0.6 }, { x: 10, y: 0, w: 0.9 }, { x: 20, y: 0, w: 1.1 }];
    expect(segmentsOf(pts).map((s) => s.w)).toEqual([0.6, 0.9, 1.1]);
  });
  it('ластик на лету стирает те же куски, что и при перерисовке всего штриха', () => {
    const s = stroke([]);
    [[0, 0], [8, 3], [15, 12], [22, 9], [31, 2], [40, 6]].forEach(([x, y], i) => addPoint(s, { x, y, t: i * 16 }));
    const segs = segmentsOf(s.points);
    expect(pieceAt(s.points, 0)).toEqual({ op: 'dot', x: 0, y: 0, w: INK.start });
    for (let k = 1; k < s.points.length; k += 1) expect(pieceAt(s.points, k)).toEqual(segs[k - 1]);
  });
});

describe('черновик: штрихи', () => {
  it('разросся сверх меры — уходят самые старые', () => {
    let list = [];
    for (let i = 0; i < SKETCH.maxStrokes + 3; i += 1) list = pushStroke(list, { id: i });
    expect(list).toHaveLength(SKETCH.maxStrokes);
    expect(list[0].id).toBe(3);
    expect(list[list.length - 1].id).toBe(SKETCH.maxStrokes + 2);
  });
  it('«Вернуть» кладёт стёртое под то, что нарисовали после', () => {
    expect(restoreStrokes([{ id: 1 }, { id: 2 }], [{ id: 3 }]).map((s) => s.id)).toEqual([1, 2, 3]);
  });
});
