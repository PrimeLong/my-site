/* ЦЕРЕМОНИИ (docs/mechanics.md, «Церемонии»): большой момент получает свою сцену во весь экран —
   новая марка в альбоме (юнит пройден), марка месяца (испытание месяца выполнено), новая печать.
   Модуль чистый: какие моменты есть у ученика и какие ещё не показаны. Показанные помнит
   устройство (ems-celebrated: ключ → когда показали). Первое открытие с церемониями или новое
   устройство запоминает всё уже полученное без сцен: церемония — для того, что получено сейчас,
   а не для истории. Старше трёх дней — тоже без сцены. */
import { albumItems, sealItems, monthItems } from './collections.js';

export const CELEBRATE = { fresh: 3 * 86400000, batch: 3 };
// порядок сцен: марка юнита, марка месяца, печати — по времени получения
const ORDER = { album: 0, month: 1, seal: 2 };

export function momentsOf(learn, now = Date.now()) {
  const out = [];
  albumItems(learn).forEach((it) => { if (it.got) out.push({ key: `u:${it.id}`, kind: 'album', at: it.at, it }); });
  monthItems(learn, now).forEach((it) => { if (it.got) out.push({ key: it.id, kind: 'month', at: it.at, it }); });
  sealItems(learn).forEach((it) => { if (it.got) out.push({ key: `a:${it.id}`, kind: 'seal', at: it.at, it }); });
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
