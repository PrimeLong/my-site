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
import { dayOf, addDays, weekOf, dayHour } from '../textbook/learn-state.js';
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
/* В лигу — только после первого урока (запрос: «не закидывать в лигу, пока не прошёл один урок»):
   регистрация больше не открывает лигу, её открывает первый пройденный урок. Правило — для тех, чей
   первый урок с LEAGUE_LESSON_FROM; у начавших раньше история лиги не пересчитывается. */
export const LEAGUE_LESSON_FROM = '2026-10-26';
// день первого урока: самый ранний день с пройденным уроком или опытом
export const firstLessonDay = (learn) => [
  ...Object.keys(learn.done || {}).filter((d) => (learn.done[d] || 0) > 0),
  ...Object.keys(learn.xp || {}).filter((d) => (learn.xp[d] || 0) > 0),
].sort()[0] || null;
// прежнее правило: регистрация или самое раннее занятие
const firstDayOf = (learn) => {
  const days = [...Object.keys(learn.done || {}), ...Object.keys(learn.xp || {})].sort();
  const reg = learn.profile && learn.profile.at ? dayOf(learn.profile.at) : null;
  return [days[0], reg].filter(Boolean).sort()[0] || null;
};
// понедельник первой недели лиги ученика (null — уроков ещё не было: лиги пока нет)
export function leagueStart(learn) {
  const lesson = firstLessonDay(learn);
  const first = lesson && lesson >= LEAGUE_LESSON_FROM ? lesson : firstDayOf(learn);
  if (!first || (!lesson && first >= LEAGUE_LESSON_FROM)) return null;
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
function rivalsV1(week, league, realNames = []) {
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

/* ЛИГИ ПО МИНУТАМ (с недели LEAGUE_V2_FROM). Каждая лига — свой темп честных занятий, без двойного
   опыта и прочих ускорений, просто уроки: чтобы остаться в лиге N (Бронзовая — первая), хватает
   5·N минут в день, чтобы подняться — чуть больше, на PROMOTE_EXTRA_MIN минут. В Бронзовой хватает
   пяти минут, в Серебряной — десяти, в Золотой — пятнадцати, … в Алмазной — тридцати пяти.
   Темп переводится в опыт честно: XP_PER_MIN — сколько опыта в минуту даёт обычный урок Пути
   (≈ 5 минут, 8–9 упражнений, ≈ 20 опыта; тест сверяет это с курсом). Неделя лиги — шесть дней.

   Соперники разложены по «слоям»: у каждого из девятнадцати — своя доля таблицы (слой), и недельный
   итог задаёт кривая лиги: пятый снизу (граница понижения) — чуть ниже темпа «остаться», пятый
   сверху (граница повышения) — между «остаться» и «подняться». Разброс внутри слоя и порядок
   соперников — от зерна недели, дни и часы — от привычки, как у живых учеников. */
export const LEAGUE_V2_FROM = '2026-10-26';
export const XP_PER_MIN = 4;
export const PROMOTE_EXTRA_MIN = 2.5;
// минут в день, чтобы остаться в лиге: 5, 10, 15, …
export const stayMinutes = (league) => 5 * (Math.max(0, LEAGUES.findIndex((l) => l.id === league)) + 1);
export const promoteMinutes = (league) => stayMinutes(league) + PROMOTE_EXTRA_MIN;
const weekOfMinutes = (min) => LEAGUE_DAYS * min * XP_PER_MIN;
/* Кривая лиги: доля таблицы u (0 — последний, 1 — первый) → опыт за неделю. S — неделя по темпу
   «остаться», P — по темпу «подняться». Пятый снизу (u от 4/19 до 5/19) — 0,86…0,95 S: темпа
   «остаться» хватает с запасом, а темпа прошлой лиги — уже нет. Пятый сверху (u от 14/19 до 15/19) —
   между S и P: «подняться» поднимает всегда, «остаться» — редко. */
function leagueCurve(league) {
  const S = weekOfMinutes(stayMinutes(league)); const P = weekOfMinutes(promoteMinutes(league));
  const D = P - S;
  const knots = [[0, 0.04 * S], [2 / 19, 0.45 * S], [4 / 19, 0.86 * S], [5 / 19, 0.95 * S], [14 / 19, S + 0.25 * D], [15 / 19, S + 0.9 * D], [17 / 19, 1.35 * S + D], [1, 2.1 * S + D]];
  return (u) => {
    for (let k = 1; k < knots.length; k += 1) {
      const [u0, x0] = knots[k - 1]; const [u1, x1] = knots[k];
      if (u <= u1) return x0 + ((x1 - x0) * (u - u0)) / (u1 - u0);
    }
    return knots[knots.length - 1][1];
  };
}
function rivalsV2(week, league, realNames = []) {
  const r = rng(`v2:${week}:${league}`);
  const used = new Set();
  const pickName = () => {
    for (let k = 0; k < 50; k += 1) {
      const n = r() < 0.18 ? NICKS[Math.floor(r() * NICKS.length)] : `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}.`;
      if (!used.has(n)) { used.add(n); return n; }
    }
    return `Ученик ${used.size + 1}`;
  };
  const rr = rng(`${week}:${league}:real`);
  const real = realNames.filter((n) => typeof n === 'string' && n.trim()).slice();
  const realSlots = new Set();
  while (realSlots.size < Math.min(6, real.length)) realSlots.add(Math.floor(rr() * (GROUP - 1)));
  // слои вразнобой: номер соперника не говорит о его месте
  const layers = Array.from({ length: GROUP - 1 }, (_, k) => k);
  for (let k = layers.length - 1; k > 0; k -= 1) { const j = Math.floor(r() * (k + 1)); [layers[k], layers[j]] = [layers[j], layers[k]]; }
  const curve = leagueCurve(league);
  return layers.map((layer, k) => {
    const u = (layer + 0.1 + r() * 0.8) / (GROUP - 1);
    const target = Math.max(12, Math.round(curve(u)));
    // привычка: внизу таблицы — бросившие и заглядывающие изредка, выше — кто как
    let habit;
    if (layer < 2) habit = HABITS[layer === 0 ? 4 : 3];
    else { let roll = r() * 0.84; habit = HABITS[2]; for (const h of HABITS.slice(0, 3)) { if (roll < h.share) { habit = h; break; } roll -= h.share; } }
    let name = pickName();
    const color = COLORS[Math.floor(r() * COLORS.length)];
    if (realSlots.has(k) && real.length) { const j = Math.floor(rr() * real.length); name = real.splice(j, 1)[0]; }
    // уроки: сколько нужно на итог недели, по дням привычки; опыт урока — 12…32, итог — ровно target
    const dr = rng(`v2:${week}:${league}:${k}`);
    const n = Math.max(1, Math.round(target / LESSON_XP));
    let active = habit.p.map((p) => dr() < p);
    if (!active.some(Boolean)) active = habit.p.map((p) => p === Math.max(...habit.p));
    const weights = habit.p.map((p, d) => (active[d] ? p : 0));
    const sumW = weights.reduce((a, x) => a + x, 0);
    const perDay = Array.from({ length: LEAGUE_DAYS }, () => 0);
    for (let j = 0; j < n; j += 1) {
      let roll = dr() * sumW; let d = 0;
      while (d < LEAGUE_DAYS - 1 && (roll >= weights[d] || !weights[d])) { roll -= weights[d]; d += 1; }
      perDay[d] += 1;
    }
    // не больше cap уроков в день: лишнее — в дни потише (сначала в дни привычки, потом в остальные)
    const cap = Math.max(8, Math.ceil(n / 4));
    for (let guard = 0; guard < 400 && perDay.some((c) => c > cap); guard += 1) {
      const from = perDay.indexOf(Math.max(...perDay));
      const open = perDay.map((c, d) => d).filter((d) => perDay[d] < cap);
      const pool = open.filter((d) => active[d]).length ? open.filter((d) => active[d]) : open;
      const to = pool.reduce((a, d) => (perDay[d] < perDay[a] || (perDay[d] === perDay[a] && habit.p[d] > habit.p[a]) ? d : a), pool[0]);
      active[to] = true; perDay[from] -= 1; perDay[to] += 1;
    }
    const raw = Array.from({ length: n }, () => 12 + dr() * 20);
    const f = target / raw.reduce((a, x) => a + x, 0);
    const gains = raw.map((x) => Math.max(12, Math.round(x * f)));
    // остаток округления — на самые крупные уроки, не опуская урок ниже 12
    let diff = target - gains.reduce((a, x) => a + x, 0);
    for (let guard = 0; diff !== 0 && guard < 200; guard += 1) {
      const j = gains.indexOf(Math.max(...gains));
      const step = diff > 0 ? 1 : gains[j] > 12 ? -1 : 0;
      if (!step) break;
      gains[j] += step; diff -= step;
    }
    let g = 0;
    const days = perDay.map((cnt) => {
      if (!cnt) return [];
      let h = [7.5, 15, 19][Math.floor(dr() * 3)] + dr() * 3.5;
      return Array.from({ length: cnt }, () => {
        const atH = Math.min(23.5, h); h += 0.15 + dr() * (dr() < 0.3 ? 4 : 0.6);
        const gain = gains[g]; g += 1;
        return [Math.round(atH * 100) / 100, gain];
      });
    });
    const total = days.reduce((a, list) => a + list.reduce((x, [, xp]) => x + xp, 0), 0);
    return { id: `b${k}`, name, color, total, days, habit: habit.id, bot: true };
  });
}
// соперники недели: до LEAGUE_V2_FROM — прежние (история лиги не пересчитывается), с неё — по минутам
const rivals = (week, league, realNames = []) => (week >= LEAGUE_V2_FROM ? rivalsV2 : rivalsV1)(week, league, realNames);

/* Опыт соперника к моменту now: прошедшие дни целиком, сегодня — уроки, час которых уже прошёл.
   В будущее и в прошлое недели не заглядывает: после субботы — весь итог. */
function rivalXp(rv, week, now) {
  const today = dayOf(now);
  // час дня — по всемирному времени, как и сам день: перевод часов на устройстве соперников не двигает
  const hour = dayHour(now);
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
  // уроков ещё не было — в лиге ученика нет: ни места в таблице, ни уведомлений; на вкладке — «после первого урока»
  const noLesson = !firstLessonDay(learn);
  return { league: shown, next: league, rest: rest && !waiting && !noLesson, week: thisWeek, table, me, toPromote, toSafe, daysLeft, history,
    joined: !waiting && !noLesson && weekXp(learn, thisWeek) > 0, waiting, startsOn: waiting ? start : null, noLesson };
}
// невыданные награды прошлых недель
export const pendingRewards = (learn, now = Date.now()) => leagueState(learn, now).history.filter((h) => h.coins > 0 && !hasClaim(learn, `lg:${h.week}`));
// забрать награды: монеты зачисляются сегодняшним днём, ключ не даёт выдать их второй раз
export function claimLeague(learn, now = Date.now()) {
  const list = pendingRewards(learn, now);
  const s = list.reduce((acc, h) => earn(acc, h.coins, `lg:${h.week}`, now), learn);
  return { s, coins: list.reduce((a, h) => a + h.coins, 0), weeks: list };
}
