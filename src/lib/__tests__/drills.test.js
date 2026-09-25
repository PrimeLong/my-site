import { describe, it, expect } from 'vitest';
import { DRILLS, evaluateDrill, drillSetup } from '../drills.js';
import { makeForecast, resolveForecasts, forecastStats } from '../forecast.js';
import { makeInitialEconomy, defaultDecisions, simulateQuarter, botCentralBank, botFinanceMinistry } from '../engine.js';
import { withSeededRandom } from '../catalog.js';

// партия задачи: игрок — выбранная стратегия, соседнее ведомство — бот
function playDrill(d, mine, seed) {
  return withSeededRandom(seed, () => {
    let e = { ...makeInitialEconomy(d.scenario, d.overrides), economyOnly: true }; let p = []; let cd = {}; let st = []; let prev = null;
    const hist = [];
    for (let q = 1; q <= d.quarters; q++) {
      const other = d.role === 'central_bank' ? botFinanceMinistry(e, 'technocrat', 'medium').decisions : botCentralBank(e, 'pragmatic', 'medium').decisions;
      const dec = { ...defaultDecisions(e, prev), ...other, ...mine(e) };
      const r = simulateQuarter({ economy: e, decisions: dec, pendingImpulses: p, eventCooldowns: cd, difficulty: 'medium', quarterIndex: q, stories: st }, { skip: ['events', 'war'] });
      e = r.economy; p = r.pendingImpulses; cd = r.eventCooldowns; st = r.stories; prev = dec; hist.push({ q, ...e });
    }
    return evaluateDrill(d, hist);
  });
}

describe('задачи на 10 минут', () => {
  it('каждую задачу нельзя пройти бездействием, но можно пройти разумной политикой', () => {
    const solver = { central_bank: (e) => botCentralBank(e, 'hawk', 'medium').decisions, ministry_finance: (e) => botFinanceMinistry(e, 'austerity', 'medium').decisions };
    DRILLS.forEach((d) => {
      expect(playDrill(d, () => ({}), 11).passed, `${d.id}: бездействие`).toBe(false);
      expect(playDrill(d, solver[d.role], 11).passed, `${d.id}: решение`).toBe(true);
    });
  });

  it('проверка целей: «всегда» проваливается сразу, «к концу» ждёт последнего квартала', () => {
    const d = DRILLS.find((x) => x.id === 'disinflation');
    const mid = evaluateDrill(d, [{ q: 1, inflation: 10, unemployment: 8 }]);
    expect(mid.done).toBe(false);
    expect(mid.goals.find((g) => g.key === 'unemployment').status).toBe('fail');
    expect(mid.goals.find((g) => g.key === 'inflation').status).toBe('pending');
    const hist = Array.from({ length: 8 }, (_, i) => ({ q: i + 1, inflation: 12 - i * 1.2, unemployment: 6 }));
    const end = evaluateDrill(d, hist);
    expect(end.done).toBe(true);
    expect(end.goals.find((g) => g.key === 'inflation').status).toBe('ok');
    expect(end.passed).toBe(true);
    expect(drillSetup(d)).toMatchObject({ role: 'central_bank', drill: 'disinflation', economyOnly: true });
  });

  it('слепой прогноз сверяется через четыре квартала, рядом — наивный', () => {
    let list = [makeForecast(1, 6, 8), makeForecast(2, 5, 7.5)];
    expect(list[0].targetQ).toBe(4);
    let r = resolveForecasts(list, 3, 5.5);
    expect(r.fresh).toEqual([]);
    r = resolveForecasts(r.list, 4, 5.5);
    expect(r.fresh.length).toBe(1);
    expect(r.fresh[0].error).toBeCloseTo(0.5, 9);
    expect(r.fresh[0].naiveError).toBeCloseTo(2.5, 9);
    list = resolveForecasts(r.list, 5, 5).list;
    const s = forecastStats(list);
    expect(s.n).toBe(2);
    expect(s.mae).toBeCloseTo(0.25, 9);
    expect(s.beatNaive).toBe(2);
  });
});
