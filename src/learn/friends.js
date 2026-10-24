/* ДРУЗЬЯ И ЗАБЕГ — чистая часть клиента (docs/mechanics.md, «Друзья и забег»).
   Карточка игрока для друзей собирается здесь из прогресса: наряд Инфли, серия, опыт, уровень,
   лига, печати, альбом, марки месяцев, опыт по дням и знаменательные события. Сервер её только
   чистит (api/_lib/friends.js). Подписи событий строит тот, кто смотрит, по виду и id — чужого
   свободного текста в приложении нет.
   Забег: друг принял приглашение — три дня, считая день принятия, кто наберёт больше опыта.
   Победа — 40 монет и печать «Забег», ничья — по 25, второе место — 15 (если сам хоть урок прошёл). */
import { streak, addDays, dayOf, weekOf } from '../textbook/learn-state.js';
import { achievementsOf, ACHIEVEMENTS, outfitOf, earn, hasClaim, mix01, plural } from './rewards.js';
import { leagueState, LEAGUE_BY_ID, LEAGUE_DAYS } from './league.js';
import { albumItems } from './collections.js';
import { pathState, levelOf, LEVEL_BY_ID } from './course.js';
import { placeOf } from '../ds-tokens.js';

const DAY_MS = 86400000;
export const RACE = { days: 3, acceptHours: 24, win: 40, tie: 25, lose: 15, onlineDays: 7, friendHours: 24 };
/* звать на забег можно друга, с которым дружите хотя бы сутки: только что добавленного — странно
   (жалоба), забег — между знакомыми. friendSince — когда стали друзьями (since с сервера) */
export const raceReadyIn = (f, now = Date.now()) => {
  const since = f && Number(f.since);
  if (!since) return 0;
  return Math.max(0, Math.ceil((since + RACE.friendHours * 3600000 - now) / 3600000));
};
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

/* Знаменательные события: пройденный юнит, серия (3, 7, 14, 30… дней), печать, марка месяца,
   повышение в лиге, победа в забеге. Свежие первыми, не больше шестнадцати. */
export function cardEvents(learn, now = Date.now()) {
  const claimed = learn.claimed || {};
  const out = [];
  albumItems(learn).filter((a) => a.got && a.at).forEach((a) => out.push({ k: 'unit', id: a.id, at: a.at }));
  Object.entries(claimed).forEach(([k, at]) => {
    if (/^st:\d+$/.test(k)) out.push({ k: 'streak', n: Number(k.slice(3)), at });
    else if (/^a:[a-z0-9]+$/.test(k)) out.push({ k: 'seal', id: k.slice(2), at });
    else if (/^m:\d{4}-\d{2}$/.test(k)) out.push({ k: 'month', id: k.slice(2), at });
    else if (/^race:[a-z0-9]+:won$/.test(k)) out.push({ k: 'race', at });
  });
  leagueState(learn, now).history.filter((h) => h.move === 'up').forEach((h) => out.push({ k: 'league', id: h.to, at: new Date(`${addDays(h.week, LEAGUE_DAYS)}T00:00:00`).getTime() }));
  return out.filter((e) => e.at && e.at <= now).sort((a, b) => b.at - a.at).slice(0, 16);
}
// карточка для друзей — только то, что можно показать
export function buildCard(learn, now = Date.now()) {
  const st = pathState(learn);
  const cur = st.find((s) => !s.complete) || st[st.length - 1];
  const today = dayOf(now);
  const xpDays = {};
  for (let k = 20; k >= 0; k -= 1) { const d = addDays(today, -k); const x = (learn.xp || {})[d] || 0; if (x) xpDays[d] = x; }
  const wear = Object.fromEntries(Object.entries(outfitOf(learn)).filter(([, v]) => v));
  return {
    wear, streak: streak(learn, now).days, xp: Object.values(learn.xp || {}).reduce((a, b) => a + b, 0),
    level: cur ? levelOf(cur.course.id).id : null, league: leagueState(learn, now).league,
    seals: achievementsOf(learn).filter((a) => a.got).map((a) => a.id),
    album: albumItems(learn).filter((a) => a.got).length,
    months: Object.keys(learn.claimed || {}).filter((k) => /^m:\d{4}-\d{2}$/.test(k)).map((k) => k.slice(2)).sort(),
    xpDays, events: cardEvents(learn, now),
  };
}

// подпись события — без рода: «Юнит «Рынок» пройден», а не «прошёл/прошла»
export function eventText(e) {
  if (e.k === 'unit') return `Юнит «${placeOf(e.id).place}» пройден`;
  if (e.k === 'streak') return `Серия — ${e.n} ${plural(e.n, 'день', 'дня', 'дней')} подряд`;
  if (e.k === 'seal') { const a = ACHIEVEMENTS.find((x) => x.id === e.id); return a ? `Печать «${a.title}»` : 'Новая печать'; }
  if (e.k === 'month') { const [y, m] = String(e.id).split('-').map(Number); return `Испытание месяца: ${MONTHS[m - 1] || ''} ${y}`; }
  if (e.k === 'league') { const l = LEAGUE_BY_ID[e.id]; return l ? `Повышение: ${l.title} лига` : 'Повышение в лиге'; }
  if (e.k === 'race') return 'Победа в забеге';
  return '';
}
export const EVENT_ICON = { unit: 'landmark', streak: 'fire', seal: 'stamp', month: 'calendar', league: 'trophy', race: 'flag' };
// лента друзей: события всех друзей за две недели, свежие первыми
export function friendFeed(friends = [], now = Date.now(), days = 14) {
  return friends.flatMap((f) => ((f.card && f.card.events) || []).filter((e) => now - e.at < days * DAY_MS).map((e) => ({ ...e, login: f.login, name: f.name, wear: (f.card && f.card.wear) || {} })))
    .sort((a, b) => b.at - a.at).slice(0, 30);
}

// «в сети»: когда друг последний раз обновлял карточку
export const lastSeenDays = (f, now = Date.now()) => (f.card && f.card.at ? Math.floor((now - f.card.at) / DAY_MS) : Infinity);
export function seenText(f, now = Date.now()) {
  const d = lastSeenDays(f, now);
  if (d === Infinity) return 'ещё не заходил в обновлённое приложение';
  if (dayOf(f.card.at) === dayOf(now)) return 'в сети сегодня';
  if (dayOf(f.card.at) === addDays(dayOf(now), -1)) return 'в сети вчера';
  return `в сети ${d} ${plural(d, 'день', 'дня', 'дней')} назад`;
}
// позвать на забег можно друга, который был в сети за последние семь дней
export const raceable = (friends = [], now = Date.now()) => friends.filter((f) => lastSeenDays(f, now) <= RACE.onlineDays && raceReadyIn(f, now) === 0);

/* Забег глазами ученика: статус, дни, опыт обоих (свой — из прогресса, друга — из карточки).
   finished — день после трёх дней забега уже наступил. */
export function raceView(race, learn, friend, now = Date.now()) {
  const today = dayOf(now);
  const base = { id: race.id, other: race.other, name: friend ? friend.name : race.other, wear: (friend && friend.card && friend.card.wear) || {}, mine: race.mine };
  if (race.status === 'pending') {
    const left = Math.max(0, race.at + RACE.acceptHours * 3600000 - now);
    return { ...base, status: race.mine ? 'outgoing' : 'incoming', hoursLeft: Math.ceil(left / 3600000) };
  }
  if (race.status !== 'active' || !race.start) return { ...base, status: race.status };
  const days = Array.from({ length: race.days || RACE.days }, (_, k) => addDays(race.start, k));
  const end = days[days.length - 1];
  const sum = (map) => days.reduce((a, d) => a + ((map || {})[d] || 0), 0);
  // опыт дня старта, набранный до принятия забега, не в счёт (baseMine/baseTheirs — с сервера)
  const my = Math.max(0, sum(learn.xp) - (race.baseMine || 0));
  const their = Math.max(0, sum(friend && friend.card ? friend.card.xpDays : {}) - (race.baseTheirs || 0));
  const finished = today > end;
  const result = !finished ? null : my > their ? 'won' : my < their ? 'lost' : 'tie';
  // какой сейчас день забега (0 — ещё не начался: друг в другом часовом поясе принял «завтра»)
  const idx = days.indexOf(today);
  const dayNo = idx >= 0 ? idx + 1 : today > end ? days.length : 0;
  return { ...base, status: finished ? 'finished' : 'active', days, start: race.start, end, my, their, result, dayNo,
    daysLeft: finished ? 0 : days.filter((d) => d >= today).length, lead: my === their ? 0 : my > their ? 1 : -1 };
}
// награда за законченный забег: один раз (ключ race:<id>, у победы — race:<id>:won для печати)
export const raceKey = (v) => (v.result === 'won' ? `race:${v.id}:won` : `race:${v.id}`);
export const raceCoins = (v) => (v.result === 'won' ? RACE.win : v.result === 'tie' ? RACE.tie : v.my > 0 ? RACE.lose : 0);
export const raceClaimed = (learn, v) => hasClaim(learn, `race:${v.id}`) || hasClaim(learn, `race:${v.id}:won`);
export function claimRace(learn, v, now = Date.now()) {
  if (v.status !== 'finished' || raceClaimed(learn, v)) return learn;
  return earn(learn, raceCoins(v), raceKey(v), now);
}

/* Предложить забег после урока — «иногда»: есть друг, который был в сети за неделю, с ним нет
   забега, ждущего ответа или идущего; не чаще раза в день (offered — день прошлого предложения)
   и примерно после каждого второго урока. */
export function raceOffer(data, learn, now = Date.now(), offered = null) {
  if (!data || !data.friends) return null;
  const today = dayOf(now);
  if (offered === today) return null;
  const busy = new Set((data.races || []).filter((r) => r.status === 'pending' || (r.status === 'active' && raceView(r, learn, null, now).status === 'active')).map((r) => r.other));
  const list = raceable(data.friends, now).filter((f) => !busy.has(f.login));
  if (!list.length) return null;
  const done = (learn.done || {})[today] || 0;
  if (mix01(`race:${today}:${done}`) > 0.5) return null;
  return list.sort((a, b) => lastSeenDays(a, now) - lastSeenDays(b, now)).slice(0, 4);
}
export const levelTitle = (id) => (LEVEL_BY_ID[id] ? LEVEL_BY_ID[id].title : '');
export const weekStart = (now = Date.now()) => weekOf(dayOf(now));
