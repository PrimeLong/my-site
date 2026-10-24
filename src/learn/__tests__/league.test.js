/* Лиги недели: таблица одна на всех устройствах, растёт по дням; первые пять поднимаются,
   последние пять опускаются; награда за первые три места — один раз. */
import { describe, it, expect } from 'vitest';
import { LEAGUES, GROUP, PROMOTE, PLACE_COINS, standings, leagueState, claimLeague, pendingRewards, weekXp, zoneOf, LEAGUE_V2_FROM, XP_PER_MIN, LESSON_XP, stayMinutes, promoteMinutes } from '../league.js';
import { LESSONS } from '../course.js';
import { lessonXp, XP } from '../../textbook/learn-state.js';
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

describe('лига: новичок не попадает в идущую неделю', () => {
  const MON2 = '2026-10-19'; // понедельник после начала правила
  it('пришёл в четверг — ждёт понедельника: опыт этой недели в лигу не идёт, уведомлений лиги нет', () => {
    const thu = addDays(MON2, 3);
    const s = { ...emptyLearn(), profile: { ...emptyLearn().profile, at: at(thu, 9) }, xp: { [thu]: 120 } };
    const st = leagueState(s, at(thu, 18));
    expect(st.waiting).toBe(true);
    expect(st.joined).toBe(false);
    expect(st.startsOn).toBe(addDays(MON2, 7));
    expect(st.table.find((r) => r.me).xp).toBe(0);
    // с понедельника — в лиге, первая неделя в истории — следующая
    const next = { ...s, xp: { ...s.xp, [addDays(MON2, 7)]: 40 } };
    const later = leagueState(next, at(addDays(MON2, 7), 18));
    expect(later.waiting).toBe(false);
    expect(later.joined).toBe(true);
    expect(leagueState(next, at(addDays(MON2, 14), 18)).history.map((h) => h.week)).toEqual([addDays(MON2, 7)]);
  });
  it('пришёл в понедельник — сразу в лиге; пришедших до правила не пересчитываем', () => {
    const s = { ...emptyLearn(), profile: { ...emptyLearn().profile, at: at(MON2, 9) }, xp: { [MON2]: 60 } };
    expect(leagueState(s, at(MON2, 18))).toMatchObject({ waiting: false, joined: true });
    const old = withXp({ [addDays(MON, 3)]: 60 });
    expect(leagueState(old, at(addDays(MON, 3), 18))).toMatchObject({ waiting: false, joined: true });
  });
});

/* Лиги по минутам (с недели LEAGUE_V2_FROM): каждая лига сложнее предыдущей. Ученик просто
   проходит уроки — без двойного опыта и прочих ускорений: m минут в день все шесть дней недели
   лиги дают m · XP_PER_MIN опыта в день. В лиге N остаться — 5·N минут в день, подняться — чуть больше. */
describe('лиги по минутам: каждая лига сложнее предыдущей', () => {
  const weeks = Array.from({ length: 52 }, (_, k) => addDays(LEAGUE_V2_FROM, 7 * k));
  const weekOf = (w, min) => withXp(Object.fromEntries(Array.from({ length: 6 }, (_, d) => [addDays(w, d), Math.round(min * XP_PER_MIN)])));
  const placeAt = (lg, w, min) => standings(weekOf(w, min), w, lg, at(addDays(w, 7))).find((r) => r.me).place;
  const places = (lg, min) => weeks.map((w) => placeAt(lg, w, min));

  it('честный темп: опыт в минуту — как у обычного урока курса (верно 85% с первой попытки, полминуты на упражнение и минута теории)', () => {
    let xp = 0; let sec = 0; let n = 0;
    LESSONS.forEach((l) => {
      const ex = (l.exercises || []).length;
      if (!ex) return;
      // ошибка — каждое седьмое упражнение; с третьего верного подряд — бонус серии
      let run = 0; let first = 0; let bonus = 0;
      for (let j = 0; j < ex; j += 1) {
        if ((j + 1) % 7 === 0) { run = 0; continue; }
        first += 1; run += 1; if (run >= XP.streakFrom) bonus += 1;
      }
      xp += lessonXp({ firstTry: first, replay: false, bonus }); sec += ex * 30 + 60; n += 1;
    });
    const perMin = xp / (sec / 60);
    expect(XP_PER_MIN).toBeGreaterThan(perMin * 0.8);
    expect(XP_PER_MIN).toBeLessThan(perMin * 1.2);
    // и урок соперника — как урок ученика
    expect(LESSON_XP).toBeGreaterThan((xp / n) * 0.75);
    expect(LESSON_XP).toBeLessThan((xp / n) * 1.3);
  });
  it('минуты по лигам: остаться — 5, 10, 15 … 35; подняться — чуть больше', () => {
    expect(LEAGUES.map((l) => stayMinutes(l.id))).toEqual([5, 10, 15, 20, 25, 30, 35]);
    LEAGUES.forEach((l) => { expect(promoteMinutes(l.id) - stayMinutes(l.id)).toBeGreaterThan(0); expect(promoteMinutes(l.id) - stayMinutes(l.id)).toBeLessThanOrEqual(3); });
  });
  it('5·N минут в день хватает, чтобы остаться в лиге N, — каждую неделю года', () => {
    LEAGUES.forEach((l) => { expect(Math.max(...places(l.id, stayMinutes(l.id))), l.id).toBeLessThanOrEqual(GROUP - 5); });
  });
  it('чуть больше — и вы в первой пятёрке: повышение каждую неделю', () => {
    LEAGUES.slice(0, -1).forEach((l) => { expect(Math.max(...places(l.id, promoteMinutes(l.id))), l.id).toBeLessThanOrEqual(PROMOTE); });
  });
  it('темпа прошлой лиги уже мало: в Серебряной не хватает пяти минут, в Золотой — десяти, … — понижение', () => {
    LEAGUES.slice(1).forEach((l, i) => { expect(Math.min(...places(l.id, stayMinutes(LEAGUES[i].id))), l.id).toBeGreaterThan(GROUP - 5); });
  });
  it('с темпом «остаться» в первую пятёрку попадают редко — подняться нужно чуть больше', () => {
    LEAGUES.slice(0, -1).forEach((l) => { const up = places(l.id, stayMinutes(l.id)).filter((p) => p <= PROMOTE).length; expect(up / weeks.length, l.id).toBeLessThan(0.25); });
  });
  it('ровно 11 минут в день неделя за неделей: из Бронзовой — в Серебряную и там остаётся (Золотая не по силам)', () => {
    const xp = {};
    weeks.slice(0, 12).forEach((w) => { for (let d = 0; d < 6; d += 1) xp[addDays(w, d)] = 11 * XP_PER_MIN; });
    const st = leagueState(withXp(xp), at(addDays(weeks[12], 1)));
    expect(st.history[0]).toMatchObject({ league: 'bronze', move: 'up' });
    const later = st.history.slice(1).map((h) => h.league);
    expect(later.every((lg) => lg === 'silver' || lg === 'gold')).toBe(true);
    expect(later.filter((lg) => lg === 'silver').length).toBeGreaterThan(later.length * 0.7);
  });
  it('соперники правдоподобны: урок — от 12 опыта, в день не больше двадцати уроков; итог растёт уроками по ходу недели', () => {
    LEAGUES.forEach((l) => weeks.slice(0, 8).forEach((w) => {
      standings(emptyLearn(), w, l.id, at(addDays(w, 7))).filter((r) => !r.me).forEach((r) => {
        r.days.forEach((list) => { expect(list.length).toBeLessThanOrEqual(20); list.forEach(([h, g]) => { expect(g).toBeGreaterThanOrEqual(12); expect(g).toBeLessThanOrEqual(40); expect(h).toBeLessThanOrEqual(23.5); }); });
        expect(r.total).toBe(r.days.flat().reduce((a, [, g]) => a + g, 0));
      });
    }));
    // по ходу недели лидер меняется
    const top = new Set();
    for (let d = 0; d < 6; d += 1) for (const h of [10, 16, 22]) { const t = standings(emptyLearn(), weeks[1], 'silver', at(addDays(weeks[1], d), h)).filter((r) => !r.me && r.xp > 0); if (t[0]) top.add(t[0].name); }
    expect(top.size).toBeGreaterThan(1);
  });
  it('прошлые недели не пересчитываются: соперники до LEAGUE_V2_FROM — прежние', () => {
    const totals = (w, lg) => standings(emptyLearn(), w, lg, at('2026-11-30')).filter((r) => !r.me).map((r) => r.xp);
    expect(totals('2026-10-05', 'bronze')).toEqual([293, 254, 252, 162, 161, 156, 131, 84, 74, 68, 68, 66, 63, 60, 59, 58, 36, 31, 25]);
    expect(totals('2026-10-19', 'gold')).toEqual([725, 610, 484, 379, 366, 359, 342, 299, 299, 275, 269, 194, 160, 106, 100, 96, 0, 0, 0]);
  });
});
