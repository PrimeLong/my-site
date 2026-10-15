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
  it('места соперников меняются по ходу недели: кто-то пропустил день — его обогнали', () => {
    // за неделю в каждой лиге лидер меняется, а у второго места — не один и тот же соперник с понедельника по субботу
    let leaders = 0; let seconds = 0;
    ['bronze', 'silver', 'gold', 'sapphire'].forEach((lg) => {
      const top = []; const second = [];
      for (let d = 0; d < 6; d += 1) for (const h of [10, 14, 18, 22]) {
        const t = standings(emptyLearn(), MON, lg, at(addDays(MON, d), h)).filter((r) => !r.me && r.xp > 0);
        if (t[0]) top.push(t[0].name); if (t[1]) second.push(t[1].name);
      }
      leaders += new Set(top).size; seconds += new Set(second).size;
    });
    expect(leaders).toBeGreaterThan(8);
    expect(seconds).toBeGreaterThan(10);
    // опыт растёт уроками: в течение дня у соперника он не дробится по часам, а прибавляется скачками от 12
    const a = standings(emptyLearn(), MON, 'gold', at(addDays(MON, 2), 11)); const b = standings(emptyLearn(), MON, 'gold', at(addDays(MON, 2), 20));
    const gains = b.filter((r) => !r.me).map((r) => r.xp - a.find((x) => x.id === r.id).xp).filter((g) => g > 0);
    expect(gains.length).toBeGreaterThan(0);
    gains.forEach((g) => expect(g).toBeGreaterThanOrEqual(12));
    // и кто-то в этот день не занимался вовсе
    expect(gains.length).toBeLessThan(GROUP - 1);
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
  it('опыт недели лиги — понедельник … суббота, воскресенье не считается; до повышения — сколько не хватает до пятого места', () => {
    const s = withXp({ [addDays(MON, -1)]: 99, [MON]: 10, [addDays(MON, 5)]: 4, [addDays(MON, 6)]: 5, [addDays(MON, 7)]: 77 });
    expect(weekXp(s, MON)).toBe(14);
    const st = leagueState(withXp({ [MON]: 1 }), at(addDays(MON, 4)));
    expect(st.league).toBe('bronze');
    expect(st.rest).toBe(false);
    expect(st.toPromote).toBeGreaterThan(0);
    // в пятницу до итогов два дня: пятница и суббота
    expect(st.daysLeft).toBe(2);
    expect(leagueState(withXp({ [MON]: 1 }), at(MON)).daysLeft).toBe(6);
    expect(LEAGUES.map((l) => l.title)).toEqual(['Бронзовая', 'Серебряная', 'Золотая', 'Сапфировая', 'Рубиновая', 'Изумрудная', 'Алмазная']);
  });
});

describe('лига: перерыв в воскресенье', () => {
  it('в воскресенье неделя уже подведена: итог в истории, награду можно забрать, таблица — окончательная', () => {
    const s = withXp({ [MON]: 3000 });
    const sun = at(addDays(MON, 6), 15);
    const st = leagueState(s, sun);
    expect(st.rest).toBe(true);
    expect(st.daysLeft).toBe(0);
    expect(st.league).toBe('bronze');
    expect(st.next).toBe('silver');
    expect(st.me.place).toBe(1);
    expect(st.history.map((h) => h.week)).toEqual([MON]);
    expect(pendingRewards(s, sun)).toHaveLength(1);
    // таблица в перерыв не растёт: соперники в 15:00 и в 23:00 с тем же опытом
    expect(leagueState(s, at(addDays(MON, 6), 23)).table.map((r) => r.xp)).toEqual(st.table.map((r) => r.xp));
    // в понедельник — уже новая неделя в Серебряной
    const mon = leagueState(s, at(addDays(MON, 7)));
    expect(mon).toMatchObject({ rest: false, league: 'silver', next: 'silver' });
  });
  it('опыт воскресенья не меняет итог недели', () => {
    const a = leagueState(withXp({ [MON]: 30 }), at(addDays(MON, 6)));
    const b = leagueState(withXp({ [MON]: 30, [addDays(MON, 6)]: 5000 }), at(addDays(MON, 6)));
    expect(b.me.place).toBe(a.me.place);
    expect(b.history).toEqual(a.history);
  });
  it('в зоне понижения видно, сколько опыта нужно, чтобы выбраться', () => {
    const s = withXp({ [MON]: 3000, [addDays(MON, 7)]: 1 });
    const st = leagueState(s, at(addDays(MON, 12)));
    expect(st.league).toBe('silver');
    expect(st.me.zone).toBe('down');
    const fifteenth = st.table.filter((r) => !r.me)[GROUP - 5 - 1];
    expect(st.toSafe).toBe(fifteenth.xp - st.me.xp + 1);
  });
});
