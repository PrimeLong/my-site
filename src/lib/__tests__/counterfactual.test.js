import { describe, it, expect } from 'vitest';
import { passiveDecisions, changedLevers, policyContribution } from '../counterfactual.js';
import { makeInitialEconomy, defaultDecisions, simulateQuarter, botFinanceMinistry } from '../engine.js';
import { withSeededRandom } from '../catalog.js';

const quarter = (e, d, seed) => withSeededRandom(seed, () => simulateQuarter({ economy: e, decisions: d, pendingImpulses: [],
  eventCooldowns: {}, difficulty: 'medium', quarterIndex: 1, stories: [] })).economy;

describe('«а если бы вы ничего не делали»', () => {
  it('те же решения и то же зерно — тот же квартал, вклад нулевой', () => {
    const e = makeInitialEconomy();
    const base = defaultDecisions(e);
    const eff = { ...base, ...botFinanceMinistry(e, 'technocrat', 'medium').decisions };
    const passive = passiveDecisions(eff, base, ['monetary']);
    const rows = policyContribution(quarter(e, eff, 42), quarter(e, passive, 42));
    rows.forEach((r) => expect(Math.abs(r.diff)).toBeLessThan(1e-9));
  });

  it('решения игрока откатываются, чужие остаются; вклад повышения ставки виден сразу', () => {
    const e = makeInitialEconomy();
    const base = defaultDecisions(e);
    const mof = botFinanceMinistry(e, 'technocrat', 'medium').decisions;
    const eff = { ...base, ...mof, keyRate: base.keyRate + 2 };
    const passive = passiveDecisions(eff, base, ['monetary']);
    expect(passive.keyRate).toBe(base.keyRate);
    expect(passive.govSpending).toBe(mof.govSpending);
    expect(changedLevers(eff, base, ['monetary']).map((c) => c.id)).toEqual(['keyRate']);
    const rows = Object.fromEntries(policyContribution(quarter(e, eff, 7), quarter(e, passive, 7)).map((r) => [r.key, r.diff]));
    expect(rows.lendingRate).toBeGreaterThan(0);
    expect(rows.exchangeRate).toBeLessThan(0);
  });
});

describe('накопленное сравнение: вся партия без решений игрока', () => {
  // партия за ЦБ: настоящий мир и мир «без вас» на одних и тех же зёрнах
  async function play(mine, quarters = 12) {
    const { startShadow, shadowQuarter, cumulativeContribution } = await import('../counterfactual.js');
    const { clamp } = await import('../engine.js');
    let e = makeInitialEconomy(); let shadow = startShadow(e);
    let p = []; let cd = {}; let st = []; let prev = null; const history = [];
    for (let q = 1; q <= quarters; q++) {
      const seed = 1000 + q;
      const mof = botFinanceMinistry(e, 'technocrat', 'medium').decisions;
      const eff = { ...defaultDecisions(e, prev), ...mof, ...mine(e, q) };
      const cbStance = clamp((eff.keyRate - e.inflationExpectations - e.rStar) / 3, -1, 1);
      const mofStance = clamp((eff.govSpending + eff.transfers * 0.6 + eff.govInvestment * 0.8) / 6
        - (eff.vatRate - e.vatRate + eff.incomeTaxRate - e.incomeTaxRate) * 0.3, -1, 1);
      const r = withSeededRandom(seed, () => simulateQuarter({ economy: { ...e, cbStance, mofStance }, decisions: eff,
        pendingImpulses: p, eventCooldowns: cd, difficulty: 'medium', quarterIndex: q, stories: st }));
      shadow = shadowQuarter(shadow, { eff, groups: ['monetary'], bots: { mof: 'technocrat' }, difficulty: 'medium', quarterIndex: q, seed });
      e = r.economy; p = r.pendingImpulses; cd = r.eventCooldowns; st = r.stories; prev = eff;
      history.push({ q, ...e });
    }
    return cumulativeContribution(history, shadow);
  }

  it('если игрок ничего не трогает, миры совпадают', async () => {
    const cum = await play(() => ({}));
    cum.rows.forEach((r) => expect(Math.abs(r.diff), r.key).toBeLessThan(1e-9));
    expect(cum.quarters).toBe(12);
  });

  it('ставка выше на 2 п.п. всю партию: инфляция и ВВП ниже, чем в мире без вас', async () => {
    const cum = await play(() => ({ keyRate: makeInitialEconomy().keyRate + 2 }));
    const row = (k) => cum.rows.find((r) => r.key === k).diff;
    expect(row('inflation')).toBeLessThan(-0.2);
    expect(row('avgInflation')).toBeLessThan(0);
    expect(row('gdp')).toBeLessThan(0);
    expect(row('unemployment')).toBeGreaterThan(0);
  });
});
