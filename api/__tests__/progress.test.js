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

/* Учебник в профиле: здесь не всё монотонно — отметку «прочитано» снимают, задача после
   ошибки возвращается в первую коробку, — поэтому по каждой записи побеждает более поздняя. */
describe('прогресс учебника в профиле', () => {
  const pc = { textbook: {
    read: { 'supply-demand': 100, elasticity: 200 }, unread: {},
    problems: { 'sd-1': { tries: 1, ok: true, box: null, due: null, lastAt: 300 },
      'el-2': { tries: 2, ok: false, box: 0, due: 5000, lastAt: 400 } },
    last: { kind: 'chapter', id: 'elasticity' }, lastAt: 400,
  } };
  const phone = { textbook: {
    read: { consumer: 150 }, unread: { elasticity: 500 },
    problems: { 'el-2': { tries: 1, ok: true, box: 1, due: 9000, lastAt: 600 },
      'cons-1': { tries: 1, ok: true, box: null, due: null, lastAt: 250 } },
    last: { kind: 'chapter', id: 'consumer' }, lastAt: 650,
  } };

  it('главы и задачи с обоих устройств, по спорным — более поздняя запись', () => {
    const t = mergeProgress(pc, phone).textbook;
    expect(Object.keys(t.read).sort()).toEqual(['consumer', 'supply-demand']);
    expect(t.unread.elasticity).toBe(500); // сняли отметку позже, чем поставили — не прочитано
    expect(t.problems['sd-1'].ok).toBe(true);
    expect(t.problems['cons-1'].ok).toBe(true);
    expect(t.problems['el-2']).toMatchObject({ ok: true, box: 1, due: 9000, tries: 2 });
    expect(t.last).toEqual({ kind: 'chapter', id: 'consumer' });
  });

  it('слияние симметрично и повторное ничего не меняет', () => {
    const a = mergeProgress(pc, phone).textbook; const b = mergeProgress(phone, pc).textbook;
    expect(a).toEqual(b);
    expect(mergeProgress({ textbook: a }, { textbook: b }).textbook).toEqual(a);
  });

  it('старый профиль без учебника и мусор на входе ничего не ломают', () => {
    expect(mergeProgress({}, pc).textbook.read['supply-demand']).toBe(100);
    const n = normalizeProgress({ textbook: { read: { ok: 5, bad: 'x', ['x'.repeat(80)]: 1 },
      problems: { p: { tries: 'много', box: 7, due: 1, lastAt: -3 }, q: 'нет' }, last: 'toc' } }).textbook;
    expect(n.read).toEqual({ ok: 5 });
    expect(n.problems).toEqual({ p: { tries: 0, ok: false, box: null, due: null, lastAt: 0 } });
    expect(n.last).toBe(null);
  });
});
