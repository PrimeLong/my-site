// друзья и забеги: заявки по точному логину, карточка для друзей, приглашение на забег (docs/mechanics.md)
import { describe, it, expect, vi } from 'vitest';
import accountHandler from '../account.js';
import { cleanCard, raceStatus, raceRest, RACE } from '../_lib/friends.js';

let ipN = 0;
const acc = (body) => new Promise((resolve) => {
  const res = { code: 200, status(c) { this.code = c; return this; }, json(d) { resolve({ status: this.code, data: d }); return this; } };
  accountHandler({ method: 'POST', query: {}, headers: { 'x-forwarded-for': `10.9.0.${ipN++}` }, body }, res);
});
let n = 0;
const reg = async (p) => {
  const login = `${p}fr${n++}`;
  const r = await acc({ action: 'register', consentPage: true, consentPd: true, birthYear: 1990, login, password: 'secret1', name: p });
  return { login, token: r.data.token };
};

describe('друзья: заявка и согласие', () => {
  it('заявка по логину ждёт ответа; принятая — друзья у обоих; встречная заявка — сразу друзья', async () => {
    const a = await reg('alina'); const b = await reg('boris'); const c = await reg('vera');
    expect((await acc({ action: 'friend-add', token: a.token, login: a.login })).status).toBe(400);
    expect((await acc({ action: 'friend-add', token: a.token, login: 'nobodyhere' })).status).toBe(404);
    await acc({ action: 'card', token: a.token, card: { streak: 7, xp: 300, wear: { head: 'crown' } } });
    const sent = await acc({ action: 'friend-add', token: a.token, login: b.login.toUpperCase() });
    expect(sent.data.status).toBe('sent');
    expect(sent.data.outgoing.map((x) => x.login)).toEqual([b.login]);
    const bView = await acc({ action: 'friends', token: b.token });
    expect(bView.data.incoming.map((x) => x.login)).toEqual([a.login]);
    // в заявке Инфля одета как у человека, но серии и опыта ещё не видно — только наряд
    expect(bView.data.incoming[0].card).toEqual({ wear: expect.objectContaining({ head: 'crown' }) });
    expect(bView.data.friends).toEqual([]);
    const ok = await acc({ action: 'friend-answer', token: b.token, login: a.login, accept: true });
    expect(ok.data.friends.map((x) => x.login)).toEqual([a.login]);
    expect(ok.data.incoming).toEqual([]);
    expect((await acc({ action: 'friends', token: a.token })).data.friends.map((x) => x.login)).toEqual([b.login]);
    // встречная: c зовёт a, a зовёт c — друзья без лишнего шага
    await acc({ action: 'friend-add', token: c.token, login: a.login });
    expect((await acc({ action: 'friend-add', token: a.token, login: c.login })).data.status).toBe('friends');
  });
  it('отказ и удаление — с обеих сторон; карточка друга без свободного текста', async () => {
    const a = await reg('gleb'); const b = await reg('dasha');
    await acc({ action: 'friend-add', token: a.token, login: b.login });
    await acc({ action: 'friend-answer', token: b.token, login: a.login, accept: false });
    expect((await acc({ action: 'friends', token: a.token })).data.outgoing).toEqual([]);
    await acc({ action: 'friend-add', token: a.token, login: b.login });
    await acc({ action: 'friend-answer', token: b.token, login: a.login, accept: true });
    await acc({ action: 'card', token: b.token, card: { streak: 12, xp: 900, wear: { head: 'beret', face: '<script>' }, seals: ['first', 'bad id!'], note: 'привет', events: [{ k: 'unit', id: 'scarcity', at: 5 }, { k: 'evil', at: 6 }] } });
    const card = (await acc({ action: 'friends', token: a.token })).data.friends[0].card;
    expect(card).toMatchObject({ streak: 12, xp: 900, wear: { head: 'beret' }, seals: ['first'] });
    expect(card.note).toBeUndefined();
    expect(card.wear.face).toBeUndefined();
    expect(card.events).toEqual([{ k: 'unit', id: 'scarcity', at: 5 }]);
    expect(card.at).toBeGreaterThan(0);
    await acc({ action: 'friend-remove', token: b.token, login: a.login });
    expect((await acc({ action: 'friends', token: a.token })).data.friends).toEqual([]);
  });
});

describe('забег с другом', () => {
  it('позвать можно только друга; второе приглашение тому же — нельзя; принял — забег идёт со дня принятия', async () => {
    const a = await reg('lena'); const b = await reg('misha'); const c = await reg('nina');
    await acc({ action: 'friend-add', token: a.token, login: b.login });
    await acc({ action: 'friend-answer', token: b.token, login: a.login, accept: true });
    expect((await acc({ action: 'race-invite', token: a.token, login: c.login })).status).toBe(400);
    // только что подружились — звать на забег рано: через сутки
    const fresh = await acc({ action: 'race-invite', token: a.token, login: b.login });
    expect(fresh.status).toBe(400);
    expect(fresh.data.error).toContain('сутки');
    // прошли сутки дружбы
    const real = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(real + RACE.friendMs + 60000);
    const inv = await acc({ action: 'race-invite', token: a.token, login: b.login });
    expect(inv.status).toBe(200);
    expect(inv.data.races).toHaveLength(1);
    expect(inv.data.races[0]).toMatchObject({ from: a.login, to: b.login, status: 'pending', mine: true, days: RACE.days });
    expect((await acc({ action: 'race-invite', token: a.token, login: b.login })).status).toBe(400);
    const id = inv.data.races[0].id;
    // ответить может только приглашённый
    expect((await acc({ action: 'race-answer', token: a.token, id, accept: true })).status).toBe(404);
    // опыт, набранный в день старта до принятия, запоминается — в счёт забега он не идёт;
    // день старта — сегодня по всемирному времени, день устройства не берётся (перевод часов не сдвигает забег)
    const ok = await acc({ action: 'race-answer', token: b.token, id, accept: true, day: '2020-01-01', base: 35 });
    const today = new Date(real + RACE.friendMs + 60000).toISOString().slice(0, 10);
    expect(ok.data.races[0]).toMatchObject({ status: 'active', start: today, mine: false, other: a.login, baseMine: 35, baseTheirs: 0 });
    expect((await acc({ action: 'race-answer', token: b.token, id, accept: false })).status).toBe(400);
    clock.mockRestore();
  });
  it('пауза между забегами: пока идёт — новый не начать; после финиша три дня отдыха, с тем же другом — неделя', async () => {
    const a = await reg('olga'); const b = await reg('petr'); const c = await reg('rita');
    for (const x of [b, c]) {
      await acc({ action: 'friend-add', token: a.token, login: x.login });
      await acc({ action: 'friend-answer', token: x.token, login: a.login, accept: true });
    }
    const real = Date.now(); const DAY = 86400000;
    const at = (ms) => vi.spyOn(Date, 'now').mockReturnValue(ms);
    let clock = at(real + RACE.friendMs + 60000);
    const inv = await acc({ action: 'race-invite', token: a.token, login: b.login });
    await acc({ action: 'race-answer', token: b.token, id: inv.data.races[0].id, accept: true });
    // забег идёт — с другим другом не начать
    const busy = await acc({ action: 'race-invite', token: a.token, login: c.login });
    expect(busy.status).toBe(400);
    expect(busy.data.error).toContain('уже идёт забег');
    // день после финиша — ещё отдых
    const start = Date.parse(`${new Date(real + RACE.friendMs + 60000).toISOString().slice(0, 10)}T00:00:00Z`);
    const end = start + RACE.days * DAY;
    clock.mockRestore(); clock = at(end + DAY);
    const rest = await acc({ action: 'race-invite', token: a.token, login: c.login });
    expect(rest.status).toBe(400);
    expect(rest.data.error).toContain('три дня отдыха');
    // через три дня — с другим другом можно, а с тем же — только через неделю
    clock.mockRestore(); clock = at(end + 3 * DAY + 1000);
    const same = await acc({ action: 'race-invite', token: a.token, login: b.login });
    expect(same.status).toBe(400);
    expect(same.data.error).toContain('раз в неделю');
    expect((await acc({ action: 'race-invite', token: a.token, login: c.login })).status).toBe(200);
    clock.mockRestore();
  });
  it('raceRest: считаются только принятые забеги; финиш — после трёх дней', () => {
    const DAY = 86400000; const s0 = Date.parse('2026-10-01T00:00:00Z');
    const r = { from: 'a', to: 'b', status: 'active', start: '2026-10-01', days: 3 };
    expect(raceRest([r], 'a', 'c', s0 + DAY)).toMatchObject({ why: 'busy' });
    expect(raceRest([r], 'a', 'c', s0 + 4 * DAY)).toMatchObject({ why: 'rest', until: s0 + 6 * DAY });
    expect(raceRest([r], 'a', 'b', s0 + 4 * DAY)).toMatchObject({ why: 'same', until: s0 + 10 * DAY });
    expect(raceRest([r], 'a', 'c', s0 + 6 * DAY)).toBe(null);
    expect(raceRest([{ ...r, status: 'declined' }, { ...r, status: 'pending' }], 'a', 'b', s0 + DAY)).toBe(null);
  });
  it('приглашение без ответа сутки — протухло; карточка чистится от мусора', () => {
    const now = Date.now();
    expect(raceStatus({ status: 'pending', at: now - RACE.acceptMs - 1 }, now)).toBe('expired');
    expect(raceStatus({ status: 'pending', at: now - 1000 }, now)).toBe('pending');
    const c = cleanCard({ streak: -5, xp: 1e12, xpDays: { '2026-10-01': 50, bad: 9 }, level: 'Basic!', months: ['2026-09', 'x'] });
    expect(c).toMatchObject({ streak: 0, xp: 1e8, xpDays: { '2026-10-01': 50 }, level: null, months: ['2026-09'] });
  });
});
