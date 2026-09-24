import { describe, it, expect } from 'vitest';
import accountHandler from '../account.js';
import roomHandler, { seatAccessError } from '../room.js';

const call = (handler, body) => new Promise((resolve) => {
  const res = { code: 200, status(c) { this.code = c; return this; }, json(d) { resolve({ status: this.code, data: d }); return this; } };
  handler({ method: 'POST', query: {}, body }, res);
});
const acc = (body) => call(accountHandler, body);
const room = (body) => call(roomHandler, body);
let n = 0;
const uniq = (p) => `${p}${Date.now().toString(36).slice(-4)}${n++}`;

describe('профиль: регистрация и вход', () => {
  it('регистрация отдаёт сессию и профиль без пароля; логин нельзя занять дважды', async () => {
    const login = uniq('anna');
    const r = await acc({ action: 'register', login, password: 'secret1', name: 'Анна', playerId: 'dev-1' });
    expect(r.status).toBe(200);
    expect(r.data.token).toBeTruthy();
    expect(r.data.profile).toMatchObject({ login, name: 'Анна', playerId: 'dev-1', emblem: 'star' });
    expect(r.data.profile.hash).toBeUndefined();
    expect(r.data.profile.salt).toBeUndefined();
    expect((await acc({ action: 'register', login, password: 'other12' })).status).toBe(409);
  });

  it('плохой логин и короткий пароль отклоняются', async () => {
    expect((await acc({ action: 'register', login: 'я', password: 'secret1' })).status).toBe(400);
    expect((await acc({ action: 'register', login: uniq('bob'), password: '123' })).status).toBe(400);
  });

  it('вход проверяет пароль, профиль приезжает с тем же playerId', async () => {
    const login = uniq('boris');
    await acc({ action: 'register', login, password: 'secret1', playerId: 'dev-b' });
    expect((await acc({ action: 'login', login, password: 'wrong11' })).status).toBe(401);
    expect((await acc({ action: 'login', login: uniq('nobody'), password: 'secret1' })).status).toBe(401);
    const ok = await acc({ action: 'login', login, password: 'secret1' });
    expect(ok.status).toBe(200);
    expect(ok.data.profile.playerId).toBe('dev-b');
  });

  it('после 8 неудач вход блокируется на время', async () => {
    const login = uniq('carl');
    await acc({ action: 'register', login, password: 'secret1' });
    for (let i = 0; i < 8; i++) await acc({ action: 'login', login, password: 'nope123' });
    expect((await acc({ action: 'login', login, password: 'secret1' })).status).toBe(429);
  });

  it('имя, значок и пароль меняются только со своей сессией; выход гасит сессию', async () => {
    const login = uniq('dina');
    const { data: { token } } = await acc({ action: 'register', login, password: 'secret1' });
    expect((await acc({ action: 'update', token: 'чужой', name: 'Вор' })).status).toBe(401);
    const up = await acc({ action: 'update', token, name: 'Дина', emblem: 'crown' });
    expect(up.data.profile).toMatchObject({ name: 'Дина', emblem: 'crown' });
    expect((await acc({ action: 'update', token, emblem: 'skull' })).status).toBe(400);
    expect((await acc({ action: 'password', token, oldPassword: 'bad', newPassword: 'newpass1' })).status).toBe(403);
    expect((await acc({ action: 'password', token, oldPassword: 'secret1', newPassword: 'newpass1' })).status).toBe(200);
    expect((await acc({ action: 'login', login, password: 'newpass1' })).status).toBe(200);
    await acc({ action: 'logout', token });
    expect((await acc({ action: 'me', token })).status).toBe(401);
  });
});

describe('места в сетевой комнате закреплены за профилем', () => {
  const T0 = 1_000_000_000_000;
  const base = { seats: { central_bank: null, ministry_finance: 'tok-b' }, accounts: { ministry_finance: 'boris' }, left: {} };

  it('нельзя сесть второй раз — ни на то же место, ни на соседнее', () => {
    expect(seatAccessError(base, 'ministry_finance', 'boris', T0)).toMatch(/уже на этом месте/);
    expect(seatAccessError(base, 'central_bank', 'boris', T0)).toMatch(/другом месте/);
    expect(seatAccessError(base, 'central_bank', 'anna', T0)).toBe(null);
  });

  it('вышедший ждёт минуту и возвращается только на своё место, которое за ним держится', () => {
    const r = { ...base, seats: { central_bank: null, ministry_finance: null }, accounts: {}, left: { boris: { seat: 'ministry_finance', at: T0 } } };
    expect(seatAccessError(r, 'ministry_finance', 'boris', T0 + 5_000)).toMatch(/через 55 с/);
    expect(seatAccessError(r, 'central_bank', 'boris', T0 + 61_000)).toMatch(/прежнее место/);
    expect(seatAccessError(r, 'ministry_finance', 'boris', T0 + 61_000)).toBe(null);
    // чужому место не отдаём, пока резерв не истёк
    expect(seatAccessError(r, 'ministry_finance', 'anna', T0 + 61_000)).toMatch(/держится/);
    expect(seatAccessError(r, 'ministry_finance', 'anna', T0 + 11 * 60_000)).toBe(null);
  });

  it('выгнанного обратно не пускают, а его место свободно сразу', () => {
    const r = { ...base, seats: { central_bank: null, ministry_finance: null }, accounts: {}, left: { boris: { seat: 'ministry_finance', at: T0, kicked: true } } };
    expect(seatAccessError(r, 'ministry_finance', 'boris', T0 + 3_600_000)).toMatch(/убрал вас/);
    expect(seatAccessError(r, 'ministry_finance', 'anna', T0 + 1_000)).toBe(null);
  });

  it('вход в комнату без профиля не пускает; выйти и тут же зайти нельзя', async () => {
    const reg = await acc({ action: 'register', login: uniq('eva'), password: 'secret1', name: 'Ева' });
    const session = reg.data.token;
    const created = await room({ action: 'create', mode: 'policy', difficulty: 'medium', president: null });
    const id = created.data.id;
    expect((await room({ action: 'join', id, seat: 'central_bank', name: 'кто-то' })).status).toBe(401);
    const j = await room({ action: 'join', id, seat: 'central_bank', name: 'подмена', session });
    expect(j.status).toBe(200);
    expect(j.data.room.names.central_bank).toBe('Ева');
    expect((await room({ action: 'join', id, seat: 'ministry_finance', session })).status).toBe(409);
    expect((await room({ action: 'leave', id, seat: 'central_bank', token: j.data.token })).status).toBe(200);
    const again = await room({ action: 'join', id, seat: 'ministry_finance', session });
    expect(again.status).toBe(409);
    expect(again.data.error).toMatch(/вышли/);
    const me = await acc({ action: 'me', token: session });
    expect(me.data.profile.stats).toMatchObject({ rooms: 1, leaves: 1 });
  });
});
