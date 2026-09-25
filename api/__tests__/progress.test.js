import { describe, it, expect } from 'vitest';
import { normalizeProgress, mergeProgress } from '../solo.js';

/* Слияние прогресса при связывании устройств: единственное требование —
   ничего не терять. Всё, что здесь хранится, монотонно (открыто, пройдено,
   сыграно), поэтому правильный ответ всегда объединение, а не «кто последний». */
describe('общий прогресс связанных устройств', () => {
  const pc = {
    achievements: { first_quarter: 1000, survivor_20: 2000 },
    roles: ['central_bank'], network: false,
    courses: { basics: true },
    modules: { budget: { step: 4, at: 2, passed: { 3: true } } },
  };
  const phone = {
    achievements: { margin_call: 500, first_quarter: 9000 },
    roles: ['trader'], network: true,
    courses: { fx: true },
    modules: { budget: { step: 2, at: 1, passed: { 1: true } }, fx: { step: 1, at: 1, passed: {} } },
  };

  it('достижения объединяются, а не заменяются', () => {
    const m = mergeProgress(pc, phone);
    expect(Object.keys(m.achievements).sort()).toEqual(['first_quarter', 'margin_call', 'survivor_20']);
  });

  it('дата открытия — самая ранняя из двух', () => {
    expect(mergeProgress(pc, phone).achievements.first_quarter).toBe(1000);
    expect(mergeProgress(phone, pc).achievements.first_quarter).toBe(1000);
  });

  it('роли, курсы и сетевая партия объединяются', () => {
    const m = mergeProgress(pc, phone);
    expect(m.roles.sort()).toEqual(['central_bank', 'trader']);
    expect(m.courses).toEqual({ basics: true, fx: true });
    expect(m.network).toBe(true);
  });

  it('в модуле берётся дальний шаг и все сданные проверки', () => {
    const m = mergeProgress(pc, phone);
    expect(m.modules.budget.step).toBe(4);
    expect(m.modules.budget.at).toBe(2);
    expect(m.modules.budget.passed).toEqual({ 1: true, 3: true });
    expect(m.modules.fx.step).toBe(1);
  });

  it('слияние не зависит от порядка', () => {
    const a = mergeProgress(pc, phone); const b = mergeProgress(phone, pc);
    expect(a.achievements).toEqual(b.achievements);
    expect(a.courses).toEqual(b.courses);
    expect(a.modules).toEqual(b.modules);
    expect(a.roles.sort()).toEqual(b.roles.sort());
  });

  it('пустой профиль ничего не стирает', () => {
    const m = mergeProgress(pc, null);
    expect(m.achievements).toEqual(pc.achievements);
    expect(m.courses).toEqual(pc.courses);
    expect(mergeProgress(null, phone).achievements).toEqual(phone.achievements);
  });

  it('мусор из запроса отбрасывается, а не попадает в профиль', () => {
    const n = normalizeProgress({ achievements: 'нет', roles: [1, 2, 'trader'], courses: null,
      modules: { m: { step: 'x', at: -5, passed: 'да' } }, network: 'да' });
    expect(n.achievements).toEqual({});
    expect(n.roles).toEqual(['trader']);
    expect(n.courses).toEqual({});
    expect(n.modules.m).toEqual({ step: 0, at: 0, passed: {} });
    expect(n.network).toBe(true);
  });

  it('число ключей ограничено — профиль нельзя раздуть', () => {
    const many = {}; for (let i = 0; i < 1000; i++) many[`a${i}`] = i + 1;
    const n = normalizeProgress({ achievements: many });
    expect(Object.keys(n.achievements).length).toBeLessThanOrEqual(300);
  });

  it('свёрнутые блоки: побеждает то положение, которое выставили позже', () => {
    const pc = { folds: { press: [0, 200], report: [1, 50] } };
    const phone = { folds: { press: [1, 100], report: [0, 90], scores: [0, 10] } };
    const m = mergeProgress(pc, phone);
    expect(m.folds).toEqual({ press: [0, 200], report: [0, 90], scores: [0, 10] });
    expect(mergeProgress(phone, pc).folds).toEqual(m.folds);
    expect(normalizeProgress({ folds: { a: 'x', b: [1, 'нет'], c: [5, 3] } }).folds).toEqual({ c: [1, 3] });
  });
});
