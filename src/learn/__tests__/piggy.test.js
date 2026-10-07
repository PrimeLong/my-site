// Копилка Инфли (сложный процент), цена отказа, «Страховка серии» и предвосхищение тем
import { describe, it, expect } from 'vitest';
import { PIGGY, piggyState, piggyPut, piggyTake, piggyValue, piggyCurve, balance, earn, forgone, incomePerLesson, FREEZE, BOOST, buy, COIN, takePolicy } from '../rewards.js';
import { CALLBACKS, callbackFor } from '../callbacks.js';
import { emptyLearn, normalizeLearn, mergeLearn } from '../../textbook/learn-state.js';
import { LESSON_BY_ID } from '../course.js';
import { CHAPTER_BY_ID } from '../../textbook/toc.js';

const DAY = 86400000;
const T0 = Date.UTC(2026, 9, 1, 9);
const rich = (n = 500) => earn(emptyLearn(), n, null, T0 - DAY);

describe('копилка: сложный процент', () => {
  it('2% в день на накопленное: неделя даёт больше, чем 2% от вклада каждый день', () => {
    expect(piggyValue(1000, 7)).toBe(1148);
    expect(piggyValue(1000, 7)).toBeGreaterThan(1000 + 7 * 20);
    expect(piggyValue(100, 0)).toBe(100);
    expect(piggyValue(100, 30)).toBe(piggyValue(100, PIGGY.days));
    const c = piggyCurve(100);
    expect(c).toHaveLength(PIGGY.days + 1);
    // прирост каждого дня больше прошлого: процент считается и с процентов
    for (let d = 2; d < c.length; d += 1) expect(c[d].value - c[d - 1].value).toBeGreaterThan(c[d - 1].value - c[d - 2].value);
  });
  it('положил — монеты ушли из кошелька; через неделю вернулись с процентами', () => {
    const s0 = rich();
    const r = piggyPut(s0, 200, T0);
    expect(r.ok).toBe(true);
    expect(balance(r.s)).toBe(300);
    expect(piggyState(r.s, T0 + 3 * DAY)).toMatchObject({ amount: 200, days: 3, ripe: false, value: piggyValue(200, 3), payout: 200 });
    const t = piggyTake(r.s, T0 + 7 * DAY + 1000);
    expect(t.ok).toBe(true); expect(t.early).toBe(false);
    expect(t.payout).toBe(piggyValue(200, 7));
    expect(balance(t.s)).toBe(300 + piggyValue(200, 7));
    expect(piggyState(t.s, T0 + 8 * DAY)).toBeNull();
  });
  it('забрать раньше срока можно, но процент сгорает', () => {
    const r = piggyPut(rich(), 200, T0);
    const t = piggyTake(r.s, T0 + 5 * DAY);
    expect(t.early).toBe(true); expect(t.payout).toBe(200); expect(t.lost).toBe(piggyValue(200, 5) - 200);
    expect(balance(t.s)).toBe(500);
  });
  it('вклад один за раз, от 10 монет и не больше, чем в кошельке', () => {
    const r = piggyPut(rich(), 50, T0);
    expect(piggyPut(r.s, 20, T0 + 1000).ok).toBe(false);
    expect(piggyPut(rich(), PIGGY.min - 1, T0).ok).toBe(false);
    expect(piggyPut(rich(30), 31, T0).ok).toBe(false);
  });
  it('копилка переживает сохранение и слияние двух устройств без двойной выплаты', () => {
    const r = piggyPut(rich(), 100, T0);
    const saved = normalizeLearn(JSON.parse(JSON.stringify(r.s)));
    expect(piggyState(saved, T0 + DAY).amount).toBe(100);
    const taken = piggyTake(saved, T0 + 8 * DAY).s;
    const merged = mergeLearn(saved, taken);
    expect(piggyState(merged, T0 + 9 * DAY)).toBeNull();
    expect(balance(merged)).toBe(balance(taken));
    expect(mergeLearn(merged, merged)).toEqual(merged);
  });
});

describe('цена отказа и страховка серии', () => {
  it('под ценой — сколько это уроков и сколько монеты принесли бы в копилке за неделю', () => {
    // урок — средний заработок за урок курса (docs/mechanics.md), а не только 10 монет за сам урок
    const per = incomePerLesson();
    expect(forgone(3 * per)).toMatchObject({ lessons: 3, week: piggyValue(3 * per, 7) - 3 * per, text: '≈ 3 урока' });
    expect(forgone(4).lessons).toBe(1);
    expect(forgone(10 * per).text).toBe('≈ 10 уроков');
    expect(COIN.lesson).toBeLessThan(per);
  });
  it('«Заморозка» стала «Страховкой серии»: полис со взносом — и пропуск прощается', () => {
    expect(FREEZE.title).toBe('Страховка серии');
    expect(FREEZE.text).toMatch(/прощается/);
    expect(takePolicy(rich(), T0).ok).toBe(true);
  });
});

describe('предвосхищение: Инфля вспоминает механику, когда до темы доходит урок', () => {
  it('шаги готовых уроков существуют; для неготовых юнитов — заготовки', () => {
    CALLBACKS.forEach((c) => {
      if (c.step) {
        const lesson = Object.values(LESSON_BY_ID).find((l) => l.inner.some((x) => x.idea.id === c.step));
        expect(lesson, c.id).toBeTruthy();
        expect(lesson.unitId).toBe(c.unit);
      } else if (c.unit) expect(CHAPTER_BY_ID[c.unit], c.id).toBeTruthy();
    });
    expect(CALLBACKS.map((c) => c.id)).toEqual(['opportunity', 'compound', 'insurance']);
  });
  it('напоминает, только если ученик уже пользовался механикой', () => {
    expect(callbackFor('sc-i1-oc', emptyLearn())).toBeNull();
    const shopper = buy(rich(), BOOST.id, T0).s;
    expect(callbackFor('sc-i1-oc', shopper).text).toMatch(/альтернативная стоимость/);
    const saver = piggyPut(rich(), 50, Date.now() - 14 * DAY).s;
    expect(CALLBACKS.find((c) => c.id === 'compound').text(saver)).toMatch(/^2 недели назад .* сложный процент/);
  });
});
