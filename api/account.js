/* Регистрация, вход и профиль игрока. До этого «аккаунтом» был случайный playerId
   устройства, а имя в сетевой партии вводилось заново в каждой комнате — поэтому
   из комнаты можно было выйти и тут же зайти другим «игроком». Теперь у игрока
   есть профиль: логин и пароль, имя, значок и статистика; сетевые места
   закрепляются за профилем (см. api/room.js), а сохранения и достижения идут за
   профилем на любое устройство — playerId профиля становится playerId устройства.
   Почты нет, поэтому забытый пароль восстанавливается кодом, который показывается
   при регистрации один раз (и выдаётся заново в профиле по паролю). */
import { getUser, setUser, setSession, delSession, hasKv, hit, getProfile, getSoloSlots, getTycoonSlots, getRecords, getReports, deleteUserData, setLeagueName, getLeagueNames,
  getUsers, getCards, setCard, getRaces, setRace } from './_lib/store.js';
import { cleanCard, raceStatus, raceOpen, raceRest, MAX_FRIENDS, MAX_PENDING, RACE } from './_lib/friends.js';
import { isRude, RUDE_NAME } from '../src/lib/moderation.js';
import { validBirthYear, isKid, needsParent } from '../src/lib/age.js';
import {
  LOGIN_RE, cleanLogin, hashPassword, checkPassword, newToken, emptyStats, publicProfile, userBySession,
  newRecoveryCode, hashRecovery, checkRecovery, sessionValue, checkName, nameBanned, isBlocked, nameNextAt, nameForOthers, RENAME_DAYS, DAY_MS, NAME_EVERY_DAYS,
} from './_lib/accounts.js';
import { isOwner } from './reports.js';
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
// заблокированному (не сменил запрещённый ник в срок) — только эти действия
const BLOCKED_OK = new Set(['me', 'update', 'logout', 'export', 'delete', 'password', 'recovery_new']);
const BLOCKED_MSG = 'Аккаунт заблокирован: ник нарушает правила. Смените ник — и всё снова откроется.';
// дата по всемирному времени: «25 ноября»
const dayText = (ts) => new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });
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
    const checked = await checkName(user.fails || user.lockLevel ? { ...user, fails: 0, lockLevel: 0, lockUntil: 0 } : user);
    return res.status(200).json({ token, profile: publicProfile(checked), storage: storage() });
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
    return res.status(200).json({ token, profile: publicProfile(await checkName(next)), recoveryCode, storage: storage() });
  }

  // дальше — только со своей сессией; запрещённый ник получает срок на смену (api/_lib/accounts.js)
  const user = await checkName(await userBySession(body.token));
  if (!user) return res.status(401).json({ error: 'Войдите в профиль заново' });
  // срок на смену ника вышел — можно только сменить ник и распорядиться своими данными
  if (isBlocked(user) && !BLOCKED_OK.has(action)) return res.status(403).json({ error: BLOCKED_MSG, blocked: true });

  if (action === 'me') return res.status(200).json({ profile: publicProfile(user), storage: storage() });
  if (action === 'update') {
    const next = { ...user };
    if (isBlocked(user) && Object.keys(body).some((k) => !['action', 'token', 'name'].includes(k))) return res.status(403).json({ error: BLOCKED_MSG, blocked: true });
    if (body.name !== undefined) {
      const n = cleanName(body.name);
      if (!n) return res.status(400).json({ error: 'Имя — от 2 до 24 символов' });
      if (isRude(n)) return res.status(400).json({ error: RUDE_NAME });
      if (n !== user.name) {
        if (user.renameFor && n === user.renameFor) return res.status(400).json({ error: RUDE_NAME });
        const wait = nameNextAt(user);
        if (wait) return res.status(429).json({ error: `Ник можно менять раз в ${NAME_EVERY_DAYS} дней — следующий раз ${dayText(wait)}`, nameNextAt: wait });
        next.name = n;
        // прежний ник был запрещён — смена не тратит месячную попытку
        if (!nameBanned(user)) next.nameAt = Date.now();
        delete next.renameBy; delete next.renameFor;
      }
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
    /* «Показывать моё имя в лигах» — только с 16 лет; имя уходит в общий список имён лиг
       (другие ученики могут увидеть его на месте бота, с выдуманным опытом) */
    if (body.leaguePublic !== undefined) {
      if (typeof body.leaguePublic !== 'boolean') return res.status(400).json({ error: 'Некорректная настройка' });
      if (body.leaguePublic && (!next.birthYear || isKid(next.birthYear))) return res.status(403).json({ error: 'Показывать имя в лигах можно с 16 лет' });
      next.leaguePublic = body.leaguePublic;
    }
    await setUser(user.login, next);
    if (next.leaguePublic || user.leaguePublic) await setLeagueName(user.login, next.leaguePublic && !nameBanned(next) ? next.name : null);
    return res.status(200).json({ profile: publicProfile(next) });
  }
  /* Владелец требует сменить ник, который фильтр пропустил: у ученика RENAME_DAYS дней, потом блок.
     Ник, сменённый на тот же самый, не проходит (user.renameFor). */
  if (action === 'require-rename') {
    if (!isOwner(user)) return res.status(403).json({ error: 'Только для владельцев' });
    const login = cleanLogin(body.login);
    const target = LOGIN_RE.test(login) ? await getUser(login) : null;
    if (!target) return res.status(404).json({ error: 'Нет такого ученика' });
    const renameBy = target.renameBy && nameBanned(target) ? target.renameBy : Date.now() + RENAME_DAYS * DAY_MS;
    await setUser(login, { ...target, renameFor: target.name, renameBy });
    if (target.leaguePublic) await setLeagueName(login, null);
    return res.status(200).json({ ok: true, login, name: target.name, renameBy });
  }
  // имена учеников, разрешивших показ в лигах: до тридцати случайных, без своего и без грубых
  if (action === 'league-names') {
    const all = Object.entries(await getLeagueNames()).filter(([login, name]) => login !== user.login && typeof name === 'string' && !isRude(name)).map(([, name]) => name);
    for (let i = all.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    return res.status(200).json({ names: all.slice(0, 30) });
  }
  /* ------------------------------ ДРУЗЬЯ И ЗАБЕГИ ------------------------------
     Друзья — по точному логину и с согласия второй стороны (заявка → принять/отклонить); поиска
     по всем ученикам нет. Друг видит только карточку: имя, значок и то, что собрал клиент
     (api/_lib/friends.js). user.friends { логин: с какого времени }, fin / fout — входящие и
     исходящие заявки, races — id забегов. */
  if (action === 'card') {
    if (await hit(`card:${user.login}`, 60) > 20) return res.status(429).json({ error: 'Слишком часто' });
    await setCard(user.login, { ...cleanCard(body.card), at: Date.now() });
    return res.status(200).json({ ok: true });
  }
  if (action === 'friends') return res.status(200).json(await friendsView(user));
  if (action === 'friend-add') {
    const to = cleanLogin(body.login);
    if (!LOGIN_RE.test(to)) return res.status(400).json({ error: 'Логин: латинские буквы, цифры и «_», от 3 до 20' });
    if (to === user.login) return res.status(400).json({ error: 'Это ваш собственный логин' });
    if (await hit(`fadd:${user.login}`, 3600) > 30) return res.status(429).json({ error: 'Слишком много заявок — попробуйте через час' });
    const other = await getUser(to);
    if (!other) return res.status(404).json({ error: 'Ученика с таким логином нет' });
    const me = links(user); const them = links(other);
    if (me.friends[to]) return res.status(200).json({ status: 'friends', ...(await friendsView(user)) });
    if (Object.keys(me.friends).length >= MAX_FRIENDS || Object.keys(them.friends).length >= MAX_FRIENDS) return res.status(400).json({ error: `Друзей — не больше ${MAX_FRIENDS}` });
    const now = Date.now();
    // встречная заявка — сразу друзья
    if (me.fin[to] || them.fout[user.login]) {
      const u = await save(user, { friends: { ...me.friends, [to]: now }, fin: without(me.fin, to), fout: without(me.fout, to) });
      await save(other, { friends: { ...them.friends, [user.login]: now }, fin: without(them.fin, user.login), fout: without(them.fout, user.login) });
      return res.status(200).json({ status: 'friends', ...(await friendsView(u)) });
    }
    if (Object.keys(me.fout).length >= MAX_PENDING || Object.keys(them.fin).length >= MAX_PENDING) return res.status(400).json({ error: 'Слишком много заявок ждут ответа' });
    const u = await save(user, { fout: { ...me.fout, [to]: now } });
    await save(other, { fin: { ...them.fin, [user.login]: now } });
    return res.status(200).json({ status: 'sent', ...(await friendsView(u)) });
  }
  if (action === 'friend-answer' || action === 'friend-cancel' || action === 'friend-remove') {
    const who = cleanLogin(body.login);
    const other = LOGIN_RE.test(who) ? await getUser(who) : null;
    const me = links(user); const them = other ? links(other) : null;
    const now = Date.now();
    let mine = {}; let theirs = {};
    if (action === 'friend-answer') {
      if (!me.fin[who]) return res.status(404).json({ error: 'Заявки нет' });
      const yes = body.accept === true && !!other;
      mine = { fin: without(me.fin, who), ...(yes ? { friends: { ...me.friends, [who]: now } } : {}) };
      if (them) theirs = { fout: without(them.fout, user.login), ...(yes ? { friends: { ...them.friends, [user.login]: now } } : {}) };
    } else if (action === 'friend-cancel') {
      mine = { fout: without(me.fout, who) };
      if (them) theirs = { fin: without(them.fin, user.login) };
    } else {
      mine = { friends: without(me.friends, who) };
      if (them) theirs = { friends: without(them.friends, user.login) };
      // забег с бывшим другом, ещё не начатый, отменяется
      const races = await getRaces(me.races);
      for (const r of races.filter((x) => [x.from, x.to].includes(who) && raceStatus(x, now) === 'pending')) await setRace({ ...r, status: 'cancelled' });
    }
    const u = await save(user, mine);
    if (other) await save(other, theirs);
    return res.status(200).json(await friendsView(u));
  }
  // пауза между забегами — словами: «через 2 дня»
  const restWhy = (rest, friend = false) => {
    const n = Math.max(1, Math.ceil((rest.until - Date.now()) / 86400000));
    const days = `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'день' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'дня' : 'дней'}`;
    if (friend) return `У друга идёт забег или отдых после него — позовите через ${days}`;
    if (rest.why === 'busy') return 'У вас уже идёт забег — следующий можно после финиша';
    if (rest.why === 'same') return `С одним другом забег — раз в неделю: снова можно через ${days}`;
    return `После забега — три дня отдыха: следующий можно через ${days}`;
  };
  if (action === 'race-invite') {
    const to = cleanLogin(body.login);
    const me = links(user);
    if (!me.friends[to]) return res.status(400).json({ error: 'Позвать на забег можно только друга' });
    const other = await getUser(to);
    if (!other) return res.status(404).json({ error: 'Ученика с таким логином нет' });
    const now = Date.now();
    if (Number(me.friends[to]) > now - RACE.friendMs) return res.status(400).json({ error: 'Позвать на забег можно через сутки дружбы' });
    const races = await getRaces(me.races);
    if (races.some((r) => [r.from, r.to].includes(to) && raceOpen(r, now))) return res.status(400).json({ error: 'С этим другом забег уже идёт или ждёт ответа' });
    if (races.filter((r) => r.from === user.login && raceStatus(r, now) === 'pending').length >= RACE.maxOpen) return res.status(400).json({ error: 'Подождите ответа на прошлые приглашения' });
    // пауза: идёт свой забег, три дня после финиша, неделя с тем же другом — и у друга тоже
    const mine = raceRest(races, user.login, to, now);
    if (mine) return res.status(400).json({ error: restWhy(mine) });
    const theirs = raceRest(await getRaces(links(other).races), to, user.login, now);
    if (theirs) return res.status(400).json({ error: restWhy(theirs, true) });
    if (await hit(`race:${user.login}`, 86400) > 10) return res.status(429).json({ error: 'Сегодня приглашений уже достаточно' });
    const race = { id: randomUUID().replace(/-/g, '').slice(0, 16), from: user.login, to, at: now, status: 'pending', days: RACE.days };
    await setRace(race);
    const u = await save(user, { races: [race.id, ...me.races].slice(0, RACE.keep) });
    const them = links(other);
    await save(other, { races: [race.id, ...them.races].slice(0, RACE.keep) });
    return res.status(200).json(await friendsView(u));
  }
  if (action === 'race-answer') {
    const me = links(user);
    const [race] = typeof body.id === 'string' && me.races.includes(body.id) ? await getRaces([body.id]) : [];
    if (!race || race.to !== user.login) return res.status(404).json({ error: 'Приглашения нет' });
    const st = raceStatus(race);
    if (st !== 'pending') return res.status(400).json({ error: st === 'expired' ? 'Сутки на ответ уже прошли' : 'На приглашение уже ответили' });
    // принять нельзя посреди своего забега и в паузу после него (пока приглашение ждало, мог начаться другой)
    if (body.accept === true) {
      const rest = raceRest(await getRaces(me.races), user.login, race.from, Date.now());
      if (rest) return res.status(400).json({ error: restWhy(rest) });
    }
    /* день старта — сегодня по всемирному времени (один часовой пояс на всё, src/textbook/learn-state.js):
       день, присланный устройством, не берём — иначе переводом часов можно было сдвинуть забег */
    const start = new Date(Date.now()).toISOString().slice(0, 10);
    /* опыт, набранный в день старта до принятия, в забег не идёт: у принявшего — из его прогресса
       (base), у пригласившего — из его карточки на этот день. Раньше утренний опыт уже стоял в счёте */
    let base = null;
    if (body.accept === true) {
      const fromCard = (await getCards([race.from]))[race.from];
      const theirs = fromCard && fromCard.xpDays ? Number(fromCard.xpDays[start]) || 0 : 0;
      const mine = Number.isFinite(Number(body.base)) ? Math.max(0, Math.min(5000, Math.round(Number(body.base)))) : 0;
      base = { [race.to]: mine, [race.from]: Math.max(0, Math.min(5000, Math.round(theirs))) };
    }
    await setRace(body.accept === true ? { ...race, status: 'active', acceptedAt: Date.now(), start, base } : { ...race, status: 'declined', answeredAt: Date.now() });
    return res.status(200).json(await friendsView(user));
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
      friends: Object.keys(links(user).friends), card: (await getCards([user.login]))[user.login] || null,
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

// связи профиля — с пустыми значениями по умолчанию
function links(u) {
  const m = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  return { friends: m(u.friends), fin: m(u.fin), fout: m(u.fout), races: Array.isArray(u.races) ? u.races.filter((x) => typeof x === 'string').slice(0, RACE.keep) : [] };
}
const without = (map, key) => { const out = { ...map }; delete out[key]; return out; };
// перечитываем профиль перед записью: между чтением и записью он мог поменяться (вход, другая заявка)
async function save(user, patch) {
  const fresh = (await getUser(user.login)) || user;
  const next = { ...fresh, ...patch };
  await setUser(user.login, next);
  return next;
}
// грубый или запрещённый ник другим не показываем — вместо него логин
const friendOut = (login, u, card) => ({ login, name: nameBanned(u) ? nameForOthers(null, login) : nameForOthers(u.name || login, login), emblem: u.emblem || 'star', card: card || null });
/* Что видит ученик: друзья с карточками, заявки, забеги. Удалённые профили выпадают сами. */
async function friendsView(user) {
  const me = links(user);
  const now = Date.now();
  const races = (await getRaces(me.races)).map((r) => ({ ...r, status: raceStatus(r, now) })).filter((r) => r.status !== 'cancelled');
  const logins = [...new Set([...Object.keys(me.friends), ...Object.keys(me.fin), ...Object.keys(me.fout), ...races.flatMap((r) => [r.from, r.to])])].filter((l) => l !== user.login);
  const users = await getUsers(logins);
  const cards = await getCards([...Object.keys(me.friends), ...Object.keys(me.fin), ...Object.keys(me.fout)].filter((l) => users[l]));
  // в заявках — только наряд Инфли (серия и опыт — когда станете друзьями): Инфля в заявке одета как у человека
  const wearOnly = (l) => (cards[l] && cards[l].wear ? { wear: cards[l].wear } : null);
  return {
    me: user.login,
    friends: Object.entries(me.friends).filter(([l]) => users[l]).map(([l, since]) => ({ ...friendOut(l, users[l], cards[l]), since })).sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    incoming: Object.entries(me.fin).filter(([l]) => users[l]).map(([l, at]) => ({ ...friendOut(l, users[l], wearOnly(l)), at })).sort((a, b) => b.at - a.at),
    outgoing: Object.entries(me.fout).filter(([l]) => users[l]).map(([l, at]) => ({ ...friendOut(l, users[l], wearOnly(l)), at })).sort((a, b) => b.at - a.at),
    races: races.filter((r) => users[r.from === user.login ? r.to : r.from]).map((r) => {
      const other = r.from === user.login ? r.to : r.from;
      const base = r.base || {};
      return { ...r, other, mine: r.from === user.login, baseMine: base[user.login] || 0, baseTheirs: base[other] || 0 };
    }),
  };
}

export default async function handler(req, res) {
  try {
    return await handleRequest(req, res);
  } catch (err) {
    console.error('account handler error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
