import { describe, it, expect } from 'vitest';
import { yoyFromAnnualized } from '../model/measures.js';

describe('год к году из квартальных темпов', () => {
  it('ровный темп не меняется, а разовый всплеск размазывается на год', () => {
    expect(yoyFromAnnualized([8, 8, 8, 8, 8]).every((v) => Math.abs(v - 8) < 1e-9)).toBe(true);
    // квартал с −20% годовых: за квартал это −5,4%, за год на фоне нулей — те же −5,4%
    const y = yoyFromAnnualized([0, 0, 0, 0, -20, 0, 0, 0, 0]);
    expect(y[4]).toBeCloseTo((Math.pow(0.8, 0.25) - 1) * 100, 6);
    expect(y[7]).toBeCloseTo(y[4], 6);
    expect(y[8]).toBeCloseTo(0, 6);
  });
  it('пока истории меньше года — годовой темп по тем кварталам, что есть', () => {
    expect(yoyFromAnnualized([10])[0]).toBeCloseTo(10, 6);
    expect(yoyFromAnnualized([10, 10])[1]).toBeCloseTo(10, 6);
  });
});
