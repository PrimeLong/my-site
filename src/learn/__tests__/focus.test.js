// Уголок для фокуса: открывается с середины первого юнита; шарик, маятники и тетрис, который играет сам
import { describe, it, expect } from 'vitest';
import {
  FOCUS, focusUnlocked, RING, newBall, stepBall, gapAt, PEND, pendulumAngle, pendulumAlign,
  TET, PIECES, shapeCells, emptyBoard, fits, spawn, shift, turn, fall, lock, clearLines, bag, bestMove,
} from '../focus.js';
import { emptyLearn } from '../../textbook/learn-state.js';

// детерминированный генератор: тесты повторяются один в один
const seeded = (s = 7) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
const withLessons = (n) => ({ ...emptyLearn(), lessons: Object.fromEntries(Array.from({ length: n }, (_, i) => [`l${i}`, { runs: 1, at: 1, best: 80 }])) });

describe('уголок для фокуса: когда открывается', () => {
  it('после четырёх пройденных уроков — не раньше', () => {
    expect(focusUnlocked(emptyLearn())).toBe(false);
    expect(focusUnlocked(withLessons(FOCUS.unlock - 1))).toBe(false);
    expect(focusUnlocked(withLessons(FOCUS.unlock))).toBe(true);
    expect(focusUnlocked(null)).toBe(false);
  });
  it('урок без прохождений не считается', () => {
    const s = withLessons(3);
    expect(focusUnlocked({ ...s, lessons: { ...s.lessons, x: { runs: 0 } } })).toBe(false);
  });
});

describe('шарик в кольце', () => {
  it('отскок без потерь: шарик не выходит за стенку, пока не попадёт в прорезь', () => {
    const rand = seeded(3);
    let b = newBall(rand);
    for (let i = 0; i < 60 * 30 && !b.out; i += 1) {
      b = stepBall(b, 1 / 60, rand);
      if (!b.out) expect(Math.hypot(b.x, b.y)).toBeLessThanOrEqual(RING.r - b.r + 1e-6);
    }
    expect(b.k).toBeGreaterThan(3);
    expect(b.hits.length).toBe(Math.min(b.k, RING.hits));
  });
  it('с каждым ударом шарик растёт, прорезь шире — и рано или поздно он вылетает', () => {
    const rand = seeded(11);
    let b = newBall(rand);
    let t = 0;
    while (!b.out && t < 600) { b = stepBall(b, 1 / 60, rand); t += 1 / 60; }
    expect(b.out).toBe(true);
    expect(b.r).toBeGreaterThan(RING.r0);
    expect(b.r).toBeLessThanOrEqual(RING.rMax);
    expect(b.gap).toBeGreaterThan(RING.gap);
  });
  it('прорезь вращается с постоянной скоростью', () => {
    const d = gapAt(1) - gapAt(0);
    expect(d).toBeCloseTo(RING.spin, 6);
  });
});

describe('маятниковая волна', () => {
  it('в начале и через цикл все маятники в одну линию', () => {
    const at = (t) => Array.from({ length: PEND.n }, (_, i) => pendulumAngle(i, t));
    at(0).forEach((a) => expect(a).toBeCloseTo(PEND.amp, 6));
    at(PEND.cycle).forEach((a) => expect(a).toBeCloseTo(PEND.amp, 6));
    // посередине цикла — разошлись: соседние маятники в противофазе
    const mid = at(PEND.cycle / 2);
    expect(Math.sign(mid[0])).not.toBe(Math.sign(mid[1]));
  });
  it('отсчёт до линии: от целого цикла до нуля, потом снова', () => {
    expect(pendulumAlign(0)).toBe(PEND.cycle);
    expect(pendulumAlign(PEND.cycle - 5)).toBeCloseTo(5, 6);
    expect(pendulumAlign(PEND.cycle + 10)).toBeCloseTo(PEND.cycle - 10, 6);
  });
});

describe('тетрис сам с собой', () => {
  it('у каждой фигуры четыре клетки, четыре поворота возвращают в начало', () => {
    PIECES.forEach((t) => {
      expect(shapeCells(t, 0)).toHaveLength(4);
      expect(shapeCells(t, 4)).toEqual(shapeCells(t, 0));
    });
  });
  it('мешок: каждая из семи фигур — ровно один раз', () => {
    expect(bag(seeded()).slice().sort()).toEqual(PIECES.slice().sort());
  });
  it('стенки и пол: фигура не выходит за поле; поворот у стены отскакивает', () => {
    const b = emptyBoard();
    let p = spawn('T');
    for (let i = 0; i < 20; i += 1) p = shift(b, p, -1);
    expect(fits(b, p)).toBe(true);
    expect(Math.min(...shapeCells(p.type, p.rot).map(([x]) => p.x + x))).toBe(0);
    let i = spawn('I');
    i = turn(b, i);
    for (let k = 0; k < 20; k += 1) i = shift(b, i, 1);
    expect(fits(b, turn(b, i))).toBe(true);
    const down = fall(b, spawn('O'));
    expect(Math.max(...shapeCells('O', 0).map(([, y]) => down.y + y))).toBe(TET.h - 1);
  });
  it('полная строка сгорает, всё выше опускается', () => {
    let b = emptyBoard();
    b[TET.h - 1] = Array(TET.w).fill(1);
    b[TET.h - 2][0] = 2;
    const { board, rows } = clearLines(b);
    expect(rows).toEqual([TET.h - 1]);
    expect(board[TET.h - 1][0]).toBe(2);
    expect(board[TET.h - 1].filter(Boolean)).toHaveLength(1);
    b = lock(emptyBoard(), fall(emptyBoard(), spawn('I')));
    expect(b[TET.h - 1].filter(Boolean)).toHaveLength(4);
  });
  it('бот играет долго, жжёт линии и держит стопку низкой', () => {
    const rand = seeded(5);
    let board = emptyBoard();
    let queue = [];
    let lines = 0; let tops = 0;
    for (let n = 0; n < 300; n += 1) {
      if (!queue.length) queue = bag(rand);
      const type = queue.shift();
      const m = bestMove(board, type);
      if (!m || !fits(board, spawn(type))) { tops += 1; board = emptyBoard(); continue; }
      const p = fall(board, { ...spawn(type), rot: m.rot, x: m.x });
      const res = clearLines(lock(board, p));
      board = res.board; lines += res.rows.length;
    }
    expect(tops).toBe(0);
    expect(lines).toBeGreaterThan(100);
    const height = TET.h - board.findIndex((r) => r.some(Boolean));
    expect(height).toBeLessThan(10);
  });
});
