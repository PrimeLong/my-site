// Возвраты для воронки: на следующий день и через неделю — по одному разу
import { describe, it, expect } from 'vitest';
import { returnEvents } from '../retention.js';

const DAY = 86400000;
const first = 20000;
const at = (d) => (first + d) * DAY + 3600000;

describe('возвраты', () => {
  it('на следующий день — return_d1, через 7–13 дней — return_d7, по разу', () => {
    expect(returnEvents({ first }, at(0))).toEqual([]);
    expect(returnEvents({ first }, at(1))).toEqual(['return_d1']);
    expect(returnEvents({ first, sent: { d1: true } }, at(1))).toEqual([]);
    expect(returnEvents({ first }, at(2))).toEqual([]);
    expect(returnEvents({ first }, at(7))).toEqual(['return_d7']);
    expect(returnEvents({ first }, at(13))).toEqual(['return_d7']);
    expect(returnEvents({ first, sent: { d7: true } }, at(9))).toEqual([]);
    expect(returnEvents({ first }, at(14))).toEqual([]);
    expect(returnEvents({ first: null }, at(1))).toEqual([]);
  });
});
