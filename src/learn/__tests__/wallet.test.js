// «Сбереги кошелёк»: реальный итог вариантов, годы с ясным решением, путь сбережений и зачёт
import { describe, it, expect } from 'vitest';
import { WALLET, WALLET_OPTIONS, FORECAST, WALLET_TYPES, realOf, nominalOf, bestOf, gapOf, walletYears, walletPath, walletResult, realPct } from '../wallet.js';
import { seeded } from '../../textbook/variants.js';

const ITEMS = ['high', 'mid', 'low'].flatMap((level) => [1, 2, 3, 4].map((n) => ({ key: `${level}${n}`, raw: `${level} ${n}`, text: [{ t: 'text', v: `${level} ${n}` }], level })));

describe('сбереги кошелёк: варианты', () => {
  it('наличные теряют рост цен, вклад — примерно ставка минус инфляция, запас — только порчу', () => {
    expect(realOf('cash', 10, 5)).toBeCloseTo(1 / 1.1);
    expect(realOf('deposit', 10, 5)).toBeCloseTo(1.05 / 1.1);
    expect(realOf('stock', 10, 5)).toBeCloseTo(0.97);
    expect(realPct('deposit', 6, 10)).toBe(3.8);
    // в кронах запас стоит по новым ценам за вычетом порчи, вклад — с процентами
    expect(nominalOf('stock', 10, 5)).toBeCloseTo(1.1 * 0.97);
    expect(nominalOf('deposit', 10, 5)).toBeCloseTo(1.05);
    expect(nominalOf('cash', 10, 5)).toBe(1);
  });
  it('наличные лучшими не бывают: при ставке от нуля вклад не хуже, при росте цен запас лучше', () => {
    for (let pi = 0; pi <= 25; pi += 1) for (let r = 0; r <= 25; r += 1) expect(realOf('cash', pi, r)).toBeLessThanOrEqual(realOf('deposit', pi, r));
    for (let pi = 4; pi <= 25; pi += 1) expect(realOf('cash', pi, 0)).toBeLessThan(realOf('stock', pi, 0));
  });
  it('ставка выше прогноза — вклад, инфляция заметно выше ставки — запас', () => {
    expect(bestOf(3, 7)).toBe('deposit');
    expect(bestOf(15, 6)).toBe('stock');
    expect(bestOf(14, 22)).toBe('deposit');
    expect(bestOf(8, 0)).toBe('stock');
  });
});

describe('сбереги кошелёк: годы', () => {
  it('в каждой игре пять лет: решение видно по прогнозу, лучший вариант опережает второй на 2 п. п.', () => {
    for (let s = 1; s <= 300; s += 1) {
      const ys = walletYears(ITEMS, seeded(s));
      expect(ys).toHaveLength(WALLET.years);
      ys.forEach((y) => {
        const [lo, hi] = FORECAST[y.level];
        expect(y.pi).toBeGreaterThanOrEqual(lo); expect(y.pi).toBeLessThanOrEqual(hi);
        expect(bestOf(y.pi, y.r)).toBe(y.best);
        expect(bestOf(lo, y.r)).toBe(y.best); expect(bestOf(hi, y.r)).toBe(y.best);
        expect(gapOf(y.pi, y.r)).toBeGreaterThanOrEqual(WALLET.margin - 1e-9);
      });
      // три года — вклад, два — запас; новости не повторяются и подходят по уровню
      expect(ys.filter((y) => y.best === 'deposit')).toHaveLength(3);
      expect(ys.filter((y) => y.best === 'stock')).toHaveLength(2);
      expect(new Set(ys.map((y) => y.key)).size).toBe(5);
      ys.forEach((y) => expect(y.key.startsWith(y.level)).toBe(true));
    }
  });
  it('шаблон «высокая инфляция — запас» не работает: в каждой игре есть год высокой инфляции, где лучше вклад', () => {
    for (let s = 1; s <= 50; s += 1) expect(walletYears(ITEMS, seeded(s)).some((y) => y.level === 'high' && y.best === 'deposit')).toBe(true);
  });
  it('один сид — одни и те же годы', () => {
    expect(walletYears(ITEMS, seeded(7))).toEqual(walletYears(ITEMS, seeded(7)));
  });
  it('у каждого типа года есть хотя бы один ясный год', () => {
    WALLET_TYPES.forEach((t) => expect(() => walletYears(ITEMS.filter((x) => x.level === t.level).concat(ITEMS), seeded(3))).not.toThrow());
  });
});

describe('сбереги кошелёк: путь и зачёт', () => {
  const ys = walletYears(ITEMS, seeded(11));
  it('старт — 10 000 крон и 100 чашек; всё время наличными — чашек меньше', () => {
    const cash = walletPath(ys, ys.map(() => 'cash'));
    expect(cash[0]).toEqual({ wallet: 10000, cup: 100, cups: 100 });
    expect(cash[5].wallet).toBe(10000);
    expect(cash[5].cups).toBeLessThan(80);
  });
  it('лучший выбор каждый год — зачёт и больше всего чашек', () => {
    const best = walletResult(ys, ys.map((y) => y.best));
    expect(best).toMatchObject({ right: 5, answered: 5, ok: true });
    WALLET_OPTIONS.forEach((o) => expect(best.cups).toBeGreaterThanOrEqual(walletResult(ys, ys.map(() => o)).cups));
  });
  it('зачёт — от четырёх лучших решений из пяти', () => {
    const four = ys.map((y, k) => (k === 0 ? 'cash' : y.best));
    expect(walletResult(ys, four)).toMatchObject({ right: 4, ok: true });
    const three = ys.map((y, k) => (k < 2 ? 'cash' : y.best));
    expect(walletResult(ys, three)).toMatchObject({ right: 3, ok: false });
    expect(walletResult(ys, ys.slice(0, 4).map((y) => y.best)).ok, 'не доиграна').toBe(false);
  });
});
