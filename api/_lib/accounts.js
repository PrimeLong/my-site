/* Профили: хэш пароля, проверка сессии и статистика сетевой игры. Общий код для
   api/account.js (регистрация, вход, профиль) и api/room.js (место в комнате
   закрепляется за профилем, выходы и сыгранные кварталы копятся в статистике). */
import { kidsModeOf } from '../../src/lib/age.js';
import { isRude } from '../../src/lib/moderation.js';
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
/* НИК. Менять — не чаще раза в NAME_EVERY_DAYS дней (user.nameAt — когда меняли). Грубый ник
   (фильтр src/lib/moderation.js) или ник, который владелец потребовал сменить (user.renameFor — тот
   самый ник), получает срок user.renameBy: RENAME_DAYS дней на смену, ученик видит уведомление.
   Срок вышел — аккаунт заблокирован: можно только сменить ник, выйти, скачать или удалить данные.
   Сменить запрещённый ник можно сразу, без месячного ограничения. Другим ученикам грубый ник
   не показываем никогда: вместо него — логин (или «Ученик», если и логин грубый). */
export const DAY_MS = 24 * 60 * 60 * 1000;
export const NAME_EVERY_DAYS = 30;
export const RENAME_DAYS = 7;
export const nameBanned = (u) => !!u && (isRude(u.name) || (!!u.renameFor && u.renameFor === u.name));
export const isBlocked = (u, now = Date.now()) => nameBanned(u) && !!u.renameBy && u.renameBy <= now;
// с какого момента можно снова сменить ник (0 — уже можно)
export const nameNextAt = (u, now = Date.now()) => (!u || !u.nameAt || nameBanned(u) || u.nameAt + NAME_EVERY_DAYS * DAY_MS <= now ? 0 : u.nameAt + NAME_EVERY_DAYS * DAY_MS);
export const nameForOthers = (name, login) => (name && !isRude(name) ? name : login && !isRude(login) ? login : 'Ученик');
// запрещённый ник получает срок на смену, сменённый — снимает его; возвращает актуального ученика
export async function checkName(user, now = Date.now()) {
  if (!user) return user;
  const banned = nameBanned(user);
  if (banned === !!user.renameBy) return user;
  let next;
  if (banned) next = { ...user, renameBy: now + RENAME_DAYS * DAY_MS };
  else { next = { ...user }; delete next.renameBy; delete next.renameFor; }
  await setUser(user.login, next);
  return next;
}

export function publicProfile(user, now = Date.now()) {
  if (!user) return null;
  // год рождения видит только сам владелец профиля (publicProfile уходит только ему); kidsMode —
  // детский режим «Мира» (src/lib/age.js)
  const banned = nameBanned(user);
  return { login: user.login, name: user.name, emblem: user.emblem || 'star', playerId: user.playerId,
    createdAt: user.createdAt, stats: { ...emptyStats(), ...user.stats }, hasRecovery: !!user.recHash,
    birthYear: user.birthYear || null, kidsMode: kidsModeOf(user), leaguePublic: user.leaguePublic === true,
    nameNextAt: nameNextAt(user, now), renameBy: banned && user.renameBy ? user.renameBy : null, blocked: isBlocked(user, now) };
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
