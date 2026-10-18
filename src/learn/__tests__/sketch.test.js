// Черновик на полях урока: точки штриха, сглаживание линии, кусок для рисования на лету, список штрихов
import { describe, it, expect } from 'vitest';
import { SKETCH, toLocal, addPoint, segmentsOf, pieceAt, pushStroke, restoreStrokes } from '../sketch.js';

const stroke = (pts) => ({ tool: 'pen', color: 'ink', size: SKETCH.pen, points: pts.map(([x, y]) => ({ x, y })) });

describe('черновик: точки', () => {
  it('x — от середины слоя урока: при смене ширины окна запись остаётся у колонки', () => {
    expect(toLocal(100, 40, 1440)).toEqual({ x: -620, y: 40 });
    expect(toLocal(720, 0, 1440)).toEqual({ x: 0, y: 0 });
  });
  it('почти совпавшая с прошлой точка не нужна; у штриха есть предел точек', () => {
    const s = stroke([]);
    expect(addPoint(s, { x: 0, y: 0 })).toBe(true);
    expect(addPoint(s, { x: 1, y: 0.5 })).toBe(false);
    expect(addPoint(s, { x: 3, y: 0 })).toBe(true);
    expect(s.points).toHaveLength(2);
    const long = stroke([]);
    for (let i = 0; i < SKETCH.maxPoints + 50; i += 1) addPoint(long, { x: i * 2, y: 0 });
    expect(long.points).toHaveLength(SKETCH.maxPoints);
  });
});

describe('черновик: сглаживание', () => {
  it('одна точка — клякса, пустой штрих — ничего', () => {
    expect(segmentsOf([])).toEqual([]);
    expect(segmentsOf([{ x: 5, y: 6 }])).toEqual([{ op: 'dot', x: 5, y: 6 }]);
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
  it('две точки — прямая через середину', () => {
    expect(segmentsOf([{ x: 0, y: 0 }, { x: 10, y: 0 }])).toEqual([
      { op: 'line', from: { x: 0, y: 0 }, to: { x: 5, y: 0 } },
      { op: 'line', from: { x: 5, y: 0 }, to: { x: 10, y: 0 } },
    ]);
  });
  it('на лету рисуются те же куски, что и при перерисовке всего штриха', () => {
    const pts = stroke([[0, 0], [8, 3], [15, 12], [22, 9], [31, 2], [40, 6]]).points;
    const segs = segmentsOf(pts);
    expect(pieceAt(pts, 0)).toEqual({ op: 'dot', x: 0, y: 0 });
    for (let k = 1; k < pts.length; k += 1) expect(pieceAt(pts, k)).toEqual(segs[k - 1]);
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
