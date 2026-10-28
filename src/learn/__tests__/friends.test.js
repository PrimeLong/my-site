// друзья и забег: карточка, события, забег и награда, «иногда» предложить забег (docs/mechanics.md)
import { describe, it, expect } from 'vitest';
import { buildCard, cardEvents, eventText, raceView, claimRace, raceCoins, raceClaimed, raceOffer, raceable, friendFeed, seenText, raceRest, raceRestText, RACE } from '../friends.js';
import { emptyLearn, finishLesson, addDays } from '../../textbook/learn-state.js';
import { balance, settle, achievementsOf } from '../rewards.js';
import { courseCtx } from '../program.js';

const at = (day, h = 12) => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d, h).getTime(); };
const DAY = '2026-10-21';
const NOW = at(DAY, 15);

describe('карточка для друзей', () => {
  it('серия, опыт, опыт по дням, наряд и события — без лишнего', () => {
    let s = { ...emptyLearn(), wear: { head: 'beret', face: null, neck: null, hand: null, frame: null, at: 1 } };
    s = finishLesson(s, 'sc-i1', { xp: 30, accuracy: 100, now: at(addDays(DAY, -1)) });
    s = finishLesson(s, 'sc-l1', { xp: 20, accuracy: 100, now: NOW });
    s = settle(s, courseCtx(s), NOW).s;
    const c = buildCard(s, NOW);
    expect(c).toMatchObject({ streak: 2, xp: 50, wear: { head: 'beret' }, xpDays: { [addDays(DAY, -1)]: 30, [DAY]: 20 } });
    expect(c.seals).toContain('first');
    expect(c.events.some((e) => e.k === 'seal' && e.id === 'first')).toBe(true);
    expect(Object.keys(c)).toEqual(['wear', 'streak', 'xp', 'level', 'league', 'seals', 'album', 'months', 'xpDays', 'events']);
    expect(cardEvents(s, NOW).every((e) => e.at <= NOW)).toBe(true);
  });
  it('подписи событий — без рода', () => {
    expect(eventText({ k: 'unit', id: 'supply-demand' })).toBe('Юнит «Рынок» пройден');
    expect(eventText({ k: 'streak', n: 7 })).toBe('Серия — 7 дней подряд');
    expect(eventText({ k: 'league', id: 'silver' })).toBe('Повышение: Серебряная лига');
    expect(eventText({ k: 'month', id: '2026-10' })).toBe('Испытание месяца: октябрь 2026');
  });
});

describe('забег с другом', () => {
  const friend = (xpDays, at = NOW - 3600e3) => ({ login: 'alina', name: 'Алина', card: { at, xpDays, wear: {} } });
  const race = { id: 'r1', from: 'me', to: 'alina', other: 'alina', mine: true, at: NOW - 2 * 86400e3, status: 'active', start: addDays(DAY, -1), days: 3 };
  it('три дня со дня принятия: кто впереди, какой день', () => {
    let s = finishLesson(emptyLearn(), 'sc-i1', { xp: 40, accuracy: 100, now: at(addDays(DAY, -1)) });
    s = finishLesson(s, 'sc-l1', { xp: 25, accuracy: 100, now: NOW });
    const v = raceView(race, s, friend({ [addDays(DAY, -1)]: 30, [DAY]: 20, [addDays(DAY, -5)]: 999 }), NOW);
    expect(v).toMatchObject({ status: 'active', my: 65, their: 50, lead: 1, dayNo: 2, daysLeft: 2 });
    // опыт дня старта до принятия забега — не в счёт: у обоих вычитается то, что было на момент принятия
    const fair = raceView({ ...race, baseMine: 40, baseTheirs: 30 }, s, friend({ [addDays(DAY, -1)]: 30, [DAY]: 20 }), NOW);
    expect(fair).toMatchObject({ my: 25, their: 20, lead: 1 });
  });
  it('после трёх дней — итог и награда один раз; победа даёт печать «Забег»', () => {
    const s = finishLesson(emptyLearn(), 'sc-i1', { xp: 40, accuracy: 100, now: at(addDays(DAY, -1)) });
    const later = at(addDays(DAY, 3));
    const v = raceView(race, s, friend({ [DAY]: 20 }), later);
    expect(v).toMatchObject({ status: 'finished', result: 'won', my: 40, their: 20 });
    expect(raceCoins(v)).toBe(RACE.win);
    const t = claimRace(s, v, later);
    expect(balance(t) - balance(s)).toBe(RACE.win);
    expect(raceClaimed(t, v)).toBe(true);
    expect(claimRace(t, v, later)).toBe(t);
    expect(achievementsOf(settle(t, courseCtx(t), later).s).find((a) => a.id === 'race').got).toBe(true);
    // проигравший, который занимался, получает утешительные монеты; ничья — поровну
    expect(raceCoins(raceView(race, s, friend({ [DAY]: 90 }), later))).toBe(RACE.lose);
    expect(raceCoins(raceView(race, s, friend({ [addDays(DAY, -1)]: 40 }), later))).toBe(RACE.tie);
  });
  it('приглашение: входящее и исходящее, с часами на ответ', () => {
    const p = { ...race, status: 'pending', start: undefined, at: NOW - 3 * 3600e3 };
    expect(raceView({ ...p, mine: false }, emptyLearn(), friend({}), NOW)).toMatchObject({ status: 'incoming', hoursLeft: 21 });
    expect(raceView(p, emptyLearn(), friend({}), NOW).status).toBe('outgoing');
  });
  it('предложить забег — только с другом, бывшим в сети за неделю, без открытого забега и не чаще раза в день', () => {
    const fresh = friend({}); const old = { ...friend({}, NOW - 9 * 86400e3), login: 'boris' };
    expect(raceable([fresh, old], NOW).map((f) => f.login)).toEqual(['alina']);
    expect(seenText(old, NOW)).toBe('в сети 9 дней назад');
    const data = { friends: [fresh, old], races: [] };
    // «иногда»: за день хотя бы после одного из уроков предложение есть
    const offers = Array.from({ length: 6 }, (_, k) => raceOffer(data, { ...emptyLearn(), done: { [DAY]: k + 1 } }, NOW));
    expect(offers.some(Boolean)).toBe(true);
    offers.filter(Boolean).forEach((o) => expect(o.map((f) => f.login)).toEqual(['alina']));
    expect(raceOffer(data, { ...emptyLearn(), done: { [DAY]: 1 } }, NOW, DAY)).toBeNull();
    // с Алиной забег уже идёт — предлагать некого
    expect(offers.map((_, k) => raceOffer({ ...data, races: [race] }, { ...emptyLearn(), done: { [DAY]: k + 1 } }, NOW)).every((o) => o === null)).toBe(true);
    expect(raceOffer(null, emptyLearn(), NOW)).toBeNull();
  });
  it('пауза между забегами: идёт — нельзя; после финиша три дня отдыха, с тем же другом — неделя; предложений нет', () => {
    const D = 86400e3; const s0 = Date.parse('2026-10-01T00:00:00Z');
    const r = { id: 'r1', other: 'alina', status: 'active', start: '2026-10-01', days: 3 };
    expect(raceRest([r], 'boris', s0 + D)).toMatchObject({ why: 'busy' });
    expect(raceRest([r], 'boris', s0 + 4 * D)).toMatchObject({ why: 'rest', days: 2 });
    expect(raceRestText(raceRest([r], 'boris', s0 + 4 * D))).toBe('После забега — три дня отдыха: следующий можно через 2 дня.');
    expect(raceRest([r], 'alina', s0 + 7 * D)).toMatchObject({ why: 'same', days: 3 });
    expect(raceRest([r], 'boris', s0 + 7 * D)).toBe(null);
    expect(raceRest([{ ...r, status: 'declined' }], 'alina', s0 + D)).toBe(null);
    // в паузу забег после урока не предлагается
    const data = { friends: [friend({}, s0 + 4 * D)], races: [r] };
    expect(Array.from({ length: 6 }, (_, k) => raceOffer(data, { ...emptyLearn(), done: { '2026-10-05': k + 1 } }, s0 + 4 * D)).every((o) => o === null)).toBe(true);
  });
  it('лента друзей — свежие события всех друзей', () => {
    const f1 = { login: 'a', name: 'А', card: { events: [{ k: 'streak', n: 3, at: NOW - 1000 }, { k: 'seal', id: 'first', at: NOW - 30 * 86400e3 }] } };
    const f2 = { login: 'b', name: 'Б', card: { events: [{ k: 'unit', id: 'scarcity', at: NOW - 500 }] } };
    expect(friendFeed([f1, f2], NOW).map((e) => e.login)).toEqual(['b', 'a']);
  });
});
