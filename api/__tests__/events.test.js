/* Аналитика без персональных данных: только счётчики, без логина и адреса; отчёт — владельцам. */
import { describe, it, expect } from 'vitest';
import eventsHandler, { sanitizeEvent, counterKeys, FUNNEL, EVENTS } from '../events.js';
import accountHandler from '../account.js';
import { readCounters } from '../_lib/store.js';

let ipN = 0;
const call = (handler, body, headers = {}) => new Promise((resolve) => {
  const res = { code: 200, status(c) { this.code = c; return this; }, json(d) { resolve({ status: this.code, data: d }); return this; } };
  handler({ method: 'POST', query: {}, headers: { 'x-forwarded-for': `10.9.0.${ipN++}`, ...headers }, body }, res);
});
const ev = (body) => call(eventsHandler, body);

describe('события', () => {
  it('принимает только известные события и только короткие id; лишние поля отбрасывает', () => {
    expect(EVENTS).toEqual(expect.arrayContaining(['welcome_start', 'goal_done', 'lesson_start', 'lesson_done', 'register_done', 'return_d1', 'return_d7', 'ex_first_try_ok', 'ex_first_try_fail']));
    expect(sanitizeEvent({ event: 'hack' })).toBeNull();
    expect(sanitizeEvent({ event: 'lesson_done', lesson: 'sd-i1', login: 'anna', ip: '1.2.3.4', ms: 5000 })).toEqual({ event: 'lesson_done', lesson: 'sd-i1', ms: 5000 });
    expect(sanitizeEvent({ event: 'lesson_done', lesson: 'x'.repeat(200) })).toEqual({ event: 'lesson_done' });
  });
  it('счётчики: событие за день и «верно/всего» по упражнению; в ключах нет ни логина, ни адреса', () => {
    const now = Date.UTC(2026, 9, 5, 12);
    expect(counterKeys({ event: 'lesson_start' }, now)).toEqual(['day:2026-10-05:lesson_start']);
    expect(counterKeys({ event: 'ex_first_try_ok', exercise: 'sd-q1' }, now)).toEqual(['day:2026-10-05:ex_first_try_ok', 'exercise:sd-q1:total', 'exercise:sd-q1:correct']);
    expect(counterKeys({ event: 'ex_first_try_fail', exercise: 'sd-q1' }, now)).toEqual(['day:2026-10-05:ex_first_try_fail', 'exercise:sd-q1:total']);
  });
  it('POST увеличивает счётчики; заголовки с адресом и сессия не нужны и не сохраняются', async () => {
    const day = new Date().toISOString().slice(0, 10);
    const before = (await readCounters([`day:${day}:welcome_start`]))[`day:${day}:welcome_start`];
    expect((await ev({ event: 'welcome_start', session: 'whatever' })).status).toBe(200);
    expect((await readCounters([`day:${day}:welcome_start`]))[`day:${day}:welcome_start`]).toBe(before + 1);
    expect((await ev({ event: 'nope' })).status).toBe(400);
  });
});

describe('отчёт для владельцев', () => {
  it('воронка за 30 дней по шагам и 20 самых трудных упражнений; не владельцу — 403', async () => {
    const owner = `evowner${Date.now() % 100000}`;
    const reg = await call(accountHandler, { action: 'register', consentPage: true, consentPd: true, birthYear: 1990, login: owner, password: 'secret1' });
    expect((await ev({ action: 'report', session: reg.data.token })).status).toBe(403);
    process.env.OWNER_LOGINS = owner;
    for (let i = 0; i < 6; i += 1) await ev({ event: i < 5 ? 'ex_first_try_fail' : 'ex_first_try_ok', exercise: 'hard-one' });
    for (let i = 0; i < 6; i += 1) await ev({ event: 'ex_first_try_ok', exercise: 'easy-one' });
    await ev({ event: 'ex_first_try_fail', exercise: 'rare-one' });
    const r = await ev({ action: 'report', session: reg.data.token });
    expect(r.status).toBe(200);
    expect(r.data.funnel.map((f) => f.event)).toEqual(FUNNEL);
    expect(r.data.hardest[0]).toMatchObject({ id: 'hard-one', total: 6, correct: 1 });
    expect(r.data.hardest.map((x) => x.id)).not.toContain('rare-one'); // меньше 5 ответов — не в списке
    expect(r.data.hardest.length).toBeLessThanOrEqual(20);
    delete process.env.OWNER_LOGINS;
  });
});
