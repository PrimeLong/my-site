/* Сад Инфли: семена за монеты по курсу дня, растение растёт по часам — и офлайн; редкое растёт
   дольше; собранное уходит в гербарий; посадки и сборы переживают слияние устройств. */
import { describe, it, expect } from 'vitest';
import { PLANTS, PLANT_BY_ID, RARITY_ORDER, GARDEN_PLOTS, GRADES, plant, harvest, herbarium, grown, collection, gardenPlots, growth, growMs, plantPrice, leftText, ripeCount,
  gradeOf, sell, salePrice, soldToday, marketFactor, paidPrice, cropGroups, sellAll } from '../garden.js';
import { emptyLearn, normalizeLearn, mergeLearn, dayOf } from '../../textbook/learn-state.js';
import { balance, earn, courseIncome, RATE_MAX, rateOn } from '../rewards.js';

const T = new Date(2026, 9, 10, 12).getTime();
const HOUR = 3600000;
const rich = (n = 5000) => earn(emptyLearn(), n, null, T);

describe('сад: каталог', () => {
  it('чем реже растение, тем дольше растёт и тем дороже семена', () => {
    const rank = (p) => RARITY_ORDER.indexOf(p.rarity);
    PLANTS.forEach((a) => PLANTS.forEach((b) => {
      if (rank(a) < rank(b)) { expect(a.hours, `${a.id} < ${b.id}`).toBeLessThan(b.hours); expect(a.crowns).toBeLessThan(b.crowns); }
    }));
    expect(new Set(PLANTS.map((p) => p.rarity))).toEqual(new Set(RARITY_ORDER));
  });
  it('самое дорогое семя — не дороже 70% заработка курса по худшему курсу', () => {
    const top = Math.max(...PLANTS.map((p) => Math.ceil(p.crowns * RATE_MAX)));
    expect(top).toBeLessThanOrEqual(0.7 * courseIncome().total);
  });
});

describe('сад: посадка и рост', () => {
  it('посадка списывает монеты по курсу дня и занимает первую свободную грядку', () => {
    const s0 = rich();
    const r = plant(s0, 'tulip', T);
    expect(r.ok).toBe(true);
    expect(r.price).toBe(plantPrice('tulip', dayOf(T)));
    expect(balance(r.s)).toBe(balance(s0) - r.price);
    expect(r.plot).toBe(0);
    expect(plant(r.s, 'chamomile', T + 1).plot).toBe(1);
  });
  it('растёт по часам: семечко → росток → бутон → цветёт, без приложения тоже', () => {
    const { s, at } = plant(rich(), 'peony', T);
    const g = gardenPlots(s).plots[0];
    expect(g.at).toBe(at);
    expect(growth(g, T).stage).toBe('seed');
    expect(growth(g, T + 6 * HOUR).stage).toBe('sprout');
    expect(growth(g, T + 18 * HOUR).stage).toBe('bud');
    expect(growth(g, T + 24 * HOUR)).toMatchObject({ stage: 'bloom', ripe: true, left: 0 });
    // часы переведены назад — растение не уходит «в минус»
    expect(growth(g, T - 5 * HOUR).p).toBe(0);
    expect(leftText(growth(g, T + 20 * HOUR + 30 * 60000).left)).toBe('ещё 3 ч 30 мин');
    expect(leftText(growMs('moneytree'))).toBe('ещё 4 дн');
    // на грядке — коротко: без «ещё», от трёх часов без минут
    expect(leftText(12 * HOUR + 60000, { short: true })).toBe('12 ч');
    expect(leftText(2 * HOUR + 20 * 60000, { short: true })).toBe('2 ч 20 мин');
  });
  it('собрать можно только созревшее; собранное — в гербарии, грядка свободна', () => {
    const { s, at } = plant(rich(), 'chamomile', T);
    expect(harvest(s, at, T + HOUR).ok).toBe(false);
    expect(ripeCount(s, T + 2 * HOUR)).toBe(1);
    const r = harvest(s, at, T + 2 * HOUR);
    expect(r).toMatchObject({ ok: true, plant: 'chamomile', first: true });
    expect(herbarium(r.s)).toEqual({ chamomile: 1 });
    expect(gardenPlots(r.s).plots.every((p) => !p)).toBe(true);
    // второй раз — уже не первое в гербарии
    const again = plant(r.s, 'chamomile', T + 3 * HOUR);
    expect(harvest(again.s, again.at, T + 6 * HOUR)).toMatchObject({ ok: true, first: false });
  });
  it('не хватает монет или грядок — посадки нет', () => {
    expect(plant(emptyLearn(), 'moneytree', T)).toMatchObject({ ok: false });
    let s = rich();
    for (let k = 0; k < GARDEN_PLOTS; k += 1) s = plant(s, 'chamomile', T + k).s;
    expect(plant(s, 'chamomile', T + 10)).toMatchObject({ ok: false, reason: expect.stringMatching(/грядки заняты/) });
  });
});

describe('сад: профиль и два устройства', () => {
  it('посадки и сборы переживают чистку профиля; мусор отбрасывается', () => {
    const { s, at } = plant(rich(), 'orchid', T);
    const n = normalizeLearn({ ...s, garden: { ...s.garden, bad: 'x@1', 123: 'orchid@1', 1790000000000: 'DROP TABLE' } });
    expect(n.garden).toEqual({ [at]: 'orchid@0' });
    expect(PLANT_BY_ID[gardenPlots(n).plots[0].plant].title).toBe('Орхидея');
  });
  it('слияние: посадки обоих устройств остаются, сбор с любого — собран; повтор слияния ничего не меняет', () => {
    const a = plant(rich(), 'chamomile', T);
    const b = plant(rich(), 'tulip', T + 5);
    const ha = harvest(a.s, a.at, T + 3 * HOUR).s;
    const m = mergeLearn(ha, b.s);
    expect(Object.keys(m.garden).length).toBe(2);
    expect(herbarium(m)).toEqual({ chamomile: 1 });
    expect(mergeLearn(m, m)).toEqual(m);
    expect(mergeLearn(b.s, ha)).toEqual(m);
    // оба посадили в первую грядку — позднее растение переезжает на свободную
    const { plots } = gardenPlots(mergeLearn(a.s, b.s));
    expect(plots.filter(Boolean).map((p) => [p.plant, p.plot])).toEqual([['chamomile', 0], ['tulip', 1]]);
  });
});

describe('сад: редкость урожая и рынок', () => {
  // посадить и вырастить: { s, at } уже собранного урожая
  const grow = (s0, id, t) => { const p = plant(s0, id, t); return { s: harvest(p.s, p.at, t + growMs(id)).s, at: p.at }; };
  it('шансы редкостей — как написано на экране; в среднем урожай чуть дороже семян', () => {
    expect(GRADES.reduce((a, g) => a + g.p, 0)).toBeCloseTo(1, 10);
    const n = 20000; const got = {};
    for (let k = 0; k < n; k += 1) { const g = gradeOf(T + k * 7919); got[g] = (got[g] || 0) + 1; }
    GRADES.forEach((g) => expect(Math.abs(got[g.id] / n - g.p), g.id).toBeLessThan(0.012));
    const ev = GRADES.reduce((a, g) => a + g.p * g.mult, 0);
    expect(ev).toBeGreaterThan(1.05);
    expect(ev).toBeLessThan(1.15);
    // редкость — от времени посадки: собрать на другом устройстве — та же
    expect(gradeOf(T + 123)).toBe(gradeOf(String(T + 123)));
  });
  it('урожай можно продать: монеты по цене семян × редкость по курсу дня; второй раз — нельзя', () => {
    const { s, at } = grow(rich(), 'tulip', T);
    const r0 = harvest(plant(rich(), 'tulip', T).s, plant(rich(), 'tulip', T).at, T + growMs('tulip'));
    expect(r0.grade).toBe(gradeOf(r0.at));
    const now = T + growMs('tulip') + 1000;
    const price = salePrice(s, at, now);
    const mult = GRADES.find((g) => g.id === gradeOf(at)).mult;
    expect(price.coins).toBe(Math.floor(PLANT_BY_ID.tulip.crowns * mult * rateOn(dayOf(now))));
    const r = sell(s, at, now);
    expect(r.ok).toBe(true);
    expect(balance(r.s)).toBe(balance(s) + price.coins);
    expect(sell(r.s, at, now)).toMatchObject({ ok: false, reason: 'Уже продано' });
    // проданное ушло из коллекции, но растение остаётся выращенным
    expect(herbarium(r.s)).toEqual({});
    expect(grown(r.s)).toEqual({ tulip: 1 });
    expect(collection(s)).toEqual({ tulip: { [gradeOf(at)]: 1 } });
  });
  it('спрос насыщается: каждая продажа того же растения за день — на 15% дешевле, не ниже половины; назавтра снова полная', () => {
    let s = rich(20000);
    const ats = [];
    for (let k = 0; k < 5; k += 1) { const g = grow(s, 'chamomile', T + k); s = g.s; ats.push(g.at); }
    const now = T + 3 * HOUR;
    expect(marketFactor(s, 'chamomile', now)).toBe(1);
    ats.forEach((at, k) => {
      expect(soldToday(s, 'chamomile', now)).toBe(k);
      expect(marketFactor(s, 'chamomile', now)).toBeCloseTo(Math.max(0.5, 1 - 0.15 * k), 10);
      s = sell(s, at, now).s;
    });
    // другое растение — свой спрос
    expect(marketFactor(s, 'tulip', now)).toBe(1);
    expect(marketFactor(s, 'chamomile', now + 24 * HOUR)).toBe(1);
  });
  it('продажа на одном устройстве — продано и после слияния', () => {
    const { s, at } = grow(rich(), 'peony', T);
    const sold = sell(s, at, T + 30 * HOUR).s;
    const m = mergeLearn(s, sold);
    expect(herbarium(m)).toEqual({});
    expect(sell(m, at, T + 31 * HOUR).ok).toBe(false);
  });
});

describe('сад: сверхредкий урожай, цена покупки и урожай одной строкой', () => {
  const grow = (s0, id, t) => { const p = plant(s0, id, t); return { s: harvest(p.s, p.at, t + growMs(id)).s, at: p.at }; };
  it('самая редкая редкость — реально редкая: один урожай из тысячи, и он самый дорогой', () => {
    const last = GRADES[GRADES.length - 1];
    expect(last).toMatchObject({ id: 'myth', title: 'небывалый' });
    expect(last.p).toBeLessThanOrEqual(0.001);
    GRADES.slice(0, -1).forEach((g) => { expect(g.p).toBeGreaterThan(last.p); expect(g.mult).toBeLessThan(last.mult); });
    // небывалый взял тысячную у легендарного: редкость прежних урожаев не сдвинулась
    expect(GRADES.slice(0, 4).reduce((a, g) => a + g.p, 0)).toBeCloseTo(0.98, 10);
  });
  it('за сколько куплены семена — цена в день посадки', () => {
    const p = plant(rich(), 'tulip', T);
    expect(paidPrice(p.s, p.at)).toBe(p.price);
    expect(paidPrice(p.s, 123)).toBe(null);
  });
  it('одинаковый урожай — одной строкой ×N, новые сверху; продать все — с насыщением спроса', () => {
    let s = rich(20000); const ats = [];
    // 30 ромашек: строк столько, сколько разных редкостей, а не 30
    for (let k = 0; k < 30; k += 1) { const g = grow(s, 'chamomile', T + k * 7919); s = g.s; ats.push(g.at); }
    const groups = cropGroups(s);
    expect(groups.length).toBe(new Set(ats.map(gradeOf)).size);
    expect(groups.reduce((a, g) => a + g.ats.length, 0)).toBe(30);
    groups.forEach((g) => { expect(g.paid[0]).toBeLessThanOrEqual(g.paid[1]); g.ats.forEach((at) => expect(gradeOf(at)).toBe(g.grade)); });
    const t = grow(s, 'tulip', T + 40 * 7919);
    expect(cropGroups(t.s)[0]).toMatchObject({ plant: 'tulip', ats: [t.at] });
    const now = T + 30 * HOUR;
    const g = groups[0];
    const one = sell(s, g.ats[0], now);
    const all = sellAll(s, g.ats, now);
    expect(all).toMatchObject({ ok: true, n: g.ats.length });
    expect(balance(all.s)).toBe(balance(s) + all.coins);
    if (g.ats.length > 1) expect(all.coins).toBeLessThan(one.coins * g.ats.length);
    expect(cropGroups(all.s).find((x) => x.key === g.key)).toBeUndefined();
  });
});
