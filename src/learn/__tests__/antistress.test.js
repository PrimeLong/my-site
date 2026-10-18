// Антистресс: открывается с середины первого юнита; шарик, кольца, маятники, песок, тетрис и змейка
import { describe, it, expect } from 'vitest';
import {
  ANTISTRESS, antistressUnlocked, RING, RINGS, newRings, stepRings, ringsGap, SAND, stepSand, drainSand,
  SNAKE, SNAKE_DIRS, newSnake, snakeMove, snakeBot, snakeWon, BATTLE, newBattle, stepBattle, battleShare, swordTip, newBall, stepBall, gapAt, PEND, pendulumAngle, pendulumAlign,
  TET, PIECES, shapeCells, emptyBoard, fits, spawn, shift, turn, fall, lock, clearLines, bag, bestMove,
} from '../antistress.js';
import { emptyLearn } from '../../textbook/learn-state.js';

// детерминированный генератор: тесты повторяются один в один
const seeded = (s = 7) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
const withLessons = (n) => ({ ...emptyLearn(), lessons: Object.fromEntries(Array.from({ length: n }, (_, i) => [`l${i}`, { runs: 1, at: 1, best: 80 }])) });

describe('антистресс: когда открывается', () => {
  it('после четырёх пройденных уроков — не раньше', () => {
    expect(antistressUnlocked(emptyLearn())).toBe(false);
    expect(antistressUnlocked(withLessons(ANTISTRESS.unlock - 1))).toBe(false);
    expect(antistressUnlocked(withLessons(ANTISTRESS.unlock))).toBe(true);
    expect(antistressUnlocked(null)).toBe(false);
  });
  it('урок без прохождений не считается', () => {
    const s = withLessons(3);
    expect(antistressUnlocked({ ...s, lessons: { ...s.lessons, x: { runs: 0 } } })).toBe(false);
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

describe('сквозь кольца', () => {
  it('шарик внутри своего кольца; кольца разбиваются по одному, изнутри наружу, и рано или поздно все', () => {
    const rand = seeded(4);
    let s = newRings(rand);
    const broke = [];
    for (let t = 0; t < 240 && s.cur < RINGS.n; t += 1 / 240) {
      const r = stepRings(s, 1 / 240, rand);
      s = r.s;
      if (r.broke >= 0) broke.push(r.broke);
      else if (s.cur < RINGS.n) expect(Math.hypot(s.x, s.y)).toBeLessThanOrEqual(s.rings[s.cur].r - RINGS.r + 1e-6);
    }
    expect(broke).toEqual(Array.from({ length: RINGS.n }, (_, i) => i));
    expect(s.hits).toBeGreaterThan(RINGS.n);
  });
  it('соседние кольца крутятся в разные стороны, внешние — чуть быстрее', () => {
    const { rings } = newRings(seeded(2));
    rings.slice(1).forEach((r, i) => {
      expect(Math.sign(r.w)).toBe(-Math.sign(rings[i].w));
      expect(Math.abs(r.w)).toBeGreaterThan(Math.abs(rings[i].w));
      expect(r.r).toBeGreaterThan(rings[i].r);
    });
    const r = rings[0];
    expect(ringsGap({ ...r, phase: 0 }, 1)).toBeCloseTo(r.w, 6);
  });
});

describe('песок', () => {
  const pour = (g, n, rand) => { for (let t = 0; t < n; t += 1) { g[SAND.w / 2 + (t % 5)] = 3; stepSand(g, SAND.w, SAND.h, rand); } };
  const count = (g) => g.reduce((a, v) => a + (v ? 1 : 0), 0);
  it('песчинки не пропадают и не висят в воздухе', () => {
    const rand = seeded(9);
    const g = new Uint16Array(SAND.w * SAND.h);
    pour(g, 800, rand);
    for (let t = 0; t < 400; t += 1) stepSand(g, SAND.w, SAND.h, rand);
    expect(count(g)).toBe(800);
    for (let y = 0; y < SAND.h - 1; y += 1) for (let x = 0; x < SAND.w; x += 1) if (g[y * SAND.w + x]) expect(g[(y + 1) * SAND.w + x]).not.toBe(0);
  });
  it('горка расползается вширь, а не растёт столбом', () => {
    const rand = seeded(5);
    const g = new Uint16Array(SAND.w * SAND.h);
    pour(g, 900, rand);
    for (let t = 0; t < 300; t += 1) stepSand(g, SAND.w, SAND.h, rand);
    const bottom = Array.from({ length: SAND.w }, (_, x) => g[(SAND.h - 1) * SAND.w + x]).filter(Boolean).length;
    expect(bottom).toBeGreaterThan(40);
  });
  it('дырка в дне выпускает песок, пока он не кончится', () => {
    const rand = seeded(6);
    const g = new Uint16Array(SAND.w * SAND.h);
    pour(g, 600, rand);
    let out = 0;
    for (let t = 0; t < 3000 && count(g); t += 1) { out += drainSand(g, SAND.w, SAND.h); stepSand(g, SAND.w, SAND.h, rand); }
    expect(out).toBe(600);
    expect(count(g)).toBe(0);
  });
});

describe('змейка', () => {
  it('ест — растёт; в стену — конец; назад развернуться нельзя', () => {
    const rand = seeded(1);
    let s = { ...newSnake(rand), food: [6, 8] };
    s = snakeMove(s, SNAKE_DIRS.right, rand);
    expect(s.body).toHaveLength(4);
    expect(s.eaten).toBe(1);
    expect(s.food).not.toEqual([6, 8]);
    const back = snakeMove(s, SNAKE_DIRS.left, rand);
    expect(back.dir).toEqual(SNAKE_DIRS.right);
    let w = s;
    for (let k = 0; k < SNAKE.w && !w.dead; k += 1) w = snakeMove({ ...w, food: [0, 0] }, SNAKE_DIRS.right, rand);
    expect(w.dead).toBe(true);
  });
  it('бот не врезается и дорастает до победы', () => {
    const rand = seeded(3);
    let s = newSnake(rand);
    let steps = 0;
    while (!s.dead && !snakeWon(s) && steps < 20000) { s = snakeMove(s, snakeBot(s), rand); steps += 1; }
    expect(s.dead).toBe(false);
    expect(s.body.length).toBeGreaterThanOrEqual(SNAKE.win);
  });
});

describe('битва цветов', () => {
  it('начало: четыре равные четверти, по два бойца у каждого цвета', () => {
    const s = newBattle(seeded(1));
    battleShare(s).forEach((v) => expect(v).toBeCloseTo(0.25, 6));
    expect(s.fighters.map((f) => f.team).sort()).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });
  it('меч красит клетки в цвет бойца; задетый мечом переходит на сторону владельца', () => {
    const rand = seeded(2);
    const s = newBattle(rand);
    const [f, g] = [s.fighters[0], s.fighters[2]];
    // меч смотрит вправо; чужая клетка под клинком — после шага она цвета бойца
    f.x = 62; f.y = 42; f.a = 0; f.w = 0;
    const [tx, ty] = swordTip(f);
    expect([tx, ty]).toEqual([62 + BATTLE.sword, 42]);
    const under = Math.floor(42 / BATTLE.cell) * BATTLE.cols + Math.floor(66 / BATTLE.cell);
    s.cells[under] = 3;
    // чужой боец у острия, его меч смотрит в другую сторону
    g.x = f.x + BATTLE.sword - 2; g.y = f.y; g.a = 0; g.w = 0; g.safe = 0;
    const { turned } = stepBattle(s, 1 / 240, rand);
    expect(s.cells[under]).toBe(f.team);
    expect(turned).toContain(g);
    expect(g.team).toBe(f.team);
  });
  it('битва кончается победой одного цвета — не позже чем через 2,5 минуты', () => {
    const rand = seeded(5);
    const s = newBattle(rand);
    while (s.winner < 0 && s.t < BATTLE.limit + 1) {
      stepBattle(s, 1 / 60, rand);
      expect(s.cells.every((c) => c < BATTLE.teams)).toBe(true);
    }
    expect(s.winner).toBeGreaterThanOrEqual(0);
    expect(s.turns).toBeGreaterThan(0);
    expect(s.fighters.length).toBeGreaterThan(BATTLE.teams * BATTLE.start);
  });
});
