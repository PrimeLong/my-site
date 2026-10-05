/* Регистрация, вход и профиль игрока. До этого «аккаунтом» был случайный playerId
   устройства, а имя в сетевой партии вводилось заново в каждой комнате — поэтому
   из комнаты можно было выйти и тут же зайти другим «игроком». Теперь у игрока
   есть профиль: логин и пароль, имя, значок и статистика; сетевые места
   закрепляются за профилем (см. api/room.js), а сохранения и достижения идут за
   профилем на любое устройство — playerId профиля становится playerId устройства.
   Почты нет, поэтому забытый пароль восстанавливается кодом, который показывается
   при регистрации один раз (и выдаётся заново в профиле по паролю). */
import { getUser, setUser, setSession, delSession, hasKv, hit, getProfile, getSoloSlots, getTycoonSlots, getRecords, getReports, deleteUserData } from './_lib/store.js';
import { isRude, RUDE_NAME } from '../src/lib/moderation.js';
import { validBirthYear, isKid, needsParent } from '../src/lib/age.js';
import {
  LOGIN_RE, cleanLogin, hashPassword, checkPassword, newToken, emptyStats, publicProfile, userBySession,
  newRecoveryCode, hashRecovery, checkRecovery, sessionValue,
} from './_lib/accounts.js';
import { randomUUID } from 'node:crypto';

const EMBLEMS = new Set(['star', 'crown', 'landmark', 'coins', 'shield', 'anchor', 'factory', 'wheat']);
/* Перебор пароля. Две защиты:
   • с одного адреса — не больше LOGIN_PER_HOUR попыток входа в час, по любым логинам;
   • у логина — нарастающая блокировка: каждые MAX_FAILS неверных паролей подряд закрывают
     вход на всё больший срок (LOCK_STEPS), успешный вход сбрасывает счёт. */
const MAX_FAILS = 5;
export const LOGIN_PER_HOUR = 30;
export const LOCK_STEPS = [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000, 6 * 60 * 60 * 1000];
export const lockFor = (level) => LOCK_STEPS[Math.min(Math.max(level, 1), LOCK_STEPS.length) - 1];
const cleanName = (v) => {
  if (typeof v !== 'string') return null;
  const t = Array.from(v).filter((ch) => ch.charCodeAt(0) >= 32).join('').replace(/\s+/g, ' ').trim().slice(0, 24);
  return t.length >= 2 ? t : null;
};
// имя родителя — как его ввели: от 2 до 60 символов, без управляющих
const cleanParentName = (v) => {
  if (typeof v !== 'string') return null;
  const t = Array.from(v).filter((ch) => ch.charCodeAt(0) >= 32).join('').replace(/\s+/g, ' ').trim().slice(0, 60);
  return t.length >= 2 ? t : null;
};
const validPlayerId = (id) => typeof id === 'string' && id.length > 0 && id.length <= 64;
// регистраций и попыток восстановления с одного адреса за час — против штамповки
// аккаунтов ботом и перебора кодов восстановления
const REG_PER_HOUR = 5;
const RECOVER_PER_HOUR = 10;
const clientIp = (req) => String((req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || 'local')
  .split(',')[0].trim().slice(0, 64);
const storage = () => (hasKv() ? 'kv' : 'memory');
// новая сессия устройства — привязана к текущей эпохе пароля
async function openSession(user) {
  const token = newToken();
  await setSession(token, sessionValue(user));
  return token;
}

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
    /* Две отдельные отметки: «ознакомлен со страницей» (данные и соглашение) и «согласие на обработку
       персональных данных». До 14 лет — ещё подтверждение родителя: отметка и его имя. Достаточно ли
       этого юридически — вопрос в docs/legal-todo.md. */
    if (body.consentPage !== true) return res.status(400).json({ error: 'Отметьте, что ознакомились со страницей «Данные и конфиденциальность»' });
    if (body.consentPd !== true) return res.status(400).json({ error: 'Нужно согласие на обработку персональных данных' });
    // год рождения — для детского режима «Мира» (до 16 лет) и согласия родителя (до 14)
    if (!validBirthYear(body.birthYear)) return res.status(400).json({ error: 'Укажите год рождения' });
    const child = needsParent(body.birthYear);
    const parentName = child ? cleanParentName(body.parentName) : null;
    if (child && (body.parentConsent !== true || !parentName)) return res.status(400).json({ error: 'До 14 лет нужно подтверждение родителя: отметка и его имя' });
    if (parentName && isRude(parentName)) return res.status(400).json({ error: RUDE_NAME });
    const name = cleanName(body.name) || login;
    // ни логин, ни имя — без грубых слов (их видят в сетевых партиях и в сообщениях об ошибках)
    if (isRude(login) || isRude(name)) return res.status(400).json({ error: RUDE_NAME });
    if (await hit(`reg:${clientIp(req)}`, 3600) > REG_PER_HOUR) {
      return res.status(429).json({ error: 'Слишком много регистраций с этого адреса — попробуйте через час' });
    }
    if (await getUser(login)) return res.status(409).json({ error: 'Такой логин уже занят' });
    const { salt, hash } = hashPassword(body.password);
    // профиль забирает сохранения и прогресс устройства, на котором его завели
    const playerId = validPlayerId(body.playerId) ? body.playerId : randomUUID();
    // почты у игры нет, поэтому доступ восстанавливается кодом, который показываем один раз
    const recoveryCode = newRecoveryCode();
    const user = { login, name, emblem: 'star', salt, hash, ...hashRecovery(recoveryCode), epoch: 0, playerId,
      birthYear: body.birthYear, createdAt: Date.now(), consentAt: Date.now(), pdConsentAt: Date.now(),
      ...(child ? { parentConsentAt: Date.now(), parentName } : {}), stats: emptyStats(), fails: 0, lockUntil: 0 };
    await setUser(login, user);
    const token = await openSession(user);
    return res.status(200).json({ token, profile: publicProfile(user), recoveryCode, storage: storage() });
  }

  if (action === 'login') {
    if (await hit(`login:${clientIp(req)}`, 3600) > LOGIN_PER_HOUR) {
      return res.status(429).json({ error: 'Слишком много попыток входа с этого адреса — попробуйте через час' });
    }
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
      const level = fails >= MAX_FAILS ? (user.lockLevel || 0) + 1 : (user.lockLevel || 0);
      await setUser(login, { ...user, fails: fails >= MAX_FAILS ? 0 : fails, lockLevel: level, lockUntil: fails >= MAX_FAILS ? Date.now() + lockFor(level) : 0 });
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }
    if (user.fails || user.lockLevel) await setUser(login, { ...user, fails: 0, lockLevel: 0, lockUntil: 0 });
    const token = await openSession(user);
    return res.status(200).json({ token, profile: publicProfile(user), storage: storage() });
  }

  // забыл пароль: логин + код восстановления → новый пароль и новый код; все
  // прежние сессии профиля перестают работать
  if (action === 'recover') {
    if (await hit(`rec:${clientIp(req)}`, 3600) > RECOVER_PER_HOUR) {
      return res.status(429).json({ error: 'Слишком много попыток — попробуйте через час' });
    }
    const login = cleanLogin(body.login);
    const user = LOGIN_RE.test(login) ? await getUser(login) : null;
    if (typeof body.newPassword !== 'string' || body.newPassword.length < 6 || body.newPassword.length > 100) {
      return res.status(400).json({ error: 'Новый пароль — не короче 6 символов' });
    }
    if (!user || !checkRecovery(body.code, user)) {
      if (!user) hashPassword('x');
      return res.status(401).json({ error: 'Логин или код восстановления не подходят' });
    }
    const recoveryCode = newRecoveryCode();
    const next = { ...user, ...hashPassword(body.newPassword), ...hashRecovery(recoveryCode),
      epoch: (user.epoch || 0) + 1, fails: 0, lockUntil: 0 };
    await setUser(login, next);
    const token = await openSession(next);
    return res.status(200).json({ token, profile: publicProfile(next), recoveryCode, storage: storage() });
  }

  // дальше — только со своей сессией
  const user = await userBySession(body.token);
  if (!user) return res.status(401).json({ error: 'Войдите в профиль заново' });

  if (action === 'me') return res.status(200).json({ profile: publicProfile(user), storage: storage() });
  if (action === 'update') {
    const next = { ...user };
    if (body.name !== undefined) {
      const n = cleanName(body.name);
      if (!n) return res.status(400).json({ error: 'Имя — от 2 до 24 символов' });
      if (isRude(n)) return res.status(400).json({ error: RUDE_NAME });
      next.name = n;
    }
    if (body.emblem !== undefined) { if (!EMBLEMS.has(body.emblem)) return res.status(400).json({ error: 'Нет такого значка' }); next.emblem = body.emblem; }
    /* Год рождения задаётся один раз — профилям, заведённым до этого правила. Поменять его потом
       нельзя: иначе детский режим снимался бы одной правкой. */
    if (body.birthYear !== undefined) {
      if (user.birthYear) return res.status(400).json({ error: 'Год рождения уже указан' });
      if (!validBirthYear(body.birthYear)) return res.status(400).json({ error: 'Укажите год рождения' });
      next.birthYear = body.birthYear;
    }
    // детский режим старше 16 — по выбору; до 16 он включён всегда
    if (body.kidsMode !== undefined) {
      if (typeof body.kidsMode !== 'boolean') return res.status(400).json({ error: 'Некорректный режим' });
      const year = next.birthYear;
      if (!body.kidsMode && (!year || isKid(year))) return res.status(403).json({ error: 'До 16 лет «Мир» — в детском режиме' });
      next.kidsMode = body.kidsMode;
    }
    await setUser(user.login, next);
    return res.status(200).json({ profile: publicProfile(next) });
  }
  if (action === 'password') {
    if (!checkPassword(body.oldPassword, user)) return res.status(403).json({ error: 'Старый пароль не подходит' });
    if (typeof body.newPassword !== 'string' || body.newPassword.length < 6) return res.status(400).json({ error: 'Новый пароль — не короче 6 символов' });
    // смена пароля закрывает все остальные сессии; этому устройству — новая
    const next = { ...user, ...hashPassword(body.newPassword), epoch: (user.epoch || 0) + 1 };
    await setUser(user.login, next);
    const token = await openSession(next);
    return res.status(200).json({ ok: true, token });
  }
  // новый код восстановления — только с паролем: код равносилен паролю
  if (action === 'recovery_new') {
    if (!checkPassword(body.password, user)) return res.status(403).json({ error: 'Пароль не подходит' });
    const recoveryCode = newRecoveryCode();
    const next = { ...user, ...hashRecovery(recoveryCode) };
    await setUser(user.login, next);
    return res.status(200).json({ recoveryCode, profile: publicProfile(next) });
  }
  /* «Скачать мои данные»: всё, что хранится о профиле, одним JSON — без хэшей пароля и кода
     восстановления (это не данные человека, а замок от них). */
  if (action === 'export') {
    const pid = user.playerId;
    const rec = (await getRecords('tycoon'))[user.login];
    return res.status(200).json({
      exportedAt: new Date().toISOString(),
      account: { ...publicProfile(user), consentAt: user.consentAt || null, pdConsentAt: user.pdConsentAt || null,
        parentConsentAt: user.parentConsentAt || null, parentName: user.parentName || null },
      progress: pid ? await getProfile(pid) : null,
      saves: pid ? { solo: await getSoloSlots(pid), tycoon: await getTycoonSlots(pid) } : null,
      records: rec ? { tycoon: typeof rec === 'string' ? JSON.parse(rec) : rec } : {},
      reports: (await getReports()).filter((r) => r.login === user.login),
    });
  }
  // «Удалить аккаунт и все данные» — только с паролем
  if (action === 'delete') {
    if (!checkPassword(body.password, user)) return res.status(403).json({ error: 'Пароль не подходит' });
    await deleteUserData({ login: user.login, playerId: user.playerId });
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
