import { describe, it, expect } from 'vitest';
import { makeInitialEconomy } from '../engine.js';
import {
  makeCompany, defaultPlan, companyPreview, settleCompany, creditLimit, totalDebt, ownerWealth, companyValue,
} from '../business.js';
import { withSeededRandom } from '../catalog.js';

const econ = (patch = {}) => ({ ...makeInitialEconomy('sandbox'), ...patch });

describe('компания предпринимателя', () => {
  it('на старте прибыльна в каждой отрасли и штат подобран под спрос', () => {
    for (const sector of ['factory', 'retail', 'builder']) {
      const e = econ(); const c = makeCompany(sector, e);
      const pv = companyPreview(c, defaultPlan(c), e);
      expect(pv.ebitda, sector).toBeGreaterThan(0);
      expect(pv.netProfit, sector).toBeGreaterThan(0);
      expect(pv.utilization, sector).toBeGreaterThan(0.75);
      expect(companyValue(c, e), sector).toBeGreaterThan(0);
      expect(ownerWealth(c, e)).toBeCloseTo(c.wealth0, 5);
    }
  });

  it('прогноз не зависит от жребия, итог при одном зерне повторяется', () => {
    const e = econ(); const c = makeCompany('factory', e); const plan = defaultPlan(c);
    expect(companyPreview(c, plan, e)).toEqual(companyPreview(c, plan, e));
    const a = withSeededRandom(7, () => settleCompany(c, plan, e, 1));
    const b = withSeededRandom(7, () => settleCompany(c, plan, e, 1));
    expect(b.company).toEqual(a.company);
  });

  it('девелопер чувствует ставку сильнее всех', () => {
    const drop = (sector) => {
      const c = makeCompany(sector, econ());
      const base = companyPreview(c, defaultPlan(c), econ()).domDemand;
      return companyPreview(c, defaultPlan(c), econ({ lendingRate: 18 })).domDemand / base;
    };
    expect(drop('builder')).toBeLessThan(0.7);
    expect(drop('retail')).toBeCloseTo(1, 5);
  });

  it('девальвация помогает экспортёру и бьёт по валютному долгу', () => {
    const e = econ(); const c = makeCompany('factory', e);
    const weak = econ({ exchangeRate: 180 });
    const plan = { ...defaultPlan(c), exportShare: 50 };
    expect(companyPreview(c, plan, weak).expDemand).toBeGreaterThan(companyPreview(c, plan, e).expDemand);
    const withFx = { ...c, debtFx: 3 };
    expect(totalDebt(withFx, weak) - totalDebt(withFx, e)).toBeCloseTo(3 * 0.8, 5);
  });

  it('при кредитном сжатии банки дают меньше', () => {
    const e = econ(); const c = makeCompany('builder', e);
    expect(creditLimit(c, { ...e, creditCrunch: true })).toBeLessThan(creditLimit(c, e));
  });

  it('заём не больше лимита, погашение не больше долга', () => {
    const e = econ(); const c = makeCompany('factory', e);
    const lim = creditLimit(c, e);
    expect(companyPreview(c, { ...defaultPlan(c), borrow: 1e9 }, e).borrow).toBeCloseTo(lim, 5);
    expect(companyPreview(c, { ...defaultPlan(c), borrow: -1e9 }, e).borrow).toBeCloseTo(-totalDebt(c, e), 5);
  });

  it('два квартала без денег — банкротство', () => {
    const e = econ(); let c = makeCompany('retail', e);
    c = { ...c, cash: -500, history: [{ ebitda: -50 }] };
    const plan = defaultPlan(c);
    const q1 = withSeededRandom(1, () => settleCompany(c, plan, e, 1)).company;
    expect(q1.distressQuarters).toBe(1);
    expect(q1.bankrupt).toBe(false);
    const q2 = withSeededRandom(2, () => settleCompany(q1, plan, e, 2)).company;
    expect(q2.bankrupt).toBe(true);
  });

  it('старый долг переоценивается по новой ставке постепенно', () => {
    const e = econ(); const c = makeCompany('builder', e);
    const next = withSeededRandom(3, () => settleCompany(c, defaultPlan(c), econ({ lendingRate: 30 }), 1)).company;
    expect(next.loanRate).toBeGreaterThan(c.loanRate);
    expect(next.loanRate).toBeLessThan(15);
  });
});
