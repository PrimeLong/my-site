/* Клиент комнаты: создать, присоединиться, отправить решения, следить за версией. */
const API = '/api/room';
const post = async (payload, url = API) => {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Ошибка сервера');
  return data;
};
export const createRoom = (opts) => post({ action: 'create', ...opts });
export const joinRoom = (id, seat, name) => post({ action: 'join', id, seat, name });
export const submitDecisions = (id, seat, token, decisions, note) =>
  post({ action: 'submit', id, seat, token, decisions, note });
export const cancelSubmission = (id, seat, token) => post({ action: 'unsubmit', id, seat, token });
export const leaveRoom = (id, seat, token) => post({ action: 'leave', id, seat, token });
export const setRoomDifficulty = (id, seat, token, difficulty) => post({ action: 'set_difficulty', id, seat, token, difficulty });
export const sendChatMessage = (id, seat, token, text) => post({ action: 'chat', id, seat, token, text });
export const kickFromRoom = (id, ownerToken, seat) => post({ action: 'kick', id, ownerToken, seat });
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

/* Соло-сохранения: три слота на игрока, целиком на сервере (см. api/solo.js) —
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
export const saveSoloSlot = (playerId, slot, snapshot) =>
  post({ action: 'save', playerId, slot, snapshot }, SOLO_API).then((d) => d.slots);
export const deleteSoloSlot = (playerId, slot) =>
  post({ action: 'delete', playerId, slot }, SOLO_API).then((d) => d.slots);
