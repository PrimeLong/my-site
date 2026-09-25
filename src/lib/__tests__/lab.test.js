import { describe, it, expect } from 'vitest';
import { impulseResponse, peakOf, LAB_LEVERS, defaultLabMode } from '../lab.js';
import { CONFIG } from '../engine.js';

describe('лаборатория: импульсный отклик одного рычага', () => {
  it('без изменения рычага миры совпадают, а расчёт повторяется', () => {
    const r = impulseResponse({ leverId: 'keyRate', delta: 0 });
    r.diff.forEach((x) => { expect(Math.abs(x.inflation)).toBeLessThan(1e-9); expect(Math.abs(x.outputGap)).toBeLessThan(1e-9); });
    const a = impulseResponse({ leverId: 'keyRate', delta: 1, seed: 3 });
    const b = impulseResponse({ leverId: 'keyRate', delta: 1, seed: 3 });
    expect(a.diff).toEqual(b.diff);
    expect(a.diff.length).toBe(12);
  });

  it('повышение ставки: ниже инфляция и выпуск, выше безработица, крепче валюта', () => {
    const r = impulseResponse({ leverId: 'keyRate', delta: 1 });
    const last = r.diff[r.diff.length - 1];
    expect(last.inflation).toBeLessThan(0);
    expect(last.outputGap).toBeLessThan(0);
    expect(last.unemployment).toBeGreaterThan(0);
    expect(last.exchangeRate).toBeLessThan(0);
    expect(peakOf(r.diff, 'outputGap').v).toBeLessThan(-0.3);
  });

  it('режим по умолчанию — как в партии; шум после расчёта возвращается', () => {
    const noise = CONFIG.noiseMult.medium;
    expect(defaultLabMode(LAB_LEVERS.find((l) => l.id === 'govSpending'))).toBe('hold');
    expect(defaultLabMode(LAB_LEVERS.find((l) => l.id === 'fxIntervention'))).toBe('pulse');
    const r = impulseResponse({ leverId: 'govSpending', delta: 2, mode: 'pulse' });
    expect(r.mode).toBe('pulse');
    expect(r.diff[1].outputGap).toBeGreaterThan(0);
    expect(CONFIG.noiseMult.medium).toBe(noise);
  });
});
