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
/* марки месяцев: полученные — по месяцам; испытание этого месяца, пока не выполнено, — ещё не
   полученная марка с прогрессом */
export function monthItems(learn, now = Date.now()) {
  const got = monthStamps(learn).map((m) => ({ id: m.key, kind: 'month', title: m.name, text: 'Испытание месяца выполнено.', got: true, at: (learn.claimed || {})[m.key] || 0 }));
  const cur = monthChallenge(learn, now);
  if (!cur.claimed) got.push({ id: cur.key, kind: 'month', title: cur.name, text: cur.title, got: false, at: 0, coins: cur.coins,
    progress: { have: cur.have, total: cur.target }, how: `${cur.title}. Осталось ${cur.need} ${cur.unit}, дней — ${cur.daysLeft}.` });
  return got;
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
