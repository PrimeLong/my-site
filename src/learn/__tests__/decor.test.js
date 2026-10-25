/* Украшения урока: продаются дороже всего в лавке, но не дороже 70% заработка курса; надеваются
   в своё место «desk» и не попадают ни на Инфлю, ни в гардероб; физика каждой вещицы остаётся в
   полосе, успокаивается и засыпает (в покое — ни кадра), а ответ её будит. */
import { describe, it, expect } from 'vitest';
import { OUTFITS, OUTFIT_BY_ID, DESK_ITEMS, WARDROBE, RATE_MAX, courseIncome, shopDay, buy, setWear, outfitOf, deskOf, earn, ACHIEVEMENTS } from '../rewards.js';
import { emptyLearn, normalizeLearn, mergeLearn, dayOf } from '../../textbook/learn-state.js';
import { decorModel, decorStep, kick, DECOR_IDS } from '../../learn-decor.jsx';

const T = Date.parse('2026-10-25T12:00:00Z');

describe('украшения урока в лавке', () => {
  it('три вещицы, у каждой подпись; дороже всего прочего, но не дороже 70% заработка курса по худшему курсу', () => {
    expect(DESK_ITEMS).toEqual(DECOR_IDS);
    const desk = DESK_ITEMS.map((id) => OUTFIT_BY_ID[id]);
    desk.forEach((o) => { expect(o.slot).toBe('desk'); expect(o.rare).toBe(true); expect(o.note, o.id).toBeTruthy(); });
    const others = Math.max(...OUTFITS.filter((o) => o.slot !== 'desk').map((o) => o.crowns));
    desk.forEach((o) => expect(o.crowns, o.id).toBeGreaterThan(others));
    desk.forEach((o) => expect(Math.ceil(o.crowns * RATE_MAX), o.id).toBeLessThanOrEqual(0.7 * courseIncome().total));
  });
  it('своя витрина: всегда в продаже, не на витрине ювелира и не в гардеробе', () => {
    const day = dayOf(T);
    const t = shopDay(emptyLearn(), day);
    expect(t.desk).toEqual(DESK_ITEMS);
    DESK_ITEMS.forEach((id) => { expect(t.rare).not.toContain(id); expect(t.showcase).not.toContain(id); });
    expect(WARDROBE.some((o) => o.slot === 'desk')).toBe(false);
    expect(WARDROBE.length + DESK_ITEMS.length).toBe(OUTFITS.length);
  });
  it('покупка вешает вещицу в уроки, Инфля без изменений; снять и повесить — только купленное; печать «Коллекционер» — не за неё', () => {
    const rich = earn(emptyLearn(), 20000, null, T);
    const r = buy(rich, 'desk-cradle', T);
    expect(r.ok).toBe(true);
    expect(deskOf(r.s)).toBe('desk-cradle');
    expect(outfitOf(r.s)).toEqual(outfitOf(rich));
    expect(deskOf(setWear(r.s, 'desk', null, T))).toBe(null);
    expect(deskOf(setWear(r.s, 'desk', 'desk-mobile', T))).toBe('desk-cradle');
    expect(deskOf(setWear(r.s, 'hand', 'desk-cradle', T))).toBe('desk-cradle');
    expect(ACHIEVEMENTS.find((a) => a.id === 'rare').test(r.s)).toBe(false);
    expect(ACHIEVEMENTS.find((a) => a.id === 'rare').test(buy(rich, 'crown', T).s)).toBe(true);
  });
  it('надетое переживает нормализацию и слияние устройств', () => {
    const rich = earn(emptyLearn(), 20000, null, T);
    const s = normalizeLearn(buy(rich, 'desk-bunting', T).s);
    expect(deskOf(s)).toBe('desk-bunting');
    expect(deskOf(mergeLearn(normalizeLearn(rich), s))).toBe('desk-bunting');
  });
});

/* Модель живёт в кадрах по 1/60 с; энергия — то, что цикл анимации сравнивает с порогом 0,05:
   ниже порога 50 кадров подряд — засыпает. */
const settle = (m, H, frames = 60 * 40) => {
  let calm = 0; let k = 0;
  for (; k < frames && calm <= 50; k += 1) { m.t += 1 / 60; calm = decorStep(m, 1 / 60, H) < 0.05 ? calm + 1 : 0; }
  return calm > 50 ? k / 60 : Infinity;
};
const bounds = (m, H) => {
  if (m.kind === 'bunting') return m.pts.every((p) => p.y >= 0 && p.y + 19 <= H);
  if (m.kind === 'cradle') return m.balls.every((b) => m.top + Math.cos(b.a) * m.L + m.r <= H);
  return m.coins.every((c) => m.top + Math.cos(c.a) * c.L + 18 <= H);
};

describe('физика вещиц', () => {
  [[560, 48], [320, 48], [260, 64]].forEach(([W, H]) => DECOR_IDS.forEach((id) => {
    it(`${id} ${W}×${H}: в полосе, засыпает, ответ будит, снова засыпает`, () => {
      const m = decorModel(id, W, H);
      const first = settle(m, H);
      expect(first, 'успокаивается сама').toBeLessThan(25);
      expect(bounds(m, H)).toBe(true);
      kick(m, true);
      expect(decorStep(m, 1 / 60, H), 'верный ответ будит').toBeGreaterThan(0.05);
      let inside = true;
      for (let k = 0; k < 120; k += 1) { decorStep(m, 1 / 60, H); inside = inside && bounds(m, H); }
      expect(inside, 'не вылетает из полосы').toBe(true);
      expect(settle(m, H), 'после верного ответа').toBeLessThan(25);
      kick(m, false);
      expect(decorStep(m, 1 / 60, H), 'ошибка — тоже').toBeGreaterThan(0.05);
      expect(settle(m, H), 'после ошибки').toBeLessThan(25);
    });
  }));
  it('гирлянда в покое провисает посередине, а не лежит на дне полосы', () => {
    const H = 48; const m = decorModel('desk-bunting', 560, H);
    settle(m, H);
    const mid = m.pts[Math.floor(m.pts.length / 2)].y; const edge = m.pts[0].y;
    expect(mid - edge).toBeGreaterThan(6);
    expect(mid).toBeLessThan(H - 22);
  });
  it('колыбель: оттянутый крайний шарик передаёт удар — отлетает противоположный', () => {
    const H = 48; const m = decorModel('desk-cradle', 400, H);
    kick(m, true);
    let far = 0;
    for (let k = 0; k < 40; k += 1) { decorStep(m, 1 / 60, H); far = Math.max(far, m.balls[4].a); }
    expect(far).toBeGreaterThan(0.3);
    expect(m.clicks).toBeGreaterThan(0);
  });
  it('мобиле: закрученная монета раскручивается и в покое смотрит лицом', () => {
    const H = 48; const m = decorModel('desk-mobile', 400, H);
    kick(m, true);
    settle(m, H);
    m.coins.forEach((c) => expect(Math.cos(c.spin)).toBeGreaterThan(0.99));
  });
});

describe('колыбель: несколько шариков сразу', () => {
  it('взяли второй слева — подняты два; отпустили — справа вылетают два', async () => {
    const { holdCradle, cradleGroup } = await import('../../learn-decor.jsx');
    const H = 48; const m = decorModel('desk-cradle', 400, H);
    expect(cradleGroup(m, 1, -1).group).toHaveLength(2);
    expect(cradleGroup(m, 3, 1).group).toHaveLength(2);
    expect(cradleGroup(m, 2, -1).group).toHaveLength(3);
    expect(cradleGroup(m, 2, 1).left).toBe(false);
    expect(holdCradle(m, 1, -m.L * 0.6)).toBe(2);
    expect(m.balls[0].a).toBeCloseTo(m.balls[1].a);
    expect(m.balls[0].a).toBeLessThan(-0.3);
    m.balls.forEach((b) => { b.drag = false; });
    let out3 = 0; let out4 = 0;
    for (let k = 0; k < 45; k += 1) { decorStep(m, 1 / 60, H); out3 = Math.max(out3, m.balls[3].a); out4 = Math.max(out4, m.balls[4].a); }
    expect(out4).toBeGreaterThan(0.25);
    expect(out3).toBeGreaterThan(0.25);
  });
});
