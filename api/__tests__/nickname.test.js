/* Ник: смена раз в 30 дней; грубый ник (заведённый до фильтра) или ник, который потребовал сменить
   владелец, — уведомление и 7 дней на смену, потом блок; другие ученики грубого ника не видят. */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import accountHandler from '../account.js';
import recordsHandler from '../records.js';
import { getUser, setUser } from '../_lib/store.js';
import { RENAME_DAYS, NAME_EVERY_DAYS, DAY_MS } from '../_lib/accounts.js';

let ipN = 0;
const call = (handler, body, ip = `10.11.0.${ipN++}`) => new Promise((resolve) => {
  const res = { code: 200, status(c) { this.code = c; return this; }, json(d) { resolve({ status: this.code, data: d }); return this; } };
  handler({ method: 'POST', query: {}, headers: { 'x-forwarded-for': ip }, body }, res);
});
let n = 0;
const uniq = (p) => `${p}nick${n++}`;
const register = async (login, name = 'Анна') => (await call(accountHandler, { action: 'register', consentPage: true, consentPd: true, birthYear: 1990, login, password: 'secret1', name, playerId: `dev-${login}` })).data.token;
const acc = (token, body) => call(accountHandler, { token, ...body });
// ник, заведённый до фильтра: в базе лежит как есть
const legacyRude = async (login) => { const token = await register(login); await setUser(login, { ...(await getUser(login)), name: 'Pidoras' }); return token; };

afterEach(() => { vi.useRealTimers(); });

describe('ник раз в месяц', () => {
  it('первая смена — сразу; вторая — только через 30 дней, с датой в ошибке', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-25T10:00:00Z'));
    const t = await register(uniq('mila'));
    const first = await acc(t, { action: 'update', name: 'Мила' });
    expect(first.status).toBe(200);
    expect(first.data.profile.name).toBe('Мила');
    expect(first.data.profile.nameNextAt).toBe(Date.parse('2026-10-25T10:00:00Z') + NAME_EVERY_DAYS * DAY_MS);
    const again = await acc(t, { action: 'update', name: 'Людмила' });
    expect(again.status).toBe(429);
    expect(again.data.error).toMatch(/раз в 30 дней — следующий раз 24 ноября/);
    // тот же ник — не смена: остальные поля сохраняются
    expect((await acc(t, { action: 'update', name: 'Мила', emblem: 'crown' })).status).toBe(200);
    vi.setSystemTime(new Date('2026-11-24T10:00:01Z'));
    expect((await acc(t, { action: 'update', name: 'Людмила' })).data.profile.name).toBe('Людмила');
  });
});

describe('грубый ник', () => {
  it('новый грубый ник не проходит ни при регистрации, ни при смене', async () => {
    expect((await call(accountHandler, { action: 'register', consentPage: true, consentPd: true, birthYear: 1990, login: uniq('x'), password: 'secret1', name: 'Pidoras' })).status).toBe(400);
    const t = await register(uniq('ok'));
    expect((await acc(t, { action: 'update', name: 'сука' })).status).toBe(400);
  });

  it('старый грубый ник: срок 7 дней и уведомление, потом блок; смена ника снимает всё и не тратит месячную попытку', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const t0 = Date.parse('2026-10-25T10:00:00Z');
    vi.setSystemTime(t0);
    const login = uniq('legacy');
    const t = await legacyRude(login);
    const me = await acc(t, { action: 'me' });
    expect(me.data.profile.renameBy).toBe(t0 + RENAME_DAYS * DAY_MS);
    expect(me.data.profile.blocked).toBe(false);
    // срок не продлевается от каждого входа
    vi.setSystemTime(t0 + 3 * DAY_MS);
    expect((await acc(t, { action: 'me' })).data.profile.renameBy).toBe(t0 + RENAME_DAYS * DAY_MS);
    expect((await acc(t, { action: 'friends' })).status).toBe(200);
    // срок вышел — блок: друзья, забеги и прочее закрыты, остальные поля профиля — тоже
    vi.setSystemTime(t0 + RENAME_DAYS * DAY_MS + 1);
    const blocked = await acc(t, { action: 'me' });
    expect(blocked.data.profile.blocked).toBe(true);
    expect((await acc(t, { action: 'friends' })).status).toBe(403);
    expect((await acc(t, { action: 'friend-add', login: 'someone' })).data.blocked).toBe(true);
    expect((await acc(t, { action: 'update', emblem: 'crown' })).status).toBe(403);
    expect((await call(recordsHandler, { session: t, kind: 'tycoon', value: 100 })).status).toBe(403);
    // смена ника открывает аккаунт сразу; смена запрещённого ника месячную попытку не тратит
    const fixed = await acc(t, { action: 'update', name: 'Паша' });
    expect(fixed.status).toBe(200);
    expect(fixed.data.profile).toMatchObject({ name: 'Паша', blocked: false, renameBy: null, nameNextAt: 0 });
    expect((await acc(t, { action: 'friends' })).status).toBe(200);
    expect((await getUser(login)).renameBy).toBeUndefined();
  });

  it('другие ученики видят вместо грубого ника логин', async () => {
    const bad = uniq('rude');
    const tb = await legacyRude(bad);
    const ta = await register(uniq('frnd'));
    const a = (await acc(ta, { action: 'me' })).data.profile.login;
    expect((await acc(tb, { action: 'friend-add', login: a })).status).toBe(200);
    const view = (await acc(ta, { action: 'friends' })).data;
    expect(view.incoming[0]).toMatchObject({ login: bad, name: bad });
  });
});

describe('владелец требует сменить ник', () => {
  const owner = uniq('boss');
  let ownerToken;
  beforeAll(async () => {
    process.env.OWNER_LOGINS = owner;
    ownerToken = await register(owner);
  });

  it('только владелец; ученик получает срок и уведомление, смена ника его снимает', async () => {
    const login = uniq('kid');
    const t = await register(login, 'Странный');
    expect((await acc(t, { action: 'require-rename', login })).status).toBe(403);
    const r = await acc(ownerToken, { action: 'require-rename', login });
    expect(r.status).toBe(200);
    expect(r.data.renameBy).toBeGreaterThan(Date.now());
    const me = (await acc(t, { action: 'me' })).data.profile;
    expect(me.renameBy).toBe(r.data.renameBy);
    expect(me.blocked).toBe(false);
    expect((await acc(ownerToken, { action: 'require-rename', login: 'nosuchlogin1' })).status).toBe(404);
    const done = await acc(t, { action: 'update', name: 'Обычный' });
    expect(done.data.profile).toMatchObject({ name: 'Обычный', renameBy: null });
    expect((await acc(t, { action: 'me' })).data.profile.renameBy).toBeNull();
  });
});
