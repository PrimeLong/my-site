/* ХЕЛЛОУИН (docs/mechanics.md, «Хеллоуин»): каждый год с 16 октября по 2 ноября.
   В сезон: хеллоуинская витрина в лавке — вещи, которые продаются только в эти дни (купленное
   остаётся навсегда); тыквы и летучие мыши на дороге Пути; событие «13 тыкв»: каждый урок
   сезона (урок, практика, проверка) — тыква в корзину, 13 тыкв — рамка «Паутина», которую не
   купить. Состояния события нет: тыквы считаются из уроков по дням (learn.done), получение
   рамки — отметка learn.claimed['hw:год'] и сама рамка в learn.owned. Модуль чистый: его
   читают лавка (src/learn/rewards.js), Путь и лавка на экране (src/learn-halloween.jsx),
   уведомления и тесты. */
import { dayOf } from '../textbook/learn-state.js';
import { plural } from '../lib/plural.js';

export const SEASON = { from: '10-16', to: '11-02' };
export const PUMPKIN_GOAL = 13;
// рамка-награда события: её нет в продаже
export const WEB_FRAME = 'frame-web';
// день 'ГГГГ-ММ-ДД' внутри сезона своего года
export const halloweenOn = (day) => { const md = day.slice(5); return md >= SEASON.from && md <= SEASON.to; };
/* событие появилось 17 октября 2026 — тыквы считаются с этого дня: уроки, пройденные до выхода события,
   не лежат в корзине заранее (жалоба). В следующие годы сезон с первого дня. */
export const RELEASED = '2026-10-17';
const seasonOf = (day) => {
  const y = day.slice(0, 4); const from = `${y}-${SEASON.from}`;
  return { from, count: from < RELEASED ? RELEASED : from, to: `${y}-${SEASON.to}`, key: `hw:${y}` };
};
const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);

/* Состояние сезона к моменту now: идёт ли, сколько тыкв собрано (не больше цели), можно ли
   забрать рамку, забрана ли, сколько дней осталось (сегодня — тоже день) и через сколько дней
   начнётся (до сезона в этом году). */
export function halloween(learn, now = Date.now()) {
  const day = dayOf(now);
  const s = seasonOf(day);
  const on = halloweenOn(day);
  const got = Object.entries(learn.done || {}).filter(([d]) => d >= s.count && d <= s.to).reduce((a, [, n]) => a + (Number(n) || 0), 0);
  const pumpkins = Math.min(PUMPKIN_GOAL, got);
  const claimed = !!(learn.claimed || {})[s.key];
  return {
    on, pumpkins, goal: PUMPKIN_GOAL, claimed, ready: on && pumpkins >= PUMPKIN_GOAL && !claimed, key: s.key, from: s.from, to: s.to,
    daysLeft: on ? daysBetween(day, s.to) + 1 : 0, startsIn: !on && day < s.from ? daysBetween(day, s.from) : null,
    // последний день сезона — завтра его уже не будет
    lastDay: on && day === s.to, firstDay: on && day === s.from,
  };
}
// забрать «Паутину»: только в сезон и только когда собраны 13 тыкв; рамка сразу надета
export function claimHalloween(learn, now = Date.now()) {
  const h = halloween(learn, now);
  if (!h.ready) return { s: learn, ok: false };
  return {
    ok: true,
    s: { ...learn, claimed: { ...learn.claimed, [h.key]: now }, owned: { ...learn.owned, [WEB_FRAME]: now }, wear: { ...learn.wear, frame: WEB_FRAME, at: now } },
  };
}
// подпись срока: «ещё 12 дней», «последний день»
export const seasonLeftText = (h) => (h.lastDay ? 'сегодня последний день' : `ещё ${h.daysLeft} ${plural(h.daysLeft, 'день', 'дня', 'дней')}`);
