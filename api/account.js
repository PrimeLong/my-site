/* Регистрация, вход и профиль игрока. До этого «аккаунтом» был случайный playerId
   устройства, а имя в сетевой партии вводилось заново в каждой комнате — поэтому
   из комнаты можно было выйти и тут же зайти другим «игроком». Теперь у игрока
   есть профиль: логин и пароль, имя, значок и статистика; сетевые места
   закрепляются за профилем (см. api/room.js), а сохранения и достижения идут за
   профилем на любое устройство — playerId профиля становится playerId устройства. */
import { getUser, setUser, setSession, delSession, hasKv } from './_lib/store.js';
import {
  LOGIN_RE, cleanLogin, hashPassword, checkPassword, newToken, emptyStats, publicProfile, userBySession,
} from './_lib/accounts.js';
import { randomUUID } from 'node:crypto';

const EMBLEMS = new Set(['star', 'crown', 'landmark', 'coins', 'shield', 'anchor', 'factory', 'wheat']);
const MAX_FAILS = 8;
const LOCK_MS = 5 * 60 * 1000;
const cleanName = (v) => {
  if (typeof v !== 'string') return null;
  const t = Array.from(v).filter((ch) => ch.charCodeAt(0) >= 32).join('').replace(/\s+/g, ' ').trim().slice(0, 24);
  return t.length >= 2 ? t : null;
};
const validPlayerId = (id) => typeof id === 'string' && id.length > 0 && id.length <= 64;

async function handleRequest(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' });
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  catch { return res.status(400).json({ error: 'Некорректный JSON' }); }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Некорректное тело запроса' });
  const { action } = body;

  if (action === 'register') {
    const login = cleanLogin(body.login);
    if (!LOGIN_RE.test(login)) return res.status(400).json({ error: 'Логин: от 3 до 20 латинских букв, цифр или «_»' });
    if (typeof body.password !== 'string' || body.password.length < 6 || body.password.length > 100) {
      return res.status(400).json({ error: 'Пароль — не короче 6 символов' });
    }
    const name = cleanName(body.name) || login;
    if (await getUser(login)) return res.status(409).json({ error: 'Такой логин уже занят' });
    const { salt, hash } = hashPassword(body.password);
    // профиль забирает сохранения и прогресс устройства, на котором его завели
    const playerId = validPlayerId(body.playerId) ? body.playerId : randomUUID();
    const user = { login, name, emblem: 'star', salt, hash, playerId, createdAt: Date.now(), stats: emptyStats(), fails: 0, lockUntil: 0 };
    await setUser(login, user);
    const token = newToken();
    await setSession(token, login);
    return res.status(200).json({ token, profile: publicProfile(user), storage: hasKv() ? 'kv' : 'memory' });
  }

  if (action === 'login') {
    const login = cleanLogin(body.login);
    const user = LOGIN_RE.test(login) ? await getUser(login) : null;
    // несуществующий логин проверяем так же долго, как настоящий: по времени ответа
    // нельзя понять, какие логины заняты
    if (!user) { hashPassword(String(body.password || '')); return res.status(401).json({ error: 'Неверный логин или пароль' }); }
    if (user.lockUntil && user.lockUntil > Date.now()) {
      return res.status(429).json({ error: `Слишком много попыток — подождите ${Math.ceil((user.lockUntil - Date.now()) / 60000)} мин.` });
    }
    if (!checkPassword(body.password, user)) {
      const fails = (user.fails || 0) + 1;
      await setUser(login, { ...user, fails: fails >= MAX_FAILS ? 0 : fails, lockUntil: fails >= MAX_FAILS ? Date.now() + LOCK_MS : 0 });
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }
    if (user.fails) await setUser(login, { ...user, fails: 0, lockUntil: 0 });
    const token = newToken();
    await setSession(token, login);
    return res.status(200).json({ token, profile: publicProfile(user) });
  }

  // дальше — только со своей сессией
  const user = await userBySession(body.token);
  if (!user) return res.status(401).json({ error: 'Войдите в профиль заново' });

  if (action === 'me') return res.status(200).json({ profile: publicProfile(user) });
  if (action === 'update') {
    const next = { ...user };
    if (body.name !== undefined) { const n = cleanName(body.name); if (!n) return res.status(400).json({ error: 'Имя — от 2 до 24 символов' }); next.name = n; }
    if (body.emblem !== undefined) { if (!EMBLEMS.has(body.emblem)) return res.status(400).json({ error: 'Нет такого значка' }); next.emblem = body.emblem; }
    await setUser(user.login, next);
    return res.status(200).json({ profile: publicProfile(next) });
  }
  if (action === 'password') {
    if (!checkPassword(body.oldPassword, user)) return res.status(403).json({ error: 'Старый пароль не подходит' });
    if (typeof body.newPassword !== 'string' || body.newPassword.length < 6) return res.status(400).json({ error: 'Новый пароль — не короче 6 символов' });
    const { salt, hash } = hashPassword(body.newPassword);
    await setUser(user.login, { ...user, salt, hash });
    return res.status(200).json({ ok: true });
  }
  if (action === 'logout') {
    await delSession(body.token);
    return res.status(200).json({ ok: true });
  }
  return res.status(400).json({ error: 'Неизвестное действие' });
}

export default async function handler(req, res) {
  try {
    return await handleRequest(req, res);
  } catch (err) {
    console.error('account handler error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
