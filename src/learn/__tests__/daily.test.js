import { describe, it, expect } from 'vitest';
import { greetingAt } from '../rewards.js';

describe('приветствие утреннего экрана — по часу', () => {
  it('в 0:50 — «Доброй ночи», а не «Доброе утро»', () => {
    expect(greetingAt(0)).toBe('Доброй ночи');
    expect(greetingAt(4)).toBe('Доброй ночи');
    expect(greetingAt(23)).toBe('Доброй ночи');
  });
  it('утро, день и вечер', () => {
    expect(greetingAt(5)).toBe('Доброе утро');
    expect(greetingAt(11)).toBe('Доброе утро');
    expect(greetingAt(12)).toBe('Добрый день');
    expect(greetingAt(17)).toBe('Добрый день');
    expect(greetingAt(18)).toBe('Добрый вечер');
    expect(greetingAt(22)).toBe('Добрый вечер');
  });
});

import { emptyLearn, recordAttempt, studyWeeks, mergeLearn, normalizeLearn } from '../../textbook/learn-state.js';

describe('«Верно с первого раза» — за четыре недели, а не по окну из 30 ответов', () => {
  const at = (d, h = 12) => new Date(2026, 9, d, h).getTime();
  it('доля верных первых попыток за 28 дней: старые ответы не выпадают, число не скачет', () => {
    let s = emptyLearn();
    // 40 ответов: 36 верных в первую неделю, потом 4 ошибки подряд
    for (let k = 0; k < 36; k += 1) s = recordAttempt(s, 'choice', true, 1000, { now: at(5) });
    for (let k = 0; k < 4; k += 1) s = recordAttempt(s, 'choice', false, 1000, { now: at(6) });
    const w = studyWeeks(s, at(7));
    expect(w.tried).toBe(40);
    expect(w.right).toBe(36);
    expect(w.accuracy).toBeCloseTo(0.9);
    // окно из 30 дало бы 26/30 ≈ 87%: каждая ошибка двигала бы число на 3%
  });
  it('попытки дня переживают синхронизацию между устройствами', () => {
    let s = emptyLearn();
    for (let k = 0; k < 10; k += 1) s = recordAttempt(s, 'choice', k % 5 !== 0, 1000, { now: at(5) });
    const back = mergeLearn(normalizeLearn(JSON.parse(JSON.stringify(s))), emptyLearn());
    expect(studyWeeks(back, at(7))).toMatchObject({ tried: 10, right: 8 });
  });
  it('пока попыток за четыре недели меньше пяти — по старому окну последних ответов', () => {
    const s = { ...emptyLearn(), recent: '1110111' };
    expect(studyWeeks(s, at(7)).accuracy).toBeCloseTo(6 / 7);
  });
});
