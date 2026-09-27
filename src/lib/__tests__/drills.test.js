import { describe, it, expect } from 'vitest';
import { DRILLS, evaluateDrill, drillSetup, drillImpulses, goalValueText, drillPrehistory } from '../drills.js';
import { makeForecast, resolveForecasts, forecastStats } from '../forecast.js';
import { makeInitialEconomy, defaultDecisions, simulateQuarter, botCentralBank, botFinanceMinistry } from '../engine.js';
import { withSeededRandom } from '../catalog.js';

// партия задачи: игрок — выбранная стратегия, соседнее ведомство — бот
function playDrill(d, mine, seed) {
  return withSeededRandom(seed, () => {
    let e = { ...makeInitialEconomy(d.scenario, d.overrides), economyOnly: true }; let p = drillImpulses(d); let cd = {}; let st = []; let prev = null;
    const hist = [];
    for (let q = 1; q <= d.quarters; q++) {
      const other = d.role === 'central_bank' ? botFinanceMinistry(e, 'technocrat', 'medium').decisions : botCentralBank(e, 'pragmatic', 'medium').decisions;
      const dec = { ...defaultDecisions(e, prev), ...other, ...mine(e, q) };
      const r = simulateQuarter({ economy: e, decisions: dec, pendingImpulses: p, eventCooldowns: cd, difficulty: 'medium', quarterIndex: q, stories: st }, { skip: ['events', 'war'] });
      e = r.economy; p = r.pendingImpulses; cd = r.eventCooldowns; st = r.stories; prev = dec; hist.push({ q, ...e });
    }
    return evaluateDrill(d, hist);
  });
}

describe('задачи на 10 минут', () => {
  // для каждой задачи — стратегия «по учебнику», которая её проходит
  const cb = (p) => (e) => botCentralBank(e, p, 'medium').decisions;
  const mof = (p) => (e) => botFinanceMinistry(e, p, 'medium').decisions;
  const SOLVER = {
    disinflation: cb('hawk'), recession: cb('dove'), // консолидация: выплаты и закупки растут заметно медленнее, чуть выше НДС
    consolidation: () => ({ transfers: -12, govSpending: -4, vatRate: 19 }),
    fisher: (e) => ({ keyRate: Math.max(0, e.inflationExpectations + 3) }),
    peg: (e) => ({ keyRate: Math.max(e.keyRate, e.inflationExpectations + 3.5) }),
    laffer: (e) => ({ incomeTaxRate: Math.max(18, e.incomeTaxRate - 3), profitTaxRate: Math.max(22, e.profitTaxRate - 4), socialContribRate: Math.max(22, e.socialContribRate - 2) }),
    slump_stimulus: (e, q) => (q <= 3 ? { govInvestment: 8, govSpending: 5 } : { govInvestment: 0, govSpending: 0 }),
    full_stimulus: mof('populist'),
    // умеренный ответ: не душить экономику ради первого круга, но и не дать разогнаться второму
    supply_shock: cb('pragmatic'),
    // без своей ставки быстрый выход один — реструктуризация, как в 2012-м; движок примет её, только когда кризис признан
    greece: () => ({ sovereignDefault: true }),
  };

  it('задач десять, у каждой — тема со страницы «игра ↔ учебник»', () => {
    expect(DRILLS.length).toBe(10);
    const topics = new Set(['fisher', 'okun', 'phillips', 'solow', 'multiplier', 'trilemma', 'laffer', 'lorenz']);
    DRILLS.forEach((d) => expect(topics.has(d.topic), d.id).toBe(true));
    ['fisher', 'trilemma', 'laffer', 'multiplier', 'phillips'].forEach((t) => expect(DRILLS.some((d) => d.topic === t), t).toBe(true));
    expect(Object.keys(SOLVER).sort()).toEqual(DRILLS.map((d) => d.id).sort());
  });

  it('каждую задачу нельзя пройти бездействием, но можно пройти разумной политикой', () => {
    DRILLS.forEach((d) => {
      expect(playDrill(d, () => ({}), 11).passed, `${d.id}: бездействие`).toBe(false);
      expect(playDrill(d, SOLVER[d.id], 11).passed, `${d.id}: решение`).toBe(true);
    });
  });

  it('стартовые значения из условия задачи действительно стоят на старте (дефицит 6,5% — это 6,5%)', () => {
    DRILLS.forEach((d) => {
      const e = makeInitialEconomy(d.scenario, d.overrides);
      Object.entries(d.overrides || {}).filter(([, v]) => typeof v === 'number').forEach(([k, v]) => {
        expect(e[k], `${d.id}: ${k}`).toBeCloseTo(v, 6);
      });
    });
  });
  it('вводный отрезок задачи: восемь кварталов до старта, от обычной экономики к завязке', () => {
    const d = DRILLS.find((x) => x.id === 'disinflation');
    const pre = drillPrehistory(d);
    expect(pre).toHaveLength(8);
    expect(pre.every((r) => r.pre && r.q <= 0)).toBe(true);
    const base = makeInitialEconomy('sandbox'); const start = makeInitialEconomy(d.scenario, d.overrides);
    expect(Math.abs(pre[0].inflation - base.inflation)).toBeLessThan(Math.abs(pre[0].inflation - start.inflation));
    expect(Math.abs(pre[7].inflation - start.inflation)).toBeLessThan(Math.abs(pre[7].inflation - base.inflation));
    // цели считаются только по кварталам самой задачи
    expect(evaluateDrill(d, pre).goals.every((g) => g.status === 'pending')).toBe(true);
  });
  it('значение цели — словами цели: сальдо −2,6 — это «дефицит 2,6% ВВП»', () => {
    expect(goalValueText({ key: 'budgetBalancePctGdp', when: 'final', value: -2.6 })).toBe('итог: дефицит 2,6% ВВП');
    expect(goalValueText({ key: 'gdpGrowth', when: 'always', value: 1.3 })).toBe('худшее: 1,3%');
    expect(goalValueText({ key: 'inflation', when: 'final', value: null })).toBe('—');
  });
  it('компромиссы, ради которых задачи сделаны', () => {
    // при полной занятости грубый стимул вытесняется ставкой ЦБ
    expect(playDrill(DRILLS.find((x) => x.id === 'full_stimulus'), () => ({ govSpending: 6, transfers: 4 }), 11).passed).toBe(false);
    // на шок предложения ястреб отвечает слишком жёстко — безработица выходит за предел
    expect(playDrill(DRILLS.find((x) => x.id === 'supply_shock'), cb('hawk'), 11).passed).toBe(false);
    // привязку курса не удержать мягкой ставкой
    expect(playDrill(DRILLS.find((x) => x.id === 'peg'), cb('dove'), 11).passed).toBe(false);
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
