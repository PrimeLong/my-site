// «Почему казино всегда в плюсе»: матожидание, сходимость среднего, доля гостей в плюсе
import { describe, it, expect } from 'vitest';
import { GAMES, SCALES, expectedValue, simulateGuest, convergence, shareAhead, scaleRow } from '../casino-odds.js';
import { seeded } from '../../textbook/variants.js';

describe('казино: закон больших чисел вместо ставок', () => {
  it('матожидание отрицательное: рулетка −1/37, бинарный опцион −7,5%', () => {
    expect(expectedValue(GAMES.roulette)).toBeCloseTo(-1 / 37, 12);
    expect(expectedValue(GAMES.binary)).toBeCloseTo(-0.075, 12);
    expect(SCALES).toEqual([10, 100, 1000]);
  });
  it('среднее на ставку прижимается к матожиданию: на 1000 ставках разброс у гостей меньше, чем на 10', () => {
    const g = GAMES.roulette;
    const ev = expectedValue(g);
    const spread = (n) => {
      const xs = Array.from({ length: 300 }, (_, i) => simulateGuest(g, n, seeded(i + 1)).total / n);
      const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
      return { mean, sd: Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length) };
    };
    const s10 = spread(10); const s1000 = spread(1000);
    expect(s1000.sd).toBeLessThan(s10.sd / 5);
    expect(Math.abs(s1000.mean - ev)).toBeLessThan(0.01);
  });
  it('доля гостей в плюсе падает с числом ставок; у казино в среднем остаётся n·|EV|', () => {
    Object.values(GAMES).forEach((g) => {
      const rows = SCALES.map((n) => scaleRow(g, n));
      // 10 и 100 ставок — почти поровну (на 10 ставках «при своих» не считается плюсом), к 1000 доля тает
      expect(rows[2].ahead).toBeLessThan(rows[0].ahead * 0.6);
      expect(rows[2].ahead).toBeLessThan(rows[1].ahead * 0.6);
      rows.forEach((r) => expect(r.house).toBeCloseTo(-expectedValue(g) * r.n, 9));
    });
    // на 1000 ставках на красное в плюсе меньше пятой части гостей, на бинарных опционах — почти никого
    expect(shareAhead(GAMES.roulette, 1000)).toBeLessThan(0.2);
    expect(shareAhead(GAMES.binary, 1000)).toBeLessThan(0.01);
    // честная монетка без комиссии: ровно половина в плюсе на нечётном числе бросков
    expect(shareAhead({ p: 0.5, win: 1, lose: -1 }, 11)).toBeCloseTo(0.5, 9);
  });
  it('график детерминирован и заканчивается на последней ставке', () => {
    const a = convergence(GAMES.roulette, 1000, 5, 3);
    expect(a).toEqual(convergence(GAMES.roulette, 1000, 5, 3));
    expect(a[0].k).toBe(1); expect(a[a.length - 1].k).toBe(1000);
    expect(a.length).toBeLessThanOrEqual(100);
    expect(Object.keys(a[0])).toEqual(['k', 'g0', 'g1', 'g2', 'g3', 'g4']);
  });
});
