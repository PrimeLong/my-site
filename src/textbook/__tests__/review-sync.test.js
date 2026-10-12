// Одно повторение на Путь и учебник (src/textbook/review-sync.js)
import { describe, it, expect } from 'vitest';
import { problemOfExercise, afterBookAnswer, afterPathAnswer } from '../review-sync.js';
import { emptyProgress, recordAnswer, scheduleAfter } from '../progress.js';
import { TEMPLATES } from '../variants.js';

const DAY = 86400000;
const t0 = Date.UTC(2026, 9, 1, 9);
const withMistake = (p, id) => ({ ...p, learn: { ...p.learn, mistakes: [{ id, at: t0 }], hinted: [] } });

describe('одно повторение на Путь и учебник', () => {
  it('упражнение Пути знает свою задачу учебника: auto:… и параллельный вариант', () => {
    expect(problemOfExercise('auto:pc-basic')).toBe('pc-basic');
    const tpl = TEMPLATES[0];
    expect(problemOfExercise(`var:${tpl.id}`)).toBe(tpl.source);
    expect(problemOfExercise('sd-i1-who')).toBe(null);
  });
  it('решили в учебнике в свой день — ошибка той же задачи уходит и с Пути', () => {
    let p = withMistake(recordAnswer(emptyProgress(), 'pc-basic', false, t0), 'auto:pc-basic');
    const at = t0 + 2 * DAY;
    const { why } = scheduleAfter(p.problems['pc-basic'], true, at);
    p = afterBookAnswer(recordAnswer(p, 'pc-basic', true, at), 'pc-basic', true, why);
    expect(p.learn.mistakes).toEqual([]);
  });
  it('ответ до срока после ошибки ничего не снимает — ни в учебнике, ни на Пути', () => {
    let p = withMistake(recordAnswer(emptyProgress(), 'pc-basic', false, t0), 'auto:pc-basic');
    const { why } = scheduleAfter(p.problems['pc-basic'], true, t0 + 1000);
    expect(why).toBe('early');
    p = afterBookAnswer(recordAnswer(p, 'pc-basic', true, t0 + 1000), 'pc-basic', true, why);
    expect(p.learn.mistakes).toHaveLength(1);
    expect(p.problems['pc-basic']).toMatchObject({ ok: false, due: t0 + 2 * DAY });
  });
  it('решили на Пути, когда подошёл срок в учебнике, — повторение учебника засчитано', () => {
    let p = recordAnswer(emptyProgress(), 'pc-basic', false, t0);
    expect(afterPathAnswer(p, 'auto:pc-basic', t0 + DAY)).toBe(p);
    p = afterPathAnswer(p, 'auto:pc-basic', t0 + 2 * DAY);
    expect(p.problems['pc-basic']).toMatchObject({ ok: true, box: 1, due: t0 + 7 * DAY });
    expect(afterPathAnswer(p, 'sd-i1-who', t0 + 9 * DAY)).toBe(p);
  });
});
