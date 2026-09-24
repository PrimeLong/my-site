/* Клиент комнаты: создать, присоединиться, отправить решения, следить за версией. */
const API = '/api/room';
const post = async (payload, url = API) => {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Ошибка сервера');
  return data;
};
export const createRoom = (opts) => post({ action: 'create', ...opts });
// session — токен профиля: место в комнате закрепляется за профилем (см. api/room.js)
export const joinRoom = (id, seat, name, session) => post({ action: 'join', id, seat, name, session });
// president — только для места президента: указы, кадры и указание вместо рычагов
export const submitDecisions = (id, seat, token, decisions, note, portfolioValue, president) =>
  post({ action: 'submit', id, seat, token, decisions, note, portfolioValue, president });
// сообщает стоимость портфеля трейдера отдельно от submit — вызывается после
// каждой сделки, а не только при готовности к следующему кварталу, иначе
// соперник полквартала видел бы устаревшее (или вовсе никакое) значение
export const reportPortfolioValue = (id, seat, token, value) =>
  post({ action: 'report_portfolio', id, seat, token, value });
export const cancelSubmission = (id, seat, token) => post({ action: 'unsubmit', id, seat, token });
export const leaveRoom = (id, seat, token) => post({ action: 'leave', id, seat, token });
export const setRoomDifficulty = (id, seat, token, difficulty) => post({ action: 'set_difficulty', id, seat, token, difficulty });
export const sendChatMessage = (id, seat, token, text) => post({ action: 'chat', id, seat, token, text });
export const kickFromRoom = (id, ownerToken, seat) => post({ action: 'kick', id, ownerToken, seat });
// браузер комнат: открытые общедоступные партии, куда можно войти без кода
export async function listPublicRooms() {
  const r = await fetch(`${API}?${new URLSearchParams({ list: 'public' })}`);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Не удалось получить список комнат');
  return data.rooms || [];
}
export async function fetchRoom(id, since, seat, token) {
  const params = new URLSearchParams({ id });
  if (since) params.set('since', since);
  // seat/token тут только для presence-хартбита (см. api/room.js): сервер отмечает,
  // что это место ещё «на связи», чтобы партнёр видел уход по факту, а не по статусу навечно
  if (seat && token) { params.set('seat', seat); params.set('token', token); }
  const r = await fetch(`${API}?${params.toString()}`);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Комната недоступна');
  return data;
}
/* Опрос сервера: вызывает onRoom при каждом изменении версии */
export function watchRoom(id, onRoom, onError, intervalMs = 2500, seat, token) {
  let version = 0; let stop = false;
  const tick = async () => {
    if (stop) return;
    try {
      const data = await fetchRoom(id, version, seat, token);
      if (data.room) { version = data.room.version; onRoom(data.room); }
    } catch (e) { if (onError) onError(e); }
    if (!stop) setTimeout(tick, intervalMs);
  };
  tick();
  return () => { stop = true; };
}

/* Соло-сохранения: четыре слота на игрока, целиком на сервере (см. api/solo.js) —
   playerId лишь адресует их, в нём самом нет данных партии. */
const SOLO_API = '/api/solo';
export async function fetchSoloSlots(playerId) {
  const r = await fetch(`${SOLO_API}?${new URLSearchParams({ playerId })}`);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Хранилище недоступно');
  return data; // { slots, storage } — storage сообщает, подключён ли Redis (см. api/_lib/store.js)
}
export async function fetchSoloSlot(playerId, slot) {
  const r = await fetch(`${SOLO_API}?${new URLSearchParams({ playerId, slot })}`);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Не удалось загрузить сохранение');
  return data.snapshot;
}
export const saveSoloSlot = (playerId, slot, snapshot, name) =>
  post({ action: 'save', playerId, slot, snapshot, name }, SOLO_API).then((d) => d.slots);
export const renameSoloSlot = (playerId, slot, name) =>
  post({ action: 'rename', playerId, slot, name }, SOLO_API).then((d) => d.slots);
export const deleteSoloSlot = (playerId, slot) =>
  post({ action: 'delete', playerId, slot }, SOLO_API).then((d) => d.slots);

/* Связывание устройств и общий прогресс. Идентификатор профиля (playerId) — это и
   есть «аккаунт»: одно устройство показывает одноразовый код, второе его вводит и
   получает тот же идентификатор. См. api/solo.js. */
export const createLinkCode = (playerId, progress) =>
  post({ action: 'link_create', playerId, progress }, SOLO_API);
export const checkLinkCode = (playerId, code) => post({ action: 'link_status', playerId, code }, SOLO_API);
export const cancelLinkCode = (playerId, code) => post({ action: 'link_cancel', playerId, code }, SOLO_API);
export const claimLinkCode = (playerId, code, progress) =>
  post({ action: 'link_claim', playerId, code, progress }, SOLO_API);
// разрыв связки с любой стороны: устройство забирает копию профиля на новый id
export const revokeLink = (playerId, progress) => post({ action: 'link_revoke', playerId, progress }, SOLO_API);
// слияние прогресса всегда двустороннее: отправляем своё, получаем общее
export const syncProgress = (playerId, progress) =>
  post({ action: 'progress', playerId, progress }, SOLO_API).then((d) => d.profile);

/* Вызов дня: таблица результатов за сутки и отправка своего итога. */
const DAILY_API = '/api/daily';
export async function fetchDailyBoard(day, playerId) {
  const params = new URLSearchParams({ day });
  if (playerId) params.set('playerId', playerId);
  const r = await fetch(`${DAILY_API}?${params.toString()}`);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Таблица недоступна');
  return data; // { day, total, rows, you }
}
export const submitDailyResult = (payload) => post(payload, DAILY_API);

/* «Своё дело»: те же слоты на сервере, но свои (kind: 'tycoon'). */
export async function fetchTycoonSlots(playerId) {
  const r = await fetch(`${SOLO_API}?${new URLSearchParams({ playerId, kind: 'tycoon' })}`);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Хранилище недоступно');
  return data;
}
export async function fetchTycoonSlot(playerId, slot) {
  const r = await fetch(`${SOLO_API}?${new URLSearchParams({ playerId, slot, kind: 'tycoon' })}`);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Не удалось загрузить сохранение');
  return data.snapshot;
}
export const saveTycoonSlot = (playerId, slot, snapshot, name) =>
  post({ action: 'save', kind: 'tycoon', playerId, slot, snapshot, name }, SOLO_API).then((d) => d.slots);
export const deleteTycoonSlot = (playerId, slot) =>
  post({ action: 'delete', kind: 'tycoon', playerId, slot }, SOLO_API).then((d) => d.slots);

/* Профиль игрока: регистрация, вход, изменение имени и значка, выход. */
const ACCOUNT_API = '/api/account';
export const accountRegister = (login, password, name, playerId) => post({ action: 'register', login, password, name, playerId }, ACCOUNT_API);
export const accountLogin = (login, password) => post({ action: 'login', login, password }, ACCOUNT_API);
export const accountMe = (token) => post({ action: 'me', token }, ACCOUNT_API);
export const accountUpdate = (token, patch) => post({ action: 'update', token, ...patch }, ACCOUNT_API);
export const accountPassword = (token, oldPassword, newPassword) => post({ action: 'password', token, oldPassword, newPassword }, ACCOUNT_API);
export const accountLogout = (token) => post({ action: 'logout', token }, ACCOUNT_API);
export const accountRecover = (login, code, newPassword) => post({ action: 'recover', login, code, newPassword }, ACCOUNT_API);
export const accountRecoveryNew = (token, password) => post({ action: 'recovery_new', token, password }, ACCOUNT_API);
