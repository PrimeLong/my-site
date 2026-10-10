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
