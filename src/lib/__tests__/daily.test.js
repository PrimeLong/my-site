import { describe, it, expect } from 'vitest';
import {
  dailyChallenge, dailySetup, dailyKey, dailyScore, withSeededRandom, hashSeed, rng, DAILY_QUARTERS,
} from '../catalog.js';
import { makeInitialEconomy, defaultDecisions, simulateQuarter, botCentralBank } from '../engine.js';

/* Вызов дня держится на одном свойстве: при одинаковых решениях у всех одинаковая
   партия. Если его сломать (скажем, кто-то вызовет Math.random() в движке мимо rng),
   таблица станет лотереей — поэтому проверяем прямо прогоном кварталов. */
function playDaily(day, tweak = 0) {
  const ch = dailyChallenge(day);
  const setup = dailySetup(ch);
  const seeded = (salt, fn) => withSeededRandom(hashSeed(`${setup.daily.seed}:${salt}`), fn);
  let economy = seeded('start', () => makeInitialEconomy(setup.scenario));
  let pendingImpulses = []; let eventCooldowns = {}; let stories = [];
  const trace = [];
  for (let q = 1; q <= 6; q++) {
    const res = seeded(`q${q}`, () => {
      const decisions = { ...defaultDecisions(economy), keyRate: economy.keyRate + (q === 2 ? tweak : 0) };
      const cb = botCentralBank(economy, setup.cbPersona, setup.difficulty);
      return simulateQuarter({ economy, decisions: { ...decisions, ...cb.decisions, keyRate: decisions.keyRate },
        pendingImpulses, eventCooldowns, difficulty: setup.difficulty, quarterIndex: q, stories, botAction: cb });
    });
    economy = res.economy; pendingImpulses = res.pendingImpulses; eventCooldowns = res.eventCooldowns; stories = res.stories;
    trace.push({ gdp: economy.gdp, inflation: economy.inflation, news: res.newsEntries.map((n) => n.headline) });
  }
  return { trace, economy, setup };
}

describe('вызов дня', () => {
  it('один день — одна и та же партия у всех', () => {
    expect(dailyChallenge('2026-09-24')).toEqual(dailyChallenge('2026-09-24'));
    const a = playDaily('2026-09-24'); const b = playDaily('2026-09-24');
    expect(b.trace).toEqual(a.trace);
  });

  it('разные дни — разные партии', () => {
    const days = ['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'].map((d) => dailyChallenge(d));
    expect(new Set(days.map((d) => d.seed)).size).toBe(4);
    // пост идёт по кругу: за четыре дня подряд выпадают все четыре
    expect(new Set(days.map((d) => d.role)).size).toBe(4);
    expect(days.every((d) => d.quarters === DAILY_QUARTERS)).toBe(true);
  });

  it('разные решения дают разный итог, но стартовая экономика та же', () => {
    const a = playDaily('2026-09-24'); const b = playDaily('2026-09-24', 3);
    expect(b.trace[0]).toEqual(a.trace[0]);
    expect(b.economy.gdp).not.toBe(a.economy.gdp);
  });

  it('зерно действует только внутри вызова и потом возвращает обычную случайность', () => {
    const seq = () => withSeededRandom(42, () => [rng(), rng(), rng()]);
    expect(seq()).toEqual(seq());
    const outside = [rng(), rng()];
    expect(outside[0]).not.toBe(seq()[0]);
    expect(() => withSeededRandom(1, () => { throw new Error('x'); })).toThrow('x');
    expect(rng()).not.toBe(withSeededRandom(1, () => rng()));
  });

  it('сутки считаются по Москве', () => {
    expect(dailyKey(new Date('2026-09-24T20:59:00Z'))).toBe('2026-09-24');
    expect(dailyKey(new Date('2026-09-24T21:01:00Z'))).toBe('2026-09-25');
  });

  it('итог: цель дня весит вдвое, поражение делит пополам', () => {
    const e = { scoreStability: 80, scoreWelfare: 40, scoreFinancial: 60, scoreFiscal: 60, scorePotential: 60 };
    expect(dailyScore(e, 'min_inflation', false)).toBeCloseTo((80 * 2 + 40 + 60 * 3) / 6, 1);
    expect(dailyScore(e, 'min_unemployment', false)).toBeCloseTo((80 + 40 * 2 + 60 * 3) / 6, 1);
    expect(dailyScore(e, 'min_inflation', true)).toBeCloseTo(dailyScore(e, 'min_inflation', false) / 2, 0);
    expect(dailyScore({}, 'min_inflation', false)).toBe(0);
  });
});
