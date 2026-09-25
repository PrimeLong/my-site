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
