import { describe, it, expect } from 'vitest';
import accountHandler from '../account.js';
import roomHandler, { seatAccessError } from '../room.js';
import dailyHandler from '../daily.js';
import { dailyKey } from '../../src/lib/catalog.js';

let ipN = 0;
// у каждого запроса свой адрес — иначе в тестах сработал бы лимит регистраций
const call = (handler, body, ip = `10.0.0.${ipN++}`) => new Promise((resolve) => {
  const res = { code: 200, status(c) { this.code = c; return this; }, json(d) { resolve({ status: this.code, data: d }); return this; } };
  handler({ method: 'POST', query: {}, headers: { 'x-forwarded-for': ip }, body }, res);
});
const acc = (body) => call(accountHandler, body);
const room = (body) => call(roomHandler, body);
let n = 0;
// логины без времени и случайностей: одинаковые при каждом запуске (фильтр грубых слов не должен зависеть от часов)
const uniq = (p) => `${p}acc${n++}`;

describe('профиль: регистрация и вход', () => {
  it('регистрация отдаёт сессию и профиль без пароля; логин нельзя занять дважды', async () => {
    const login = uniq('anna');
    const r = await acc({ action: 'register', consentPage: true, consentPd: true, birthYear: 1990, login, password: 'secret1', name: 'Анна', playerId: 'dev-1' });
    expect(r.status).toBe(200);
    expect(r.data.token).toBeTruthy();
    expect(r.data.profile).toMatchObject({ login, name: 'Анна', playerId: 'dev-1', emblem: 'star' });
    expect(r.data.profile.hash).toBeUndefined();
    expect(r.data.profile.salt).toBeUndefined();
    expect((await acc({ action: 'register', consentPage: true, consentPd: true, birthYear: 1990, login, password: 'other12' })).status).toBe(409);
  });

  it('плохой логин и короткий пароль отклоняются', async () => {
    expect((await acc({ action: 'register', consentPage: true, consentPd: true, birthYear: 1990, login: 'я', password: 'secret1' })).status).toBe(400);
    expect((await acc({ action: 'register', consentPage: true, consentPd: true, birthYear: 1990, login: uniq('bob'), password: '123' })).status).toBe(400);
  });

  it('вход проверяет пароль, профиль приезжает с тем же playerId', async () => {
    const login = uniq('boris');
    await acc({ action: 'register', consentPage: true, consentPd: true, birthYear: 1990, login, password: 'secret1', playerId: 'dev-b' });
    expect((await acc({ action: 'login', login, password: 'wrong11' })).status).toBe(401);
    expect((await acc({ action: 'login', login: uniq('nobody'), password: 'secret1' })).status).toBe(401);
    const ok = await acc({ action: 'login', login, password: 'secret1' });
    expect(ok.status).toBe(200);
    expect(ok.data.profile.playerId).toBe('dev-b');
  });

  it('после 8 неудач вход блокируется на время', async () => {
    const login = uniq('carl');
    await acc({ action: 'register', consentPage: true, consentPd: true, birthYear: 1990, login, password: 'secret1' });
    for (let i = 0; i < 8; i++) await acc({ action: 'login', login, password: 'nope123' });
    expect((await acc({ action: 'login', login, password: 'secret1' })).status).toBe(429);
  });

  it('имя, значок и пароль меняются только со своей сессией; выход гасит сессию', async () => {
    const login = uniq('dina');
    const { data: { token } } = await acc({ action: 'register', consentPage: true, consentPd: true, birthYear: 1990, login, password: 'secret1' });
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

describe('профиль: восстановление доступа и сессии', () => {
  it('при регистрации выдаётся код восстановления; по нему задаётся новый пароль, старые сессии гаснут', async () => {
    const login = uniq('fedor');
    const reg = await acc({ action: 'register', consentPage: true, consentPd: true, birthYear: 1990, login, password: 'secret1' });
    expect(reg.data.recoveryCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(reg.data.profile.hasRecovery).toBe(true);
    const old = reg.data.token;
    expect((await acc({ action: 'recover', login, code: 'AAAA-BBBB-CCCC', newPassword: 'fresh12' })).status).toBe(401);
    const rec = await acc({ action: 'recover', login, code: reg.data.recoveryCode.toLowerCase(), newPassword: 'fresh12' });
    expect(rec.status).toBe(200);
    expect(rec.data.recoveryCode).not.toBe(reg.data.recoveryCode);
    expect((await acc({ action: 'me', token: old })).status).toBe(401);
    expect((await acc({ action: 'me', token: rec.data.token })).status).toBe(200);
    expect((await acc({ action: 'login', login, password: 'fresh12' })).status).toBe(200);
    // старый код одноразовый
    expect((await acc({ action: 'recover', login, code: reg.data.recoveryCode, newPassword: 'again12' })).status).toBe(401);
  });

  it('смена пароля закрывает другие сессии, а этому устройству выдаёт новую', async () => {
    const login = uniq('gleb');
    const a = await acc({ action: 'register', consentPage: true, consentPd: true, birthYear: 1990, login, password: 'secret1' });
    const b = await acc({ action: 'login', login, password: 'secret1' });
    const ch = await acc({ action: 'password', token: a.data.token, oldPassword: 'secret1', newPassword: 'newpass1' });
    expect(ch.data.token).toBeTruthy();
    expect((await acc({ action: 'me', token: b.data.token })).status).toBe(401);
    expect((await acc({ action: 'me', token: ch.data.token })).status).toBe(200);
  });

  it('новый код восстановления — только по паролю', async () => {
    const { data: { token } } = await acc({ action: 'register', consentPage: true, consentPd: true, birthYear: 1990, login: uniq('hana'), password: 'secret1' });
    expect((await acc({ action: 'recovery_new', token, password: 'wrong11' })).status).toBe(403);
    expect((await acc({ action: 'recovery_new', token, password: 'secret1' })).data.recoveryCode).toBeTruthy();
  });

  it('с одного адреса — не больше пяти регистраций в час', async () => {
    const ip = '203.0.113.7';
    for (let i = 0; i < 5; i++) expect((await call(accountHandler, { action: 'register', consentPage: true, consentPd: true, birthYear: 1990, login: uniq('bot'), password: 'secret1' }, ip)).status).toBe(200);
    expect((await call(accountHandler, { action: 'register', consentPage: true, consentPd: true, birthYear: 1990, login: uniq('bot'), password: 'secret1' }, ip)).status).toBe(429);
  });
});

describe('вызов дня за профилем', () => {
  const entry = (extra) => ({ day: dailyKey(), score: 70, role: 'central_bank', quarters: 12, ...extra });
  it('строка из профиля подписана его именем и значком; гость чужое имя не займёт', async () => {
    const reg = await acc({ action: 'register', consentPage: true, consentPd: true, birthYear: 1990, login: uniq('ira'), password: 'secret1', name: 'Ирина Штерн', playerId: uniq('dev') });
    await acc({ action: 'update', token: reg.data.token, emblem: 'crown' });
    const r = await call(dailyHandler, entry({ playerId: 'whatever', name: 'Подмена', session: reg.data.token }));
    expect(r.data.you).toMatchObject({ name: 'Ирина Штерн', verified: true, emblem: 'crown' });
    const g = await call(dailyHandler, entry({ playerId: uniq('guest'), name: 'ирина штерн', score: 90 }));
    expect(g.data.you.name).toBe('ирина штерн (гость)');
    expect(g.data.you.verified).toBe(false);
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
    const reg = await acc({ action: 'register', consentPage: true, consentPd: true, birthYear: 1990, login: uniq('eva'), password: 'secret1', name: 'Ева' });
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

describe('рекорды «Своего дела»', () => {
  it('записывают только из профиля; хранится лучший результат, имя из профиля', async () => {
    const { default: records } = await import('../records.js');
    const rec = (body) => call(records, body);
    expect((await rec({ kind: 'tycoon', value: 500 })).status).toBe(401);
    const reg = await acc({ action: 'register', consentPage: true, consentPd: true, birthYear: 1990, login: uniq('tyc'), password: 'secret1', name: 'Магнат' });
    const a = await rec({ kind: 'tycoon', session: reg.data.token, value: 500, start: 'farm', quarters: 12 });
    expect(a.data.you).toMatchObject({ name: 'Магнат', value: 500, start: 'farm' });
    const b = await rec({ kind: 'tycoon', session: reg.data.token, value: 300 });
    expect(b.data.you.value).toBe(500);
    expect(b.data.improved).toBe(false);
    expect((await rec({ kind: 'tycoon', session: reg.data.token, value: 1e9 })).status).toBe(400);
  });
});

describe('данные и конфиденциальность', () => {
  it('без согласия со страницей «Данные и конфиденциальность» аккаунт не создаётся; согласие запоминается', async () => {
    const login = uniq('consent');
    const no = await acc({ action: 'register', login, password: 'secret1', name: 'Анна' });
    expect(no.status).toBe(400);
    expect(no.data.error).toContain('Данные и конфиденциальность');
    const yes = await acc({ action: 'register', consentPage: true, consentPd: true, birthYear: 1990, login, password: 'secret1', name: 'Анна' });
    expect(yes.status).toBe(200);
    const out = await acc({ action: 'export', token: yes.data.token });
    expect(out.data.account.consentAt).toBeGreaterThan(0);
  });
  it('«Скачать мои данные»: профиль, прогресс и сохранения одним JSON — без хэшей пароля и кода', async () => {
    const login = uniq('export');
    const r = await acc({ action: 'register', consentPage: true, consentPd: true, birthYear: 1990, login, password: 'secret1', name: 'Олег', playerId: `dev-${login}` });
    const out = await acc({ action: 'export', token: r.data.token });
    expect(out.status).toBe(200);
    expect(out.data.account.login).toBe(login);
    expect(out.data).toHaveProperty('progress');
    expect(out.data).toHaveProperty('saves');
    expect(out.data).toHaveProperty('reports');
    const text = JSON.stringify(out.data);
    expect(text).not.toMatch(/"hash"|"salt"|recHash|recSalt/);
  });
  it('«Удалить аккаунт и все данные»: только с паролем; после удаления войти нельзя и логин свободен', async () => {
    const login = uniq('gone');
    const r = await acc({ action: 'register', consentPage: true, consentPd: true, birthYear: 1990, login, password: 'secret1', name: 'Вера' });
    expect((await acc({ action: 'delete', token: r.data.token, password: 'wrong1' })).status).toBe(403);
    expect((await acc({ action: 'delete', token: r.data.token, password: 'secret1' })).status).toBe(200);
    expect((await acc({ action: 'me', token: r.data.token })).status).toBe(401);
    expect((await acc({ action: 'login', login, password: 'secret1' })).status).toBe(401);
    expect((await acc({ action: 'register', consentPage: true, consentPd: true, birthYear: 1990, login, password: 'secret2', name: 'Вера' })).status).toBe(200);
  });
});

describe('возраст и детский режим «Мира»', () => {
  const thisYear = new Date().getUTCFullYear();
  it('без года рождения не зарегистрироваться; до 16 детский режим включён и не снимается', async () => {
    expect((await acc({ action: 'register', consentPage: true, consentPd: true, login: uniq('noyear'), password: 'secret1' })).status).toBe(400);
    expect((await acc({ action: 'register', consentPage: true, consentPd: true, login: uniq('baby'), password: 'secret1', birthYear: thisYear - 2 })).status).toBe(400);
    const kid = await acc({ action: 'register', consentPage: true, consentPd: true, login: uniq('kid'), password: 'secret1', birthYear: thisYear - 13, parentConsent: true, parentName: 'Ольга Петрова' });
    expect(kid.status).toBe(200);
    expect(kid.data.profile).toMatchObject({ birthYear: thisYear - 13, kidsMode: true });
    const off = await acc({ action: 'update', token: kid.data.token, kidsMode: false });
    expect(off.status).toBe(403);
    // год рождения задаётся один раз — переписать его, чтобы снять режим, нельзя
    expect((await acc({ action: 'update', token: kid.data.token, birthYear: 1990 })).status).toBe(400);
  });
  it('взрослому режим выключен, но его можно включить в профиле', async () => {
    const r = await acc({ action: 'register', consentPage: true, consentPd: true, login: uniq('adult'), password: 'secret1', birthYear: 1990 });
    expect(r.data.profile.kidsMode).toBe(false);
    const on = await acc({ action: 'update', token: r.data.token, kidsMode: true });
    expect(on.status).toBe(200); expect(on.data.profile.kidsMode).toBe(true);
    const back = await acc({ action: 'update', token: r.data.token, kidsMode: false });
    expect(back.data.profile.kidsMode).toBe(false);
  });
  it('игрок в детском режиме садится только в детскую партию', async () => {
    const kid = await acc({ action: 'register', consentPage: true, consentPd: true, login: uniq('kidnet'), password: 'secret1', birthYear: thisYear - 12, parentConsent: true, parentName: 'Ольга Петрова' });
    const adultRoom = await room({ action: 'create', mode: 'policy', difficulty: 'medium', president: null });
    const denied = await room({ action: 'join', id: adultRoom.data.id, seat: 'central_bank', session: kid.data.token });
    expect(denied.status).toBe(403);
    const kidsRoom = await room({ action: 'create', mode: 'policy', difficulty: 'medium', president: null, kids: true });
    expect(kidsRoom.data.room.economy.kidsMode).toBe(true);
    const ok = await room({ action: 'join', id: kidsRoom.data.id, seat: 'central_bank', session: kid.data.token });
    expect(ok.status).toBe(200);
  });
});

describe('согласия при регистрации и подтверждение родителя', () => {
  const thisYear = new Date().getUTCFullYear();
  const base = () => ({ action: 'register', login: uniq('cons'), password: 'secret1' });
  it('«ознакомлен со страницей» и «согласие на обработку данных» — две отдельные отметки, обе обязательны', async () => {
    expect((await acc({ ...base(), birthYear: 1990, consentPd: true })).status).toBe(400);
    expect((await acc({ ...base(), birthYear: 1990, consentPage: true })).status).toBe(400);
    const ok = await acc({ ...base(), birthYear: 1990, consentPage: true, consentPd: true });
    expect(ok.status).toBe(200);
    const ex = await acc({ action: 'export', token: ok.data.token });
    expect(ex.data.account.consentAt).toBeGreaterThan(0);
    expect(ex.data.account.pdConsentAt).toBeGreaterThan(0);
    expect(ex.data.account.parentConsentAt).toBeNull();
  });
  it('до 14 лет без родителя не зарегистрироваться; с отметкой и именем — сервер хранит parentConsentAt', async () => {
    const kid = { ...base(), birthYear: thisYear - 12, consentPage: true, consentPd: true };
    expect((await acc(kid)).status).toBe(400);
    expect((await acc({ ...kid, login: uniq('cons'), parentConsent: true })).status).toBe(400);
    expect((await acc({ ...kid, login: uniq('cons'), parentConsent: true, parentName: 'М' })).status).toBe(400);
    const ok = await acc({ ...kid, login: uniq('cons'), parentConsent: true, parentName: 'Мария Иванова' });
    expect(ok.status).toBe(200);
    const ex = await acc({ action: 'export', token: ok.data.token });
    expect(ex.data.account.parentConsentAt).toBeGreaterThan(0);
    expect(ex.data.account.parentName).toBe('Мария Иванова');
    // 15 лет — родитель не нужен
    expect((await acc({ ...base(), birthYear: thisYear - 16, consentPage: true, consentPd: true })).status).toBe(200);
  });
});

describe('имя в лигах недели — только с согласия и с 16 лет', () => {
  const thisYear = new Date().getUTCFullYear();
  it('по умолчанию выключено; включил — имя видят другие, но не сам; выключил — пропало', async () => {
    const a = await acc({ action: 'register', consentPage: true, consentPd: true, login: uniq('league'), password: 'secret1', name: 'Лигина', birthYear: 1995 });
    const b = await acc({ action: 'register', consentPage: true, consentPd: true, login: uniq('viewer'), password: 'secret1', name: 'Зритель', birthYear: 1995 });
    expect(a.data.profile.leaguePublic).toBe(false);
    expect((await acc({ action: 'league-names', token: b.data.token })).data.names).not.toContain('Лигина');
    const on = await acc({ action: 'update', token: a.data.token, leaguePublic: true });
    expect(on.status).toBe(200); expect(on.data.profile.leaguePublic).toBe(true);
    expect((await acc({ action: 'league-names', token: b.data.token })).data.names).toContain('Лигина');
    expect((await acc({ action: 'league-names', token: a.data.token })).data.names).not.toContain('Лигина');
    // новое имя — новое и в лигах
    await acc({ action: 'update', token: a.data.token, name: 'Лигина Н.' });
    expect((await acc({ action: 'league-names', token: b.data.token })).data.names).toContain('Лигина Н.');
    await acc({ action: 'update', token: a.data.token, leaguePublic: false });
    const names = (await acc({ action: 'league-names', token: b.data.token })).data.names;
    expect(names).not.toContain('Лигина'); expect(names).not.toContain('Лигина Н.');
  });
  it('до 16 лет включить нельзя', async () => {
    const kid = await acc({ action: 'register', consentPage: true, consentPd: true, login: uniq('kidleague'), password: 'secret1', birthYear: thisYear - 14, parentConsent: true, parentName: 'Ольга Петрова' });
    expect((await acc({ action: 'update', token: kid.data.token, leaguePublic: true })).status).toBe(403);
  });
});
