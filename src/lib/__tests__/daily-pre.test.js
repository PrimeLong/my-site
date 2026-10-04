import { describe, it, expect } from 'vitest';
import { makePrehistory } from '../autopilot.js';
import { drillPrehistory, overheatAmp } from '../drills.js';
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
  it('гиперинфляция: вводный отрезок связный — инфляцию разгоняет перегрев, к старту разрыв закрывается', () => {
    const rows = withSeededRandom(hashSeed('2026-10-04:lead'), () => drillPrehistory({ scenario: 'hyperinflation' }));
    const start = makeInitialEconomy('hyperinflation');
    const plain = withSeededRandom(hashSeed('2026-10-04:lead'), () => makePrehistory({ quarters: 8 })).prehistory;
    const n = rows.length; const mid = Math.floor((n - 1) / 2);
    // в середине отрезка экономика перегрета: разрыв заметно выше, чем у той же экономики без завязки
    expect(rows[mid].outputGap - plain[mid].outputGap).toBeGreaterThan(2);
    expect(Math.max(...rows.map((r) => r.outputGap))).toBeGreaterThan(start.outputGap + 2);
    // к старту перегрев гаснет: последний квартал ближе к стартовому разрыву, чем середина
    expect(Math.abs(rows[n - 1].outputGap - start.outputGap)).toBeLessThan(Math.abs(rows[mid].outputGap - start.outputGap));
    // в первой половине рост ВВП выше обычного, во второй — ниже: перегрев набирается и гаснет
    expect(rows[0].gdpGrowth - plain[0].gdpGrowth).toBeGreaterThan(0);
    expect(rows[n - 1].gdpGrowth - plain[n - 1].gdpGrowth).toBeLessThan(0);
  });
  it('без скачка инфляции горба перегрева нет', () => {
    expect(overheatAmp(2)).toBe(0);
    expect(overheatAmp(30)).toBeGreaterThan(3);
    expect(overheatAmp(100)).toBe(4);
  });
});
