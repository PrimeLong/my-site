/* ЦЕРЕМОНИИ (docs/mechanics.md, «Церемонии»): большой момент получает свою сцену во весь экран —
   новая марка в альбоме (юнит пройден), марка месяца (испытание месяца выполнено), новая печать,
   открылась новая возможность (лиги, лавка, копилка, сад).
   Модуль чистый: какие моменты есть у ученика и какие ещё не показаны. Показанные помнит
   устройство (ems-celebrated: ключ → когда показали). Первое открытие с церемониями или новое
   устройство запоминает всё уже полученное без сцен: церемония — для того, что получено сейчас,
   а не для истории. Старше трёх дней — тоже без сцены. */
import { albumItems, sealItems, monthItems } from './collections.js';
import { leagueState, LEAGUE_DAYS } from './league.js';
import { addDays } from '../textbook/learn-state.js';
import { unlockedAt } from './unlocks.js';

export const CELEBRATE = { fresh: 3 * 86400000, batch: 3 };
// порядок сцен: марка юнита, марка месяца, итоги лиги, печати — по времени получения
const ORDER = { album: 0, month: 1, league: 2, seal: 3, unlock: 4 };
/* Итоги недели лиги — тоже церемония (жалоба: «хочется отдельную анимацию по завершению лиги»): неделя
   кончилась (суббота позади, в воскресенье — перерыв), место и переход известны. Момент — полночь по
   Гринвичу после последнего дня недели; ключ lg:<неделя>. */
export const leagueEnd = (week) => Date.parse(`${addDays(week, LEAGUE_DAYS)}T00:00:00Z`);
export function leagueMoments(learn, now = Date.now()) {
  return leagueState(learn, now).history.filter((h) => leagueEnd(h.week) <= now)
    .map((h) => ({ key: `lg:${h.week}`, kind: 'league', at: leagueEnd(h.week), it: h }));
}

export function momentsOf(learn, now = Date.now()) {
  const out = [];
  albumItems(learn).forEach((it) => { if (it.got) out.push({ key: `u:${it.id}`, kind: 'album', at: it.at, it }); });
  monthItems(learn, now).forEach((it) => { if (it.got) out.push({ key: it.id, kind: 'month', at: it.at, it }); });
  sealItems(learn).forEach((it) => { if (it.got) out.push({ key: `a:${it.id}`, kind: 'seal', at: it.at, it }); });
  leagueMoments(learn, now).forEach((m) => out.push(m));
  // открылась возможность (лиги, лавка, копилка, сад — src/learn/unlocks.js): сцена-знакомство
  unlockedAt(learn).forEach((u) => { if (u.at) out.push({ key: `o:${u.id}`, kind: 'unlock', at: u.at, it: u }); });
  return out;
}
// ещё не показанные и свежие — по порядку сцен
export function pendingMoments(learn, seen, now = Date.now()) {
  return momentsOf(learn, now)
    .filter((m) => !seen[m.key] && m.at > 0 && now - m.at <= CELEBRATE.fresh)
    .sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.at - b.at);
}
// первое знакомство: всё уже полученное — как показанное
export const baselineSeen = (learn, now = Date.now()) => Object.fromEntries(momentsOf(learn, now).map((m) => [m.key, now]));
/* Сцен подряд — не больше трёх: остальное (например, пачка печатей после долгого перерыва)
   отмечается показанным без сцен, чтобы церемония не превращалась в очередь. */
export function nextBatch(pending) {
  return { show: pending.slice(0, CELEBRATE.batch), skip: pending.slice(CELEBRATE.batch) };
}
