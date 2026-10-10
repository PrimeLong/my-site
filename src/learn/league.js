/* ЛИГИ НЕДЕЛИ (docs/mechanics.md, «Лиги»). Неделя — с понедельника по воскресенье. В группе
   двадцать учеников: вы и девятнадцать соперников. Место — по опыту за неделю. В конце недели
   первые пять поднимаются в следующую лигу, последние пять опускаются; в Бронзовой опускаться
   некуда, в Алмазной — подниматься. Первые три места получают монеты.

   Соперники — ученики-боты: имя, ритм занятий и опыт за неделю задаёт зерно (неделя, лига,
   место в группе), так что таблица одна и та же на всех устройствах и растёт в течение недели
   по дням, как у живых учеников. Ученики, разрешившие показывать своё имя (api/account.js,
   leaguePublic), могут появиться под именем бота — с выдуманным опытом; на экране об этом
   сказано честно.

   Состояния лиги в профиле нет: она выводится из опыта по дням (learn.xp) — неделя за неделей
   от первой недели с опытом, поэтому два устройства всегда согласны. Неделя без опыта — вне
   лиги: лига не меняется. Награда — через claimed (ключ lg:<понедельник>), дважды не выдаётся. */
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
const MAX_WEEKS = 104;

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

/* Соперник: имя, цвет значка и опыт за неделю. Ритм — в какие дни он занимается и сколько:
   у кого-то каждый день понемногу, у кого-то рывок в выходные, кто-то почти бросил. */
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
  return Array.from({ length: GROUP - 1 }, (_, k) => {
    const style = r();
    // почти бросил — 8%, обычный — по медиане лиги с разбросом
    const total = style < 0.08 ? Math.round(r() * 20) : Math.round(lg.median * Math.exp((r() + r() + r() - 1.5) * 0.9));
    const days = Array.from({ length: 7 }, (_, d) => (style < 0.3 ? (d >= 5 ? 3 : 0.3) : style < 0.55 ? (r() < 0.75 ? 1 : 0) : 0.6 + r()));
    const sum = days.reduce((a, x) => a + x, 0) || 1;
    let name = pickName();
    if (realSlots.has(k) && real.length) { const j = Math.floor(rr() * real.length); name = real.splice(j, 1)[0]; }
    return { id: `b${k}`, name, color: COLORS[Math.floor(r() * COLORS.length)], total, share: days.map((x) => x / sum), bot: true };
  });
}
/* Опыт соперника к моменту now: прошедшие дни целиком, сегодняшний — по часам. В будущее и в
   прошлое недели не заглядывает: после воскресенья — весь итог. */
function rivalXp(rv, week, now) {
  const today = dayOf(now);
  let xp = 0;
  for (let d = 0; d < 7; d += 1) {
    const day = addDays(week, d);
    if (day < today) xp += rv.total * rv.share[d];
    else if (day === today) { const h = new Date(now).getHours() + new Date(now).getMinutes() / 60; xp += rv.total * rv.share[d] * Math.min(1, Math.max(0, (h - 7) / 15)); }
  }
  return Math.round(xp);
}
export const weekXp = (learn, week) => Array.from({ length: 7 }, (_, d) => (learn.xp || {})[addDays(week, d)] || 0).reduce((a, x) => a + x, 0);
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
  const done = dayOf(now) > addDays(week, 6);
  const rows = rivals(week, league, realNames).map((rv) => ({ ...rv, xp: done ? rv.total : rivalXp(rv, week, now) }));
  rows.push({ id: 'me', name: 'Вы', me: true, xp: weekXp(learn, week) });
  rows.sort((a, b) => b.xp - a.xp || (a.me ? 1 : b.me ? -1 : 0));
  return rows.map((row, k) => ({ ...row, place: k + 1, zone: zoneOf(k + 1, league) }));
}
/* Лига ученика неделя за неделей — от первой недели с опытом до прошлой. Возвращает нынешнюю
   лигу, таблицу текущей недели и историю: место, переход и награду каждой прошлой недели. */
export function leagueState(learn, now = Date.now(), realNames = []) {
  const thisWeek = weekOf(dayOf(now));
  const days = Object.keys(learn.xp || {}).filter((d) => (learn.xp[d] || 0) > 0).sort();
  let league = 'bronze';
  const history = [];
  if (days.length) {
    let w = weekOf(days[0]);
    const oldest = addDays(thisWeek, -7 * MAX_WEEKS);
    if (w < oldest) w = oldest;
    for (; w < thisWeek; w = addDays(w, 7)) {
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
  const table = standings(learn, thisWeek, league, now, realNames);
  const me = table.find((row) => row.me);
  // сколько опыта до зоны повышения (до пятого места) — 0, если уже там
  const fifth = table.filter((row) => !row.me)[PROMOTE - 1];
  const toPromote = me.zone === 'up' || tierIndex(league) === LEAGUES.length - 1 ? 0 : Math.max(1, fifth.xp - me.xp + 1);
  // дней до конца недели, считая сегодняшний: в понедельник — 7, в воскресенье — 1
  const daysLeft = 7 - Array.from({ length: 7 }, (_, d) => addDays(thisWeek, d)).indexOf(dayOf(now));
  return { league, week: thisWeek, table, me, toPromote, daysLeft, history, joined: weekXp(learn, thisWeek) > 0 };
}
// невыданные награды прошлых недель
export const pendingRewards = (learn, now = Date.now()) => leagueState(learn, now).history.filter((h) => h.coins > 0 && !hasClaim(learn, `lg:${h.week}`));
// забрать награды: монеты зачисляются сегодняшним днём, ключ не даёт выдать их второй раз
export function claimLeague(learn, now = Date.now()) {
  const list = pendingRewards(learn, now);
  const s = list.reduce((acc, h) => earn(acc, h.coins, `lg:${h.week}`, now), learn);
  return { s, coins: list.reduce((a, h) => a + h.coins, 0), weeks: list };
}
