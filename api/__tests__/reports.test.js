/* «Сообщить об ошибке»: только из профиля, лимит в час, список и разбор — только владельцам
   (OWNER_LOGINS), контекст чистится. */
import { describe, it, expect, beforeAll } from 'vitest';
import accountHandler from '../account.js';
import reportsHandler, { REPORTS_PER_HOUR, sanitizeReport } from '../reports.js';

let ipN = 0;
const call = (handler, body, ip = `10.9.0.${ipN++}`) => new Promise((resolve) => {
  const res = { code: 200, status(c) { this.code = c; return this; }, json(d) { resolve({ status: this.code, data: d }); return this; } };
  handler({ method: 'POST', query: {}, headers: { 'x-forwarded-for': ip }, body }, res);
});
let n = 0;
// логины без времени и случайностей: одинаковые при каждом запуске
const uniq = (p) => `${p}rep${n++}`;
const register = async (login) => (await call(accountHandler, { action: 'register', consent: true, login, password: 'secret1', name: 'Анна', playerId: `dev-${login}` })).data.token;
const send = (session, extra = {}, ip) => call(reportsHandler, { action: 'send', session, reason: 'answer', comment: 'в ответе 25, а должно быть 20',
  context: { screen: 'exercise', exercise: 'sd-l1:x', lesson: 'sd-l1', answer: '25', correct: '20', build: 'abc1234', device: 'test' }, ...extra }, ip);

describe('сообщения об ошибках', () => {
  const owner = uniq('boss');
  let ownerToken; let userToken;
  beforeAll(async () => {
    process.env.OWNER_LOGINS = `someone, ${owner.toUpperCase()}`;
    ownerToken = await register(owner);
    userToken = await register(uniq('kate'));
  });

  it('без входа отправить нельзя; без причины — нельзя', async () => {
    expect((await send('nope-token-that-is-long-enough-000')).status).toBe(401);
    expect((await send(userToken, { reason: 'nonsense' })).status).toBe(400);
  });

  it('отправка из профиля: сохраняется с контекстом, ученик — не владелец', async () => {
    const r = await send(userToken);
    expect(r.status).toBe(200);
    expect(r.data.id).toBeTruthy();
    expect((await call(reportsHandler, { action: 'me', session: userToken })).data.owner).toBe(false);
    expect((await call(reportsHandler, { action: 'list', session: userToken })).status).toBe(403);
    expect((await call(reportsHandler, { action: 'status', session: userToken, id: r.data.id, status: 'done' })).status).toBe(403);
  });

  it('владелец видит новые, отмечает разобранным — сообщение переходит в «разобранные»', async () => {
    expect((await call(reportsHandler, { action: 'me', session: ownerToken })).data.owner).toBe(true);
    const { data: sent } = await send(userToken, { reason: 'typo', comment: 'опечатка' });
    const list = await call(reportsHandler, { action: 'list', session: ownerToken, status: 'new' });
    const mine = list.data.reports.find((x) => x.id === sent.id);
    expect(mine).toMatchObject({ reason: 'typo', comment: 'опечатка', status: 'new', context: { exercise: 'sd-l1:x', answer: '25', correct: '20', build: 'abc1234' } });
    expect(mine.login).toBeTruthy();
    await call(reportsHandler, { action: 'status', session: ownerToken, id: sent.id, status: 'done' });
    const done = await call(reportsHandler, { action: 'list', session: ownerToken, status: 'done' });
    expect(done.data.reports.map((x) => x.id)).toContain(sent.id);
    const fresh = await call(reportsHandler, { action: 'list', session: ownerToken, status: 'new' });
    expect(fresh.data.reports.map((x) => x.id)).not.toContain(sent.id);
    expect(done.data.counts.done).toBeGreaterThanOrEqual(1);
  });

  it('грубое сообщение не принимается; старые грубые помечены, владелец может удалить', async () => {
    const rude = await send(userToken, { comment: 'Это пиздец блять какая МАША' });
    expect(rude.status).toBe(400);
    expect(rude.data.error).toContain('грубых слов');
    const { data: sent } = await send(userToken, { comment: 'Тут нужен калькулятор' });
    const list = await call(reportsHandler, { action: 'list', session: ownerToken, status: 'new' });
    expect(list.data.reports.find((x) => x.id === sent.id).rude).toBe(false);
    expect((await call(reportsHandler, { action: 'delete', session: userToken, id: sent.id })).status).toBe(403);
    expect((await call(reportsHandler, { action: 'delete', session: ownerToken, id: sent.id })).status).toBe(200);
    const after = await call(reportsHandler, { action: 'list', session: ownerToken, status: 'all' });
    expect(after.data.reports.map((x) => x.id)).not.toContain(sent.id);
  });

  it('логин и имя с грубыми словами не регистрируются', async () => {
    expect((await call(accountHandler, { action: 'register', consent: true, login: uniq('ok'), password: 'secret1', name: 'Pidoras' })).status).toBe(400);
    expect((await call(accountHandler, { action: 'register', consent: true, login: `fuck${n++}`, password: 'secret1', name: 'Анна' })).status).toBe(400);
  });

  it('«Это ошибка фильтра»: без аккаунта, с логином и именем, владелец видит его в списке', async () => {
    const r = await call(reportsHandler, { action: 'filter', login: 'glebakov', name: 'Глеб', screen: 'register' });
    expect(r.status).toBe(200);
    const list = await call(reportsHandler, { action: 'list', session: ownerToken, status: 'new' });
    const got = list.data.reports.find((x) => x.reason === 'filter' && x.login === 'glebakov');
    expect(got && got.name).toBe('Глеб');
    expect((await call(reportsHandler, { action: 'filter' })).status).toBe(400);
    // хорошие имена фильтр больше не трогает
    expect((await call(accountHandler, { action: 'register', consent: true, login: uniq('glebakov'), password: 'secret1', name: 'Глеб' })).status).toBe(200);
  });

  it(`не больше ${REPORTS_PER_HOUR} сообщений в час с профиля`, async () => {
    const t = await register(uniq('spam'));
    const codes = [];
    for (let k = 0; k < REPORTS_PER_HOUR + 1; k += 1) codes.push((await send(t, {}, `10.8.${k}.1`)).status);
    expect(codes.slice(0, REPORTS_PER_HOUR).every((c) => c === 200)).toBe(true);
    expect(codes[REPORTS_PER_HOUR]).toBe(429);
  });

  it('контекст чистится: только известные поля, короткие строки, без управляющих символов', () => {
    const r = sanitizeReport({ reason: 'broken', comment: 'x'.repeat(5000), context: { exercise: 'a\u0000b', evil: 'drop me', prompt: 'p'.repeat(5000), answer: { a: 1 } } });
    expect(r.comment).toHaveLength(1000);
    expect(r.context.exercise).toBe('ab');
    expect(r.context.evil).toBeUndefined();
    expect(r.context.prompt).toHaveLength(1500);
    expect(r.context.answer).toBeUndefined();
    expect(sanitizeReport({ reason: 'x' })).toBe(null);
  });
});
