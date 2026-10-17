// Хеллоуин (docs/mechanics.md, «Хеллоуин»): сезон, тыквы за уроки, «Паутина» и хеллоуинская витрина
import { describe, it, expect } from 'vitest';
import { halloween, halloweenOn, claimHalloween, PUMPKIN_GOAL, WEB_FRAME, seasonLeftText } from '../halloween.js';
import { OUTFITS, SEASON_ITEMS, shopDay, buy, earn, outfitOf } from '../rewards.js';
import { emptyLearn } from '../../textbook/learn-state.js';

const at = (day, h = 12) => new Date(`${day}T${String(h).padStart(2, '0')}:00:00`).getTime();
const withDone = (done) => ({ ...emptyLearn(), done });

describe('сезон', () => {
  it('с 16 октября по 2 ноября включительно, каждый год', () => {
    expect(halloweenOn('2026-10-15')).toBe(false);
    expect(halloweenOn('2026-10-16')).toBe(true);
    expect(halloweenOn('2026-10-31')).toBe(true);
    expect(halloweenOn('2026-11-02')).toBe(true);
    expect(halloweenOn('2026-11-03')).toBe(false);
    expect(halloweenOn('2027-10-20')).toBe(true);
  });
  it('сколько осталось: сегодня — тоже день; до сезона — через сколько дней начнётся', () => {
    expect(halloween(emptyLearn(), at('2026-10-16')).daysLeft).toBe(18);
    expect(halloween(emptyLearn(), at('2026-11-02')).lastDay).toBe(true);
    expect(seasonLeftText(halloween(emptyLearn(), at('2026-11-02')))).toBe('сегодня последний день');
    expect(seasonLeftText(halloween(emptyLearn(), at('2026-11-01')))).toBe('ещё 2 дня');
    expect(halloween(emptyLearn(), at('2026-10-10')).startsIn).toBe(6);
    expect(halloween(emptyLearn(), at('2026-11-10')).startsIn).toBe(null);
  });
});

describe('13 тыкв — рамка «Паутина»', () => {
  it('тыквы — уроки сезона этого года; до сезона и прошлый год не считаются', () => {
    const s = withDone({ '2026-10-15': 5, '2026-10-16': 2, '2026-10-20': 3, '2025-10-20': 9 });
    const h = halloween(s, at('2026-10-21'));
    expect(h.pumpkins).toBe(5);
    expect(h.ready).toBe(false);
    // больше цели корзина не растёт
    expect(halloween(withDone({ '2026-10-20': 40 }), at('2026-10-21')).pumpkins).toBe(PUMPKIN_GOAL);
  });
  it('забрать — только когда собраны все и только в сезон; рамка сразу надета, второй раз не выдаётся', () => {
    const s = withDone({ '2026-10-18': 7, '2026-10-25': 6 });
    expect(claimHalloween(withDone({ '2026-10-18': 12 }), at('2026-10-26')).ok).toBe(false);
    const r = claimHalloween(s, at('2026-10-26'));
    expect(r.ok).toBe(true);
    expect(r.s.owned[WEB_FRAME]).toBeTruthy();
    expect(outfitOf(r.s).frame).toBe(WEB_FRAME);
    expect(halloween(r.s, at('2026-10-27')).claimed).toBe(true);
    expect(claimHalloween(r.s, at('2026-10-27')).ok).toBe(false);
    // после сезона — уже нельзя, но рамка остаётся
    expect(claimHalloween(s, at('2026-11-05')).ok).toBe(false);
    expect(halloween(r.s, at('2027-10-20')).claimed).toBe(false);
  });
});

describe('хеллоуинская витрина', () => {
  const rich = (now) => earn(emptyLearn(), 20000, null, now);
  it('сезонные вещи — не на витрине дня и не у ювелира; своя витрина — только в сезон', () => {
    const season = OUTFITS.filter((o) => o.season);
    expect(season.map((o) => o.slot).sort()).toEqual(['face', 'frame', 'hand', 'head', 'head', 'neck']);
    for (const day of ['2026-10-20', '2026-12-01']) {
      const d = shopDay(emptyLearn(), day);
      d.showcase.forEach((id) => expect(SEASON_ITEMS).not.toContain(id));
      d.rare.forEach((id) => expect(season.map((o) => o.id)).not.toContain(id));
    }
    expect(shopDay(emptyLearn(), '2026-10-20').season).toEqual(SEASON_ITEMS);
    expect(shopDay(emptyLearn(), '2026-12-01').season).toEqual([]);
    expect(SEASON_ITEMS).not.toContain(WEB_FRAME);
  });
  it('купить — только в сезон; купленное носится и после; «Паутину» не купить', () => {
    const inSeason = at('2026-10-20');
    const r = buy(rich(inSeason), 'witch', inSeason);
    expect(r.ok).toBe(true);
    expect(outfitOf(r.s).head).toBe('witch');
    const after = at('2026-12-01');
    expect(buy(rich(after), 'witch', after).reason).toMatch(/только на Хеллоуин/);
    expect(buy(rich(inSeason), WEB_FRAME, inSeason).reason).toMatch(/не купить/);
  });
});
