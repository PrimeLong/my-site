// Оператор и возрастная маркировка — одни константы на обе страницы (docs/legal-todo.md, п. 6 и 7)
import { describe, it, expect } from 'vitest';
import { OPERATOR, AGE_RATING, isPlaceholder, operatorFilled } from '../../legal.js';

describe('оператор и маркировка', () => {
  it('пока — заглушки в квадратных скобках, и это видно', () => {
    expect(OPERATOR).toEqual({ name: '[ФИО/название]', address: '[адрес для обращений]', email: '[e-mail]' });
    expect(isPlaceholder(AGE_RATING)).toBe(true);
    expect(operatorFilled()).toBe(false);
    expect(operatorFilled({ name: 'ИП Иванов И. И.', address: 'Москва, а/я 1', email: 'hello@example.org' })).toBe(true);
  });
});
