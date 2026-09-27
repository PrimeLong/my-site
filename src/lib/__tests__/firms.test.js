import { describe, it, expect } from 'vitest';
import { FIRMS, firmTarget, firmsStep } from '../model/firms.js';

const crisis = { gdpGrowth: -8, rateGap: 3, profitTaxRate: 20, fxDeprAnnual: 0, exportsGrowth: -6, sanctions: false, atWar: false };

describe('крупный бизнес', () => {
  it('в кризисе цели фирм различаются и не упираются в границу', () => {
    const t = Object.fromEntries(FIRMS.map((f) => [f.id, firmTarget(f, crisis)]));
    Object.values(t).forEach((v) => { expect(v).toBeGreaterThan(3); expect(v).toBeLessThan(50); });
    // продукты — самые устойчивые, металлургия — самая циклическая
    expect(t.kolos).toBeGreaterThan(t.severoles);
    expect(t.severoles).toBeGreaterThan(t.stal);
    expect(t.kolos - t.stal).toBeGreaterThan(15);
  });

  it('за восемь кварталов кризиса здоровье фирм расходится', () => {
    let st = null;
    for (let i = 0; i < 8; i++) st = firmsStep(st && st.firms, crisis);
    const h = FIRMS.map((f) => st.firms[f.id].health);
    expect(new Set(h.map((v) => Math.round(v))).size).toBe(FIRMS.length);
    expect(Math.max(...h) - Math.min(...h)).toBeGreaterThan(15);
  });

  it('важна реальная ставка: разрыв с нейтральной, а не номинал', () => {
    const f = FIRMS.find((x) => x.id === 'severoles');
    const calm = { ...crisis, gdpGrowth: 2, exportsGrowth: 0 };
    expect(firmTarget(f, { ...calm, rateGap: -2 })).toBeGreaterThan(firmTarget(f, { ...calm, rateGap: 0 }));
    expect(firmTarget(f, { ...calm, rateGap: 0 })).toBeCloseTo(f.base, 5);
  });

  it('сокращения не добавляют безработицу поверх закона Оукена', () => {
    let st = null;
    for (let i = 0; i < 8; i++) st = firmsStep(st && st.firms, crisis);
    expect(st.unemploymentPush).toBeUndefined();
    expect(Object.values(st.firms).some((x) => x.mode === 'cutting')).toBe(true);
    expect(st.investmentPush).toBeLessThan(0);
  });
});
