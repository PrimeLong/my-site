/* Сад Инфли: семена за монеты по курсу дня, растение растёт по часам — и офлайн; редкое растёт
   дольше; собранное уходит в гербарий; посадки и сборы переживают слияние устройств. */
import { describe, it, expect } from 'vitest';
import { PLANTS, PLANT_BY_ID, RARITY_ORDER, GARDEN_PLOTS, plant, harvest, herbarium, gardenPlots, growth, growMs, plantPrice, leftText, ripeCount } from '../garden.js';
import { emptyLearn, normalizeLearn, mergeLearn, dayOf } from '../../textbook/learn-state.js';
import { balance, earn, courseIncome, RATE_MAX } from '../rewards.js';

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
