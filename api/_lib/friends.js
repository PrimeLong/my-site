/* ДРУЗЬЯ И ЗАБЕГИ — чистые правила сервера (api/account.js, docs/mechanics.md «Друзья и забег»).
   Карточка игрока — то, что видят его друзья: наряд Инфли, серия, опыт, лига, уровень, печати,
   опыт по дням (для забега) и знаменательные события. Её собирает клиент (src/learn/friends.js),
   а сервер только чистит: ни свободного текста, ни лишних полей — подписи событий строит тот, кто
   смотрит, по виду и id. Друзья — только по точному логину и с согласия второй стороны. */
export const MAX_FRIENDS = 100;
export const MAX_PENDING = 50;
// забег: сутки на принятие, три дня гонки, не больше трёх своих приглашений, ждущих ответа
// friendMs — сколько нужно дружить, чтобы позвать на забег (совпадает с RACE.friendHours клиента)
export const RACE = { acceptMs: 24 * 3600 * 1000, days: 3, maxOpen: 3, keep: 20, friendMs: 24 * 3600 * 1000, restDays: 3, sameDays: 7 };
export const SLOTS = ['head', 'face', 'neck', 'hand', 'frame'];
export const EVENT_KINDS = new Set(['unit', 'streak', 'seal', 'month', 'league', 'race']);

const ID = /^[a-z0-9-]{1,32}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const arr = (v) => (Array.isArray(v) ? v : []);
const num = (v, hi) => (Number.isFinite(v) ? Math.max(0, Math.min(hi, Math.round(v))) : 0);
const id = (v) => (typeof v === 'string' && ID.test(v) ? v : null);

export function cleanCard(raw) {
  const c = obj(raw);
  const w = obj(c.wear);
  const wear = Object.fromEntries(SLOTS.map((s) => [s, id(w[s])]).filter(([, v]) => v));
  const xpDays = {};
  Object.keys(obj(c.xpDays)).filter((d) => DAY.test(d)).sort().slice(-21).forEach((d) => { const x = num(c.xpDays[d], 5000); if (x) xpDays[d] = x; });
  const events = arr(c.events).map(obj).filter((e) => EVENT_KINDS.has(e.k) && (e.id == null || id(String(e.id))))
    .map((e) => ({ k: e.k, ...(e.id != null ? { id: String(e.id) } : {}), ...(e.n ? { n: num(e.n, 1e5) } : {}), at: num(e.at, 1e14) }))
    .filter((e) => e.at > 0).sort((a, b) => b.at - a.at).slice(0, 20);
  return {
    wear, streak: num(c.streak, 5000), xp: num(c.xp, 1e8), level: id(c.level), league: id(c.league),
    seals: [...new Set(arr(c.seals).map(id).filter(Boolean))].slice(0, 60), album: num(c.album, 200),
    months: arr(c.months).filter((m) => typeof m === 'string' && /^\d{4}-\d{2}$/.test(m)).slice(-36),
    xpDays, events,
  };
}

// приглашение на забег протухает через сутки без ответа
export function raceStatus(race, now = Date.now()) {
  if (!race) return null;
  if (race.status === 'pending' && now - race.at > RACE.acceptMs) return 'expired';
  return race.status;
}
// открытый забег — ждёт ответа или идёт (закончился ли он — решает клиент по своему дню)
export const raceOpen = (race, now = Date.now()) => ['pending', 'active'].includes(raceStatus(race, now))
  && !(race.status === 'active' && race.start && now - Date.parse(`${race.start}T00:00:00Z`) > (RACE.days + 1) * 86400000);
/* Пауза между забегами (совпадает с raceRest клиента): пока идёт забег, другой не начать; после
   финиша — три дня без забегов, а с тем же другом — неделя. Считаются только принятые забеги;
   финиш — начало дня после трёх дней забега (всемирное время). Ответ — null или { until, why }. */
const DAY_MS = 86400000;
export const raceEnd = (r) => Date.parse(`${r.start}T00:00:00Z`) + (r.days || RACE.days) * DAY_MS;
export function raceRest(races, login, other = null, now = Date.now()) {
  const played = arr(races).filter((r) => r && r.status === 'active' && validDay(r.start) && [r.from, r.to].includes(login));
  if (played.some((r) => now < raceEnd(r))) return { until: Math.max(...played.filter((r) => now < raceEnd(r)).map(raceEnd)), why: 'busy' };
  const last = (list) => (list.length ? Math.max(...list.map(raceEnd)) : 0);
  const same = other ? last(played.filter((r) => [r.from, r.to].includes(other))) + RACE.sameDays * DAY_MS : 0;
  const any = last(played) + RACE.restDays * DAY_MS;
  if (same > now && same >= any) return { until: same, why: 'same' };
  if (any > now) return { until: any, why: 'rest' };
  return null;
}
export const validDay = (v) => typeof v === 'string' && DAY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
