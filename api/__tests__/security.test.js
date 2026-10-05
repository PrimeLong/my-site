/* Безопасность: лимит попыток входа с адреса, нарастающая блокировка логина, заголовки сайта. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import accountHandler, { LOGIN_PER_HOUR, LOCK_STEPS, lockFor } from '../account.js';
import { getUser, setUser } from '../_lib/store.js';

let ipN = 0;
const call = (body, ip = `10.7.0.${ipN++}`) => new Promise((resolve) => {
  const res = { code: 200, status(c) { this.code = c; return this; }, json(d) { resolve({ status: this.code, data: d }); return this; } };
  accountHandler({ method: 'POST', query: {}, headers: { 'x-forwarded-for': ip }, body }, res);
});
let n = 0;
const uniq = (p) => `${p}sec${n++}`;
const register = (login) => call({ action: 'register', consentPage: true, consentPd: true, birthYear: 1990, login, password: 'secret1' });

describe('вход: лимит с одного адреса', () => {
  it(`не больше ${LOGIN_PER_HOUR} попыток входа в час с адреса — по любым логинам, даже верным`, async () => {
    const login = uniq('ipl'); await register(login);
    const ip = '10.77.0.1';
    expect(LOGIN_PER_HOUR).toBe(30);
    for (let i = 0; i < LOGIN_PER_HOUR; i += 1) expect((await call({ action: 'login', login: uniq('ghost'), password: 'whatever' }, ip)).status).toBe(401);
    const blocked = await call({ action: 'login', login, password: 'secret1' }, ip);
    expect(blocked.status).toBe(429);
    expect(blocked.data.error).toMatch(/адреса/);
    // с другого адреса тот же логин входит
    expect((await call({ action: 'login', login, password: 'secret1' }, '10.77.0.2')).status).toBe(200);
  });
});

describe('вход: нарастающая блокировка логина', () => {
  it('ступени растут: 1 мин, 5 мин, 15 мин, час, 6 часов — дальше не растёт', () => {
    expect(LOCK_STEPS.map((ms) => ms / 60000)).toEqual([1, 5, 15, 60, 360]);
    expect(lockFor(1)).toBe(60000); expect(lockFor(3)).toBe(15 * 60000); expect(lockFor(99)).toBe(6 * 3600000);
  });
  it('пять неверных паролей подряд — блокировка; следующая серия — дольше; верный пароль сбрасывает счёт', async () => {
    const login = uniq('lock'); await register(login);
    for (let i = 0; i < 5; i += 1) await call({ action: 'login', login, password: 'nope123' });
    let u = await getUser(login);
    expect(u.lockLevel).toBe(1);
    expect(u.lockUntil - Date.now()).toBeGreaterThan(50 * 1000);
    expect(u.lockUntil - Date.now()).toBeLessThanOrEqual(60 * 1000);
    expect((await call({ action: 'login', login, password: 'secret1' })).status).toBe(429);
    // блокировка прошла — ещё пять промахов закрывают вход уже на 5 минут
    await setUser(login, { ...u, lockUntil: Date.now() - 1 });
    for (let i = 0; i < 5; i += 1) await call({ action: 'login', login, password: 'nope123' });
    u = await getUser(login);
    expect(u.lockLevel).toBe(2);
    expect(u.lockUntil - Date.now()).toBeGreaterThan(4 * 60 * 1000);
    // верный пароль после блокировки — счёт с нуля
    await setUser(login, { ...u, lockUntil: Date.now() - 1 });
    expect((await call({ action: 'login', login, password: 'secret1' })).status).toBe(200);
    u = await getUser(login);
    expect(u).toMatchObject({ fails: 0, lockLevel: 0, lockUntil: 0 });
  });
});

describe('заголовки сайта (vercel.json)', () => {
  const cfg = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
  const all = cfg.headers.find((h) => h.source === '/(.*)');
  const get = (k) => (all.headers.find((h) => h.key.toLowerCase() === k.toLowerCase()) || {}).value;
  it('на всех страницах: CSP, nosniff, Referrer-Policy, Permissions-Policy', () => {
    expect(all).toBeTruthy();
    expect(get('X-Content-Type-Options')).toBe('nosniff');
    expect(get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(get('Permissions-Policy')).toMatch(/camera=\(\)/);
    expect(get('Permissions-Policy')).toMatch(/geolocation=\(\)/);
  });
  it('CSP: только свой сайт, data: — для шрифтов и картинок, без чужих скриптов и без встраивания в чужие страницы', () => {
    const csp = Object.fromEntries(get('Content-Security-Policy').split(';').map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
    expect(csp['default-src']).toEqual(["'self'"]);
    expect(csp['script-src']).toEqual(["'self'"]);
    expect(csp['connect-src']).toEqual(["'self'"]);
    expect(csp['font-src']).toEqual(["'self'", 'data:']);
    expect(csp['img-src']).toEqual(expect.arrayContaining(["'self'", 'data:']));
    expect(csp['frame-ancestors']).toEqual(["'none'"]);
    expect(csp['object-src']).toEqual(["'none'"]);
    // ни одного внешнего адреса и ни одного unsafe-eval
    expect(get('Content-Security-Policy')).not.toMatch(/https?:|unsafe-eval|\*/);
  });
});
