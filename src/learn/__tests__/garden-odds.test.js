// «Шансы урожая»: экран выключен флагом (решение владельца); таблица — из тех же GRADES, по которым выпадает редкость
import { describe, it, expect } from 'vitest';
import { GRADES, SHOW_ODDS, oddsTable, oddsText, gradeOf } from '../garden.js';

describe('шансы урожая', () => {
  it('экран выключен: шансы на экране не пишем, пока владелец не решит иначе (docs/legal-todo.md, п. 11)', () => {
    expect(SHOW_ODDS).toBe(false);
  });
  it('таблица: 55 / 25 / 12 / 6 / 1,9 / 0,1% — в сумме 100%, в том же порядке и с теми же ценами', () => {
    expect(oddsTable().map((g) => g.odds)).toEqual(['55%', '25%', '12%', '6%', '1,9%', '0,1%']);
    expect(oddsTable().map((g) => g.id)).toEqual(GRADES.map((g) => g.id));
    expect(oddsTable().map((g) => g.mult)).toEqual(GRADES.map((g) => g.mult));
    expect(GRADES.reduce((a, g) => a + g.p, 0)).toBeCloseTo(1, 10);
    expect(oddsText(0.019)).toBe('1,9%');
  });
  it('шансы на экране совпадают с тем, как редкость выпадает на самом деле (10 000 сборов)', () => {
    const n = 10000; const got = {};
    for (let i = 0; i < n; i += 1) { const g = gradeOf(1700000000000 + i * 7919); got[g] = (got[g] || 0) + 1; }
    GRADES.filter((g) => g.p >= 0.05).forEach((g) => expect(Math.abs(got[g.id] / n - g.p), g.id).toBeLessThan(0.02));
  });
});
