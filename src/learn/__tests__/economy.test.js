// Экономика наград (docs/mechanics.md): цены от заработка курса, «≈ N уроков», опыт и монеты, копилка
import { describe, it, expect } from 'vitest';
import {
  COIN, OUTFITS, FREEZE, BOOST, ACHIEVEMENTS, RATE_MAX, PATH_LESSONS, courseIncome, incomePerLesson, forgone,
  rateOn, PIGGY, PIGGY_YEARLY, REAL_RATE, realCurve,
} from '../rewards.js';
import { XP, lessonXp, addDays } from '../../textbook/learn-state.js';
import { LESSONS } from '../course.js';

const ALL = [...OUTFITS, FREEZE, BOOST];
const maxPrice = () => Math.ceil(Math.max(...ALL.map((o) => o.crowns)) * RATE_MAX);

describe('цены лавки — от заработка курса', () => {
  const inc = courseIncome();
  it('заработок курса считается из уроков Пути (сейчас 44) и складывается из частей', () => {
    expect(PATH_LESSONS).toBe(LESSONS.length);
    expect(PATH_LESSONS).toBe(44);
    const { total, days, ...parts } = inc;
    expect(total).toBe(Object.values(parts).reduce((a, b) => a + b, 0));
    expect(parts.lessons).toBe(PATH_LESSONS * COIN.lesson);
    expect(days).toBe(PATH_LESSONS / 2);
  });
  it('самая дорогая вещь — не больше 70% заработка курса даже по худшему курсу', () => {
    expect(maxPrice()).toBeLessThanOrEqual(0.7 * inc.total);
    // и по любому курсу последних двух месяцев
    for (let k = 0; k < 60; k += 1) expect(rateOn(addDays('2026-10-01', k))).toBeLessThanOrEqual(RATE_MAX);
  });
  it('«≈ N уроков» никогда не больше числа уроков на Пути', () => {
    ALL.forEach((o) => {
      const price = Math.ceil(o.crowns * RATE_MAX);
      expect(forgone(price).lessons, o.id).toBeLessThanOrEqual(PATH_LESSONS);
      expect(forgone(price).lessons, o.id).toBeGreaterThanOrEqual(1);
    });
    expect(forgone(10 ** 6).lessons).toBe(PATH_LESSONS);
    expect(forgone(incomePerLesson() * 3).text).toBe('≈ 3 урока');
  });
  it('обычные вещи дешевле редких; страховка серии — пара уроков', () => {
    const plain = OUTFITS.filter((o) => !o.rare).map((o) => o.crowns);
    const rare = OUTFITS.filter((o) => o.rare).map((o) => o.crowns);
    expect(Math.max(...plain)).toBeLessThan(Math.min(...rare));
    expect(FREEZE.crowns).toBeLessThanOrEqual(3 * COIN.lesson);
  });
});

describe('опыт и монеты', () => {
  it('опыт — только за работу в уроке: 2 за верный с первой попытки и 5 за финиш', () => {
    expect(XP).toMatchObject({ correct: 2, finish: 5 });
    expect(lessonXp({ firstTry: 10 })).toBe(25);
    expect(lessonXp({ firstTry: 10, diamond: true })).toBe(38);
    expect(lessonXp({ firstTry: 10, replay: true })).toBe(3);
    // печати опыта не дают
    ACHIEVEMENTS.forEach((a) => expect(a.xp, a.id).toBeUndefined());
  });
  it('печать стоит целое число уроков: монеты кратны цене урока', () => {
    ACHIEVEMENTS.forEach((a) => expect(a.coins % COIN.lesson, `${a.id}: ${a.coins}`).toBe(0));
  });
});

describe('копилка: честно про проценты', () => {
  it('2% в день — это 730% годовых; реальные 8% годовых — 1000 крон за 10 лет чуть больше чем вдвое', () => {
    expect(PIGGY.rate).toBe(0.02);
    expect(PIGGY_YEARLY).toBe(730);
    expect(REAL_RATE).toBe(0.08);
    const c = realCurve();
    expect(c).toHaveLength(11);
    expect(c[0].value).toBe(1000);
    expect(c[10].value).toBe(2159);
  });
});
