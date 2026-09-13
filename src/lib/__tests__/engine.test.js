import { describe, it, expect } from 'vitest';
import {
  makeInitialEconomy, defaultDecisions, simulateQuarter,
  botCentralBank, botFinanceMinistry, processRequest, redescribeCbAction,
  clamp, LEVERS, FX_REGIMES, PROMISE_POOL, pickPromises, evaluatePromise,
} from '../engine.js';

function assertFiniteEconomy(economy, label) {
  for (const [key, value] of Object.entries(economy)) {
    if (typeof value === 'number') {
      expect(Number.isFinite(value), `${label}: ${key} = ${value}`).toBe(true);
    }
  }
}

function runQuarters(n, difficulty = 'medium') {
  let economy = makeInitialEconomy();
  let decisions = defaultDecisions(economy);
  let pendingImpulses = [];
  let eventCooldowns = {};
  let stories = [];
  for (let q = 1; q <= n; q++) {
    const cbAct = botCentralBank(economy, 'pragmatic', difficulty);
    const mofAct = botFinanceMinistry(economy, 'technocrat', difficulty);
    const decisionsForQuarter = { ...decisions, ...cbAct.decisions, ...mofAct.decisions };
    const res = simulateQuarter({
      economy, decisions: decisionsForQuarter, pendingImpulses, eventCooldowns,
      difficulty, quarterIndex: q, stories,
      botAction: cbAct, botActions: [mofAct],
    });
    economy = res.economy;
    pendingImpulses = res.pendingImpulses;
    eventCooldowns = res.eventCooldowns;
    stories = res.stories;
    decisions = defaultDecisions(economy, decisionsForQuarter);
    assertFiniteEconomy(economy, `quarter ${q}`);
  }
  return economy;
}

describe('clamp', () => {
  it('bounds a value to [min, max]', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('makeInitialEconomy', () => {
  it('produces only finite numeric fields', () => {
    assertFiniteEconomy(makeInitialEconomy(), 'initial');
  });
});

describe('simulateQuarter', () => {
  it('keeps every numeric field finite over a 10-year run (40 кварталов), medium', () => {
    const final = runQuarters(40, 'medium');
    expect(final.gdp).toBeGreaterThan(0);
    expect(final.exchangeRate).toBeGreaterThan(0);
    expect(final.unemployment).toBeGreaterThanOrEqual(0);
  });

  it('stays finite on hard difficulty too (длинные лаги, срывы ожиданий)', () => {
    runQuarters(20, 'hard');
  });

  it('never lets reserves or bank capital go non-finite when key levers are pushed to extremes', () => {
    let economy = makeInitialEconomy();
    let decisions = defaultDecisions(economy);
    for (const lever of LEVERS) {
      if (lever.id in decisions) decisions[lever.id] = lever.max;
    }
    for (const regime of FX_REGIMES) {
      const res = simulateQuarter({
        economy, decisions: { ...decisions, fxRegime: regime.id }, pendingImpulses: [], eventCooldowns: {},
        difficulty: 'hard', quarterIndex: 1, stories: [],
      });
      assertFiniteEconomy(res.economy, `fxRegime=${regime.id}`);
    }
  });
});

describe('rate_hold request (Минфин просит ЦБ не повышать ставку)', () => {
  it('actually caps the hike instead of no-op-ing back to the bot\'s own proposal', () => {
    const s = { ...makeInitialEconomy(), keyRate: 5, outputGap: 2.0, inflation: 5.0,
      inflationExpectations: 5.0, inflationTarget: 4, interestToRevenue: 16 };
    const cbAction = botCentralBank(s, 'dove', 'medium');
    expect(cbAction.decisions.keyRate).toBeGreaterThan(s.keyRate); // ЦБ сам хотел повысить
    const decisions = defaultDecisions(s);
    const eff = { ...decisions, ...cbAction.decisions };
    const result = processRequest('rate_hold', s, 'central_bank', 'dove', eff);
    expect(result.status).toBe('accepted');
    // ставка не должна вырасти выше того, что было до решения ЦБ
    expect(result.decisions.keyRate).toBeLessThanOrEqual(s.keyRate);
  });

  it('leaves a cut alone (hold only blocks hikes, not cuts)', () => {
    const s = { ...makeInitialEconomy(), keyRate: 5, outputGap: -2.0, inflation: 3.0,
      inflationExpectations: 3.0, inflationTarget: 4, interestToRevenue: 5 };
    const cbAction = botCentralBank(s, 'dove', 'medium');
    expect(cbAction.decisions.keyRate).toBeLessThan(s.keyRate); // ЦБ сам режет ставку
    const decisions = defaultDecisions(s);
    const eff = { ...decisions, ...cbAction.decisions };
    const result = processRequest('rate_hold', s, 'central_bank', 'dove', eff);
    if (result.status !== 'rejected') expect(result.decisions.keyRate).toBe(cbAction.decisions.keyRate);
  });
});

describe('redescribeCbAction (новость после межведомственного запроса)', () => {
  it('describes the final rate, not the one the bot originally proposed', () => {
    const s = { ...makeInitialEconomy(), keyRate: 5, outputGap: -1.5, inflation: 3.5,
      inflationExpectations: 3.5, inflationTarget: 4, unemployment: 6 };
    const cbAction = botCentralBank(s, 'pragmatic', 'medium');
    const decisions = defaultDecisions(s);
    const eff = { ...decisions, ...cbAction.decisions };
    const result = processRequest('rate_cut', s, 'central_bank', 'pragmatic', eff);
    expect(result.status).toBe('accepted');
    expect(result.decisions.keyRate).not.toBe(cbAction.decisions.keyRate); // запрос реально что-то изменил
    const redescribed = redescribeCbAction(s, 'pragmatic', result.decisions);
    expect(redescribed.note).toContain(result.decisions.keyRate.toFixed(2));
    expect(redescribed.note).not.toContain(cbAction.decisions.keyRate.toFixed(2));
  });
});

describe('предвыборные обещания (роль «глава государства»)', () => {
  it('picks the requested number of distinct promises with baked-in numeric targets', () => {
    const economy = makeInitialEconomy();
    const promises = pickPromises(economy, 3);
    expect(promises).toHaveLength(3);
    const ids = new Set(promises.map((p) => p.id));
    expect(ids.size).toBe(3); // без повторов
    for (const p of promises) {
      expect(typeof p.target).toBe('number');
      expect(Number.isFinite(p.target)).toBe(true);
      expect(typeof p.text).toBe('string');
      expect(p.text.length).toBeGreaterThan(0);
    }
  });

  it('starts already met for every "don\'t make it worse" ceiling/floor promise', () => {
    // цели для этих обещаний считаются от стартовой экономики, поэтому в момент
    // вступления в должность они обязаны выполняться сами собой — иначе игрок
    // начинал бы уже проигравшим. growth_promise — исключение: это обещание
    // «добиться роста к выборам», а не «не ухудшить», и на старте закономерно не выполнено.
    const economy = makeInitialEconomy();
    for (const def of PROMISE_POOL) {
      const target = def.target(economy);
      const baseline = def.baseline ? def.baseline(economy) : null;
      const promise = { id: def.id, target, baseline };
      const { met } = evaluatePromise(promise, economy);
      expect(met, `${def.id} at term start`).toBe(def.id !== 'growth_promise');
    }
  });

  it('flags a promise as broken once the economy drifts past its target', () => {
    const economy = makeInitialEconomy();
    const promise = pickPromises(economy, 1).find((p) => p.id === 'debt_discipline')
      || { id: 'debt_discipline', target: PROMISE_POOL.find((p) => p.id === 'debt_discipline').target(economy), baseline: null };
    const worse = { ...economy, debtToGdp: promise.target + 20 };
    expect(evaluatePromise(promise, worse).met).toBe(false);
  });
});

describe('noEvents (используется режимом «Обучение»)', () => {
  it('suppresses random crisis events even on hard difficulty over many quarters', () => {
    let economy = makeInitialEconomy();
    let decisions = defaultDecisions(economy);
    let pendingImpulses = [];
    let eventCooldowns = {};
    for (let q = 1; q <= 30; q++) {
      const res = simulateQuarter({
        economy, decisions, pendingImpulses, eventCooldowns,
        difficulty: 'hard', quarterIndex: q, stories: [], noEvents: true,
      });
      economy = res.economy;
      pendingImpulses = res.pendingImpulses;
      eventCooldowns = res.eventCooldowns;
      decisions = defaultDecisions(economy, decisions);
      expect(economy.activeCrises).toEqual([]);
    }
    expect(economy.regime).toBe('normal');
  });
});

describe('pandemic crisis tracking', () => {
  it('shows up in activeCrises/regime for a few quarters, then clears', () => {
    // pandemicQuartersLeft: 3 здесь эквивалентно "квартал сразу после срабатывания
    // события" (на самом триггере счётчик становится 3 без декремента) — отсюда
    // ещё 2 активных квартала до истечения, всего 3 квартала кризиса от триггера
    let economy = { ...makeInitialEconomy(), pandemicQuartersLeft: 3 };
    let decisions = defaultDecisions(economy);
    const seen = [];
    for (let q = 1; q <= 5; q++) {
      const r = simulateQuarter({ economy, decisions, pendingImpulses: [], eventCooldowns: {},
        difficulty: 'medium', quarterIndex: q, stories: [] });
      economy = r.economy;
      decisions = defaultDecisions(economy, decisions);
      seen.push(economy.activeCrises.includes('pandemic'));
    }
    expect(seen).toEqual([true, true, false, false, false]);
    expect(economy.regime).not.toBe('pandemic');
  });
});
