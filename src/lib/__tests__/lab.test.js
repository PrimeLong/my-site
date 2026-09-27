import { describe, it, expect } from 'vitest';
import { impulseResponse, peakOf, LAB_LEVERS, defaultLabMode, defaultLabCb } from '../lab.js';
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

  it('повышение ставки, удержанное без реакции ЦБ: ниже инфляция и выпуск, выше безработица, крепче валюта', () => {
    const r = impulseResponse({ leverId: 'keyRate', delta: 1, mode: 'hold' });
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
    expect(defaultLabMode(LAB_LEVERS.find((l) => l.id === 'keyRate'))).toBe('taylor');
    expect(defaultLabCb(LAB_LEVERS.find((l) => l.id === 'govSpending'))).toBe('taylor');
    expect(defaultLabMode(LAB_LEVERS.find((l) => l.id === 'fxIntervention'))).toBe('pulse');
    const r = impulseResponse({ leverId: 'govSpending', delta: 2, mode: 'pulse' });
    expect(r.mode).toBe('pulse');
    expect(r.diff[1].outputGap).toBeGreaterThan(0);
    expect(CONFIG.noiseMult.medium).toBe(noise);
  });

  it('шок ставки при ЦБ по правилу Тейлора: горб на 8–11-м квартале и возврат разрыва к нулю через 24 квартала', () => {
    const r = impulseResponse({ leverId: 'keyRate', delta: 1, horizon: 24 });
    expect(r.mode).toBe('taylor');
    const trough = peakOf(r.diff, 'outputGap');
    expect(trough.v).toBeLessThan(-0.3);
    expect(trough.q).toBeGreaterThanOrEqual(8);
    expect(trough.q).toBeLessThanOrEqual(11);
    const q24 = r.diff[23].outputGap;
    expect(Math.abs(q24)).toBeLessThan(0.2 * Math.abs(trough.v));
    expect(Math.abs(q24)).toBeLessThan(0.15);
    // без реакции ЦБ разовый шок так и не рассасывается
    const frozen = impulseResponse({ leverId: 'keyRate', delta: 1, mode: 'pulse', horizon: 24 });
    expect(Math.abs(frozen.diff[23].outputGap)).toBeGreaterThan(Math.abs(q24) * 0.8);
    expect(Math.abs(frozen.diff[23].outputGap)).toBeGreaterThan(0.6 * Math.abs(peakOf(frozen.diff, 'outputGap').v));
  });

  it('бюджетный стимул: ЦБ поднимает ставку и гасит часть эффекта (вытеснение)', () => {
    const on = impulseResponse({ leverId: 'govInvestment', delta: 2, cb: 'taylor', horizon: 24 });
    const off = impulseResponse({ leverId: 'govInvestment', delta: 2, cb: 'fixed', horizon: 24 });
    expect(on.diff[11].keyRate).toBeGreaterThan(0.05);
    expect(off.diff[11].keyRate).toBe(0);
    expect(on.diff[23].outputGap).toBeLessThan(off.diff[23].outputGap * 0.7);
  });
});

describe('оси графиков лаборатории', () => {
  it('ноль всегда на шкале, деления круглые', async () => {
    const { zeroTicks } = await import('../lab.js');
    const a = zeroTicks([-0.09, -0.15, -0.42]);
    expect(a.ticks).toContain(0);
    expect(a.domain[1]).toBe(0);
    expect(a.ticks).toEqual([-0.6, -0.4, -0.2, 0]);
    const b = zeroTicks([0.1, 1.2, -0.39]);
    expect(b.ticks).toContain(0);
    expect(b.domain[0]).toBeLessThanOrEqual(-0.39);
    expect(b.domain[1]).toBeGreaterThanOrEqual(1.2);
  });
});
