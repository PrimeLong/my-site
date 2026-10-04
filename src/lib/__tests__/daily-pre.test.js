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
  it('кризисный сценарий: кварталы вводного отрезка настоящие — ВВП растёт, линии не прямые, у всех одинаково', () => {
    const make = () => withSeededRandom(hashSeed('2026-10-04:lead'), () => drillPrehistory({ scenario: 'hyperinflation' }));
    const rows = make();
    expect(rows.map((r) => r.gdp)).toEqual(make().map((r) => r.gdp));
    // ВВП за восемь кварталов меняется (раньше — ровно 0%)
    expect(Math.abs(rows[rows.length - 1].gdp / rows[0].gdp - 1)).toBeGreaterThan(0.01);
    // рост и безработица колеблются от квартала к кварталу, а не стоят на месте
    ['gdpGrowth', 'unemployment', 'stockIndex'].forEach((k) => expect(new Set(rows.map((r) => r[k].toFixed(2))).size, k).toBeGreaterThan(4));
    // «прямая» — когда все приросты одинаковы; у настоящих кварталов они разные
    const d = rows.slice(1).map((r, i) => r.gdp - rows[i].gdp);
    expect(Math.max(...d) - Math.min(...d)).toBeGreaterThan(1);
    // к старту экономика сведена в завязку сценария: инфляция уже высокая, как на старте
    const start = makeInitialEconomy('hyperinflation');
    expect(Math.abs(rows[rows.length - 1].inflation - start.inflation)).toBeLessThan(Math.abs(rows[0].inflation - start.inflation));
  });
});
