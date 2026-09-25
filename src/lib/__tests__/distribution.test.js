import { describe, it, expect } from 'vitest';
import { distributionStep, initialDistribution, giniOf, QUINTILES } from '../model/distribution.js';

const base = { wageGrowth: 6, unemployment: 5, prevUnemployment: 5, transfersRealGrowth: 0, inflation: 4, coreInflation: 4,
  gdpGrowth: 2.3, stockGrowth: 1, keyRate: 5.5, vatRate: 18, incomeTaxRate: 15, capitalTaxRate: 13 };
const run = (x, n = 4) => { let d = initialDistribution(); for (let i = 0; i < n; i++) d = distributionStep(d, { ...base, ...x }); return d; };

describe('распределение доходов по квинтилям', () => {
  it('Джини: равенство — 0, стартовые доли — около 0,37', () => {
    expect(giniOf([1, 1, 1, 1, 1])).toBeCloseTo(0, 5);
    expect(giniOf(QUINTILES.map((q) => q.share0))).toBeGreaterThan(0.3);
    expect(giniOf(QUINTILES.map((q) => q.share0))).toBeLessThan(0.45);
  });

  it('НДС регрессивен: доля в доходе беднейших выше, чем у богатейших', () => {
    const d = run({ incomeTaxRate: 0, capitalTaxRate: 0 }, 1);
    expect(d.quintiles[0].taxBurden).toBeGreaterThan(d.quintiles[4].taxBurden * 1.5);
  });

  it('скачок цен на еду бьёт по бедным сильнее: их личная инфляция выше', () => {
    const d = run({ inflation: 10, coreInflation: 5 }, 1);
    expect(d.quintiles[0].inflation).toBeGreaterThan(d.quintiles[4].inflation + 2);
  });

  it('урезание трансфертов роняет реальные доходы низа и поднимает неравенство', () => {
    const ok = run({}, 8); const cut = run({ transfersRealGrowth: -10 }, 8);
    expect(cut.quintiles[0].real).toBeLessThan(ok.quintiles[0].real - 3);
    expect(cut.gini).toBeGreaterThan(ok.gini);
  });
});
