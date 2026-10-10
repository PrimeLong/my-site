/* Лиги недели: таблица одна на всех устройствах, растёт по дням; первые пять поднимаются,
   последние пять опускаются; награда за первые три места — один раз. */
import { describe, it, expect } from 'vitest';
import { LEAGUES, GROUP, PROMOTE, PLACE_COINS, standings, leagueState, claimLeague, pendingRewards, weekXp, zoneOf } from '../league.js';
import { emptyLearn, mergeLearn, addDays } from '../../textbook/learn-state.js';
import { balance } from '../rewards.js';

const MON = '2026-10-05'; // понедельник
const at = (day, h = 12) => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d, h).getTime(); };
const withXp = (map) => ({ ...emptyLearn(), xp: map });

describe('лига: таблица недели', () => {
  it('двадцать учеников, одни и те же на любом устройстве; соперники копят опыт по ходу недели', () => {
    const s = withXp({ [MON]: 50 });
    const a = standings(s, MON, 'bronze', at(addDays(MON, 2)));
    const b = standings(s, MON, 'bronze', at(addDays(MON, 2)));
    expect(a).toHaveLength(GROUP);
    expect(a).toEqual(b);
    const later = standings(s, MON, 'bronze', at(addDays(MON, 5)));
    const sum = (t) => t.filter((r) => !r.me).reduce((x, r) => x + r.xp, 0);
    expect(sum(later)).toBeGreaterThan(sum(a));
    // имена соперников в группе не повторяются
    expect(new Set(a.map((r) => r.name)).size).toBe(GROUP);
  });
  it('в старших лигах соперники набирают больше', () => {
    const avg = (lg) => { let t = 0; for (let k = 0; k < 20; k += 1) { const w = addDays(MON, 7 * k); t += standings(emptyLearn(), w, lg, at(addDays(w, 9))).filter((r) => !r.me).reduce((x, r) => x + r.xp, 0); } return t; };
    expect(avg('diamond')).toBeGreaterThan(avg('gold'));
    expect(avg('gold')).toBeGreaterThan(avg('bronze'));
  });
  it('зоны: первые пять — вверх, последние пять — вниз; в Бронзовой вниз некуда, в Алмазной вверх', () => {
    expect(zoneOf(1, 'silver')).toBe('up'); expect(zoneOf(PROMOTE, 'silver')).toBe('up'); expect(zoneOf(PROMOTE + 1, 'silver')).toBe('stay');
    expect(zoneOf(GROUP, 'silver')).toBe('down'); expect(zoneOf(GROUP, 'bronze')).toBe('stay'); expect(zoneOf(1, 'diamond')).toBe('stay');
  });
  it('настоящие имена встают на места ботов, но опыт и места соперников не меняют', () => {
    const s = withXp({ [MON]: 80 });
    const plain = standings(s, MON, 'gold', at(addDays(MON, 3)));
    const named = standings(s, MON, 'gold', at(addDays(MON, 3)), ['Тест Т.', 'Проверка П.']);
    expect(named.map((r) => r.xp)).toEqual(plain.map((r) => r.xp));
    expect(named.filter((r) => ['Тест Т.', 'Проверка П.'].includes(r.name))).toHaveLength(2);
  });
});

describe('лига: переходы и награды', () => {
  it('много опыта за неделю — первое место, повышение и 50 монет; неделя без опыта лигу не меняет', () => {
    const s = withXp({ [MON]: 3000, [addDays(MON, 14)]: 3000 });
    const st = leagueState(s, at(addDays(MON, 22)));
    expect(st.history.map((h) => [h.week, h.league, h.place, h.to])).toEqual([[MON, 'bronze', 1, 'silver'], [addDays(MON, 14), 'silver', 1, 'gold']]);
    expect(st.league).toBe('gold');
    expect(st.history[0].coins).toBe(PLACE_COINS[0]);
  });
  it('мало опыта в Серебряной — понижение в Бронзовую', () => {
    // неделя 1: 3000 опыта — в Серебряную; неделя 2: 1 опыт — последнее место и вниз
    const s = withXp({ [MON]: 3000, [addDays(MON, 7)]: 1 });
    const st = leagueState(s, at(addDays(MON, 15)));
    expect(st.history[1]).toMatchObject({ league: 'silver', move: 'down', to: 'bronze', coins: 0 });
    expect(st.league).toBe('bronze');
  });
  it('награда выдаётся один раз — и на двух устройствах', () => {
    const s = withXp({ [MON]: 3000 });
    const now = at(addDays(MON, 8));
    expect(pendingRewards(s, now)).toHaveLength(1);
    const r = claimLeague(s, now);
    expect(r.coins).toBe(50);
    expect(balance(r.s)).toBe(50);
    expect(claimLeague(r.s, now).coins).toBe(0);
    expect(balance(claimLeague(mergeLearn(r.s, s), now).s)).toBe(50);
  });
  it('опыт недели — сумма дней с понедельника по воскресенье; до повышения — сколько не хватает до пятого места', () => {
    const s = withXp({ [addDays(MON, -1)]: 99, [MON]: 10, [addDays(MON, 6)]: 5, [addDays(MON, 7)]: 77 });
    expect(weekXp(s, MON)).toBe(15);
    const st = leagueState(withXp({ [MON]: 1 }), at(addDays(MON, 4)));
    expect(st.league).toBe('bronze');
    expect(st.toPromote).toBeGreaterThan(0);
    expect(st.daysLeft).toBe(3);
    expect(LEAGUES.map((l) => l.title)).toEqual(['Бронзовая', 'Серебряная', 'Золотая', 'Сапфировая', 'Рубиновая', 'Изумрудная', 'Алмазная']);
  });
});
