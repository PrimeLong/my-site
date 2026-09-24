/* Профили: хэш пароля, проверка сессии и статистика сетевой игры. Общий код для
   api/account.js (регистрация, вход, профиль) и api/room.js (место в комнате
   закрепляется за профилем, выходы и сыгранные кварталы копятся в статистике). */
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { getUser, setUser, getSession } from './store.js';

export const LOGIN_RE = /^[a-z0-9_]{3,20}$/;
export const cleanLogin = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(String(password), salt, 64).toString('hex') };
}
export function checkPassword(password, user) {
  if (!user || !user.salt || !user.hash) return false;
  const a = Buffer.from(scryptSync(String(password), user.salt, 64).toString('hex'), 'hex');
  const b = Buffer.from(user.hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
export const newToken = () => randomBytes(24).toString('hex');
// код восстановления: 12 знаков без похожих друг на друга (0/O, 1/I/L), по четыре
const REC_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newRecoveryCode() {
  const bytes = randomBytes(12);
  const raw = Array.from(bytes, (b) => REC_ALPHABET[b % REC_ALPHABET.length]).join('');
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}
export const normRecoveryCode = (v) => (typeof v === 'string' ? v.toUpperCase().replace(/[^A-Z0-9]/g, '') : '');
export function hashRecovery(code) {
  const { salt, hash } = hashPassword(normRecoveryCode(code));
  return { recSalt: salt, recHash: hash };
}
export function checkRecovery(code, user) {
  if (!user || !user.recSalt || !user.recHash) return false;
  return checkPassword(normRecoveryCode(code), { salt: user.recSalt, hash: user.recHash });
}
// сессия хранит эпоху пароля: смена пароля или восстановление её сдвигает, и
// все прежние сессии (в том числе чужие, если пароль утёк) перестают работать
export const sessionValue = (user) => `${user.login}:${user.epoch || 0}`;
export const emptyStats = () => ({ rooms: 0, quarters: 0, leaves: 0, lastRoom: null });

// то, что можно показать о профиле: без хэша, соли и счётчика неудачных входов
export function publicProfile(user) {
  if (!user) return null;
  return { login: user.login, name: user.name, emblem: user.emblem || 'star', playerId: user.playerId,
    createdAt: user.createdAt, stats: { ...emptyStats(), ...user.stats }, hasRecovery: !!user.recHash };
}

export async function userBySession(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  const value = await getSession(token);
  if (!value) return null;
  const [login, epoch = '0'] = String(value).split(':');
  const user = await getUser(login);
  return user && String(user.epoch || 0) === epoch ? user : null;
}

// статистика меняется только на сервере — клиент не может её себе нарисовать
export async function bumpStats(login, patch) {
  if (!login) return;
  const u = await getUser(login);
  if (!u) return;
  const s = { ...emptyStats(), ...u.stats };
  Object.entries(patch).forEach(([k, v]) => { s[k] = typeof v === 'number' && k !== 'lastRoom' ? (s[k] || 0) + v : v; });
  await setUser(login, { ...u, stats: s });
}
