/* ЛИГИ НЕДЕЛИ (docs/mechanics.md, «Лиги»). Неделя лиги — с понедельника по субботу, воскресенье —
   перерыв: итоги и награды, опыт в лигу не идёт. В группе двадцать учеников: вы и девятнадцать
   соперников. Место — по опыту за шесть дней. По итогам первые пять поднимаются в следующую лигу,
   последние пять опускаются, остальные остаются; в Бронзовой опускаться некуда, в Алмазной —
   подниматься. Первые три места получают монеты.

   Соперники — ученики-боты: имя, привычку, уроки по дням и часам задаёт зерно (неделя, лига,
   номер соперника, день), так что таблица одна и та же на всех устройствах и растёт в течение
   недели скачками — урок за уроком, с пропущенными днями, как у живых учеников: места меняются. Ученики, разрешившие показывать своё имя (api/account.js,
   leaguePublic), могут появиться под именем бота — с выдуманным опытом; на экране об этом
   сказано честно.

   Состояния лиги в профиле нет: она выводится из опыта по дням (learn.xp) — неделя за неделей
   от первой недели с опытом, поэтому два устройства всегда согласны. Неделя без опыта — вне
   лиги: лига не меняется. Награда — через claimed (ключ lg:<понедельник>), дважды не выдаётся.

   Новичок не попадает в идущую неделю: соперники набирают опыт с понедельника, а он пришёл в
   четверг — его первая неделя лиги начинается с ближайшего понедельника (пришёл в понедельник —
   с этой недели). До тех пор на вкладке — «Ваша лига начнётся в понедельник». */
import { dayOf, addDays, weekOf } from '../textbook/learn-state.js';
import { earn, hasClaim } from './rewards.js';

export const LEAGUES = [
  { id: 'bronze', title: 'Бронзовая', color: '#8A5A2B', median: 110 },
  { id: 'silver', title: 'Серебряная', color: '#6E7680', median: 170 },
  { id: 'gold', title: 'Золотая', color: '#9A7413', median: 240 },
  { id: 'sapphire', title: 'Сапфировая', color: '#2F5D8C', median: 320 },
  { id: 'ruby', title: 'Рубиновая', color: '#9B2335', median: 420 },
  { id: 'emerald', title: 'Изумрудная', color: '#2E6B4A', median: 540 },
  { id: 'diamond', title: 'Алмазная', color: '#4A6A86', median: 700 },
];
export const LEAGUE_BY_ID = Object.fromEntries(LEAGUES.map((l) => [l.id, l]));
export const GROUP = 20;
export const PROMOTE = 5;
export const DEMOTE = 5;
// монеты за первые три места — кратны цене урока (10 монет)
export const PLACE_COINS = [50, 30, 20];
// дни соревнования: понедельник — суббота; седьмой день недели — перерыв
export const LEAGUE_DAYS = 6;
export const isBreakDay = (now = Date.now()) => { const day = dayOf(now); return day === addDays(weekOf(day), LEAGUE_DAYS); };
const MAX_WEEKS = 104;
/* С какого дня действует правило «новичок ждёт понедельника»: у тех, кто пришёл раньше, история
   лиги не пересчитывается (иначе первая неделя выпала бы и сдвинула все переходы между лигами). */
export const LEAGUE_WAIT_FROM = '2026-10-17';
// первый день ученика: регистрация или самое раннее занятие
const firstDayOf = (learn) => {
  const days = [...Object.keys(learn.done || {}), ...Object.keys(learn.xp || {})].sort();
  const reg = learn.profile && learn.profile.at ? dayOf(learn.profile.at) : null;
  return [days[0], reg].filter(Boolean).sort()[0] || null;
};
// понедельник первой недели лиги ученика (null — ещё ничего не известно: лига с первой недели с опытом)
export function leagueStart(learn) {
  const first = firstDayOf(learn);
  if (!first) return null;
  const w = weekOf(first);
  return first < LEAGUE_WAIT_FROM || first === w ? w : addDays(w, 7);
}

// генератор с зерном из строки: одна и та же неделя и лига — одни и те же соперники
function rng(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const FIRST = ['Алина', 'Матвей', 'Софья', 'Артём', 'Вика', 'Даня', 'Полина', 'Егор', 'Маша', 'Илья', 'Ксюша', 'Тимофей', 'Лиза', 'Никита', 'Ева', 'Гоша',
  'Арина', 'Лёва', 'Катя', 'Миша', 'Варя', 'Саша', 'Ульяна', 'Федя', 'Аня', 'Роман', 'Злата', 'Кирилл', 'Настя', 'Ярослав', 'Вера', 'Денис', 'Мила', 'Глеб',
  'Таня', 'Олег', 'Надя', 'Платон', 'Юля', 'Марк'];
const LAST = 'АБВГДЕЖЗИКЛМНОПРСТУФХЧШЯ';
const NICKS = ['Белка', 'Совушка', 'Эконом', 'Кофеман', 'Пончик', 'Капучино', 'Звёздочка', 'Ёжик', 'Монетка', 'Калькулятор', 'Сырник', 'Барсик', 'Лимон', 'Чайка'];
const COLORS = ['#86461F', '#4B692C', '#7A3B4E', '#2F5D8C', '#9A4524', '#5E5A24', '#86446A', '#735030', '#4B5B2D', '#6E3226'];

/* Соперник: имя, цвет значка и уроки по дням. Живые ученики занимаются неровно: сегодня два урока,
   завтра ни одного, в субботу рывок; урок даёт опыт сразу, а не размазанно по часам. Поэтому у
   каждого соперника своя привычка (каждый день, по выходным, как придётся, почти бросил) и свой
   «запал» на эту неделю, а каждый день — свой бросок: занимался ли, сколько уроков и в какие часы,
   насколько удачно (опыт урока — от 12 до 32, как у живого ученика с ошибками и без). Так места
   в таблице меняются по ходу недели: Надя, бывшая второй, пропустила день — и её обогнали.
   Всё задаётся зерном (неделя, лига, номер соперника, день) — на всех устройствах одинаково. */
const HABITS = [
  // доля соперников с такой привычкой; вероятность занятий по дням (пн … сб); уроков за раз
  { id: 'daily', share: 0.34, p: [0.85, 0.85, 0.8, 0.85, 0.75, 0.6], lessons: [1, 2] },
  { id: 'weekend', share: 0.18, p: [0.25, 0.2, 0.25, 0.3, 0.55, 0.9], lessons: [2, 4] },
  { id: 'casual', share: 0.32, p: [0.5, 0.45, 0.5, 0.45, 0.45, 0.5], lessons: [1, 3] },
  { id: 'fading', share: 0.08, p: [0.8, 0.55, 0.35, 0.2, 0.12, 0.08], lessons: [1, 2] },
  { id: 'idle', share: 0.08, p: [0.12, 0.08, 0.08, 0.08, 0.06, 0.1], lessons: [1, 1] },
];
// сколько уроков в среднем за неделю даёт привычка — чтобы привести лигу к её медиане опыта
const habitWeek = (h) => h.p.reduce((a, x) => a + x, 0) * ((h.lessons[0] + h.lessons[1]) / 2);
export const LESSON_XP = 22;
function rivals(week, league, realNames = []) {
  const r = rng(`${week}:${league}`);
  const lg = LEAGUE_BY_ID[league];
  const used = new Set();
  const pickName = () => {
    for (let k = 0; k < 50; k += 1) {
      const n = r() < 0.18 ? NICKS[Math.floor(r() * NICKS.length)] : `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}.`;
      if (!used.has(n)) { used.add(n); return n; }
    }
    return `Ученик ${used.size + 1}`;
  };
  /* настоящие имена — не больше шести на группу, в случайных местах. Своё зерно: имена не
     сдвигают опыт соперников, таблица и лига от них не зависят */
  const rr = rng(`${week}:${league}:real`);
  const real = realNames.filter((n) => typeof n === 'string' && n.trim()).slice();
  const realSlots = new Set();
  while (realSlots.size < Math.min(6, real.length)) realSlots.add(Math.floor(rr() * (GROUP - 1)));
  // типичный ученик лиги делает за неделю столько уроков, чтобы набрать её медиану
  const typical = HABITS.reduce((a, h) => a + h.share * habitWeek(h), 0);
  return Array.from({ length: GROUP - 1 }, (_, k) => {
    let roll = r(); let habit = HABITS[HABITS.length - 1];
    for (const h of HABITS) { if (roll < h.share) { habit = h; break; } roll -= h.share; }
    // запал недели: кто-то в ударе, кто-то занят — множитель числа уроков, от ~0.45 до ~2.2
    const drive = ((lg.median * 0.88) / (typical * LESSON_XP)) * Math.exp((r() + r() + r() - 1.5) * 0.75);
    let name = pickName();
    const color = COLORS[Math.floor(r() * COLORS.length)];
    if (realSlots.has(k) && real.length) { const j = Math.floor(rr() * real.length); name = real.splice(j, 1)[0]; }
    // уроки по дням: [час, опыт]; у каждого дня своё зерно — один день не тянет за собой другие
    const days = Array.from({ length: LEAGUE_DAYS }, (_, d) => {
      const dr = rng(`${week}:${league}:${k}:${d}`);
      if (dr() >= Math.min(0.97, habit.p[d] * Math.min(1.25, 0.75 + drive * 0.25))) return [];
      const [lo, hi] = habit.lessons;
      const n = Math.max(1, Math.round((lo + dr() * (hi - lo)) * drive));
      // час первого урока: утро, после школы или вечер; следующие — подряд с паузами
      let h = [7.5, 15, 19][Math.floor(dr() * 3)] + dr() * 3.5;
      return Array.from({ length: Math.min(n, 9) }, () => {
        const at = Math.min(23.5, h); h += 0.15 + dr() * (dr() < 0.3 ? 4 : 0.6);
        return [Math.round(at * 100) / 100, 12 + Math.round(dr() * 20)];
      });
    });
    const total = days.reduce((a, list) => a + list.reduce((x, [, xp]) => x + xp, 0), 0);
    return { id: `b${k}`, name, color, total, days, habit: habit.id, bot: true };
  });
}
/* Опыт соперника к моменту now: прошедшие дни целиком, сегодня — уроки, час которых уже прошёл.
   В будущее и в прошлое недели не заглядывает: после субботы — весь итог. */
function rivalXp(rv, week, now) {
  const today = dayOf(now);
  const hour = new Date(now).getHours() + new Date(now).getMinutes() / 60;
  let xp = 0;
  for (let d = 0; d < LEAGUE_DAYS; d += 1) {
    const day = addDays(week, d);
    if (day > today) break;
    rv.days[d].forEach(([h, gain]) => { if (day < today || h <= hour) xp += gain; });
  }
  return xp;
}
// опыт недели лиги — понедельник … суббота; воскресенье — перерыв
export const weekXp = (learn, week) => Array.from({ length: LEAGUE_DAYS }, (_, d) => (learn.xp || {})[addDays(week, d)] || 0).reduce((a, x) => a + x, 0);
const tierIndex = (id) => LEAGUES.findIndex((l) => l.id === id);
// зона места: up — поднимутся, down — опустятся
export function zoneOf(place, league) {
  const i = tierIndex(league);
  if (place <= PROMOTE && i < LEAGUES.length - 1) return 'up';
  if (place > GROUP - DEMOTE && i > 0) return 'down';
  return 'stay';
}
/* Таблица группы: вы и соперники, по убыванию опыта. При равенстве вы — ниже бота: место надо
   взять опытом. */
export function standings(learn, week, league, now = Date.now(), realNames = []) {
  const done = dayOf(now) > addDays(week, LEAGUE_DAYS - 1);
  const rows = rivals(week, league, realNames).map((rv) => ({ ...rv, xp: done ? rv.total : rivalXp(rv, week, now) }));
  rows.push({ id: 'me', name: 'Вы', me: true, xp: weekXp(learn, week) });
  rows.sort((a, b) => b.xp - a.xp || (a.me ? 1 : b.me ? -1 : 0));
  return rows.map((row, k) => ({ ...row, place: k + 1, zone: zoneOf(k + 1, league) }));
}
/* Лига ученика неделя за неделей — от первой недели с опытом до прошлой. Возвращает нынешнюю
   лигу, таблицу текущей недели и историю: место, переход и награду каждой прошлой недели.
   В воскресенье (перерыв) неделя уже подведена: она в истории, а таблица — её итог (rest: true),
   league — лига, в которой неделю играли, next — куда она ведёт. */
export function leagueState(learn, now = Date.now(), realNames = []) {
  const thisWeek = weekOf(dayOf(now));
  const rest = isBreakDay(now);
  const days = Object.keys(learn.xp || {}).filter((d) => (learn.xp[d] || 0) > 0).sort();
  const start = leagueStart(learn);
  // пришёл посреди недели — ждёт понедельника: в идущую неделю лиги не попадает
  const waiting = !!start && thisWeek < start;
  let league = 'bronze';
  const history = [];
  if (days.length) {
    let w = weekOf(days[0]);
    if (start && w < start) w = start;
    const oldest = addDays(thisWeek, -7 * MAX_WEEKS);
    if (w < oldest) w = oldest;
    for (; w < thisWeek || (rest && w === thisWeek); w = addDays(w, 7)) {
      const xp = weekXp(learn, w);
      if (!xp) continue;
      const table = standings(learn, w, league, now);
      const me = table.find((row) => row.me);
      const i = tierIndex(league);
      const next = me.zone === 'up' ? LEAGUES[i + 1].id : me.zone === 'down' ? LEAGUES[i - 1].id : league;
      history.push({ week: w, league, place: me.place, xp, move: me.zone, to: next, coins: PLACE_COINS[me.place - 1] || 0 });
      league = next;
    }
  }
  // в перерыв на экране — итог этой недели в той лиге, где её играли
  const restWeek = rest && history.length && history[history.length - 1].week === thisWeek ? history[history.length - 1] : null;
  const shown = restWeek ? restWeek.league : league;
  // ждущий понедельника в таблице идущей недели не стоит: его опыт этой недели в лигу не идёт
  const table = standings(waiting ? { ...learn, xp: {} } : learn, thisWeek, shown, now, realNames);
  const me = table.find((row) => row.me);
  const others = table.filter((row) => !row.me);
  // сколько опыта до зоны повышения (до пятого места) — 0, если уже там
  const toPromote = rest || me.zone === 'up' || tierIndex(shown) === LEAGUES.length - 1 ? 0 : Math.max(1, others[PROMOTE - 1].xp - me.xp + 1);
  // сколько опыта, чтобы выйти из зоны понижения (обогнать 15-го)
  const toSafe = rest || me.zone !== 'down' ? 0 : Math.max(1, others[GROUP - DEMOTE - 1].xp - me.xp + 1);
  // дней до итогов, считая сегодняшний: в понедельник — 6, в субботу — 1, в воскресенье (перерыв) — 0
  const daysLeft = rest ? 0 : LEAGUE_DAYS - Array.from({ length: LEAGUE_DAYS }, (_, d) => addDays(thisWeek, d)).indexOf(dayOf(now));
  return { league: shown, next: league, rest: rest && !waiting, week: thisWeek, table, me, toPromote, toSafe, daysLeft, history,
    joined: !waiting && weekXp(learn, thisWeek) > 0, waiting, startsOn: waiting ? start : null };
}
// невыданные награды прошлых недель
export const pendingRewards = (learn, now = Date.now()) => leagueState(learn, now).history.filter((h) => h.coins > 0 && !hasClaim(learn, `lg:${h.week}`));
// забрать награды: монеты зачисляются сегодняшним днём, ключ не даёт выдать их второй раз
export function claimLeague(learn, now = Date.now()) {
  const list = pendingRewards(learn, now);
  const s = list.reduce((acc, h) => earn(acc, h.coins, `lg:${h.week}`, now), learn);
  return { s, coins: list.reduce((a, h) => a + h.coins, 0), weeks: list };
}
