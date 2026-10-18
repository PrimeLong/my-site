/* КОЛЛЕКЦИИ ПРОФИЛЯ (docs/mechanics.md, «Профиль»): альбом марок (пройденный юнит — марка с его
   зданием), печати-достижения и марки месяцев (выполненное испытание месяца). В профиле у каждой —
   короткий ряд: сначала недавно полученные, потом ближайшие к получению; стрелка — весь список с
   полученными и ещё не полученными. Касание марки — она крупно, за что дана и когда получена.
   Модуль чистый: его читают профиль (src/learn-profile.jsx) и тесты. */
import { pathState } from './course.js';
import { achievementsOf, monthStamps, monthChallenge } from './rewards.js';
import { placeOf } from '../ds-tokens.js';
import { plural } from '../lib/plural.js';

/* Альбом: марка на каждый юнит Пути. Получена — когда пройден последний урок юнита (или юнит сдан
   тестом уровня — тогда дата сдачи). */
export function albumItems(learn) {
  return pathState(learn).map((s, k) => {
    const pl = placeOf(s.course.id);
    const done = s.lessons.filter((l) => l.done).length;
    const ats = s.lessons.map((l) => ((learn.lessons || {})[l.id] || {}).at || 0);
    const tested = ((learn.units || {})[s.course.id] || {}).tested || 0;
    const at = s.complete ? Math.max(...ats) : 0;
    return {
      id: s.course.id, kind: 'album', no: k + 1, title: pl.place, sub: s.course.title, color: pl.color, building: pl.building,
      text: `Юнит ${k + 1} — «${s.course.title}»: ${pl.note}.`, got: s.complete, at: at || (s.complete ? tested : 0),
      progress: { have: done, total: s.lessons.length },
      how: done ? `Пройдено ${done} ${plural(done, 'урок', 'урока', 'уроков')} из ${s.lessons.length} — пройдите остальные.` : `Пройдите все ${s.lessons.length} ${plural(s.lessons.length, 'урок', 'урока', 'уроков')} юнита.`,
    };
  });
}
// печати: полученные — с датой и монетами, неполученные — «как получить»
export const sealItems = (learn) => achievementsOf(learn).map((a) => ({ id: a.id, kind: 'seal', title: a.title, text: a.text, how: a.how, got: a.got, at: a.at, coins: a.coins, icon: a.icon }));
/* Марки месяцев: у каждого месяца — своя марка. Испытания месяца появились в сентябре 2026, поэтому
   коллекция — все месяцы с сентября 2026 по нынешний, без «ещё не полученных» из будущего: полученные
   яркие, пропущенные блёклые, нынешний — с прогрессом. В полном списке — разделы по годам. */
export const MONTHS_FROM = '2026-09';
const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const nextMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; };
export function monthItems(learn, now = Date.now()) {
  const cur = monthChallenge(learn, now);
  const claimed = new Set(monthStamps(learn).map((m) => m.key));
  const out = [];
  for (let ym = MONTHS_FROM; ym <= cur.month; ym = nextMonth(ym)) {
    const [y, m] = ym.split('-').map(Number);
    const key = `m:${ym}`; const got = claimed.has(key); const now_ = ym === cur.month;
    const base = { id: key, kind: 'month', year: y, month: m, title: MONTH_NAMES[m - 1], full: `${MONTH_NAMES[m - 1].toLowerCase()} ${y}`, got, at: got ? (learn.claimed || {})[key] || 0 : 0, coins: cur.coins };
    if (got) out.push({ ...base, text: `Испытание месяца — ${base.full} — выполнено.` });
    else if (now_) out.push({ ...base, current: true, text: cur.title, progress: { have: cur.have, total: cur.target }, how: `${cur.title}. Осталось ${cur.need} ${cur.unit}, дней — ${cur.daysLeft}.` });
    else out.push({ ...base, missed: true, text: `Испытание месяца — ${base.full}.`, how: 'Этот месяц прошёл без марки: испытание не выполнено. Марки следующих месяцев ещё впереди.' });
  }
  return out;
}
// марки месяцев по годам: свежий год первым, внутри — по порядку месяцев
export function monthsByYear(items) {
  const years = [...new Set(items.map((x) => x.year))].sort((a, b) => b - a);
  return years.map((y) => ({ year: y, items: items.filter((x) => x.year === y).sort((a, b) => a.month - b.month) }));
}
/* Порядок в коротком ряду профиля: недавно полученные первыми, потом ближайшие к получению
   (больше доля прогресса), потом остальные по порядку. В полном списке — полученные по дате,
   неполученные по порядку курса. */
export function shelfOrder(items) {
  const got = items.filter((x) => x.got).sort((a, b) => b.at - a.at);
  const share = (x) => (x.progress ? x.progress.have / Math.max(1, x.progress.total) : 0);
  const rest = items.filter((x) => !x.got).map((x, k) => [x, k]).sort((a, b) => share(b[0]) - share(a[0]) || a[1] - b[1]).map((x) => x[0]);
  return [...got, ...rest];
}
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
// «14 октября 2026»
export const fullDate = (ts) => { const d = new Date(ts); return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`; };
