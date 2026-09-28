import { describe, it, expect } from 'vitest';
import { makePrehistory } from '../autopilot.js';
import { drillPrehistory } from '../drills.js';
import { withSeededRandom, hashSeed } from '../catalog.js';
import { makeInitialEconomy } from '../engine.js';

// вызов дня: до первого хода игрока видно, куда шла страна, — и у всех одинаково
describe('вызов дня: предыстория', () => {
  it('обычный старт: предыстория по зерну дня одна и та же у всех игроков', () => {
    const make = () => withSeededRandom(hashSeed('2026-09-28:pre'), () => makePrehistory({ difficulty: 'medium' }));
    const a = make(); const b = make();
    expect(a.prehistory.length).toBeGreaterThanOrEqual(8);
    expect(a.prehistory.map((r) => r.gdp)).toEqual(b.prehistory.map((r) => r.gdp));
    expect(a.economy.inflation).toBe(b.economy.inflation);
    expect(a.news.length).toBeGreaterThan(0);
  });
  it('кризисный сценарий: вводный отрезок ведёт к той же стартовой точке', () => {
    const rows = drillPrehistory({ scenario: 'currency_crisis' });
    const start = makeInitialEconomy('currency_crisis');
    expect(rows.length).toBe(8);
    const last = rows[rows.length - 1];
    // последний квартал вводного отрезка уже близок к старту сценария
    expect(Math.abs(last.exchangeRate - start.exchangeRate)).toBeLessThan(Math.abs(rows[0].exchangeRate - start.exchangeRate) + 1e-9);
  });
});
