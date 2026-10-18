// Копилка Инфли (сложный процент), цена отказа, «Страховка серии» и предвосхищение тем
import { describe, it, expect } from 'vitest';
import { PIGGY, piggyState, piggyPut, piggyTake, piggyValue, piggyCurve, balance, earn, forgone, incomePerLesson, FREEZE, BOOST, buy, COIN, takePolicy,
  RATE_STEPS, DEMAND_STEPS, rateStep, weekRate, weekDemand } from '../rewards.js';
import { dayOf, addDays } from '../../textbook/learn-state.js';
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
    // ставка — недели, когда положили, и держится весь срок
    const rate = weekRate(dayOf(T0));
    expect(r.rate).toBe(rate);
    expect(piggyState(r.s, T0 + 3 * DAY)).toMatchObject({ amount: 200, days: 3, ripe: false, rate, value: piggyValue(200, 3, rate), payout: 200 });
    const t = piggyTake(r.s, T0 + 7 * DAY + 1000);
    expect(t.ok).toBe(true); expect(t.early).toBe(false);
    expect(t.payout).toBe(piggyValue(200, 7, rate));
    expect(balance(t.s)).toBe(300 + piggyValue(200, 7, rate));
    expect(piggyState(t.s, T0 + 8 * DAY)).toBeNull();
  });
  it('забрать раньше срока можно, но процент сгорает', () => {
    const r = piggyPut(rich(), 200, T0);
    const t = piggyTake(r.s, T0 + 5 * DAY);
    expect(t.early).toBe(true); expect(t.payout).toBe(200); expect(t.lost).toBe(piggyValue(200, 5, weekRate(dayOf(T0))) - 200);
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

describe('ставка недели: копилка и сад — разные решения', () => {
  const days = Array.from({ length: 7 * 30 }, (_, k) => addDays('2026-10-05', k));
  it('ставка 1–3% в день, меняется только по понедельникам и не больше чем на шаг; в среднем 2%', () => {
    days.forEach((d) => expect(RATE_STEPS).toContain(weekRate(d)));
    for (let k = 1; k < days.length; k += 1) {
      const a = rateStep(days[k - 1]); const b = rateStep(days[k]);
      if (new Date(`${days[k]}T12:00:00`).getDay() !== 1) expect(b, days[k]).toBe(a);
      else expect(Math.abs(b - a), days[k]).toBeLessThanOrEqual(1);
    }
    const weeks = days.filter((d, k) => k % 7 === 0).map(weekRate);
    expect(weeks.reduce((a, r) => a + r, 0) / weeks.length).toBeCloseTo(0.02, 3);
    expect(new Set(weeks).size).toBe(RATE_STEPS.length);
  });
  it('ставка выше — вклад выгоднее, а спрос на рынке сада ниже', () => {
    for (let k = 1; k < RATE_STEPS.length; k += 1) {
      expect(piggyValue(1000, 7, RATE_STEPS[k])).toBeGreaterThan(piggyValue(1000, 7, RATE_STEPS[k - 1]));
      expect(DEMAND_STEPS[k]).toBeLessThan(DEMAND_STEPS[k - 1]);
    }
    days.forEach((d) => expect(weekDemand(d)).toBe(DEMAND_STEPS[rateStep(d)]));
    // при средней ставке спрос обычный
    expect(DEMAND_STEPS[RATE_STEPS.indexOf(0.02)]).toBe(1);
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

describe('копилка: срочный вклад или пополняемый', () => {
  it('пополняемый — ставка на 0,5 п. п. ниже (не ниже 0,5%), срочный пополнить нельзя', async () => {
    const { topupRate, piggyAdd } = await import('../rewards.js');
    expect(topupRate(0.02)).toBe(0.015);
    expect(topupRate(0.01)).toBe(0.005);
    expect(topupRate(0.005)).toBe(0.005);
    const fixed = piggyPut(rich(), 100, T0);
    expect(piggyAdd(fixed.s, 20, T0 + DAY)).toMatchObject({ ok: false, reason: 'Этот вклад без пополнений' });
    const top = piggyPut(rich(), 100, T0, { topup: true });
    expect(top.rate).toBe(topupRate(weekRate(dayOf(T0))));
    expect(piggyState(top.s, T0)).toMatchObject({ topup: true, canAdd: true });
  });
  it('путь вклада для графика: пополнение — ступенька в свой день, до него — только первый взнос; конец пути — итог вклада', async () => {
    const { piggyAdd } = await import('../rewards.js');
    let s = piggyPut(rich(900), 100, T0, { topup: true }).s;
    const rate = piggyState(s, T0).rate;
    s = piggyAdd(s, 60, T0 + 2 * DAY + 3600000).s;
    s = piggyAdd(s, 300, T0 + 4 * DAY + 3600000).s;
    const st = piggyState(s, T0 + 6 * DAY);
    expect(st.path).toHaveLength(PIGGY.days + 1);
    expect(st.path[0]).toBe(100);
    // до пополнения в день 2 — только первый взнос со своим процентом
    expect(st.path[2]).toBe(Math.floor(100 * (1 + rate) ** 2 + 1e-9));
    // пополнение видно со следующей точки, растёт со своего дня
    expect(st.path[3]).toBe(Math.floor(100 * (1 + rate) ** 3 + 60 * (1 + rate) ** 0 + 1e-9));
    expect(st.path[st.path.length - 1]).toBe(st.final);
    for (let d = 1; d <= PIGGY.days; d += 1) expect(st.path[d]).toBeGreaterThanOrEqual(st.path[d - 1]);
    expect(st.steps).toEqual([{ day: 3, n: 60 }, { day: 5, n: 300 }]);
    // срочный вклад без пополнений — ровная кривая сложного процента
    const plain = piggyState(piggyPut(rich(), 100, T0).s, T0 + DAY);
    expect(plain.steps).toEqual([]);
    expect(plain.path).toEqual(Array.from({ length: PIGGY.days + 1 }, (_, d) => piggyValue(100, d, plain.rate)));
  });
  it('пополнение растёт со своего дня до конца срока; раньше срока процент сгорает, вложенное — целиком', async () => {
    const { piggyAdd } = await import('../rewards.js');
    let s = piggyPut(rich(500), 100, T0, { topup: true }).s;
    const rate = piggyState(s, T0).rate;
    expect(piggyAdd(s, 3, T0 + DAY).ok).toBe(false);
    s = piggyAdd(s, 50, T0 + 5 * DAY).s;
    expect(balance(s)).toBe(350);
    const st = piggyState(s, T0 + 5 * DAY);
    expect(st.amount).toBe(150);
    // первый взнос — 7 дней, пополнение — только 2
    expect(st.final).toBe(Math.floor(100 * (1 + rate) ** 7 + 50 * (1 + rate) ** 2 + 1e-9));
    const early = piggyTake(s, T0 + 6 * DAY);
    expect(early.payout).toBe(150);
    const late = piggyTake(s, T0 + 7 * DAY + 1);
    expect(late.payout).toBe(st.final);
    expect(balance(late.s)).toBe(350 + st.final);
    // срок вышел — пополнить уже нельзя
    expect(piggyAdd(s, 20, T0 + 7 * DAY + 1).ok).toBe(false);
  });
  it('вид вклада и пополнения переживают слияние устройств', async () => {
    const { piggyAdd } = await import('../rewards.js');
    let s = piggyPut(rich(500), 100, T0, { topup: true }).s;
    s = piggyAdd(s, 40, T0 + DAY).s;
    const m = mergeLearn(normalizeLearn(s), emptyLearn());
    expect(piggyState(m, T0 + 2 * DAY)).toMatchObject({ topup: true, amount: 140, adds: 1 });
  });
});
