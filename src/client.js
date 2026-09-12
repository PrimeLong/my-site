/* Клиент комнаты: создать, присоединиться, отправить решения, следить за версией. */
const API = '/api/room';
const post = async (payload) => {
  const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Ошибка сервера');
  return data;
};
export const createRoom = (opts) => post({ action: 'create', ...opts });
export const joinRoom = (id, seat, name) => post({ action: 'join', id, seat, name });
export const submitDecisions = (id, seat, token, decisions, note) =>
  post({ action: 'submit', id, seat, token, decisions, note });
export const cancelSubmission = (id, seat, token) => post({ action: 'unsubmit', id, seat, token });
export async function fetchRoom(id, since) {
  const r = await fetch(`${API}?id=${encodeURIComponent(id)}${since ? `&since=${since}` : ''}`);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Комната недоступна');
  return data;
}
/* Опрос сервера: вызывает onRoom при каждом изменении версии */
export function watchRoom(id, onRoom, onError, intervalMs = 2500) {
  let version = 0; let stop = false;
  const tick = async () => {
    if (stop) return;
    try {
      const data = await fetchRoom(id, version);
      if (data.room) { version = data.room.version; onRoom(data.room); }
    } catch (e) { if (onError) onError(e); }
    if (!stop) setTimeout(tick, intervalMs);
  };
  tick();
  return () => { stop = true; };
}
